// @ts-nocheck
import { useState, useEffect, useMemo, useCallback, useRef, cloneElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Quote, QuoteStatus, ColumnConfig } from '@/app/types/quote';
import { KanbanView, BoardColumnConfigSidebar } from '@/app/components/KanbanView';
import { ImportWizardModal } from '@/app/components/import/ImportWizardModal';
import { IMPORT_EXPORT_ENABLED } from '@/app/config/featureFlags';
import type { ExportRecord } from '@/app/components/import/importExport';
import { ExportRecordsModal } from '@/app/components/import/ExportRecordsModal';
import { materializeQuote } from '@/app/components/import/importMaterialize';
import { ImportNoticeBanner, setImportNotice, dismissImportNotice, useImportNotice } from '@/app/components/import/importNotice';
import { CreateQuoteModal, QuoteDraft } from '@/app/components/CreateQuoteModal';
import { HighlightText } from '@/app/components/HighlightText';
import { AssignSalesRepModal } from '@/app/components/modals/AssignSalesRepModal';
import { StatusBadge } from '@/app/components/StatusBadge';
import { PriorityBadge } from '@/app/components/PriorityBadge';
import { VersionBadge } from '@/app/components/VersionBadge';
import {
  CustomerCellRich,
  PocCellRich,
  SalesRepCellRich,
  DeliveryLocationCell,
  EmptyPersonCell,
} from '@/app/components/shared/ListingCells';
import { FIELD_RULES, getMissingFields, joinLabels } from '@/app/components/shared/fieldRequirements';
import { VersionHistoryModal } from '@/app/components/VersionHistoryModal';
import { PDFPreviewModal } from '@/app/components/quote-details/PDFPreviewModal';
import { StatusTransitionOverlay, type CustomActionConfig } from '@/app/components/quote-details/StatusTransitionOverlay';
import { CancelQuoteModal } from '@/app/components/quote-details/CancelQuoteModal';
import { ArchiveQuoteModal } from '@/app/components/quote-details/ArchiveQuoteModal';
import { mockQuotes } from '@/app/data/mockQuotes';
import { CURRENT_USER_REP } from '@/app/components/shared/salesRepRoster';
import { addCreatedQuote, setCreatedQuoteAdjustments, getAllCreatedQuotes, getCreatedQuote, applyQuoteOverride, subscribeQuoteStatusOverrides } from '@/app/data/quoteStore';
import { duplicateQuote } from '@/app/data/duplicateQuote';
import { DuplicateQuoteModal } from '@/app/components/quote-details/DuplicateQuoteModal';
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
} from '@/app/components/quotes/KpiInsightsPanel';
import {
  QuoteFiltersModal,
  DEFAULT_QUOTE_FILTERS,
  countActiveQuoteFilters,
  quoteMatchesAdvancedFilters,
  type QuoteAdvancedFilters,
} from '@/app/components/quotes/FiltersModal';
import { DatePickerField } from '@/app/components/quote-creation/date-picker-field';
import { InsightsRangeMenu, InsightsRefresh, type InsightsRange } from '@/app/components/shared/InsightsControls';
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
  Search, X, Plus, MoreHorizontal, Eye, Archive, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, AlignJustify, List,
  LayoutGrid, Check, ChevronDown, User, SlidersHorizontal, GripVertical, ChartColumn,
  Calendar, Clock, BarChart3, FileText, Copy, Printer, Download, ExternalLink, Link2, Upload,
  Trash2, Info, FileDown, Send, CheckCircle, ArchiveRestore, Maximize2, Minimize2, Layers,
  Package, AlertTriangle, Ban, Mail, Phone,
} from 'lucide-react';
import { OverflowTooltip } from '@/app/components/shared/OverflowTooltip';
import { FilterPill as SharedFilterPill } from '@/app/components/shared/FilterPill';
import { FiltersButton as SharedFiltersButton } from '@/app/components/shared/FiltersButton';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/app/components/ui/hover-card';
import { Avatar } from '@/app/components/shared/Avatar';
import { QuickViewPanel, type QuickViewData } from '@/app/components/shared/QuickViewPanel';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import { getAvatarTint as getDiverseAvatarTint } from '@/app/utils/avatarTints';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/app/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/app/components/ui/tooltip';
import { format } from 'date-fns';

type DensityOption = 'condensed' | 'comfort' | 'board';
type QuickFilter = 'all' | 'draft' | 'sent' | 'confirmed_customer' | 'converted' | 'expired' | 'rejected' | 'cancelled' | 'archived';
/* The state-pill row supports multi-select: the user can toggle any
   combination of these active-state pills and the list ORs across
   them. "Show All" and "Archived" are mutually exclusive with the
   active-state set — "Show All" is the empty selection, "Archived"
   is its own bucket (we hide archived records by default). */
type ActiveStateKey = Exclude<QuickFilter, 'all' | 'archived'>;

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
  { key: 'rejected', label: 'Rejected', showCount: true },
  { key: 'cancelled', label: 'Cancelled', showCount: true },
];

/* ─── Column configuration ─── */
/* Widths sized to each column's content so the label/value never
   crops. Status badge sits at 180px to host the longest pill copy
   ("Confirmed by Customer"). Items column drops to 220px because
   the thumb + code + "+N more" pill never exceeds ~200px even in
   relaxed mode — the previous 260 left a visible gap of whitespace
   on every row. Quote No anchors at 260 since it has to host both
   the number and the version badge plus an optional description
   line in relaxed mode. */
const COLUMN_DEFS: (ColSelectorConfig & { minWidth: string; sortable?: boolean; align?: 'left' | 'right' })[] = [
  { key: 'quoteNumber', label: 'Quote No', minWidth: '260px', sortable: true },
  { key: 'customer', label: 'Customer Name', minWidth: '210px', sortable: true },
  { key: 'primaryPoC', label: 'Point of Contact', minWidth: '210px', sortable: true },
  { key: 'status', label: 'Status', minWidth: '180px', sortable: true },
  // Items column — Partner v7 parity. Renders a thumbnail + the first item
  // code + "+N more" overflow tooltip with all other items. Items are
  // derived deterministically from the quote ID so the column reads as
  // stable mock data; in production this would come from the quote's line
  // items. No warehouse column — items belong to the quote, allocation to
  // a specific warehouse happens in the Sales Order.
  { key: 'items', label: 'Line Items', minWidth: '220px', sortable: true },
  { key: 'totalValue', label: 'Quote Value', minWidth: '130px', sortable: true, align: 'right' },
  { key: 'deliveryLocation', label: 'Delivery Location', minWidth: '180px', sortable: true },
  { key: 'requestedDate', label: 'Requested On', minWidth: '120px', sortable: true },
  { key: 'respondBy', label: 'Respond By', minWidth: '120px', sortable: true },
  { key: 'expiryDate', label: 'Expiration Date', minWidth: '140px', sortable: true },
  { key: 'confirmationDate', label: 'Confirmed', minWidth: '120px', sortable: true },
  { key: 'salesRep', label: 'Sales Rep', minWidth: '180px', sortable: true },
  { key: 'priority', label: 'Priority', minWidth: '100px', sortable: true },
  /* Tags — chips + "+N more" overflow. Draws on `quote.tags` which
     the mock generator seeds off `TAGS` in `data/mockQuotes.ts`. */
  { key: 'tags', label: 'Tags', minWidth: '200px' },
  /* Audit-trail columns — Created On / By, Last Updated / By — sit at
     the tail of the grid, right before the action affordances. Kept
     as a pair so users read them together. Avatar + PersonHoverCard
     reveals email / phone / dept on hover, matching Partner
     Management's Last-Updated pattern. */
  { key: 'createdDate', label: 'Created On', minWidth: '120px', sortable: true },
  { key: 'createdBy', label: 'Created By', minWidth: '180px', sortable: true },
  { key: 'lastUpdatedDate', label: 'Last Updated On', minWidth: '120px', sortable: true },
  { key: 'lastUpdatedBy', label: 'Last Updated By', minWidth: '180px', sortable: true },
  /* Rejected On / Rejected By — audit trail for the Rejected state.
     Hidden by default (see `HIDDEN_BY_DEFAULT_COLUMNS` below); the
     user opts them in via the column configurator when they need to
     surface rejection metadata on the listing. Sits at the tail
     because these are audit-trail columns, not primary listing
     signals. */
  { key: 'rejectedAt', label: 'Rejected On', minWidth: '150px', sortable: true },
  { key: 'rejectedBy', label: 'Rejected By', minWidth: '180px' },
];

/* Columns opted-out of the default listing view. Users can toggle
   them on via the column configurator (both grid + kanban). */
const HIDDEN_BY_DEFAULT_COLUMNS = new Set<string>(['rejectedAt', 'rejectedBy']);

const CURRENT_USER_NAME = CURRENT_USER_REP.name;

/* Returns true when the signed-in user is the primary or an
   additional sales rep on the quote. */
function isQuoteSalesRepMe(q: Quote): boolean {
  const primary = typeof q.salesRep === 'string' ? q.salesRep : (q.salesRep as any)?.name || '';
  if (primary === CURRENT_USER_NAME) return true;
  const extras = (q as any).additionalSalesReps as { name?: string }[] | undefined;
  if (Array.isArray(extras)) return extras.some(r => r?.name === CURRENT_USER_NAME);
  return false;
}

/* True when the signed-in user created the quote. V1's author is the
   originator on the version timeline, so we use that as the creator
   signal. */
function isQuoteCreatedByMe(q: Quote): boolean {
  const versions = (q as any).versions as { version?: number; author?: string }[] | undefined;
  if (Array.isArray(versions)) {
    const v1 = versions.find(v => v?.version === 1);
    if (v1?.author === CURRENT_USER_NAME) return true;
  }
  return false;
}

function isQuoteMine(q: Quote): boolean {
  return isQuoteSalesRepMe(q) || isQuoteCreatedByMe(q);
}

/* Reason string surfaced in the row badge's tooltip so the user sees
   why their row was flagged. Names the role explicitly so the badge
   is never read as a generic "assigned" marker. */
function mineReason(createdByMe: boolean, salesRepMe: boolean): string {
  if (createdByMe && salesRepMe) return "You created this quote and are assigned as a sales representative on it";
  if (createdByMe) return "You created this quote";
  return "You're assigned as a sales representative on this quote";
}

const DEFAULT_COLUMN_ORDER = COLUMN_DEFS.map(c => c.key);
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  COLUMN_DEFS.map(c => [c.key, !HIDDEN_BY_DEFAULT_COLUMNS.has(c.key)]),
);
const LOCKED_COLUMNS = ['quoteNumber'];
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(COLUMN_DEFS.map(c => [c.key, parseInt(c.minWidth, 10)]));
const MIN_COL_WIDTH = 1;
const CHECKBOX_COL_WIDTH = 40;

const DND_LIST_KPI = 'LIST_KPI_CARD';

/* ISO ↔ Date helpers — used by the Kanban Custom Range picker so we
   can hand DatePickerField a Date object while keeping the canonical
   `yyyy-MM-dd` string in state. Same shape as ShipmentMethodModal. */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromIsoDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/* ─── Avatar tints — use PM-V's diverse palette for parity ─── */
function getAvatarTint(name: string) {
  const t = getDiverseAvatarTint(name || '');
  return { bg: t.bg, text: t.fg };
}

/* ─── People rosters + contact-detail helper ───
   `CREATED_BY` / `LAST_UPDATED_BY` seed the two person columns with
   a small, deterministic pool of team members. `getContactDetails`
   derives role / dept / email / phone from a name via a stable hash
   so the PersonHoverCard shows consistent info for the same name
   across rows (matches SO listing's helper `getContactDetails`). */
const CREATED_BY = [
  "Emily Chen", "Adrian User", "System Import", "Marcus Taylor",
  "Adrian User", "David Park", "Emily Chen", "Emily Chen",
  "System Import", "Marcus Taylor", "James Rodriguez", "Emily Chen",
];
const LAST_UPDATED_BY = [
  "Sarah Chen", "James Wilson", "Emily Torres", "Marcus Taylor",
  "David Park", "Maria Garcia", "James Rodriguez", "Adrian User",
  "Emily Chen", "Sarah Chen", "David Park", "James Wilson",
];
function getContactDetails(name: string): { role: string; dept: string; email: string; phone: string } {
  if (!name) return { role: "", dept: "", email: "", phone: "" };
  const h = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const depts = ["Sales", "Operations", "Finance", "Procurement", "Customer Success", "Engineering"];
  const roles = ["Manager", "Director", "Lead", "Specialist", "Coordinator", "Analyst"];
  const dept = depts[h % depts.length];
  const role = `${dept} ${roles[(h * 7) % roles.length]}`;
  const [first, last = "user"] = name.toLowerCase().split(" ");
  const email = `${first}.${last}@company.com`;
  const phone = `(${300 + (h % 700)}) ${100 + (h % 900)}-${1000 + (h % 9000)}`;
  return { role, dept, email, phone };
}

/* Person-column derivation is keyed off `quote.id` (see the module's
   own `hashString` further down) so sort order is preserved when the
   user re-sorts the grid — a row's assignee stays stable regardless
   of position. */
function pickCreatedBy(quote: Quote): string {
  return CREATED_BY[hashString(quote.id) % CREATED_BY.length];
}
function pickLastUpdatedBy(quote: Quote): string {
  return LAST_UPDATED_BY[(hashString(quote.id) + 3) % LAST_UPDATED_BY.length];
}

/* Deterministic Last-Updated date derived from the quote's own
   `lastUpdated` if present, otherwise built off createdDate + a
   quote-id-hash offset so cells vary but stay stable across sorts. */
function pickLastUpdatedDate(quote: Quote): string {
  const canonical = (quote as unknown as { lastUpdated?: string }).lastUpdated;
  if (canonical) return canonical;
  const base = quote.createdDate ? new Date(quote.createdDate) : new Date();
  const bumpDays = (hashString(quote.id) % 28) + 1;
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + bumpDays);
  return d.toISOString().slice(0, 10);
}

/* ─── DraggableListKpiCard — matches PM-V exactly ─── */
function DraggableListKpiCard({ index, kpiKey, label, value, iconName, tooltip, moveCard, onRemove }: {
  index: number; kpiKey: string; label: string; value: string; iconName: string; tooltip?: string; moveCard: (from: number, to: number) => void; onRemove?: () => void;
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
    return <div ref={ref} className="rounded-lg border border-dashed border-primary/20 bg-primary/[0.02] min-h-[52px] pointer-events-none" />;
  }

  return (
    <div ref={ref}
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none overflow-hidden cursor-grab active:cursor-grabbing ${
        isOver
          ? "border-primary/30 bg-primary/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]"
          : "border-border hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      }`}>
      {isOver && <div className="absolute inset-0 rounded-lg bg-primary/[0.02] pointer-events-none" />}
      <div className="px-3 py-2">
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-muted rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-slate-500" />
        </div>
        {/* Label row: label + info + icon (right) */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10.5px] text-slate-500 whitespace-nowrap" style={{ fontWeight: 500 }}>{label}</p>
            {tooltip && (
              /* Portal-rendered Radix tooltip — escapes the card's
                 `overflow:hidden` clip so the hover-card is never cut
                 off at the card boundary. Visual styling kept identical
                 to the prior inline implementation (white surface,
                 muted-foreground copy). */
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex shrink-0"
                      tabIndex={-1}
                      onClick={e => e.stopPropagation()}
                    >
                      <Info className="w-3 h-3 text-slate-300 hover:text-slate-400 transition-colors cursor-help" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="bg-white text-muted-foreground border border-border rounded-lg px-3 py-2 shadow-md text-[11px] max-w-[260px] whitespace-normal"
                    style={{ lineHeight: 1.55 }}
                  >
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {iconName && <KpiIcon name={iconName} className="w-3.5 h-3.5 shrink-0" style={{ color: '#94A3B8' }} />}
        </div>
        {/* Value — slate-700 like PM-V (softer than --foreground) */}
        <div className="flex items-baseline gap-1.5">
          <p className="text-[15px] text-slate-700 tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</p>
        </div>
      </div>
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
          title={`Remove ${label}`}>
          <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Items cell helpers — Partner v7 parity.

   The quote mock data doesn't carry item codes, so we derive a stable set
   from the quote ID hash. Same approach as Partner's vendor.itemCodes —
   keeps the column reading as real data without needing to backfill mocks.
   ────────────────────────────────────────────────────────────────────── */
const ITEM_CODE_POOL = [
  '000-100-001', '000-100-002', '000-100-026', '000-100-041', '000-100-049',
  '000-100-059', '000-100-079', '000-100-171', '000-100-175', '501-100-001',
  '501-100-002', '501-100-003', '501-100-004', '501-100-005', '501-100-006',
];
const ITEM_DESCRIPTIONS = [
  'E-450 stripped chassis, dual rear wheels',
  'Cutaway-mount modular body kit',
  'P25 Phase II mobile radio, AES-256',
  'Powered hydraulic stretcher, 700 lb',
  '3000W pure-sine power inverter',
  'Linear super-LED light bar',
  '54" full-size LED light bar, RGB',
  'Auto-eject shoreline, 30A',
  'ProMaster 3500 extended chassis',
  'Ambulance prep package, body wiring',
];
const ITEM_THUMB_BG = ['#FDE8E8', '#FEF3C7', '#DBEAFE', '#E0E7FF', '#D1FAE5', '#FCE7F3', '#E5E7EB'];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

const ITEM_CATEGORIES = ['Component', 'Assembly', 'Consumable', 'Finished Good', 'Raw Material'];
const ITEM_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock', 'On Order'];
const ITEM_STATUS_TOKENS: Record<string, { bg: string; fg: string }> = {
  'In Stock': { bg: '#F0FDF4', fg: '#166534' },
  'Low Stock': { bg: '#FFFBEB', fg: '#92400E' },
  'Out of Stock': { bg: '#FEF2F2', fg: '#991B1B' },
  'On Order': { bg: '#EFF6FF', fg: '#1E40AF' },
};

interface MockItem {
  code: string;
  description: string;
  thumbBg: string;
  category: string;
  onHand: number;
  unitPrice: number;
  status: string;
}

/* A quote that actually carries line items (created in-app, or brought
   in by the legacy importer) shows its own items; the hash fallback below
   exists only because the mock catalogue has none. Without this an
   imported quote listed invented codes next to its real total. */
function deriveQuoteItems(quoteId: string, quote?: Quote): MockItem[] {
  if (quote?.items && quote.items.length > 0) {
    return quote.items.map((li, i) => ({
      code: li.productId || li.name,
      description: li.description || li.name,
      thumbBg: ITEM_THUMB_BG[i % ITEM_THUMB_BG.length],
      category: ITEM_CATEGORIES[i % ITEM_CATEGORIES.length],
      onHand: 0,
      unitPrice: li.unitPrice,
      status: ITEM_STATUSES[0],
    }));
  }
  const seed = hashString(quoteId);
  const count = 3 + (seed % 6); // 3-8 items per quote
  const start = seed % ITEM_CODE_POOL.length;
  return Array.from({ length: count }, (_, i) => {
    const idx = (start + i) % ITEM_CODE_POOL.length;
    const descIdx = (seed + i) % ITEM_DESCRIPTIONS.length;
    const bgIdx = (seed + i) % ITEM_THUMB_BG.length;
    const catIdx = (seed + i * 3) % ITEM_CATEGORIES.length;
    const statusIdx = (seed + i * 7) % ITEM_STATUSES.length;
    return {
      code: ITEM_CODE_POOL[idx],
      description: ITEM_DESCRIPTIONS[descIdx],
      thumbBg: ITEM_THUMB_BG[bgIdx],
      category: ITEM_CATEGORIES[catIdx],
      onHand: 100 + ((seed * 13 + i * 211) % 15000),
      unitPrice: 10 + ((seed * 7 + i * 37) % 500),
      status: ITEM_STATUSES[statusIdx],
    };
  });
}

export function QuotesListPage() {
  const navigate = useNavigate();
  /* Outcome of the last import, on the listing where the records landed.
     Survives navigating away and back, and clears on its own X. */
  const importNotice = useImportNotice();
  /* Export runs through UAC's export modal: pick a format, pick the columns. */
  const [exportOpen, setExportOpen] = useState(false);
  const [exportRows, setExportRows] = useState<ExportRecord[]>([]);
  /* Seed from the mock catalogue AND the module-level `createdQuotes`
     store so quotes created during this session survive an in-app
     navigation to another route and back. Only a hard refresh
     (which tears down the JS module cache) wipes them; that's the
     contract the user expects. */
  const [quotes, setQuotes] = useState<Quote[]>(() =>
    [...getAllCreatedQuotes(), ...mockQuotes].map(applyQuoteOverride),
  );
  /* Re-derive the list whenever the runtime override registry mutates
     (e.g. someone rejects a quote from the detail page and comes back
     to the listing — status pill should be Rejected without a reload). */
  useEffect(() => {
    return subscribeQuoteStatusOverrides(() => {
      setQuotes([...getAllCreatedQuotes(), ...mockQuotes].map(applyQuoteOverride));
    });
  }, []);
  const [density, setDensity] = useState<DensityOption>('condensed');
  const [searchQuery, setSearchQuery] = useState('');
  /* Multi-select status filter. Empty set + archived off = "Show All".
     Toggling a state pill adds/removes it from the set. Toggling
     Archived flips its own boolean; if turning it on we also clear
     the active-state set so the two surfaces stay mutually exclusive
     (archived records aren't returned by the state-pill query). */
  const [activeStates, setActiveStates] = useState<Set<ActiveStateKey>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const showAll = activeStates.size === 0 && !showArchived;
  const toggleActiveState = useCallback((key: ActiveStateKey) => {
    setShowArchived(false);
    setActiveStates(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setCurrentPage(1);
    setSelectedRows(new Set());
  }, []);
  const selectShowAll = useCallback(() => {
    setActiveStates(new Set());
    setShowArchived(false);
    setCurrentPage(1);
    setSelectedRows(new Set());
  }, []);
  const toggleArchived = useCallback(() => {
    setShowArchived(prev => {
      const next = !prev;
      if (next) setActiveStates(new Set());
      return next;
    });
    setCurrentPage(1);
    setSelectedRows(new Set());
  }, []);
  const [meMode, setMeMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const contentRef = useRef<HTMLDivElement>(null);

  // Modals
  const [isCreateQuoteModalOpen, setIsCreateQuoteModalOpen] = useState(false);

  /* Legacy import / export. The importer builds one quote per group of
     rows in the file and hands back what it created; the listing folds
     those in so the run is visible without a reload. */
  const [importOpen, setImportOpen] = useState(false);
  const handleExport = useCallback(() => {
    const rows = quotes.map((q) => ({
      values: {
        quoteNo: q.quoteNumber,
        customerName: q.customer,
        quoteStatus: q.status,
        currencyCode: 'USD',
        requestedOn: q.createdDate,
        expirationDate: q.expiryDate,
        salesRep: q.salesRep,
        priority: q.priority,
      },
      lines: (q.items ?? []).map((li) => ({
        lineItem: li.productId,
        lineUnitOfMeasure: li.uom ?? 'EA',
        lineQuantity: String(li.quantity),
        linePricePerUnit: String(li.unitPrice),
        lineDescription: li.description,
      })) as Array<Record<string, string>>,
    }));
    setExportRows(rows);
    setExportOpen(true);
  }, [quotes]);
  const [showAssignRepModal, setShowAssignRepModal] = useState(false);
  // Item QuickView state — opens the Partner v7-style item lightbox when a
  // user taps an item thumbnail in the items column (hover shows a card,
  // tap opens the full panel).
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);
  const [versionHistoryQuote, setVersionHistoryQuote] = useState<{ id: string; version: number } | null>(null);
  const [pdfPreviewQuote, setPdfPreviewQuote] = useState<{ quote: any; mode: 'print' | 'download'; isNewlyCreated?: boolean } | null>(null);
  // Row-level lifecycle modals — same modals the kanban and details page use.
  const [rowArchiveTarget, setRowArchiveTarget] = useState<Quote | null>(null);
  const [rowCancelTarget, setRowCancelTarget] = useState<Quote | null>(null);
  /* Row-level duplicate flow:
     - `duplicateTarget` holds the quote whose dropdown invoked Duplicate.
       Setting it opens DuplicateQuoteModal.
     - On confirm we synthesize the new quote synchronously, then show the
       same StatusTransitionOverlay (`duplicateActionOverlay`) used by
       archive/cancel/convert so the animation is consistent. When the
       overlay finishes we navigate to the new quote's detail page. */
  const [duplicateTarget, setDuplicateTarget] = useState<Quote | null>(null);
  /* Send to Customer and Convert to Sales Order from a row check the
     quote's essential fields first (shared FIELD_RULES: `send`, and
     `release` for a conversion). A gap shows a short toast naming what
     is missing, with a way into the quote, instead of opening the flow. */
  const runIfQuoteReady = (quote: Quote, stage: 'send' | 'release', run: () => void) => {
    const missing = getMissingFields({
      customer: quote.customer,
      poc: quote.primaryPoC,
      lineItems: deriveQuoteItems(quote.id, quote),
      /* `undefined` is a record that predates the field; the quote
         page derives an address for it, so only an explicit blank
         counts as missing. */
      shipTo: quote.shippingAddress === undefined ? 'derived' : quote.shippingAddress,
    }, stage);
    if (missing.length === 0) { run(); return; }
    const goal = stage === 'send' ? 'send it to the customer' : 'convert it to a sales order';
    toast.error(`${quote.quoteNumber} isn't ready yet`, {
      description: `${joinLabels(missing)} ${missing.length === 1 ? 'is' : 'are'} required to ${goal}.`,
      action: { label: 'Open Quote', onClick: () => navigate(`/quotes/${quote.id}`) },
    });
  };
  const [duplicateActionOverlay, setDuplicateActionOverlay] = useState<{ config: CustomActionConfig; onComplete: () => void } | null>(null);
  const [kanbanFullscreen, setKanbanFullscreen] = useState(false);
  // The board opens on the last 30 days. The window only applies while
  // the board is showing (its control lives in the board toolbar), so
  // the table view always lists every quote.
  const [boardTimeDuration, setBoardTimeDuration] = useState('last_30_days');
  /* Manual portal-based dropdown for the Kanban time-duration filter.
     Was a Radix DropdownMenu, but its outside-click + Escape-close
     fired when the user interacted with the embedded DatePickerField's
     portal calendar (the calendar renders OUTSIDE the menu DOM tree),
     which closed the menu mid-pick and made "Custom range" unusable.
     The SO module already uses this manual createPortal pattern for
     the same reason — mirroring it here keeps both modules in sync. */
  const [boardTimeDurationOpen, setBoardTimeDurationOpen] = useState(false);
  const boardTimeDurationRef = useRef<HTMLDivElement>(null);
  // Bug A5: custom From / To range that activates when boardTimeDuration
  // === 'custom'. Strings (yyyy-mm-dd) so they bind directly to the
  // existing native <input type="date"> the Filters modal already uses.
  const [boardCustomRange, setBoardCustomRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  // Advanced filters modal
  const [advFilters, setAdvFilters] = useState<QuoteAdvancedFilters>({ ...DEFAULT_QUOTE_FILTERS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = useMemo(() => countActiveQuoteFilters(advFilters), [advFilters]);

  // Row selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Board state
  const [boardGroupBy, setBoardGroupBy] = useState<'none' | 'salesRep' | 'customer' | 'priority'>('none');
  const [isBoardColumnConfigModalOpen, setIsBoardColumnConfigModalOpen] = useState(false);
  const [boardVisibleColumns, setBoardVisibleColumns] = useState<QuoteStatus[]>(() => {
    const saved = localStorage.getItem('boardVisibleColumns');
    if (saved) return JSON.parse(saved);
    return ['Draft', 'Sent to Customer', 'Unconfirmed SO', 'Confirmed SO', 'Expired', 'Rejected', 'Cancelled'];
  });

  // KPI insights
  const [activeKpis, setActiveKpis] = useState<string[]>([...DEFAULT_ACTIVE_KPIS]);
  const [insightsPanelOpen, setInsightsPanelOpen] = useState(false);
  const [insightsDateRange, setInsightsDateRange] = useState<InsightsRange>('last_30');
  const [insightsCustom, setInsightsCustom] = useState<{ from: string; to: string }>({ from: '', to: '' });
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
  /* Quote No is the locked anchor; Customer is pre-pinned alongside it
     so users open onto both identifying columns sticky on the left. */
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(['quoteNumber', 'customer']));

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
    const counts: Record<QuickFilter, number> = { all: quotes.length, draft: 0, sent: 0, confirmed_customer: 0, converted: 0, expired: 0, rejected: 0, cancelled: 0, archived: 0 };
    quotes.forEach(q => {
      if (q.status === 'Draft') counts.draft++;
      if (q.status === 'Sent to Customer') counts.sent++;
      if (q.status === 'Unconfirmed SO') counts.confirmed_customer++;
      if (q.status === 'Confirmed SO') counts.converted++;
      if (q.status === 'Expired') counts.expired++;
      if (q.status === 'Rejected') counts.rejected++;
      if (q.status === 'Cancelled') counts.cancelled++;
    });
    return counts;
  }, [quotes]);

  /* ─── Filtered + sorted quotes ─── */
  const filteredQuotes = useMemo(() => {
    /* Status pill predicate:
       - Archived view: only Archived quotes.
       - Active-state set non-empty: any quote whose status maps to a
         key in the set. (Multi-select OR.)
       - Otherwise (Show All): every non-Archived quote. Archived is
         hidden by default — surfacing them requires the Archived
         pill to be explicitly on. */
    let result = quotes.filter(q => {
      if (showArchived) return q.status === 'Archived';
      if (q.status === 'Archived') return false;
      if (activeStates.size === 0) return true;
      if (activeStates.has('draft') && q.status === 'Draft') return true;
      if (activeStates.has('sent') && q.status === 'Sent to Customer') return true;
      if (activeStates.has('confirmed_customer') && q.status === 'Unconfirmed SO') return true;
      if (activeStates.has('converted') && q.status === 'Confirmed SO') return true;
      if (activeStates.has('expired') && q.status === 'Expired') return true;
      if (activeStates.has('rejected') && q.status === 'Rejected') return true;
      if (activeStates.has('cancelled') && q.status === 'Cancelled') return true;
      return false;
    });

    // Me mode — surfaces quotes where the signed-in user is the
    // creator (primary sales rep) or named among additional sales
    // reps. CURRENT_USER_NAME is the canonical roster entry; mock
    // data is seeded with this name in some primary/additional
    // slots so the filter actually returns rows.
    if (meMode) {
      result = result.filter(q => isQuoteMine(q));
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

    /* Advanced filters — apply the shared predicate the modal also
       uses so the listing's filter chain and the modal's "Show N
       quotes" CTA preview always agree on what a given filter set
       matches. */
    if (countActiveQuoteFilters(advFilters) > 0) {
      result = result.filter(q => quoteMatchesAdvancedFilters(q, advFilters));
    }

    // Bug A6: board-level time duration was rendered in the UI but
    // never reached the filter pipeline. Compute the active [from, to]
    // window from the preset (or custom range) and apply it against
    // each quote's createdDate. 'all' / unset values short-circuit.
    // Board only: the table has no time control, so it never filters.
    if (density === 'board') {
      let from: Date | null = null;
      let to: Date | null = null;
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      switch (boardTimeDuration) {
        case 'last_7_days':   from = new Date(startOfToday); from.setDate(from.getDate() - 7);  to = endOfToday; break;
        case 'last_30_days':  from = new Date(startOfToday); from.setDate(from.getDate() - 30); to = endOfToday; break;
        case 'last_6_months': from = new Date(startOfToday); from.setMonth(from.getMonth() - 6); to = endOfToday; break;
        case 'last_12_months':from = new Date(startOfToday); from.setMonth(from.getMonth() - 12); to = endOfToday; break;
        case 'custom':
          if (boardCustomRange.from) from = new Date(boardCustomRange.from + 'T00:00:00');
          if (boardCustomRange.to)   { to = new Date(boardCustomRange.to + 'T00:00:00'); to.setHours(23, 59, 59, 999); }
          break;
        // 'all' or unknown — no filtering
      }
      if (from || to) {
        result = result.filter((q) => {
          if (!q.createdDate) return false;
          const d = new Date(q.createdDate);
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        });
      }
    }

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
          case 'items': aVal = deriveQuoteItems(a.id, a).length; bVal = deriveQuoteItems(b.id, b).length; break;
          case 'salesRep': aVal = typeof a.salesRep === 'string' ? a.salesRep : a.salesRep?.name || ''; bVal = typeof b.salesRep === 'string' ? b.salesRep : b.salesRep?.name || ''; break;
          case 'createdBy': aVal = pickCreatedBy(a); bVal = pickCreatedBy(b); break;
          case 'lastUpdatedBy': aVal = pickLastUpdatedBy(a); bVal = pickLastUpdatedBy(b); break;
          case 'lastUpdatedDate': aVal = pickLastUpdatedDate(a); bVal = pickLastUpdatedDate(b); break;
          case 'priority': aVal = a.priority || ''; bVal = b.priority || ''; break;
          default: { aVal = a[key] instanceof Date ? a[key].getTime() : (a as any)[key] || ''; bVal = b[key] instanceof Date ? b[key].getTime() : (b as any)[key] || ''; }
        }
        if (typeof aVal === 'string' && typeof bVal === 'string') return dir * aVal.localeCompare(bVal);
        return dir * (aVal > bVal ? 1 : aVal < bVal ? -1 : 0);
      });
    }

    return result;
  }, [quotes, activeStates, showArchived, meMode, searchQuery, advFilters, columnFiltersList, sortConfig, boardTimeDuration, boardCustomRange, density]);

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
    const willFreeze = !(frozenColumns.has(columnKey) && columnKey !== 'quoteNumber');
    const nextFrozen = new Set(frozenColumns);
    if (willFreeze) nextFrozen.add(columnKey);
    else nextFrozen.delete(columnKey);
    setFrozenColumns(nextFrozen);
    /* Keep the frozen block contiguous at the left — snap the toggled
       column to the freeze boundary. On freeze it lands at the end of
       the frozen block; on unfreeze it becomes the first unfrozen
       column. Matches Partner Management so the drag-guard stays
       symmetric and frozenOffsets can assume contiguity. */
    setColumnOrder(prevOrder => {
      const order = prevOrder.filter(k => k !== columnKey);
      let lastFrozenIdx = -1;
      order.forEach((k, i) => { if (nextFrozen.has(k)) lastFrozenIdx = i; });
      order.splice(lastFrozenIdx + 1, 0, columnKey);
      return order;
    });
  }, [frozenColumns]);

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
    /* Frozen columns are pinned to the left edge and cannot be picked
       up themselves; locked columns (Quote No) likewise stay put. */
    if (LOCKED_COLUMNS.includes(columnKey) || frozenColumns.has(columnKey) || isResizing || e.button !== 0) return;
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
        const k = th.getAttribute('data-col-drag-key');
        if (!k || k === draggedKey || LOCKED_COLUMNS.includes(k)) break;
        /* Don't let the drag cross the freeze boundary: a frozen column
           may only be reordered among other frozen columns, and an
           unfrozen column may only move among unfrozen columns. Keeps
           the frozen block contiguous at the left (frozenOffsets
           assumes it) and stops any unfrozen column from being pushed
           into the sticky area. Mirrors Partner Management exactly. */
        if (frozenColumns.has(draggedKey) !== frozenColumns.has(k)) break;
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
  }, [isResizing, frozenColumns]);

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
    const now = new Date(); const quoteId = `quote-created-${Date.now()}`; const quoteNumber = generateQuoteNumber();
    const totalValue = draft.lineItems.reduce((sum, item) => sum + item.total, 0);
    /* Pull customer + PoC from the draft objects (id/name/email/...).
       Earlier this mapper read `draft.customerName` / `draft.pointOfContact`
       which don't exist on the QuoteDraft shape, so the saved quote
       carried an empty customer.name + missing primaryPoC — which is
       why the right sidebar fell back to "Unknown Customer / Unknown
       Contact" the moment the new quote opened. */
    const draftCustomer = draft.customer;
    const draftPoc = draft.primaryPoC;
    const primaryRecipient = draft.recipients?.find(r => r.isPrimary) ?? draft.recipients?.[0];
    const newQuote: Quote = {
      id: quoteId, quoteNumber, status: 'Draft' as QuoteStatus, priority: 'Standard' as any, version: 1,
      customer: {
        id: draftCustomer?.id || 'cust-unknown',
        name: draftCustomer?.name || '',
        location: draftCustomer?.location ? { name: draftCustomer.location, isPrimary: true } : undefined,
      },
      primaryPoC: draftPoc ? {
        id: draftPoc.id,
        name: draftPoc.name,
        email: draftPoc.email,
        phone: primaryRecipient?.phone,
        role: primaryRecipient?.title,
        isPrimary: true,
      } : undefined,
      additionalPoCs: (draft.recipients || []).filter(r => !r.isPrimary).map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        role: r.title,
        isPrimary: false,
      })),
      /* Pull rep selection from the draft so a quote created with
         "Yahya Naveed (You)" picked in Step 2 lands on the detail
         sidebar already showing Yahya Naveed, not "Unassigned". The
         primary is the rep flagged `isPrimary` (or the first entry),
         the rest become additionalSalesReps. */
      salesRep: (() => {
        const reps = draft.salesReps ?? [];
        const primary = reps.find((r) => r.isPrimary) ?? reps[0];
        if (primary) return { id: primary.id, name: primary.name, email: '' };
        return undefined;
      })(),
      additionalSalesReps: ((): { id: string; name: string; email: string }[] | undefined => {
        const reps = draft.salesReps ?? [];
        const primary = reps.find((r) => r.isPrimary) ?? reps[0];
        const extras = reps.filter((r) => r.id !== primary?.id);
        return extras.length > 0 ? extras.map((r) => ({ id: r.id, name: r.name, email: '' })) : undefined;
      })(),
      totalValue, createdDate: now, expiryDate: now,
      hasUnreadMessages: false, unreadMessageCount: 0, daysInCurrentStage: 0,
      lastUpdated: now,
      /* Description intentionally left empty for user-created
         quotes — the "Quote for X" auto-copy was boilerplate that
         duplicated the customer name already visible in the
         header. Users can add their own description via the
         empty-state pencil affordance. */
      description: '',
      items: draft.lineItems.map(item => ({ id: item.id || `li-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, ...item })),
      /* Commercial terms from Step 1b. Copied as-is so an empty value
         stays empty on the detail page instead of being re-derived. */
      billingAddress: draft.commercial?.billingAddress,
      shippingAddress: draft.commercial?.shippingAddress,
      paymentTerms: draft.commercial?.paymentTerms,
      paymentMethod: draft.commercial?.paymentMethod,
    };
    setQuotes(prev => [newQuote, ...prev]);
    addCreatedQuote(newQuote, draft.lineItems);
    setCurrentPage(1); setSearchQuery(''); setActiveStates(new Set()); setShowArchived(false);
    return { quoteId, quoteNumber };
  }, [quotes, generateQuoteNumber]);

  const handleStatusChange = useCallback((quoteId: string, newStatus: QuoteStatus) => {
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: newStatus } : q));
  }, []);

  /* ─── Bulk actions ───
     Mark as Confirmed is the only verb we expose in bulk. Archive,
     Cancel, Export, and Print all need per-record context that does
     not generalise across a multi-select, so they live exclusively
     on the row action menu (and on the detail page). */
  /* Mark as Confirmed — only meaningful for quotes in stage 2 (Sent to
     Customer). Counts the selected rows in that status; the button is hidden
     when none qualify, and the handler skips any that don't. */
  const bulkMarkConfirmedCount = useMemo(
    () => Array.from(selectedRows).filter(id => quotes.find(q => q.id === id)?.status === 'Sent to Customer').length,
    [selectedRows, quotes],
  );
  const handleBulkMarkConfirmed = () => {
    const ids = Array.from(selectedRows).filter(id => quotes.find(q => q.id === id)?.status === 'Sent to Customer');
    if (ids.length === 0) return;
    setQuotes(prev => prev.map(q => ids.includes(q.id) ? { ...q, status: 'Unconfirmed SO' as QuoteStatus } : q));
    toast.success(`Marked ${ids.length} quote${ids.length > 1 ? 's' : ''} as Confirmed by Customer`);
    setSelectedRows(new Set());
  };

  /* ─── Text helpers ─── */
  /* Yellow-mark highlight — aligned to the canonical HighlightText
     component used by the line-item pickers + selection modals. Was
     a bespoke orange tint that drifted from the Partner v7 spec.
     Wraps the shared component so the null/empty-fallback contract
     used by existing call sites still works. */
  const highlightText = useCallback((text: string | undefined | null) => {
    if (!text) return <span>–</span>;
    return <HighlightText text={text} searchTerm={searchQuery} />;
  }, [searchQuery]);

  const clearAllFilters = () => { setSearchQuery(''); setActiveStates(new Set()); setShowArchived(false); setAdvFilters({ ...DEFAULT_QUOTE_FILTERS }); setColumnFilters({}); setSortConfig(null); setCurrentPage(1); };
  const hasAnyFilter = !!searchQuery || !showAll || activeFilterCount > 0 || Object.keys(columnFilters).length > 0;

  const fmtCurrency = (val: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  const fmtDate = (dateInput: Date | string | undefined | null) => {
    if (!dateInput) return '–';
    try { return format(new Date(dateInput), 'MM/dd/yyyy'); } catch { return '–'; }
  };
  /* Same MM/DD/YYYY prefix as `fmtDate` but with the hh:mm suffix
     appended — used by audit-trail columns (Rejected On) and the
     rejection banner so the timestamp reads consistent everywhere. */
  const fmtDateTime = (dateInput: Date | string | undefined | null) => {
    if (!dateInput) return '–';
    try { return format(new Date(dateInput), 'MM/dd/yyyy HH:mm'); } catch { return '–'; }
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
      <div ref={contentRef} className="flex-1 min-w-0 flex flex-col h-full px-6 lg:px-8 py-6" style={{ paddingBottom: 0, overflow: 'hidden' }}>

        {/* Page Header */}
        <div className="flex items-center justify-between shrink-0 -mx-6 lg:-mx-8 -mt-6 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white border-b border-border" style={{ marginBottom: 16 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent">
              <FileText className="w-4 h-4 text-accent-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-[20px]">Quotes</h1>
              <p className="text-xs text-muted-foreground" style={{ marginTop: 1 }}>Create, manage, and track customer quotes through the entire lifecycle.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Actions, Import / Export (hidden: IMPORT_EXPORT_ENABLED). Same trigger and menu placement as the
                User Access Control listing, so bulk operations live in the same
                spot across modules. */}
            {IMPORT_EXPORT_ENABLED && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-lg border border-border bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Actions
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-0">
                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setImportOpen(true)}>
                  <Upload className="w-3.5 h-3.5 text-[#64748B]" />
                  Import
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => { void handleExport(); }}>
                  <Download className="w-3.5 h-3.5 text-[#64748B]" />
                  Export
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
            <Button onClick={() => setIsCreateQuoteModalOpen(true)} className="bg-primary text-primary-foreground shrink-0">
              <Plus className="w-4 h-4 mr-1.5" /> Create New Quote
            </Button>
          </div>
        </div>

        {/* KPI Insights — inline cards shown in every non-fullscreen
            density (table AND board). Hidden only in the fullscreen
            kanban portal where it would steal vertical space from the
            board, matching the SO module's behaviour. */}
        {!kanbanFullscreen && showInsights && activeKpiDefs.length > 0 && (
          <div className="shrink-0" style={{ marginBottom: 12 }}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Performance Insights</span>
                <InsightsRangeMenu
                  range={insightsDateRange}
                  onRangeChange={setInsightsDateRange}
                  customFrom={insightsCustom.from}
                  customTo={insightsCustom.to}
                  onCustomChange={(from, to) => setInsightsCustom({ from, to })}
                />
                <InsightsRefresh toastLabel="Quote insights refreshed" />
              </div>
              <button onClick={() => setInsightsPanelOpen(true)} className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer" style={{ fontWeight: 500, color: 'var(--primary)' }}>
                <Plus className="w-3 h-3" /> Add Insights
              </button>
            </div>
            <DndProvider backend={HTML5Backend}>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
                {activeKpiDefs.map((kpi, idx) => {
                  const value = computeKpiValue(kpi.key, quotes);
                  return <DraggableListKpiCard key={kpi.key} index={idx} kpiKey={kpi.key} label={kpi.label} value={value} iconName={kpi.iconName} tooltip={kpi.tooltip} moveCard={moveKpi} onRemove={() => handleToggleKpi(kpi.key)} />;
                })}
              </div>
            </DndProvider>
          </div>
        )}

        <KpiInsightsPanel open={insightsPanelOpen} onOpenChange={setInsightsPanelOpen} activeKpis={activeKpis} onToggleKpi={handleToggleKpi} quotes={quotes} />

        {/* Unified Table Container */}
        {IMPORT_EXPORT_ENABLED && !kanbanFullscreen && importNotice && (
          <ImportNoticeBanner
            notice={importNotice}
            entity={{ singular: 'quote', plural: 'quotes' }}
            onOpenDetails={() => {
              /* The run's detail page lives in Company Setup, Data Imports,
                 which is not built on this side yet. */
              toast.info('Import details live in Company Setup, Data Imports.');
            }}
            onDismiss={dismissImportNotice}
          />
        )}
        <div className="border border-border rounded-xl bg-card overflow-clip flex flex-1 min-h-0" style={{ marginBottom: 24 }}>
          <div className="flex-1 min-w-0 overflow-clip flex flex-col">

            {/* Row 1: Search + Filters ... Count + Density */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                  {/* Inline white bg — class-based bg overrides are
                      losing the cascade against the shared Input's
                      default `bg-input-background` utility (Tailwind v4
                      custom-token quirk), so the explicit style wins. */}
                  <Input placeholder="Search by quote no, customer, or rep..." value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    style={{ backgroundColor: '#FFFFFF' }}
                    className="pl-9 pr-8 h-9 text-sm border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20" />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {/* Filters button — uses shared `FiltersButton` so this
                    trigger matches every other Filters button across
                    the suite (detail tabs, picker modals, listings). */}
                <SharedFiltersButton count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
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
                    <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px] bg-accent text-accent-foreground" style={{ fontWeight: 600 }}>{activeKpiDefs.length}</span>
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
                        {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Columns selector is irrelevant in the board view — kanban has
                    fixed status columns, not table columns — so it's hidden there. */}
                {!isBoard && (
                  <ColumnSelectorTrigger visibleCount={visibleColumns.length} active={columnDrawerOpen} onClick={() => setColumnDrawerOpen(!columnDrawerOpen)} />
                )}

                {/* Fullscreen toggle — board view only. Entering
                    fullscreen forces the insights cards to show so
                    the behaviour stays aligned with the SO module
                    (instead of carrying the user's normal-view
                    collapsed state into fullscreen). */}
                {isBoard && (
                  <>
                    <div className="w-px h-5 bg-border/60 mx-1" />
                    {/* Portal-rendered tooltip — matches KPI info hover-card
                        styling (white surface, muted-foreground copy) so the
                        fullscreen button no longer renders as a black bubble. */}
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              if (!kanbanFullscreen) setShowInsights(true);
                              setKanbanFullscreen(!kanbanFullscreen);
                            }}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none shrink-0"
                          >
                            <Maximize2 className="w-[18px] h-[18px] text-muted-foreground/80" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          sideOffset={6}
                          className="bg-white text-muted-foreground border border-border rounded-lg px-3 py-2 shadow-md text-[11px]"
                          style={{ lineHeight: 1.55, fontWeight: 500 }}
                        >
                          Expand to fullscreen
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
              </div>
            </div>

            {/* Row 2: Quick Filter Pills — Me mode + status pills + Archived */}
            <div className="flex items-center gap-1.5 px-4 pb-3 shrink-0" style={{ overflowX: isBoard ? 'visible' : 'auto', flexWrap: isBoard ? 'wrap' : 'nowrap' }}>
              {/* Me mode pill */}
              <button onClick={() => { setMeMode(!meMode); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  meMode ? "border-primary bg-accent hover:bg-accent" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                }`}
                style={{ fontWeight: meMode ? 500 : 400, color: meMode ? "var(--primary)" : undefined }}>
                <User className="w-3.5 h-3.5" /> Me mode
              </button>

              {/* Board-only inline pills: Group By + Time Duration */}
              {isBoard && !kanbanFullscreen && (
                <>
                  <div className="w-px h-5 bg-border mx-1 shrink-0" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${
                        boardGroupBy !== 'none' ? "border-primary bg-accent hover:bg-accent" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                      }`} style={{ fontWeight: boardGroupBy !== 'none' ? 500 : 400, color: boardGroupBy !== 'none' ? 'var(--primary)' : undefined }}>
                        <Layers className="w-3.5 h-3.5" />
                        <span>{boardGroupBy === 'none' ? 'Group By' : boardGroupBy === 'salesRep' ? 'Sales Rep' : boardGroupBy === 'customer' ? 'Customer' : 'Priority'}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[180px]">
                      {[{ value: 'none', label: 'No Grouping' }, { value: 'salesRep', label: 'Sales Rep' }, { value: 'customer', label: 'Customer' }, { value: 'priority', label: 'Priority' }].map(opt => (
                        <DropdownMenuItem key={opt.value} className="flex items-center justify-between cursor-pointer" onClick={() => setBoardGroupBy(opt.value as any)}>
                          <span className="text-sm">{opt.label}</span>
                          {boardGroupBy === opt.value && <Check className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/* Manual portal-based dropdown (mirrors SO's SOList).
                      The Radix DropdownMenu version was killing the
                      DatePickerField's portal calendar via its
                      outside-click handler, which made Custom Range
                      unusable. This version owns its own scrim and
                      closes only on backdrop click, so the embedded
                      calendar can stay open across user interaction. */}
                  <div ref={boardTimeDurationRef} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setBoardTimeDurationOpen((v) => !v)}
                      className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${
                        boardTimeDuration !== 'all' ? "border-primary bg-accent hover:bg-accent" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                      }`}
                      style={{ fontWeight: boardTimeDuration !== 'all' ? 500 : 400, color: boardTimeDuration !== 'all' ? 'var(--primary)' : undefined }}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{boardTimeDuration === 'last_7_days' ? 'Last 7 days' : boardTimeDuration === 'last_30_days' ? 'Last 30 days' : boardTimeDuration === 'last_6_months' ? 'Last 6 months' : boardTimeDuration === 'last_12_months' ? 'Last 12 months' : boardTimeDuration === 'custom' ? (boardCustomRange.from && boardCustomRange.to ? `${boardCustomRange.from} → ${boardCustomRange.to}` : 'Custom range') : 'All'}</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {boardTimeDurationOpen && createPortal(
                      <>
                        {/* Scrim — single-source-of-truth for "close
                            on outside click". Calendar pop-ups render
                            at higher z-indexes, so clicks inside them
                            don't reach this scrim. */}
                        <div className="fixed inset-0 z-[9998]" onClick={() => setBoardTimeDurationOpen(false)} />
                        <div
                          className="fixed z-[9999] w-[300px] bg-popover border border-border rounded-lg p-1.5"
                          style={{
                            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                            top: (boardTimeDurationRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                            left: (boardTimeDurationRef.current?.getBoundingClientRect().right ?? 0) - 300,
                          }}
                        >
                          {[{ value: 'last_7_days', label: 'Last 7 days' }, { value: 'last_30_days', label: 'Last 30 days' }, { value: 'last_6_months', label: 'Last 6 months' }, { value: 'last_12_months', label: 'Last 12 months' }, { value: 'all', label: 'All' }].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => { setBoardTimeDuration(opt.value); setBoardTimeDurationOpen(false); }}
                              className="flex items-center gap-3 py-2 px-3 cursor-pointer rounded-md w-full hover:bg-muted/50 transition-colors"
                            >
                              <span className="flex-1 text-sm text-left" style={{ fontWeight: 500, color: boardTimeDuration === opt.value ? 'var(--primary)' : undefined }}>{opt.label}</span>
                              {boardTimeDuration === opt.value && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />}
                            </button>
                          ))}
                          {/* Custom range — Partners' menu section
                              chrome (10px / 600 / uppercase / tracking-
                              widest / muted-foreground/50). From + To
                              side by side using the shared DatePicker-
                              Field — same component the Freight modal
                              renders so the calendar UI is consistent. */}
                          <div className="border-t border-border mt-1 pt-2 px-3 pb-3">
                            <div className="flex items-center justify-between mb-2 px-0.5">
                              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60" style={{ fontWeight: 600 }}>Custom range</span>
                              {boardTimeDuration === 'custom' && <Check className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />}
                            </div>
                            <div className="flex items-end gap-2">
                              <div className="flex-1 min-w-0">
                                <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>From</label>
                                <DatePickerField
                                  value={fromIsoDate(boardCustomRange.from)}
                                  onChange={(d) => {
                                    /* Flip to 'custom' BEFORE writing the
                                       range so the useMemo doesn't briefly
                                       render through a non-custom branch. */
                                    setBoardTimeDuration('custom');
                                    setBoardCustomRange((r) => ({ ...r, from: d ? toIsoDate(d) : '' }));
                                  }}
                                  placeholder="MM/DD/YYYY"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <label className="text-[11px] text-muted-foreground mb-1 block" style={{ fontWeight: 500 }}>To</label>
                                <DatePickerField
                                  value={fromIsoDate(boardCustomRange.to)}
                                  onChange={(d) => {
                                    setBoardTimeDuration('custom');
                                    setBoardCustomRange((r) => ({ ...r, to: d ? toIsoDate(d) : '' }));
                                  }}
                                  minDate={fromIsoDate(boardCustomRange.from)}
                                  placeholder="MM/DD/YYYY"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </>,
                      document.body,
                    )}
                  </div>
                </>
              )}

              {!isBoard && (
                <>
                  <div className="w-px h-5 bg-border shrink-0" />
                  {MAIN_STATUS_PILLS.map(sf => {
                    const isShowAllPill = sf.key === 'all';
                    const isActive = isShowAllPill ? showAll : activeStates.has(sf.key as ActiveStateKey);
                    const count = filterCounts[sf.key as QuickFilter];
                    return (
                      <SharedFilterPill
                        key={sf.key}
                        label={sf.label}
                        active={isActive}
                        count={sf.showCount ? count : undefined}
                        onClick={() => { if (isShowAllPill) selectShowAll(); else toggleActiveState(sf.key as ActiveStateKey); }}
                      />
                    );
                  })}
                  {/* Archived pill — destructive tone, red accent at rest
                      AND when active. Uses the shared `FilterPill` so the
                      size/hover/badge/border all match Partner Management
                      exactly and the rest of the suite stays in lockstep. */}
                  <div className="w-px h-5 bg-border mx-1 shrink-0" />
                  <SharedFilterPill
                    label="Archived"
                    tone="destructive"
                    icon={Archive}
                    active={showArchived}
                    count={filterCounts.archived}
                    onClick={toggleArchived}
                  />
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
                {/* ── Inline Bulk Action Bar — direct port of Sales-Order-V5
                       SOList. Sits as its own row below the filter pills (the
                       pills above remain visible while a selection is active);
                       symmetric vertical padding (`py-3`) so the buttons don't
                       hug the divider above. */}
                {selectedRows.size > 0 && (
                  <div
                    role="toolbar"
                    aria-label="Bulk actions for selected quotes"
                    className="flex items-center gap-1.5 px-4 py-3 shrink-0 border-b border-border"
                  >
                    <div className="flex items-center w-full" style={{ height: "30px", gap: "12px" }}>
                      <span style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                        {selectedRows.size} {selectedRows.size === 1 ? "quote" : "quotes"} selected
                      </span>
                      <div style={{ width: "1px", height: "20px", background: "var(--border)", flexShrink: 0 }} />
                      <div className="inline-flex items-center" style={{ gap: "4px" }}>
                        {/* Bulk actions are intentionally narrow.
                            Mark as Confirmed is the only state-change
                            verb available in bulk. Export, Print,
                            Archive, and Cancel are deliberately not
                            offered here — those flows require
                            per-record context (reason capture, version
                            handling, document rendering) that does not
                            generalise across a multi-select. */}
                        {bulkMarkConfirmedCount > 0 && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs whitespace-nowrap shrink-0 cursor-pointer transition-colors border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                            style={{ fontWeight: 500 }}
                            onClick={(e) => { e.stopPropagation(); handleBulkMarkConfirmed(); }}
                            title="Move selected quotes (Sent to Customer) to Confirmed by Customer"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Mark as Confirmed</span>
                            <span className="tabular-nums opacity-80">({bulkMarkConfirmedCount})</span>
                          </button>
                        )}
                      </div>
                      <div className="flex-1" />
                      <button
                        onClick={() => setSelectedRows(new Set())}
                        className="inline-flex items-center gap-1 transition-colors hover:opacity-80"
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "var(--font-weight-medium)", color: "var(--muted-foreground)" }}
                      >
                        Esc to clear
                        <X size={12} />
                      </button>
                    </div>
                    <div aria-live="polite" className="sr-only">{`${selectedRows.size} quote${selectedRows.size !== 1 ? 's' : ''} selected`}</div>
                  </div>
                )}

                {/* Table */}
                <div className={`flex-1 min-h-0 overflow-auto ${isResizing || draggingColumnKey ? 'select-none' : ''}`}>
                  <Table style={{ tableLayout: 'fixed', minWidth: `${CHECKBOX_COL_WIDTH + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] ?? parseInt(colDef(key).minWidth, 10)), 0) + 60}px`, width: '100%' }}>
                    <TableHeader className="sticky top-0 z-20 bg-card">
                      <TableRow className={`bg-muted/30 hover:bg-muted/30 border-b border-border ${density === 'condensed' ? '[&>th]:h-8' : '[&>th]:h-9'}`}>
                        <TableHead className="sticky left-0 z-20 w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0" style={{ background: '#F8FAFC' }}>
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
                              className={`whitespace-nowrap relative group/colheader ${isFrozen ? 'sticky z-20' : ''} ${isDraggable ? 'cursor-grab' : ''} ${def.align === 'right' ? 'text-right' : ''}`}
                              style={{
                                width: `${width}px`, overflow: 'hidden',
                                ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px`, background: '#F8FAFC' } : {}),
                                ...(key === lastFrozenKey && !isBeingDragged ? { boxShadow: 'inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)' } : {}),
                                ...(isBeingDragged ? { background: 'linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)' } : {}),
                              }}>
                              {isBeingDragged && <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: 'var(--primary)' }} />}
                              {isDraggable && <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? 'opacity-100 text-primary' : 'opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40'}`} />}
                              <div className={`flex items-center ${def.align === 'right' ? 'w-full' : ''}`} style={key === 'quoteNumber' ? { paddingLeft: 24 } : undefined}>
                                <ColumnHeaderMenu columnKey={key} label={def.label} sortable={def.sortable} sortConfig={sortConfig}
                                  onSort={handleSort} onAddFilter={handleAddColumnFilter} onHideColumn={handleHideColumn}
                                  onFreezeColumn={handleFreezeColumn} isFrozen={isFrozen} isLocked={isLocked} hasActiveFilter={hasFilter}
                                  filter={columnFilters[key] ?? null} quotes={quotes} onFilterChange={handleColumnFilterChange}>
                                  <div className={`inline-flex items-center gap-1 ${def.align === 'right' ? 'w-full justify-end' : ''}`}>
                                    <span className="text-[13px]" style={currentColSort || hasFilter ? { color: 'var(--primary)' } : undefined}>{def.label}</span>
                                    {hasFilter && !currentColSort && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--primary)' }} />}
                                    {/* Sort arrow — always visible for sortable columns; muted slate by
                                        default, flips to primary blue once the user clicks to sort.
                                        Up/Down replace ArrowUpDown when an active direction is set. */}
                                    {currentColSort === 'asc' && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: 'var(--primary)' }} />}
                                    {currentColSort === 'desc' && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: 'var(--primary)' }} />}
                                    {!currentColSort && !hasFilter && def.sortable && <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground/60 transition-colors" />}
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
                        <TableHead className="whitespace-nowrap w-[60px] sticky right-0 z-20 !pl-2 !pr-2" style={{ background: '#F8FAFC', boxShadow: 'inset 1px 0 0 0 rgba(0,0,0,0.08)' }}>
                          <span className="text-[13px]">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody style={{ pointerEvents: draggingColumnKey ? 'none' : undefined }}>
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
                            case 'quoteNumber': {
                              const createdByMe = isQuoteCreatedByMe(quote);
                              const salesRepMe = isQuoteSalesRepMe(quote);
                              const mine = createdByMe || salesRepMe;
                              const mineLabel = mineReason(createdByMe, salesRepMe);
                              return (
                                <TableCell key={colKey}>
                                  {/* Reserved 16px slot before the quote number so
                                      the ID text always lands at the same X
                                      whether or not the row is mine. When the
                                      row matches the signed-in user the slot
                                      renders a plain person glyph (no chip,
                                      no background); otherwise it stays empty.
                                      The header label is shifted by the same
                                      offset so the column reads cleanly. */}
                                  <div className="flex items-center gap-2 w-full">
                                    <span className="inline-flex items-center justify-center shrink-0" style={{ width: 16, height: 16 }} aria-hidden={!mine}>
                                      {mine && (
                                        <TooltipProvider delayDuration={150}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <span className="inline-flex" aria-label={mineLabel}>
                                                <User className="w-3.5 h-3.5" strokeWidth={1.75} style={{ color: '#2563EB' }} />
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" sideOffset={6} className="bg-white text-muted-foreground border border-border rounded-lg px-2.5 py-1.5 shadow-md text-[11px]">
                                              {mineLabel}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      )}
                                    </span>
                                    <div className={`flex flex-col min-w-0 ${isRelaxed ? 'flex-1' : ''}`}>
                                      <span className={isRelaxed ? 'text-[13.5px]' : 'text-sm'} style={{ fontWeight: 500, color: 'var(--primary)' }}>{highlightText(quote.quoteNumber)}</span>
                                      {isRelaxed && <span className="text-[10px] text-muted-foreground/50 truncate">{quote.description || '–'}</span>}
                                    </div>
                                    {/* Outdated-configuration surface moved out of the listing; the
                                        detail-page version banner is now the single entry point for
                                        the sync flow. The listing stays on the version badge alone. */}
                                    <VersionBadge version={quote.version || 1} compact showExpandIcon onClick={(e) => { e.stopPropagation(); setVersionHistoryQuote({ id: quote.id, version: quote.version || 1 }); }} />
                                  </div>
                                </TableCell>
                              );
                            }
                            case 'customer':
                              return (
                                <TableCell key={colKey}>
                                  <CustomerCellRich
                                    customer={{
                                      id: quote.customer?.id ?? quote.id,
                                      name: customerName,
                                      logoUrl: quote.customer?.logoUrl,
                                      email: (quote.customer as any)?.email,
                                      phone: (quote.customer as any)?.phone,
                                      industry: (quote.customer as any)?.industry,
                                      location: customerLoc ? { name: customerLoc, isPrimary: true } : undefined,
                                    }}
                                    density={isRelaxed ? 'comfortable' : 'compact'}
                                  />
                                </TableCell>
                              );
                            case 'primaryPoC': {
                              const additional = (quote.additionalPoCs || []) as any[];
                              if (!quote.primaryPoC?.name) {
                                return <TableCell key={colKey}><EmptyPersonCell label={FIELD_RULES.poc.emptyLabel} /></TableCell>;
                              }
                              return (
                                <TableCell key={colKey}>
                                  <PocCellRich
                                    primary={{
                                      id: quote.primaryPoC?.id ?? `${quote.id}-poc`,
                                      name: pocName,
                                      email: quote.primaryPoC?.email ?? '',
                                      phone: (quote.primaryPoC as any)?.phone,
                                      role: (quote.primaryPoC as any)?.role,
                                      isPrimary: true,
                                      avatarUrl: (quote.primaryPoC as any)?.avatarUrl,
                                    }}
                                    additional={additional.map((c: any) => ({
                                      id: c.id ?? c.name,
                                      name: c.name,
                                      email: c.email ?? '',
                                      phone: c.phone,
                                      role: c.role,
                                      avatarUrl: c.avatarUrl,
                                    }))}
                                    density={isRelaxed ? 'comfortable' : 'compact'}
                                  />
                                </TableCell>
                              );
                            }
                            case 'status': return <TableCell key={colKey}><StatusBadge status={quote.status} /></TableCell>;
                            case 'totalValue': return <TableCell key={colKey} className="text-right"><span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>$ {fmtCurrency(quote.totalValue || 0)}</span></TableCell>;
                            case 'deliveryLocation':
                              return (
                                <TableCell key={colKey}>
                                  <DeliveryLocationCell
                                    locationName={customerLoc || ''}
                                    density={isRelaxed ? 'comfortable' : 'compact'}
                                  />
                                </TableCell>
                              );
                            case 'requestedDate': return <TableCell key={colKey}><span className="text-[13px] text-muted-foreground" style={{ fontVariantNumeric: 'normal' }}>{fmtDate(quote.requestedDate)}</span></TableCell>;
                            case 'rejectedAt': return <TableCell key={colKey}><span className="text-[13px] text-muted-foreground" style={{ fontVariantNumeric: 'normal' }}>{fmtDateTime(quote.rejectedAt)}</span></TableCell>;
                            case 'rejectedBy': {
                              const rb = (quote as any).rejectedBy as string | undefined;
                              if (!rb) return <TableCell key={colKey}><span className="text-[13px] text-muted-foreground">—</span></TableCell>;
                              return <TableCell key={colKey}><span className="text-[13px] text-foreground">{rb}</span></TableCell>;
                            }
                            case 'createdDate': return <TableCell key={colKey}><span className="text-[13px] text-muted-foreground" style={{ fontVariantNumeric: 'normal' }}>{fmtDate(quote.createdDate)}</span></TableCell>;
                            case 'createdBy': {
                              /* Mirrors SO listing's createdby chrome — avatar +
                                 PersonHoverCard revealing email / phone / dept.
                                 System-attributed rows skip the hover card. */
                              const cb = pickCreatedBy(quote);
                              const isSystem = /system/i.test(cb);
                              const tint = getAvatarTint(cb);
                              const initials = cb.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
                              const details = !isSystem ? getContactDetails(cb) : null;
                              return (
                                <TableCell key={colKey}>
                                  <div className="flex items-center gap-2">
                                    {details ? (
                                      <HoverCard openDelay={250}>
                                        <HoverCardTrigger asChild>
                                          <div className="cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <Avatar name={cb} size={isRelaxed ? 28 : 24} />
                                          </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent
                                          side="bottom" align="start"
                                          className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                        >
                                          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                                            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                            <div className="flex items-center gap-3 relative">
                                              <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: tint.bg }}>
                                                <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{initials}</div>
                                              </div>
                                              <div className="min-w-0">
                                                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{cb}</p>
                                                <p className="text-[11px] text-slate-400 truncate">{details.role}</p>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="bg-white px-4 py-3 space-y-2">
                                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{details.email}</span></div>
                                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{details.phone}</span></div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                    ) : (
                                      <Avatar name={cb} size={isRelaxed ? 28 : 24} />
                                    )}
                                    <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#334155' }}>{cb}</span>
                                  </div>
                                </TableCell>
                              );
                            }
                            case 'lastUpdatedDate': return <TableCell key={colKey}><span className="text-[13px] text-muted-foreground" style={{ fontVariantNumeric: 'normal' }}>{fmtDate(pickLastUpdatedDate(quote))}</span></TableCell>;
                            case 'lastUpdatedBy': {
                              /* Same chrome as createdBy — the two columns read
                                 as a matched pair in the demo grid. */
                              const lu = pickLastUpdatedBy(quote);
                              const isSystem = /system/i.test(lu);
                              const tint = getAvatarTint(lu);
                              const initials = lu.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
                              const details = !isSystem ? getContactDetails(lu) : null;
                              return (
                                <TableCell key={colKey}>
                                  <div className="flex items-center gap-2">
                                    {details ? (
                                      <HoverCard openDelay={250}>
                                        <HoverCardTrigger asChild>
                                          <div className="cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <Avatar name={lu} size={isRelaxed ? 28 : 24} />
                                          </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent
                                          side="bottom" align="start"
                                          className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                        >
                                          <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                                            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                                            <div className="flex items-center gap-3 relative">
                                              <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/20 shrink-0" style={{ backgroundColor: tint.bg }}>
                                                <div className="w-full h-full flex items-center justify-center text-[13px] text-white" style={{ fontWeight: 700 }}>{initials}</div>
                                              </div>
                                              <div className="min-w-0">
                                                <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{lu}</p>
                                                <p className="text-[11px] text-slate-400 truncate">{details.role}</p>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="bg-white px-4 py-3 space-y-2">
                                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{details.email}</span></div>
                                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span>{details.phone}</span></div>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                    ) : (
                                      <Avatar name={lu} size={isRelaxed ? 28 : 24} />
                                    )}
                                    <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#334155' }}>{lu}</span>
                                  </div>
                                </TableCell>
                              );
                            }
                            case 'respondBy': return <TableCell key={colKey}><span className="text-[13px] text-muted-foreground" style={{ fontVariantNumeric: 'normal' }}>{fmtDate(quote.respondBy)}</span></TableCell>;
                            case 'expiryDate': return <TableCell key={colKey}><span className="text-[13px] text-muted-foreground" style={{ fontVariantNumeric: 'normal' }}>{fmtDate(quote.expiryDate)}</span></TableCell>;
                            case 'confirmationDate': return <TableCell key={colKey}><span className="text-[13px] text-muted-foreground" style={{ fontVariantNumeric: 'normal' }}>{fmtDate(quote.confirmationDate)}</span></TableCell>;
                            case 'salesRep':
                              if (!(quote.salesRep as any)?.name) {
                                return <TableCell key={colKey}><EmptyPersonCell label={FIELD_RULES.salesRep.emptyLabel} /></TableCell>;
                              }
                              return (
                                <TableCell key={colKey}>
                                  <SalesRepCellRich
                                    rep={{
                                      id: (quote.salesRep as any)?.id ?? salesRepName,
                                      name: salesRepName,
                                      email: (quote.salesRep as any)?.email,
                                      avatar: (quote.salesRep as any)?.avatar,
                                      role: (quote.salesRep as any)?.role,
                                      phone: (quote.salesRep as any)?.phone,
                                    }}
                                    additional={(quote.additionalSalesReps ?? []).map((r) => ({
                                      id: r.id,
                                      name: r.name,
                                      email: r.email,
                                      avatar: r.avatar,
                                    }))}
                                    density={isRelaxed ? 'comfortable' : 'compact'}
                                  />
                                </TableCell>
                              );
                            case 'priority': return <TableCell key={colKey}><PriorityBadge priority={quote.priority} /></TableCell>;
                            case 'tags': {
                              /* Tags cell — Partner Management chrome
                                 (PartnersVendorsListPage.tsx:1946) with
                                 explicit slate colors instead of the
                                 shadcn `--muted` tokens. Quote's theme
                                 resolves those tokens to a black/white
                                 combination, breaking the intended soft
                                 gray look; slate-100 bg + slate-600 fg
                                 + slate-200 border matches Partners'
                                 actual pill appearance. */
                              const tags = quote.tags || [];
                              if (tags.length === 0) return <TableCell key={colKey}><span className={`${isRelaxed ? 'text-[13.5px]' : 'text-sm'} text-muted-foreground`}>{'–'}</span></TableCell>;
                              const extra = tags.length > 1 ? tags.length - 1 : 0;
                              const pillStyle: React.CSSProperties = {
                                fontWeight: 500,
                                backgroundColor: '#F1F5F9',
                                color: '#475569',
                                borderColor: '#E2E8F0',
                              };
                              return (
                                <TableCell key={colKey}>
                                  <div className={`flex items-center ${isRelaxed ? 'gap-1.5' : 'gap-1'}`}>
                                    <span
                                      className={`inline-flex items-center ${isRelaxed ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs'} rounded-md border`}
                                      style={pillStyle}
                                    >
                                      {tags[0]}
                                    </span>
                                    {extra > 0 && (
                                      <OverflowTooltip
                                        category="Tags"
                                        items={tags.slice(1).map((t, i) => ({
                                          id: `${quote.id}-tag-${i}`,
                                          name: t,
                                          subtitle: 'TAG',
                                        }))}
                                      >
                                        <span
                                          className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default"
                                          style={{ ...pillStyle, fontWeight: 600 }}
                                        >
                                          +{extra}
                                        </span>
                                      </OverflowTooltip>
                                    )}
                                  </div>
                                </TableCell>
                              );
                            }
                            case 'items': {
                              // Partner v7 items-column parity: thumbnail + first
                              // item code + "+N more" tooltip. The thumbnail
                              // gets a rich HoverCard preview AND a tap
                              // handler that opens the full QuickViewPanel
                              // (the same component used elsewhere for
                              // location / contact quick previews).
                              const items = deriveQuoteItems(quote.id, quote);
                              const first = items[0];
                              const extra = items.length - 1;
                              const isRelaxed = density !== 'condensed';
                              const thumbSize = isRelaxed ? 40 : 28;
                              const statusTokens = ITEM_STATUS_TOKENS[first.status] || ITEM_STATUS_TOKENS['In Stock'];
                              const openQuickView = (it: MockItem, e?: React.MouseEvent) => {
                                e?.stopPropagation();
                                setQuickViewData({
                                  type: 'item',
                                  item: { id: `${quote.id}-${it.code}`, name: it.code, subtitle: it.description },
                                  vendorName: quote.quoteNumber,
                                });
                              };
                              return (
                                <TableCell key={colKey}>
                                  <div className={`flex items-center ${isRelaxed ? 'gap-2.5' : 'gap-2'}`}>
                                    <HoverCard openDelay={120} closeDelay={80}>
                                      <HoverCardTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                        <button
                                          type="button"
                                          onClick={(e) => openQuickView(first, e)}
                                          style={{
                                            width: thumbSize, height: thumbSize, flexShrink: 0,
                                            borderRadius: 6, backgroundColor: first.thumbBg,
                                            border: '1px solid #E8ECF1',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', padding: 0,
                                          }}
                                          aria-label={`Preview ${first.code}`}
                                        >
                                          <Package style={{ width: isRelaxed ? 18 : 14, height: isRelaxed ? 18 : 14, color: '#64748B', opacity: 0.6 }} />
                                        </button>
                                      </HoverCardTrigger>
                                      <HoverCardContent
                                        side="bottom" align="start" sideOffset={8}
                                        className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden"
                                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                      >
                                        {/* Gradient header — matches Partner v7 item hover-card chrome */}
                                        <div className="px-3.5 py-3 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)' }}>
                                          <div className="flex items-center gap-3 relative">
                                            <div
                                              className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                                              style={{ backgroundColor: first.thumbBg }}
                                            >
                                              <Package className="w-4 h-4" style={{ color: '#475569' }} />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{first.code}</p>
                                              <p className="text-[11px] truncate" style={{ color: 'rgba(148,163,184,0.9)' }}>{first.description}</p>
                                            </div>
                                          </div>
                                        </div>
                                        {/* Body: category, on-hand qty + price, status pill */}
                                        <div className="bg-white px-3.5 py-3 space-y-2">
                                          <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span>{first.category}</span>
                                          </div>
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                                              <WarehouseIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                              <span>On-Hand: <b>{first.onHand.toLocaleString()}</b></span>
                                            </div>
                                            <span className="text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
                                              ${first.unitPrice.toFixed(2)}
                                              <span className="text-slate-400 ml-1" style={{ fontWeight: 400 }}>/ unit</span>
                                            </span>
                                          </div>
                                          <span
                                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px]"
                                            style={{ fontWeight: 600, backgroundColor: statusTokens.bg, color: statusTokens.fg }}
                                          >
                                            {first.status}
                                          </span>
                                        </div>
                                      </HoverCardContent>
                                    </HoverCard>
                                    <div className="min-w-0">
                                      <span
                                        className={`${isRelaxed ? 'text-[13.5px]' : 'text-sm'} block truncate`}
                                        style={{ fontWeight: 500, color: 'var(--foreground)' }}
                                      >
                                        {first.code}
                                      </span>
                                      {isRelaxed && (
                                        <span className="text-[10.5px] text-muted-foreground block truncate" style={{ maxWidth: 180 }}>
                                          {first.description}
                                        </span>
                                      )}
                                    </div>
                                    {extra > 0 && (
                                      <OverflowTooltip
                                        category="Items"
                                        items={items.slice(1).map((it, i) => ({
                                          id: `${quote.id}-item-${i + 1}`,
                                          name: it.code,
                                          subtitle: it.description,
                                          icon: <Package className="w-3.5 h-3.5" />,
                                        }))}
                                        onItemClick={(it) => {
                                          const mock = items.find(m => m.code === it.name) || first;
                                          openQuickView(mock);
                                        }}
                                        onViewMore={() => navigate(`/quotes/${quote.id}`)}
                                        viewMoreLabel={`View all ${items.length} items for ${quote.quoteNumber}`}
                                      >
                                        <span
                                          className="text-[11px] shrink-0 cursor-default leading-none"
                                          style={{ fontWeight: 600, color: '#085FCC' }}
                                        >
                                          +{extra} more
                                        </span>
                                      </OverflowTooltip>
                                    )}
                                  </div>
                                </TableCell>
                              );
                            }
                            default: return <TableCell key={colKey}>–</TableCell>;
                          }
                        };

                        const isSelected = selectedRows.has(quote.id);
                        const selectionActive = selectedRows.size > 0;
                        return (
                          <TableRow key={quote.id}
                            className={`group ${isSelected ? '' : (draggingColumnKey ? '' : 'hover:bg-muted/50')} ${density === 'condensed' ? '[&>td]:py-1 [&>td]:px-2' : '[&>td]:py-2 [&>td]:px-2'}`}
                            style={{
                              background: isSelected ? '#EFF6FF' : undefined,
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                            onClick={() => {
                              // Selection-active mode mirrors Sales-Order-V5
                              // SOList: while ≥1 row is checked, clicking a row
                              // toggles its checkbox instead of opening the
                              // quote. Prevents accidental navigation during
                              // bulk-select flows.
                              if (selectionActive) {
                                handleSelectRow(quote.id);
                                return;
                              }
                              navigate(`/quotes/${quote.id}`);
                            }}>
                            <TableCell className={`sticky left-0 z-10 ${isSelected ? '' : (draggingColumnKey ? 'bg-card' : 'bg-card group-hover:bg-muted/50')} w-[40px] min-w-[40px] max-w-[40px] !pl-2 !pr-0`} style={isSelected ? { background: '#EFF6FF' } : undefined}>
                              <Checkbox checked={isSelected} onCheckedChange={() => handleSelectRow(quote.id)} onClick={e => e.stopPropagation()} />
                            </TableCell>
                            {visibleColumns.map(key => {
                              const cell = renderCell(key);
                              const w = columnWidths[key] ?? parseInt(colDef(key).minWidth, 10);
                              const isDraggedCol = draggingColumnKey === key;
                              const cellWidthStyle: React.CSSProperties = { width: `${w}px`, minWidth: `${w}px`, maxWidth: `${w}px`, overflow: 'hidden', textOverflow: 'ellipsis', ...(isDraggedCol ? { backgroundColor: 'rgba(10,119,255,0.035)' } : {}) };
                              if (frozenColumns.has(key)) {
                                const defAlign = colDef(key).align;
                                return cloneElement(cell, {
                                  className: `${cell.props.className || ''} sticky z-10 ${isSelected ? '' : (draggingColumnKey ? 'bg-card' : 'bg-card group-hover:bg-muted/50')} ${defAlign === 'right' ? 'text-right' : ''}`.trim(),
                                  style: { ...cell.props.style, ...cellWidthStyle, left: `${frozenOffsets[key] ?? 0}px`, ...(isSelected ? { background: '#EFF6FF' } : {}), ...(key === lastFrozenKey ? { boxShadow: 'inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)' } : {}) },
                                });
                              }
                              const defAlign = colDef(key).align;
                              return cloneElement(cell, { className: `${cell.props.className || ''} ${defAlign === 'right' ? 'text-right' : ''}`.trim(), style: { ...cell.props.style, ...cellWidthStyle } });
                            })}
                            <TableCell className={`sticky right-0 z-10 !pl-2 !pr-2 ${isSelected ? '' : (draggingColumnKey ? 'bg-card' : 'bg-card group-hover:bg-muted/50')}`} style={{ boxShadow: 'inset 1px 0 0 0 rgba(0,0,0,0.08)', ...(isSelected ? { background: '#EFF6FF' } : {}) }}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                  <button type="button" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[200px]" onClick={e => e.stopPropagation()}>
                                  {(() => {
                                    /* Row menu order (product spec): View Details, Copy Link,
                                       Print, Download, the status actions, Duplicate, Archive,
                                       Cancel. Editing happens on the quote's page.
                                       Draft, Sent and Confirmed by Customer can all convert straight
                                       to a sales order; send and convert check essential fields first. Status actions open the
                                       quote and run its own flow, so modals and checks are not
                                       duplicated here. Export CSV stays off the row (backlog, see
                                       IMPORT_EXPORT_ENABLED). */
                                    const canSend = quote.status === 'Draft';
                                    const canConfirm = quote.status === 'Sent to Customer';
                                    const canConvert = ['Draft', 'Sent to Customer', 'Unconfirmed SO'].includes(quote.status);
                                    const canReactivate = ['Expired', 'Rejected', 'Cancelled', 'Archived'].includes(quote.status);
                                    const hasStatusAction = canSend || canConfirm || canConvert || canReactivate;
                                    /* Same rules as the quote's detail page: Archive from any
                                       state but Archived; Cancel only while the quote is live
                                       (Draft, Sent, Confirmed). A converted quote lives on as its
                                       sales order, so it has no Cancel. */
                                    const canArchive = quote.status !== 'Archived';
                                    const canCancel = ['Draft', 'Sent to Customer', 'Unconfirmed SO'].includes(quote.status);
                                    return (
                                      <>
                                        <DropdownMenuItem onClick={() => navigate(`/quotes/${quote.id}`)}>
                                          <Eye className="w-4 h-4 mr-2" /> View Details
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/quotes/${quote.id}`); toast.success('Link copied'); }}>
                                          <Link2 className="w-4 h-4 mr-2" /> Copy Link
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setPdfPreviewQuote({
                                          quote: {
                                            quoteNumber: quote.quoteNumber,
                                            customerName: typeof quote.customer === 'string' ? quote.customer : quote.customer?.name || '',
                                            version: quote.version || 1,
                                            items: (quote as any).items || [],
                                            subtotal: (quote as any).subtotal || 0,
                                            tax: (quote as any).tax || 0,
                                            total: (quote as any).total || (quote as any).totalValue || 0,
                                            status: quote.status,
                                          },
                                          mode: 'print',
                                          isNewlyCreated: !!getCreatedQuote(quote.id),
                                        })}>
                                          <Printer className="w-4 h-4 mr-2" /> Print Quote
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setPdfPreviewQuote({
                                          quote: {
                                            quoteNumber: quote.quoteNumber,
                                            customerName: typeof quote.customer === 'string' ? quote.customer : quote.customer?.name || '',
                                            version: quote.version || 1,
                                            items: (quote as any).items || [],
                                            subtotal: (quote as any).subtotal || 0,
                                            tax: (quote as any).tax || 0,
                                            total: (quote as any).total || (quote as any).totalValue || 0,
                                            status: quote.status,
                                          },
                                          mode: 'download',
                                          isNewlyCreated: !!getCreatedQuote(quote.id),
                                        })}>
                                          <Download className="w-4 h-4 mr-2" /> Download Quote
                                        </DropdownMenuItem>
                                        {hasStatusAction && <DropdownMenuSeparator />}
                                        {canSend && (
                                          <DropdownMenuItem onClick={() => runIfQuoteReady(quote, 'send', () => navigate(`/quotes/${quote.id}?action=next`))}>
                                            <Send className="w-4 h-4 mr-2" /> Send to Customer
                                          </DropdownMenuItem>
                                        )}
                                        {canConfirm && (
                                          <DropdownMenuItem onClick={() => navigate(`/quotes/${quote.id}?action=next`)}>
                                            <CheckCircle className="w-4 h-4 mr-2" /> Confirmed by Customer
                                          </DropdownMenuItem>
                                        )}
                                        {canConvert && (
                                          <DropdownMenuItem onClick={() => runIfQuoteReady(quote, 'release', () => navigate(`/quotes/${quote.id}?action=convert`))}>
                                            <FileText className="w-4 h-4 mr-2" /> Convert to Sales Order
                                          </DropdownMenuItem>
                                        )}
                                        {canReactivate && (
                                          <DropdownMenuItem onClick={() => navigate(`/quotes/${quote.id}?action=next`)}>
                                            <ArchiveRestore className="w-4 h-4 mr-2" /> Reactivate Quote
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setDuplicateTarget(quote)}>
                                          <Copy className="w-4 h-4 mr-2" /> Duplicate
                                        </DropdownMenuItem>
                                        {canArchive && (
                                          <DropdownMenuItem
                                            onClick={() => setRowArchiveTarget(quote)}
                                            className="text-destructive focus:text-destructive focus:bg-destructive/5"
                                          >
                                            <Archive className="w-4 h-4 mr-2 text-destructive" /> Archive
                                          </DropdownMenuItem>
                                        )}
                                        {canCancel && (
                                          <DropdownMenuItem
                                            onClick={() => setRowCancelTarget(quote)}
                                            className="text-destructive focus:text-destructive focus:bg-destructive/5"
                                          >
                                            <Ban className="w-4 h-4 mr-2 text-destructive" /> Cancel Quote
                                          </DropdownMenuItem>
                                        )}
                                      </>
                                    );
                                  })()}
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

          {/* Column Selector Side Drawer. `lockedColumns` is the union
              of the hard-locked anchor (Quote No) and every frozen
              column the user has pinned. Frozen columns surface in the
              drawer's Pinned section and lose their drag handle + hide
              toggle, matching Partner Management's behaviour. */}
          <ColumnSelector columns={COLUMN_DEFS} columnOrder={columnOrder} columnVisibility={columnVisibility}
            onColumnOrderChange={setColumnOrder} onColumnVisibilityChange={setColumnVisibility}
            lockedColumns={Array.from(new Set([...LOCKED_COLUMNS, ...frozenColumns]))} open={columnDrawerOpen} onOpenChange={setColumnDrawerOpen} />
        </div>
      </div>

      {/* Modals */}
      <QuoteFiltersModal open={filtersOpen} onOpenChange={setFiltersOpen} filters={advFilters} onFiltersChange={f => { setAdvFilters(f); setCurrentPage(1); }} quotes={quotes} filteredCount={filteredQuotes.length} />
      {/* Legacy import. The wizard owns the whole flow: template, upload,
          the record-shaped review sheet, and the completion dialog. It
          hands back what it created so the listing can show it at once. */}
      <ExportRecordsModal
        open={IMPORT_EXPORT_ENABLED && exportOpen}
        onClose={() => setExportOpen(false)}
        records={exportRows}
        scopeNote={hasAnyFilter ? 'Every quote matching your filters will be exported' : 'Every quote on your list will be exported'}
      />

      <ImportWizardModal
        open={IMPORT_EXPORT_ENABLED && importOpen}
        onClose={() => setImportOpen(false)}
        onGoToListing={() => setImportOpen(false)}
        validateOptions={{
          singleCurrency: true,
          conditionalDateKey: 'expirationDate',
          datesRequiredForStatuses: ['Sent to Customer', 'Confirmed by Customer'],
          alreadyImported: new Set(quotes.map((q) => q.quoteNumber.toLowerCase())),
        }}
        onApplied={(outcome) => {
          if (outcome.created.length === 0) return;
          /* Turn the reviewed rows into real quotes. `addCreatedQuote` is
             the same registry the create-quote flow writes to, so the
             detail page can open an imported quote by id without any
             import-specific plumbing. */
          const importedAt = new Date().toISOString();
          const meta = { importedAt, importName: outcome.importName, fileName: outcome.fileName };
          const built = outcome.created.map((record, i) => materializeQuote(record, meta, i));
          built.forEach(({ quote, lineItems, adjustments }) => {
            addCreatedQuote(quote, lineItems);
            /* The file's one-time discounts and premiums, waiting for the
               detail page to seed its adjustments layer. */
            setCreatedQuoteAdjustments(quote.id, adjustments);
          });
          setQuotes(prev => [...built.map(b => b.quote), ...prev]);
          /* Land the user on a view where the new rows are actually
             visible — same reset the create flow does. */
          setCurrentPage(1); setSearchQuery(''); setActiveStates(new Set()); setShowArchived(false); setSortConfig(null);
          const n = built.length;
          setImportNotice({
            created: n,
            updated: 0,
            skipped: outcome.skipped.length + outcome.failed.length,
            warnings: outcome.warningCount,
            importId: `IMP-${Date.now()}`,
          });
          toast.success(`${n} quote${n === 1 ? '' : 's'} imported as V1 and tagged Legacy Import.`, {
            description: n === 1 ? `${built[0].quote.quoteNumber} is now at the top of the listing.` : 'They are at the top of the listing.',
            action: { label: n === 1 ? 'Open' : 'Open first', onClick: () => navigate(`/quotes/${built[0].quote.id}`) },
          });
        }}
      />

      <CreateQuoteModal
        open={isCreateQuoteModalOpen}
        onOpenChange={setIsCreateQuoteModalOpen}
        onQuoteCreated={handleQuoteCreated}
        onNavigateToQuote={(quoteId) => {
          setIsCreateQuoteModalOpen(false);
          navigate(`/quotes/${quoteId}`);
        }}
      />
      <AssignSalesRepModal open={showAssignRepModal} onOpenChange={setShowAssignRepModal} selectedCount={selectedRows.size}
        onAssign={rep => { toast.success(`Assigned ${rep} to ${selectedRows.size} quote${selectedRows.size > 1 ? 's' : ''}`); setSelectedRows(new Set()); setShowAssignRepModal(false); }} />
      {versionHistoryQuote && (
        <VersionHistoryModal
          quoteId={versionHistoryQuote.id}
          currentVersion={versionHistoryQuote.version}
          onClose={() => setVersionHistoryQuote(null)}
          onRevert={(toVersion) => {
            setQuotes(prev => prev.map(q => q.id === versionHistoryQuote.id ? { ...q, version: toVersion } : q));
            setVersionHistoryQuote(prev => prev ? { ...prev, version: toVersion } : prev);
          }}
        />
      )}
      {pdfPreviewQuote && (
        <PDFPreviewModal
          isOpen={true}
          onClose={() => setPdfPreviewQuote(null)}
          quote={pdfPreviewQuote.quote}
          mode={pdfPreviewQuote.mode}
          isNewlyCreated={pdfPreviewQuote.isNewlyCreated}
        />
      )}

      {/* Row-level Archive — same standalone ArchiveQuoteModal the kanban
          and details-page Actions menu use, so the single-row flow carries
          the same red ConfirmationModal + Reason textarea everywhere. */}
      {rowArchiveTarget && (
        <ArchiveQuoteModal
          isOpen
          quoteNumber={rowArchiveTarget.quoteNumber}
          onCancel={() => setRowArchiveTarget(null)}
          onConfirm={(_reason) => {
            toast.success(`${rowArchiveTarget.quoteNumber} archived`);
            setRowArchiveTarget(null);
          }}
        />
      )}

      {/* Row-level Cancel. Converted quotes have no Cancel in the row menu. */}
      {rowCancelTarget && (
        <CancelQuoteModal
          isOpen
          quoteNumber={rowCancelTarget.quoteNumber}
          onCancel={() => setRowCancelTarget(null)}
          onConfirm={(_reason) => {
            toast.info(`${rowCancelTarget.quoteNumber} cancelled`);
            setRowCancelTarget(null);
          }}
        />
      )}

      {/* Duplicate Quote modal + overlay
          1. User clicks Duplicate in a row → DuplicateQuoteModal opens.
          2. On confirm we build the duplicate via the shared
             `duplicateQuote()` helper (persists in module store + returns
             the new Quote object) and inject it at the head of the local
             `quotes` state so the listing reflects it immediately.
          3. The custom action overlay plays the same animation used for
             archive/cancel/convert. When it finishes we navigate to the
             new quote's detail page.
          The duplicate persists in the listing until a hard refresh
          wipes the JS module's `createdQuotes` map. */}
      {duplicateTarget && (
        <DuplicateQuoteModal
          isOpen={true}
          onClose={() => setDuplicateTarget(null)}
          quoteNumber={duplicateTarget.quoteNumber}
          currentCustomer={typeof duplicateTarget.customer === 'string' ? duplicateTarget.customer : duplicateTarget.customer?.name || ''}
          /* The latest version reflects the quote's current operational
             state. When the quote has been converted to a Sales Order
             (Unconfirmed SO / Confirmed SO) or has reached a terminal
             state (Cancelled / Archived / Expired), mark the latest
             version as non-duplicable. */
          availableVersions={(duplicateTarget.versions || []).map(v => {
            const nonDuplicableStatuses = ['Unconfirmed SO', 'Confirmed SO', 'Cancelled', 'Archived', 'Expired'];
            const latestNum = duplicateTarget.version ?? duplicateTarget.versions?.[duplicateTarget.versions.length - 1]?.version;
            const isLatest = v.version === latestNum;
            return isLatest && nonDuplicableStatuses.includes(duplicateTarget.status) ? { ...v, canDuplicate: false } : v;
          })}
          currentVersion={duplicateTarget.version}
          onConfirm={({ customerId, customerName, versionMode, selectedVersion }) => {
            const source = duplicateTarget;
            setDuplicateTarget(null);
            const existingNumbers = quotes.map(q => q.quoteNumber);
            const result = duplicateQuote(source, {
              newCustomerId: customerId,
              newCustomerName: customerName,
              versionMode,
              selectedVersion,
              existingQuoteNumbers: existingNumbers,
            });
            /* Splice the new quote in at the top of the listing state so
               the table updates instantly. Filtering by status, search,
               etc. still applies; the new quote always shows up because
               its status is "Draft". */
            setQuotes(prev => [result.quote, ...prev]);
            setCurrentPage(1);
            const versionMeta = versionMode === 'all'
              ? 'all versions copied'
              : `from V${selectedVersion}`;
            setDuplicateActionOverlay({
              config: {
                processing: 'Duplicating Quote',
                done: `${result.quote.quoteNumber} created (${versionMeta})`,
                icon: Copy,
                accentColor: 'var(--primary)',
                accentBg: 'var(--accent)',
                ringColor: 'rgba(10, 119, 255, 0.4)',
              },
              onComplete: () => {
                setDuplicateActionOverlay(null);
                toast.success(`Quote duplicated → ${result.quote.quoteNumber}`, {
                  description: `New draft created for ${customerName}.`,
                });
                navigate(`/quotes/${result.quote.id}`);
              },
            });
          }}
        />
      )}
      <StatusTransitionOverlay
        isActive={duplicateActionOverlay !== null}
        fromStatus={'draft'}
        toStatus={'draft'}
        customAction={duplicateActionOverlay?.config ?? null}
        onComplete={() => duplicateActionOverlay?.onComplete()}
      />

      {/* Item QuickView — Partner v7 panel; opens on item-thumbnail tap. */}
      <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />

      {/* ═══ Kanban Fullscreen Portal ═══ */}
      {kanbanFullscreen && createPortal(
        <div className="fixed inset-0 z-[200] flex flex-col bg-background" style={{ overflow: 'hidden' }}>
          {/* Page header bar — kept visible in fullscreen so the user can
              still spin up a new quote without exiting back to the
              regular listing first. Mirrors the bar that ships above the
              non-fullscreen layout (line ~906). Performance Insights
              stays omitted in fullscreen — the kanban gets all the
              vertical pixels below this bar. */}
          <div className="flex items-center justify-between shrink-0 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent">
                <FileText className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-[20px]">Quotes</h1>
                <p className="text-xs text-muted-foreground" style={{ marginTop: 1 }}>Create, manage, and track customer quotes through the entire lifecycle.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Actions, Import / Export (hidden: IMPORT_EXPORT_ENABLED). Mirrors the non-fullscreen header. */}
              {IMPORT_EXPORT_ENABLED && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13px] rounded-lg border border-border bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    Actions
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-0">
                  <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => setImportOpen(true)}>
                    <Upload className="w-3.5 h-3.5 text-[#64748B]" />
                    Import
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => { void handleExport(); }}>
                    <Download className="w-3.5 h-3.5 text-[#64748B]" />
                    Export
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              )}
              <Button onClick={() => setIsCreateQuoteModalOpen(true)} className="bg-primary text-primary-foreground shrink-0">
                <Plus className="w-4 h-4 mr-1.5" /> Create New Quote
              </Button>
            </div>
          </div>

          {/* White card with full content */}
          <div className="bg-card border border-border relative flex flex-col min-h-0 flex-1 overflow-clip rounded-xl mx-4 mb-4 mt-2">

            {/* Fullscreen Toolbar */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
                  <Input placeholder="Search by quote no, customer, or rep..." value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    style={{ backgroundColor: '#FFFFFF' }}
                    className="pl-9 pr-8 h-9 text-sm border-border/80 shadow-sm placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/20" />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <SharedFiltersButton count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Insights toggle is intentionally omitted in the fullscreen
                    board view — the KPI cards row is already hidden there
                    to maximise the board area, and the user can re-enable
                    insights from the main toolbar after exiting fullscreen. */}
                {/* Exit fullscreen — portal-rendered white tooltip,
                    same surface as the KPI info hover-cards. */}
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setKanbanFullscreen(false)}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none shrink-0"
                      >
                        <Minimize2 className="w-[18px] h-[18px] text-muted-foreground/80" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      sideOffset={6}
                      className="bg-white text-muted-foreground border border-border rounded-lg px-3 py-2 shadow-md text-[11px]"
                      style={{ lineHeight: 1.55, fontWeight: 500 }}
                    >
                      Exit fullscreen · <kbd className="text-[10px] opacity-70">Esc</kbd>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Fullscreen Pills Row */}
            <div className="flex items-center gap-1.5 px-4 pb-3 shrink-0" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
              {/* Me mode */}
              <button onClick={() => { setMeMode(!meMode); setCurrentPage(1); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  meMode ? "border-primary bg-accent hover:bg-accent" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                }`}
                style={{ fontWeight: meMode ? 500 : 400, color: meMode ? "var(--primary)" : undefined }}>
                <User className="w-3.5 h-3.5" /> Me mode
              </button>
              <div className="w-px h-5 bg-border mx-1 shrink-0" />

              {/* Group By */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${
                    boardGroupBy !== 'none' ? "border-primary bg-accent hover:bg-accent" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                  }`} style={{ fontWeight: boardGroupBy !== 'none' ? 500 : 400, color: boardGroupBy !== 'none' ? 'var(--primary)' : undefined }}>
                    <Layers className="w-3.5 h-3.5" />
                    <span>{boardGroupBy === 'none' ? 'Group By' : boardGroupBy === 'salesRep' ? 'Sales Rep' : boardGroupBy === 'customer' ? 'Customer' : 'Priority'}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[180px]">
                  {[{ value: 'none', label: 'No Grouping' }, { value: 'salesRep', label: 'Sales Rep' }, { value: 'customer', label: 'Customer' }, { value: 'priority', label: 'Priority' }].map(opt => (
                    <DropdownMenuItem key={opt.value} className="flex items-center justify-between cursor-pointer" onClick={() => setBoardGroupBy(opt.value as any)}>
                      <span className="text-sm">{opt.label}</span>
                      {boardGroupBy === opt.value && <Check className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Time Duration */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${
                    boardTimeDuration !== 'all' ? "border-primary bg-accent hover:bg-accent" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"
                  }`} style={{ fontWeight: boardTimeDuration !== 'all' ? 500 : 400, color: boardTimeDuration !== 'all' ? 'var(--primary)' : undefined }}>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{boardTimeDuration === 'last_7_days' ? 'Last 7 days' : boardTimeDuration === 'last_30_days' ? 'Last 30 days' : boardTimeDuration === 'last_6_months' ? 'Last 6 months' : boardTimeDuration === 'last_12_months' ? 'Last 12 months' : 'All'}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[170px]">
                  {[{ value: 'last_7_days', label: 'Last 7 days' }, { value: 'last_30_days', label: 'Last 30 days' }, { value: 'last_6_months', label: 'Last 6 months' }, { value: 'last_12_months', label: 'Last 12 months' }, { value: 'all', label: 'All' }].map(opt => (
                    <DropdownMenuItem key={opt.value} className="flex items-center justify-between cursor-pointer" onClick={() => setBoardTimeDuration(opt.value)}>
                      <span className="text-sm">{opt.label}</span>
                      {boardTimeDuration === opt.value && <Check className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-px h-5 bg-border mx-1 shrink-0" />

              {/* Status filter pills */}
              {MAIN_STATUS_PILLS.map(sf => {
                const isShowAllPill = sf.key === 'all';
                const isActive = isShowAllPill ? showAll : activeStates.has(sf.key as ActiveStateKey);
                const count = filterCounts[sf.key as QuickFilter];
                return (
                  <button key={sf.key} onClick={() => { if (isShowAllPill) selectShowAll(); else toggleActiveState(sf.key as ActiveStateKey); }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive ? "border-primary bg-accent hover:bg-accent active:bg-[#ADD1FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"
                    }`}
                    style={{ fontWeight: isActive ? 500 : 400, color: isActive ? 'var(--primary)' : undefined }}>
                    {sf.label}
                    {sf.showCount && <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`} style={{ fontWeight: 600, color: isActive ? 'var(--primary)' : 'var(--foreground)' }}>{count}</span>}
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

      {/* Column drag ghost — Partner-parity pill with grip icon, blur
          surface, and optional sort/filter indicators. Positioned via
          the ref set inside the mousemove handler so drag movement
          runs at zero re-renders. */}
      {createPortal(
        <div
          ref={ghostElRef}
          style={{
            position: 'fixed', top: 0, left: 0, zIndex: 9999,
            pointerEvents: 'none',
            opacity: draggingColumnKey ? 1 : 0,
            transition: 'opacity 80ms ease-out',
            willChange: 'transform',
          }}
        >
          {draggingColumnKey && (() => {
            const ghostSort: 'asc' | 'desc' | null = sortConfig?.key === draggingColumnKey ? sortConfig.direction : null;
            const ghostFilter = columnFilters[draggingColumnKey] ? isFilterActive(columnFilters[draggingColumnKey]) : false;
            return (
              <div
                className="flex items-center gap-1.5 h-[32px] pl-2 pr-3 rounded-md whitespace-nowrap"
                style={{
                  marginLeft: 12,
                  marginTop: -14,
                  backgroundColor: 'rgba(255,255,255,0.92)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(10,119,255,0.3)',
                  boxShadow: '0 1px 3px rgba(10,119,255,0.08), 0 6px 20px rgba(0,0,0,0.10)',
                }}
              >
                <GripVertical className="w-3 h-3 shrink-0" style={{ color: 'var(--primary)' }} />
                <span className="text-[13px]" style={{ color: 'var(--primary)', fontWeight: 500 }}>
                  {colDef(draggingColumnKey)?.label}
                </span>
                {ghostSort === 'asc' && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: 'var(--primary)' }} />}
                {ghostSort === 'desc' && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: 'var(--primary)' }} />}
                {ghostFilter && !ghostSort && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--primary)' }} />}
              </div>
            );
          })()}
        </div>,
        document.body,
      )}
    </>
  );
}
