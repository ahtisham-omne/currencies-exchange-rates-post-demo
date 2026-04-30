import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useSOStore } from "./store";
import { usePersona } from "./PersonaContext";
import { SOStatusBadge, PriorityBadge } from "./StatusBadge";
import { HighlightText } from "./SearchHighlight";
import { InsightsPanel, type ActiveInsight } from "./InsightsPanel";
import { SOColumnConfigurator, type ColumnDef } from "./SOColumnConfigurator";
import { SOKanbanBoard } from "./SOKanbanBoard";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { SOColumnHeaderMenu, type SortConfig, isFilterActive } from "./SOColumnHeaderMenu";
import { OverflowTooltip, type OverflowItem } from "./OverflowTooltip";
import { getAvatarTint } from "./avatarTints";
import { CustomerHoverCard } from "./CustomerHoverCard";
import { SOFilterBar } from "./SOFilterBar";
// SOFilterPills removed — filters managed via modal only
import { EMPTY_SO_FILTERS, countActiveSOFilters, type SOActiveFilters } from "./SOFilterUtils";
import type { SOStatus } from "./types";
import { ARCHIVABLE_STATES } from "./types";
import {
  FileText, Plus, Search, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Columns3,
  Archive, ArchiveRestore,
  BarChart3, MoreHorizontal, Copy, FileDown, Eye, Ban, Printer,
  User, AlignJustify, List, LayoutGrid, X, Trash2, Info,
  Send, Lock, ArrowUpRight, CheckCircle, Check,
  SlidersHorizontal, GripVertical, ArrowUp, ArrowDown, ArrowUpDown,
  AlertCircle, Layers, Users, Building2, Flag, Calendar, Maximize2, Minimize2,
} from "lucide-react";
import { CreateSOModal, type SOCreationPayload } from "./CreateSOModal";
import { ConfirmSOModal } from "./ConfirmSOModal";
import { BulkConfirmSOModal } from "./BulkConfirmSOModal";
import { CancellationModal } from "./CancellationModal";
import { BulkSubmitForReviewModal, BulkCloseOrdersModal, BulkCancellationModal } from "./BulkActionModals";
import { toast } from "sonner";
import { Button } from "./ui/Button";
import type { SalesOrder } from "./types";
/* ═══════════════════════════════════════════════════════
   Status filter pills — Archived is separated
   ═══════════════════════════════════════════════════════ */
const MAIN_STATUS_FILTERS: ("All" | SOStatus)[] = [
  "All", "Draft", "Pending Review", "Cleared", "Partially Shipped", "Shipped", "Cancelled", "Partially Cancelled",
];

const STATUS_FILTER_LABELS: Record<string, string> = {
  "All": "Show All", "Draft": "Draft", "Pending Review": "Pending Review",
  "Cleared": "Cleared by Ops", "Partially Shipped": "Partially Shipped",
  "Shipped": "Shipped", "Cancelled": "Cancelled", "Partially Cancelled": "Partially Cancelled", "Archived": "Archived",
};

const STATUS_FILTER_MAP: Record<string, SOStatus[]> = {
  "Cancelled": ["Cancelled"],
};

/* ═══ Mock data arrays ═══ */
const POC_NAMES = [
  "Meredith", "Toby", "Robert", "Ryan", "Kevin", "Pam",
  "Holly", "Creed", "Meredith", "Ryan", "Kevin", "Robert",
  "Holly", "Toby", "Pam", "Meredith",
];
const POC_EXTRA = [0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
const CREATED_BY = [
  "Emily Chen", "Adrian User", "System Import", "Marcus Taylor",
  "Adrian User", "David Park", "Emily Chen", "Emily Chen",
  "System Import", "Marcus Taylor", "James Rodriguez", "Emily Chen",
];

/* Version badge — now using shared component */
import { VersionBadge } from "./VersionBadge";

/* ═══ Density config matching Partner module ═══ */
type DensityOption = "condensed" | "comfort" | "kanban";
const DENSITY_CONFIG: { key: DensityOption; label: string; description: string; icon: typeof AlignJustify }[] = [
  { key: "condensed", label: "Condensed", description: "Compact view", icon: AlignJustify },
  { key: "comfort", label: "Comfort", description: "Spacious view", icon: List },
  { key: "kanban", label: "Kanban View", description: "Board layout", icon: LayoutGrid },
];

/* ═══ Column definitions — Partner-style with minWidth, sortable ═══ */
interface SOColumnDef {
  key: string;
  label: string;
  minWidth: number;
  sortable?: boolean;
  align?: "left" | "right";
  locked?: boolean;
}

const COLUMN_DEFS: SOColumnDef[] = [
  { key: "so", label: "Sales Order #", minWidth: 170, sortable: true, locked: true },
  { key: "quote", label: "Quote #", minWidth: 120, sortable: true },
  { key: "customer", label: "Customer Name", minWidth: 200, sortable: true },
  { key: "status", label: "Order Status", minWidth: 170, sortable: true },
  { key: "poc", label: "POC", minWidth: 220 },
  { key: "salesrep", label: "Sales Rep", minWidth: 170, sortable: true },
  { key: "value", label: "Order Value", minWidth: 130, sortable: true, align: "right" },
  { key: "invoiced", label: "Invoiced Amount", minWidth: 155, sortable: true, align: "right" },
  { key: "payments", label: "Payments Made", minWidth: 150, sortable: true },
  { key: "orderdate", label: "Order Date", minWidth: 120, sortable: true },
  { key: "shipby", label: "Ship By", minWidth: 120 },
  { key: "delivery", label: "Delivery Date", minWidth: 130 },
  { key: "createdon", label: "Created On", minWidth: 120, sortable: true },
  { key: "createdby", label: "Created By", minWidth: 150 },
  { key: "lastupdated", label: "Last Updated", minWidth: 130 },
  { key: "confirmation", label: "Confirmation Date", minWidth: 150 },
  { key: "priority", label: "Priority", minWidth: 100, sortable: true },
  { key: "warehouse", label: "Warehouse", minWidth: 130 },
  { key: "currency", label: "Currency", minWidth: 90 },
  { key: "linecount", label: "No. of Items", minWidth: 190, sortable: true },
];

const DEFAULT_COLUMN_ORDER = COLUMN_DEFS.map(c => c.key);
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = Object.fromEntries(
  COLUMN_DEFS.map(c => [c.key, c.key !== "currency"])
);
const LOCKED_COLUMNS = ["so"];
const MIN_COL_WIDTH = 60;
const CHECKBOX_COL_WIDTH = 40;

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = Object.fromEntries(
  COLUMN_DEFS.map(c => [c.key, c.minWidth])
);

function colDef(key: string) { return COLUMN_DEFS.find(c => c.key === key)!; }

/* ═══ Styled Tooltip for bulk action icons ═══ */
function ActionTooltip({ children, label, description }: { children: React.ReactNode; label: string; description: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const onEnter = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.top - 8, left: r.left + r.width / 2 });
    setShow(true);
  };

  return (
    <div ref={triggerRef} onMouseEnter={onEnter} onMouseLeave={() => setShow(false)} className="relative">
      {children}
      {show && (
        <div className="fixed z-[300] pointer-events-none" style={{ top: pos.top, left: pos.left, transform: "translate(-50%, -100%)" }}>
          <div className="bg-white rounded-lg border border-border/50 px-3 py-2 text-left" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)", minWidth: 140, maxWidth: 220 }}>
            <div className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>{label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5" style={{ fontWeight: 400 }}>{description}</div>
          </div>
          <div className="flex justify-center -mt-px">
            <div className="w-2 h-2 rotate-45 bg-white border-b border-r border-border/50" />
          </div>
        </div>
      )}
    </div>
  );
}

const DND_LIST_KPI = "LIST_KPI_CARD";

/* ═══ DraggableListKpiCard — matches Partner Management exactly ═══ */
function DraggableInsightCard({ index, card, moveCard, onRemove }: {
  index: number;
  card: { label: string; value: string; trending?: "up" | "down" | "neutral"; description?: string };
  moveCard: (from: number, to: number) => void;
  onRemove?: (label: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: DND_LIST_KPI,
    item: () => ({ index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DND_LIST_KPI,
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

  /* Dragging ghost — dashed placeholder */
  if (isDragging) {
    return (
      <div
        ref={ref}
        className="rounded-lg border border-dashed border-[#0A77FF]/20 bg-[#0A77FF]/[0.02] min-h-[52px] pointer-events-none"
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`border rounded-lg bg-white group relative min-w-0 transition-all duration-200 select-none cursor-grab active:cursor-grabbing ${
        isOver
          ? "border-[#0A77FF]/30 bg-[#0A77FF]/[0.03] shadow-[0_0_0_2px_rgba(10,119,255,0.08)] scale-[1.02]"
          : "border-[#E2E8F0] hover:-translate-y-[1px] hover:border-[#93B8F7] hover:shadow-[0_2px_8px_-3px_rgba(10,119,255,0.06)]"
      }`}
    >
      {/* Drop zone overlay */}
      {isOver && (
        <div className="absolute inset-0 rounded-lg bg-[#0A77FF]/[0.02] pointer-events-none" />
      )}
      <div className="px-3 py-2">
        {/* Drag handle — top-right pill */}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center bg-[#F1F5F9] rounded-md p-1 z-10 pointer-events-none">
          <GripVertical className="w-3.5 h-3.5 text-[#64748B]" />
        </div>
        {/* Label row: label + info icon + trend icon */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-[10.5px] text-[#64748B] whitespace-nowrap" style={{ fontWeight: 500 }}>{card.label}</p>
            {card.description && (
              <div className="relative group/info inline-flex shrink-0">
                <button type="button" className="inline-flex shrink-0" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                  <Info className="w-3 h-3 text-[#CBD5E1] hover:text-[#94A3B8] transition-colors cursor-help" />
                </button>
                <div className="absolute z-50 w-[220px] pointer-events-none opacity-0 group-hover/info:opacity-100 transition-opacity duration-200 bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2">
                  <div className="bg-white border border-border rounded-lg px-3 py-2 shadow-md text-[11px] text-muted-foreground" style={{ lineHeight: 1.55 }}>
                    {card.description}
                  </div>
                </div>
              </div>
            )}
          </div>
          {card.trending === "up" && (
            <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0" style={{ marginRight: card.description ? 18 : 0 }}>
              <path d="M1 9L5 4L8 7L13 1" stroke="#94A3B8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {/* Value */}
        <div className="flex items-baseline gap-1.5">
          <p className="text-[15px] text-[#0F172A] tracking-tight whitespace-nowrap" style={{ fontWeight: 600, lineHeight: 1.2 }}>{card.value}</p>
        </div>
      </div>
      {/* Remove button — bottom-right on hover, trash icon */}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(card.label); }}
          className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-150 p-1 rounded cursor-pointer hover:bg-red-50 z-10"
          title={`Remove ${card.label}`}
        >
          <Trash2 className="w-3 h-3 text-[#94A3B8] hover:text-[#EF4444]" />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SOList Component
   ═══════════════════════════════════════════════════════ */
export function SOList() {
  const { salesOrders, createSO, unarchiveSO, archiveSO, cancelSO, confirmSO, markUnconfirmed, cancelSOLines, updateSO, reactivateSO } = useSOStore();
  const navigate = useNavigate();
  
  const { isCreator, isReviewer } = usePersona();
  const [statusFilter, setStatusFilter] = useState<"All" | SOStatus | "Archived">("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [density, setDensity] = useState<DensityOption>("condensed");
  const [densityOpen, setDensityOpen] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [meMode, setMeMode] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [insightsCollapsed, setInsightsCollapsed] = useState(false);
  const moveInsight = useCallback((fromIndex: number, toIndex: number) => {
    setActiveInsights((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);
  const [activeInsights, setActiveInsights] = useState<ActiveInsight[]>([
    { label: "Total Orders", value: "", trending: "up" },
    { label: "Total Projected Revenue", value: "", trending: "up", description: "Cumulative value of all confirmed sales orders in the selected period. Represents order bookings, not invoiced revenue." },
    { label: "Overdue Orders", value: "", trending: "up", description: "Orders where at least one line item has passed its promised ship-by date and has not yet been shipped." },
    { label: "High Priority Orders", value: "", description: "Total number of orders currently marked with Critical priority status." },
    { label: "Ready to Ship", value: "", description: "Orders that are fully allocated and packed, awaiting carrier pickup or shipment dispatch." },
    { label: "Avg. Days to Fulfill", value: "", description: "Average number of days from Cleared by Ops to fully shipped, across all completed orders in the selected period." },
  ]);
  const [confirmSingleSO, setConfirmSingleSO] = useState<SalesOrder | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [cancelTargetSO, setCancelTargetSO] = useState<SalesOrder | null>(null);
  const [cancelModalMode, setCancelModalMode] = useState<"full" | "partial">("full");
  const [showBulkSubmitReview, setShowBulkSubmitReview] = useState(false);
  const [showBulkClose, setShowBulkClose] = useState(false);
  const [showBulkCancel, setShowBulkCancel] = useState(false);
  const [versionModalSO, setVersionModalSO] = useState<SalesOrder | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState<SOActiveFilters>(EMPTY_SO_FILTERS);

  // Kanban-specific controls (lifted from SOKanbanBoard)
  const [kanbanGroupBy, setKanbanGroupBy] = useState<"none" | "salesRep" | "customer" | "priority">("none");
  const [kanbanGroupByOpen, setKanbanGroupByOpen] = useState(false);
  const kanbanGroupByRef = useRef<HTMLDivElement>(null);
  const [kanbanTimeDuration, setKanbanTimeDuration] = useState("last_30_days");
  const [kanbanTimeDurationOpen, setKanbanTimeDurationOpen] = useState(false);
  const kanbanTimeDurationRef = useRef<HTMLDivElement>(null);
  const [kanbanFullscreen, setKanbanFullscreen] = useState(false);
  const [listingFullscreen, setListingFullscreen] = useState(false);

  // Escape key: clear selection first, then exit fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedIds.size > 0) { e.preventDefault(); setSelectedIds(new Set()); return; }
        if (listingFullscreen || kanbanFullscreen) { e.preventDefault(); setListingFullscreen(false); setKanbanFullscreen(false); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedIds.size, listingFullscreen, kanbanFullscreen]);

  const anyFullscreen = listingFullscreen || kanbanFullscreen;

  const isKanban = density === "kanban";
  const [columnOrder, setColumnOrder] = useState<string[]>([...DEFAULT_COLUMN_ORDER]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({ ...DEFAULT_COLUMN_VISIBILITY });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({ ...DEFAULT_COLUMN_WIDTHS });
  const [frozenColumns, setFrozenColumns] = useState<Set<string>>(new Set(["so"]));
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  /* Column drag reorder state */
  const colDragRef = useRef<{ columnKey: string; startX: number; startY: number; isDragging: boolean; lastSwapTime: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const ghostElRef = useRef<HTMLDivElement>(null);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);

  /* Column resize refs */
  const resizeRef = useRef<{ columnKey: string; startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumnKey, setResizingColumnKey] = useState<string | null>(null);

  const contentCardRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionRef.current && !actionRef.current.contains(e.target as Node)) setOpenActionId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Visible columns in user-defined order ── */
  const visibleColumns = useMemo(() => {
    const ordered = columnOrder.filter(k => COLUMN_DEFS.some(c => c.key === k) && columnVisibility[k] !== false);
    if (!ordered.includes("so")) ordered.unshift("so");
    else if (ordered[0] !== "so") { const idx = ordered.indexOf("so"); ordered.splice(idx, 1); ordered.unshift("so"); }
    return ordered;
  }, [columnOrder, columnVisibility]);

  const visibleColCount = visibleColumns.length;

  /* ── Kanban-specific column defs (card fields) ── */
  const KANBAN_COLUMN_DEFS: { key: string; label: string; defaultVisible: boolean }[] = [
    { key: "Draft", label: "Draft", defaultVisible: true },
    { key: "Pending Review", label: "Pending Review", defaultVisible: true },
    { key: "Cleared", label: "Cleared by Ops", defaultVisible: true },
    { key: "Partially Shipped", label: "Partially Shipped", defaultVisible: true },
    { key: "Shipped", label: "Shipped", defaultVisible: true },
    { key: "Cancelled", label: "Cancelled", defaultVisible: true },
    { key: "Archived", label: "Archived", defaultVisible: true },
    { key: "Expired", label: "Expired", defaultVisible: true },
  ];

  /* ── For legacy SOColumnConfigurator ── */
  const legacyColumns: ColumnDef[] = useMemo(() => {
    if (isKanban) {
      return KANBAN_COLUMN_DEFS.map(kd => ({
        key: kd.key, label: kd.label,
        visible: columnVisibility[kd.key] !== undefined ? columnVisibility[kd.key] : kd.defaultVisible,
        locked: false,
      }));
    }
    return columnOrder.map(key => {
      const def = COLUMN_DEFS.find(c => c.key === key);
      if (!def) return null;
      return { key, label: def.label, visible: columnVisibility[key] !== false, locked: LOCKED_COLUMNS.includes(key) };
    }).filter(Boolean) as ColumnDef[];
  }, [columnOrder, columnVisibility, isKanban]);

  const handleLegacyColumnsChange = useCallback((cols: ColumnDef[]) => {
    setColumnOrder(cols.map(c => c.key));
    const vis: Record<string, boolean> = {};
    cols.forEach(c => { vis[c.key] = c.visible; });
    setColumnVisibility(vis);
  }, []);

  /* ── Frozen column offsets ── */
  const frozenOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let cumLeft = CHECKBOX_COL_WIDTH;
    for (const key of visibleColumns) {
      if (frozenColumns.has(key)) {
        offsets[key] = cumLeft;
        cumLeft += columnWidths[key] ?? colDef(key).minWidth;
      }
    }
    return offsets;
  }, [visibleColumns, frozenColumns, columnWidths]);

  const lastFrozenKey = useMemo(() => {
    let last = "";
    for (const key of visibleColumns) { if (frozenColumns.has(key)) last = key; }
    return last;
  }, [visibleColumns, frozenColumns]);

  /* ── Column drag reorder (Partner-style mouse events) ── */
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: string) => {
    if (LOCKED_COLUMNS.includes(columnKey)) return;
    if (isResizing) return;
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    colDragRef.current = { columnKey, startX, startY, isDragging: false, lastSwapTime: 0 };

    const DRAG_THRESHOLD = 5;
    const SWAP_SETTLE_MS = 60;

    const onMove = (moveEvt: MouseEvent) => {
      if (!colDragRef.current) return;
      const dx = moveEvt.clientX - colDragRef.current.startX;
      const dy = moveEvt.clientY - colDragRef.current.startY;
      if (!colDragRef.current.isDragging) {
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        colDragRef.current.isDragging = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        setDraggingColumnKey(colDragRef.current.columnKey);
      }
      const ghost = ghostElRef.current;
      if (ghost) ghost.style.transform = `translate(${moveEvt.clientX}px, ${moveEvt.clientY}px)`;
      const now = performance.now();
      if (now - colDragRef.current.lastSwapTime < SWAP_SETTLE_MS) return;
      const cursorX = moveEvt.clientX;
      const draggedKey = colDragRef.current.columnKey;
      const draggedTh = document.querySelector<HTMLElement>(`th[data-col-drag-key="${draggedKey}"]`);
      if (!draggedTh) return;
      const draggedRect = draggedTh.getBoundingClientRect();
      if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;
      const allThs = document.querySelectorAll<HTMLElement>("th[data-col-drag-key]");
      for (const th of allThs) {
        const rect = th.getBoundingClientRect();
        if (cursorX < rect.left || cursorX > rect.right) continue;
        const k = th.getAttribute("data-col-drag-key");
        if (!k || k === draggedKey || LOCKED_COLUMNS.includes(k)) break;
        setColumnOrder(prev => {
          const srcIdx = prev.indexOf(draggedKey);
          const tgtIdx = prev.indexOf(k);
          if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return prev;
          const next = [...prev];
          next.splice(srcIdx, 1);
          next.splice(tgtIdx, 0, draggedKey);
          return next;
        });
        colDragRef.current.lastSwapTime = now;
        break;
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (colDragRef.current?.isDragging) {
        suppressNextClickRef.current = true;
        requestAnimationFrame(() => { suppressNextClickRef.current = false; });
      }
      colDragRef.current = null;
      setDraggingColumnKey(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [isResizing]);

  /* ── Column resize ── */
  const handleResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[columnKey] ?? colDef(columnKey).minWidth;
    resizeRef.current = { columnKey, startX: e.clientX, startWidth };
    setIsResizing(true);
    setResizingColumnKey(columnKey);
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = moveEvent.clientX - resizeRef.current.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizeRef.current.startWidth + delta);
      setColumnWidths(prev => ({ ...prev, [resizeRef.current!.columnKey]: newWidth }));
    };
    const handleMouseUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      setResizingColumnKey(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [columnWidths]);

  /* ── Column header menu handlers ── */
  const handleSort = useCallback((key: string, direction: "asc" | "desc" | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ key, direction });
    setPage(1);
  }, []);

  const handleHideColumn = useCallback((columnKey: string) => {
    setColumnVisibility(prev => ({ ...prev, [columnKey]: false }));
    setSortConfig(prev => (prev?.key === columnKey ? null : prev));
  }, []);

  const handleFreezeColumn = useCallback((columnKey: string) => {
    setFrozenColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnKey) && columnKey !== "so") next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  }, []);

  const handleAddColumnFilter = useCallback((_columnKey: string) => {
    // No-op — column filters managed via filter pills/modal
  }, []);

  /* ── Row actions ── */
  const handleDuplicate = (soId: string) => {
    const original = salesOrders.find(s => s.id === soId);
    if (!original) return;
    const dup = createSO({ customer: original.customer, description: `Copy of ${original.soNumber}` });
    toast.success(`Duplicated ${original.soNumber} → ${dup.soNumber}`);
    setOpenActionId(null);
  };
  const handleArchiveRow = (soId: string) => { const so = salesOrders.find(s => s.id === soId); if (!so) return; archiveSO(soId); setTimeout(() => toast.success(`${so.soNumber} archived`), 1400); setOpenActionId(null); };
  const handleViewPDF = (soId: string) => { const so = salesOrders.find(s => s.id === soId); toast.success(`Generating PDF for ${so?.soNumber ?? soId}…`); setOpenActionId(null); };
  const handleExportCSV = (soId: string) => { const so = salesOrders.find(s => s.id === soId); toast.success(`Exporting CSV for ${so?.soNumber ?? soId}…`); setOpenActionId(null); };
  const handleCancelRow = (soId: string, forcePartial?: boolean) => {
    const so = salesOrders.find(s => s.id === soId);
    if (!so) return;
    const hasShipped = so.lines.some(l => !l.cancelled && l.shippedQty > 0);
    setCancelTargetSO(so);
    setCancelModalMode(forcePartial || hasShipped ? "partial" : "full");
    setOpenActionId(null);
  };
  const handleSubmitForReview = (soId: string) => { const so = salesOrders.find(s => s.id === soId); if (!so) return; markUnconfirmed(soId); toast.success(`${so.soNumber} submitted for review`); setOpenActionId(null); };
  const handleCloseRow = (_soId: string) => { /* closeSO removed */ };
  const handleUnarchiveRow = (soId: string) => { const so = salesOrders.find(s => s.id === soId); if (!so) return; unarchiveSO(soId); toast.success(`${so.soNumber} unarchived`); setOpenActionId(null); };
  const handleCancelFull = (reason: import("./types").CancellationReason, reasonText: string) => { if (!cancelTargetSO) return; cancelSO(cancelTargetSO.id, reason, reasonText); setTimeout(() => toast.info("Order cancelled"), 1400); setCancelTargetSO(null); };
  const handleCancelPartial = (lineIds: string[], cancelQtys: Record<string, number>, reason: import("./types").CancellationReason, reasonText: string) => { if (!cancelTargetSO) return; cancelSOLines(cancelTargetSO.id, lineIds, reason === "Other" && reasonText ? `${reason}: ${reasonText}` : reason, cancelQtys); setTimeout(() => toast.info(`${lineIds.length} line item${lineIds.length !== 1 ? "s" : ""} cancelled`), 1400); setCancelTargetSO(null); };

  /* ── Kanban drag-drop handlers ── */
  const handleKanbanStatusChange = useCallback((soId: string, fromStatus: SOStatus, toStatus: SOStatus) => {
    try {
      if (toStatus === "Draft") {
        if (fromStatus === "Archived" || fromStatus === "Cancelled" || fromStatus === "Partially Cancelled") {
          reactivateSO(soId);
        } else {
          updateSO(soId, { status: "Draft" });
        }
      } else if (toStatus === "Cleared") {
        const result = confirmSO(soId);
        if (!result.valid && result.errors) result.errors.forEach(e => toast.error(e));
      }
    } catch (err) {
      console.error("Kanban status change error:", err);
      toast.error("Failed to update order status");
    }
  }, [confirmSO, reactivateSO, updateSO]);

  const handleKanbanCancelRequest = useCallback((so: SalesOrder) => {
    const hasShipped = so.lines.some(l => !l.cancelled && l.shippedQty > 0);
    setCancelTargetSO(so);
    setCancelModalMode(hasShipped ? "partial" : "full");
  }, []);


  const selectedSOs = useMemo(() => salesOrders.filter(so => selectedIds.has(so.id)), [salesOrders, selectedIds]);
  const bulkApprovableCount = useMemo(() => selectedSOs.filter(so => so.status === "Pending Review" || so.status === "Draft").length, [selectedSOs]);
  const bulkArchivableCount = useMemo(() => selectedSOs.filter(so => ARCHIVABLE_STATES.includes(so.status)).length, [selectedSOs]);
  const bulkSubmitCount = useMemo(() => selectedSOs.filter(so => so.status === "Draft").length, [selectedSOs]);
  const bulkCloseCount = useMemo(() => selectedSOs.filter(so => so.status === "Shipped" || so.status === "Partially Shipped").length, [selectedSOs]);

  const handleBulkApprove = () => { if (bulkApprovableCount === 1) { const target = selectedSOs.find(so => so.status === "Pending Review" || so.status === "Draft"); if (target) setConfirmSingleSO(target); } else setShowBulkConfirm(true); };
  const handleBulkConfirmDone = (soIds: string[]) => { let approved = 0, errors = 0; soIds.forEach(id => { const result = confirmSO(id); if (result.valid) approved++; else errors++; }); if (approved > 0) toast.success(`Cleared ${approved} order${approved > 1 ? "s" : ""}`); if (errors > 0) toast.info(`${errors} order${errors > 1 ? "s" : ""} could not be cleared`); setSelectedIds(new Set()); setShowBulkConfirm(false); setConfirmSingleSO(null); };
  const handleSingleConfirmDone = () => { if (!confirmSingleSO) return; const result = confirmSO(confirmSingleSO.id); if (result.valid) toast.success("Sales Order cleared"); else result.errors.forEach(e => toast.error(e)); setConfirmSingleSO(null); setSelectedIds(new Set()); };
  const handleApproveRow = (soId: string) => { const so = salesOrders.find(s => s.id === soId); if (!so) return; setConfirmSingleSO(so); setOpenActionId(null); };
  const handleBulkArchive = () => { let archived = 0; selectedSOs.filter(so => ARCHIVABLE_STATES.includes(so.status)).forEach(so => { archiveSO(so.id); archived++; }); toast.success(`Archived ${archived} order${archived > 1 ? "s" : ""}`); setSelectedIds(new Set()); };
  const handleBulkSubmitForReview = () => { setShowBulkSubmitReview(true); };
  const handleBulkClose = () => { setShowBulkClose(true); };
  const handleBulkSubmitConfirmed = (soIds: string[]) => { let submitted = 0; soIds.forEach(id => { markUnconfirmed(id); submitted++; }); toast.success(`Submitted ${submitted} order${submitted > 1 ? "s" : ""} for review`); setSelectedIds(new Set()); setShowBulkSubmitReview(false); };
  const handleBulkCloseConfirmed = (_soIds: string[]) => { /* closeSO removed */ };
  const handleBulkCancelConfirmed = (soIds: string[], reason: import("./types").CancellationReason, reasonText: string) => { let cancelled = 0; soIds.forEach(id => { cancelSO(id, reason, reasonText); cancelled++; }); toast.info(`Cancellation requested for ${cancelled} order${cancelled > 1 ? "s" : ""}`); setSelectedIds(new Set()); setShowBulkCancel(false); };
  const handleBulkExportCSV = () => { toast.success(`Exporting CSV for ${selectedIds.size} order${selectedIds.size > 1 ? "s" : ""}…`); };
  const handleBulkPrint = () => { toast.success(`Generating print view for ${selectedIds.size} order${selectedIds.size > 1 ? "s" : ""}…`); };

  /* ── Filtering & Sorting ── */
  const filtered = useMemo(() => {
    let list = salesOrders;
    if (statusFilter === "All") list = list.filter(so => so.status !== "Archived");
    else if (statusFilter === "Archived") list = list.filter(so => so.status === "Archived");
    else { const mapped = STATUS_FILTER_MAP[statusFilter]; if (mapped) list = list.filter(so => mapped.includes(so.status) || so.status === statusFilter); else list = list.filter(so => so.status === statusFilter); }
    if (meMode) list = list.filter(so => so.salesRep === "Adrian User");
    if (search) { const q = search.toLowerCase(); list = list.filter(so => so.soNumber.toLowerCase().includes(q) || so.customer.toLowerCase().includes(q) || so.salesRep.toLowerCase().includes(q) || so.sourceQuoteRef.toLowerCase().includes(q)); }

    // Apply sorting
    if (sortConfig) {
      list = [...list].sort((a, b) => {
        const dir = sortConfig.direction === "asc" ? 1 : -1;
        let aVal: any, bVal: any;
        switch (sortConfig.key) {
          case "so": aVal = a.soNumber; bVal = b.soNumber; break;
          case "quote": aVal = a.sourceQuoteRef; bVal = b.sourceQuoteRef; break;
          case "customer": aVal = a.customer; bVal = b.customer; break;
          case "status": aVal = a.status; bVal = b.status; break;
          case "salesrep": aVal = a.salesRep; bVal = b.salesRep; break;
          case "value": aVal = a.total; bVal = b.total; break;
          case "priority": aVal = a.priority; bVal = b.priority; break;
          case "linecount": aVal = a.lines.length; bVal = b.lines.length; break;
          case "orderdate": aVal = a.orderDate; bVal = b.orderDate; break;
          case "createdon": aVal = a.createdDate; bVal = b.createdDate; break;
          default: aVal = ""; bVal = "";
        }
        if (typeof aVal === "string" && typeof bVal === "string") return dir * aVal.localeCompare(bVal);
        return dir * ((aVal > bVal ? 1 : aVal < bVal ? -1 : 0));
      });
    }

    return list;
  }, [salesOrders, statusFilter, search, meMode, sortConfig]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  /* ── Analytics ── */
  const activeSOs = useMemo(() => salesOrders.filter(s => s.status !== "Archived"), [salesOrders]);
  const stats = useMemo(() => {
    const totalRevenue = activeSOs.reduce((s, so) => s + so.total, 0);
    const totalOrders = activeSOs.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const pendingApproval = activeSOs.filter(s => s.status === "Pending Review").length;
    const overdueOrders = activeSOs.filter(s => s.status === "Cleared" || s.status === "Partially Shipped").length;
    const openOrderValue = activeSOs.filter(s => !["Cancelled", "Shipped"].includes(s.status)).reduce((s, so) => s + so.total, 0);
    const revenueAtRisk = activeSOs.filter(s => s.status === "Partially Cancelled").reduce((s, so) => s + so.total, 0);
    return { totalRevenue, totalOrders, avgOrderValue, pendingApproval, overdueOrders, openOrderValue, revenueAtRisk };
  }, [activeSOs]);

  const insightCardData = useMemo(() => {
    const highPriorityCount = activeSOs.filter(s => s.priority === "High").length;
    const readyToShipCount = activeSOs.filter(s => s.status === "Cleared" && s.lines.every(l => l.cancelled || l.allocatedQty >= l.orderedQty)).length;
    const pipelineValue = activeSOs.filter(s => !["Cancelled", "Archived"].includes(s.status)).reduce((s, so) => s + so.total, 0);
    const clearedValue = activeSOs.filter(s => s.status === "Cleared").reduce((s, so) => s + so.total, 0);
    const valueMap: Record<string, string> = {
      "Total Projected Revenue": `$${(stats.totalRevenue / 1000).toFixed(0)}K`,
      "Average Order Value": `$${(stats.avgOrderValue / 1000).toFixed(1)}K`,
      "Total Orders": String(stats.totalOrders),
      "Pending Approval": String(stats.pendingApproval),
      "Overdue Orders": String(stats.overdueOrders),
      "Open Order Value": `$${(stats.openOrderValue / 1000).toFixed(0)}K`,
      "Revenue at Risk": `$${(stats.revenueAtRisk / 1000).toFixed(0)}K`,
      "High Priority Orders": String(highPriorityCount),
      "Ready to Ship": String(readyToShipCount),
      "Avg. Days to Fulfill": "3.2 days",
      "Order Fill Rate": "87%",
      "Order Revisions": String(activeSOs.filter(s => !["Cancelled", "Shipped"].includes(s.status) && s.version && s.version.number > 1).length),
      "Pipeline Value": pipelineValue >= 1000000 ? `$${(pipelineValue / 1000000).toFixed(1)}M` : `$${(pipelineValue / 1000).toFixed(0)}K`,
      "Cleared Value": clearedValue >= 1000000 ? `$${(clearedValue / 1000000).toFixed(1)}M` : `$${(clearedValue / 1000).toFixed(0)}K`,
    };
    return activeInsights.map(ins => ({ label: ins.label, value: valueMap[ins.label] || ins.value, trending: ins.trending, description: ins.description }));
  }, [activeInsights, stats, activeSOs]);

  const statusCount = (s: "All" | SOStatus | "Archived") => {
    if (s === "All") return salesOrders.filter(so => so.status !== "Archived").length;
    if (s === "Archived") return salesOrders.filter(so => so.status === "Archived").length;
    const mapped = STATUS_FILTER_MAP[s];
    if (mapped) return salesOrders.filter(so => mapped.includes(so.status) || so.status === s).length;
    return salesOrders.filter(so => so.status === s).length;
  };

  const handleBulkUnarchive = () => { selectedIds.forEach(id => unarchiveSO(id)); setSelectedIds(new Set()); };
  const toggleSelectSO = (id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const toggleSelectAll = () => { if (selectedIds.size === paginated.length) setSelectedIds(new Set()); else setSelectedIds(new Set(paginated.map(so => so.id))); };

  const deriveDates = (so: typeof salesOrders[0], idx: number) => {
    const base = so.orderDate.split("/").map(Number);
    const year = base[0], month = base[1], day = base[2];
    const fmtDate = (y: number, m: number, d: number) => {
      try { return format(new Date(y, m - 1, d), "MM/dd/yyyy"); } catch { return "—"; }
    };
    return { orderDate: fmtDate(year, month, day), shipBy: fmtDate(year, Math.min(12, month + 2), Math.min(28, day)), deliveryDate: fmtDate(year, Math.min(12, month + 3), Math.min(28, day)), createdOn: fmtDate(year, month, Math.max(1, day - 3)), lastUpdated: fmtDate(year, Math.min(12, month + 1), Math.min(28, day + (idx % 5))), confirmationDate: so.status !== "Draft" && so.status !== "Pending Review" ? fmtDate(year, month, Math.min(28, day + 2)) : "" };
  };

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 6) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else { pages.push(1); if (page > 3) pages.push("..."); const start = Math.max(2, page - 1); const end = Math.min(totalPages - 1, page + 1); for (let i = start; i <= end; i++) pages.push(i); if (page < totalPages - 2) pages.push("..."); pages.push(totalPages); }
    return pages;
  };

  const isCondensed = density === "condensed";
  const rowH = isCondensed ? "py-1 px-2" : "py-2 px-2";
  const cellFontSize = "13px";
  const avatarSize = isCondensed ? 22 : 24;
  const avatarFontSize = isCondensed ? 9 : 10;
  const smallAvatarSize = isCondensed ? 20 : 24;
  const smallAvatarFontSize = isCondensed ? 8 : 9;

  /* ═══ Cell renderers with avatars & overflow tooltips ═══ */
  const renderCell = useCallback((colKey: string, so: typeof salesOrders[0], globalIdx: number) => {
    const dates = deriveDates(so, globalIdx);
    const poc = POC_NAMES[globalIdx % POC_NAMES.length];
    const pocExtra = POC_EXTRA[globalIdx % POC_EXTRA.length];
    const createdBy = CREATED_BY[globalIdx % CREATED_BY.length];

    switch (colKey) {
      case "quote":
        return <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}><HighlightText text={so.sourceQuoteRef} search={search} /></span>;
      case "customer": {
        const tint = getAvatarTint(so.customer);
        return (
          <CustomerHoverCard customerName={so.customer} customerInitials={so.customerInitials}>
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]" style={{ width: isCondensed ? 28 : 32, height: isCondensed ? 28 : 32, backgroundColor: tint.bg }}>
                <span style={{ fontSize: isCondensed ? 9 : 10, fontWeight: 700, color: '#334155' }}>{so.customerInitials}</span>
              </div>
              <span className="truncate" style={{ fontWeight: 500, maxWidth: 160, fontSize: '13px', color: '#334155' }}><HighlightText text={so.customer} search={search} /></span>
            </div>
          </CustomerHoverCard>
        );
      }
      case "status":
        return <div className="whitespace-nowrap"><SOStatusBadge status={so.status} /></div>;
      case "poc": {
        const pocTint = getAvatarTint(poc);
        const pocInitials = poc.charAt(0);
        return (
          <div className="flex items-center gap-2 flex-nowrap overflow-hidden min-w-0 whitespace-nowrap">
            <div className="rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]" style={{ width: isCondensed ? 24 : 28, height: isCondensed ? 24 : 28, backgroundColor: pocTint.bg }}>
              <span style={{ fontSize: isCondensed ? 8 : 9, fontWeight: 700, color: '#334155' }}>{pocInitials}</span>
            </div>
            <span className="truncate min-w-0" style={{ fontWeight: 500, fontSize: '13px', color: '#334155', maxWidth: pocExtra > 0 ? 72 : 140 }}>{poc}</span>
            {pocExtra > 0 && (
              <OverflowTooltip
                category="Point of Contacts"
                items={Array.from({ length: pocExtra }, (_, i) => {
                  const name = POC_NAMES[(globalIdx + i + 1) % POC_NAMES.length];
                  const t = getAvatarTint(name);
                  return { id: `${so.id}-poc-${i}`, name, subtitle: "CONTACT", initials: name.charAt(0), avatarBg: t.bg, avatarFg: t.fg };
                })}
              >
                <span className="text-[11px] inline-flex shrink-0 cursor-default whitespace-nowrap leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{pocExtra} more</span>
              </OverflowTooltip>
            )}
          </div>
        );
      }
      case "salesrep": {
        const repTint = getAvatarTint(so.salesRep);
        const repInitials = so.salesRep.split(" ").map(w => w[0]).join("").substring(0, 2);
        return (
          <div className="flex items-center gap-2">
            <div className="rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]" style={{ width: isCondensed ? 24 : 28, height: isCondensed ? 24 : 28, backgroundColor: repTint.bg }}>
              <span style={{ fontSize: isCondensed ? 8 : 9, fontWeight: 700, color: '#334155' }}>{repInitials}</span>
            </div>
            <span className="whitespace-nowrap" style={{ fontWeight: 500, fontSize: '13px', color: '#334155' }}><HighlightText text={so.salesRep} search={search} /></span>
          </div>
        );
      }
      case "value":
        return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>${so.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>;
      case "invoiced": {
        const invoiced = so.linkedTransactions.filter(t => t.type === "Invoice").reduce((s, t) => s + t.amount, 0);
        const invoiceList = so.linkedTransactions.filter(t => t.type === "Invoice");
        return (
          <div className="relative group/inv">
            <div className="flex items-center gap-1">
              <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 500, color: invoiced > 0 ? '#0F172A' : '#94A3B8' }}>
                {invoiced > 0 ? `$${invoiced.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}
              </span>
              {invoiceList.length > 0 && (
                <ArrowUpRight className="w-3 h-3 text-primary/40 group-hover/inv:text-primary transition-colors" />
              )}
            </div>
            {invoiceList.length > 0 && (
              <div className="absolute left-0 top-full mt-1 z-[300] w-[260px] bg-white border border-border rounded-lg shadow-lg p-3 opacity-0 pointer-events-none group-hover/inv:opacity-100 group-hover/inv:pointer-events-auto transition-opacity duration-150">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2" style={{ fontWeight: 600 }}>Linked Invoices</div>
                <div className="flex flex-col gap-1.5">
                  {invoiceList.map((inv, i) => (
                    <div key={i} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/40 transition-colors cursor-pointer">
                      <span className="text-[12px] text-primary" style={{ fontWeight: 500 }}>{inv.number}</span>
                      <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>${inv.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }
      case "payments": {
        const payments = so.linkedTransactions.filter(t => t.type === "Payment Receipt").reduce((s, t) => s + t.amount, 0);
        return <span className="whitespace-nowrap tabular-nums text-left" style={{ fontSize: '13px', fontWeight: 500, color: payments > 0 ? '#0F172A' : '#94A3B8' }}>{payments > 0 ? `$${payments.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—'}</span>;
      }
      case "orderdate": return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.orderDate}</span>;
      case "shipby": return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.shipBy}</span>;
      case "delivery": return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.deliveryDate}</span>;
      case "createdon": return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.createdOn}</span>;
      case "createdby": {
        const cbTint = getAvatarTint(createdBy);
        const cbInitials = createdBy.split(" ").map(w => w[0]).join("").substring(0, 2);
        return (
          <div className="flex items-center gap-2">
            <div className="rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-[#E8ECF1]" style={{ width: isCondensed ? 24 : 28, height: isCondensed ? 24 : 28, backgroundColor: cbTint.bg }}>
              <span style={{ fontSize: isCondensed ? 8 : 9, fontWeight: 700, color: '#334155' }}>{cbInitials}</span>
            </div>
            <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#334155' }}>{createdBy}</span>
          </div>
        );
      }
      case "lastupdated": return <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.lastUpdated}</span>;
      case "confirmation": return dates.confirmationDate ? <span className="whitespace-nowrap tabular-nums" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{dates.confirmationDate}</span> : <span style={{ fontSize: '13px', color: '#CBD5E1' }}>—</span>;
      case "priority": return <PriorityBadge priority={so.priority} />;
      case "warehouse": return <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{so.warehouse}</span>;
      case "currency": return <span className="whitespace-nowrap" style={{ fontSize: '13px', fontWeight: 400, color: '#64748B' }}>{so.currency}</span>;
      case "linecount": {
        const lineItems = so.lines;
        const extraLineItems = lineItems.length - 1;
        return (
          <div className={`flex items-center whitespace-nowrap ${isCondensed ? "gap-1.5" : "gap-2.5"}`}>
            {!isCondensed && (
              <div className="w-7 h-7 rounded-md bg-[#F1F5F9] flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5 text-[#64748B]" />
              </div>
            )}
            <span className={`${isCondensed ? "text-sm" : "text-[13.5px]"} truncate`} style={{ fontWeight: 500 }}>{lineItems[0]?.itemCode || "–"}</span>
            <span className="text-[11px] text-muted-foreground/60 shrink-0">{lineItems.length} item{lineItems.length !== 1 ? "s" : ""}</span>
            {extraLineItems > 0 && (
              <OverflowTooltip
                category="Line Items"
                items={lineItems.slice(1).map((li, i) => ({
                  id: `${so.id}-line-${i}`,
                  name: li.itemCode,
                  subtitle: li.itemName,
                }))}
              >
                <span className="text-[11px] shrink-0 cursor-default leading-none" style={{ fontWeight: 600, color: '#085FCC' }}>+{extraLineItems} more</span>
              </OverflowTooltip>
            )}
          </div>
        );
      }
      default: return null;
    }
  }, [search, isCondensed, cellFontSize, avatarSize, avatarFontSize, smallAvatarSize, smallAvatarFontSize]);

  const isTableView = density !== "kanban";

  /* ═══ Render ═══ */
  return (
    <>
    <div className="flex-1 min-w-0 flex flex-col h-full px-6 lg:px-8 py-6" style={{ paddingBottom: 0, overflowX: "hidden", overflowY: "auto" }}>

        {/* ─── Page Header ─── */}
        <div className="flex items-center justify-between shrink-0 -mx-6 lg:-mx-8 -mt-6 px-6 lg:px-8 pt-3.5 pb-3.5 bg-white border-b border-border" style={{ marginBottom: 16 }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EDF4FF" }}>
              <FileText className="w-4 h-4" style={{ color: "#0A77FF" }} />
            </div>
            <div>
              <h1 className="font-bold text-[20px]">Sales Orders</h1>
              <p className="text-xs text-muted-foreground" style={{ marginTop: 1 }}>Manage and track sales orders — from confirmation through allocation, picking, and shipping.</p>
            </div>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 transition-colors cursor-pointer" style={{ fontWeight: 600 }}>
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Create New SO
          </button>
        </div>

        {/* ─── Performance Insights Cards ─── */}
        {!insightsCollapsed && activeInsights.length > 0 && !anyFullscreen && (
          <div className="shrink-0" style={{ marginBottom: 12 }}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Performance Insights</span>
                <button className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
                  Last 30 days <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </div>
              <button onClick={() => setShowInsights(true)} className="inline-flex items-center gap-1 text-[11px] hover:bg-muted/50 px-2 py-0.5 rounded-md transition-colors cursor-pointer" style={{ fontWeight: 500, color: "#0A77FF" }}>
                <Plus className="w-3 h-3" /> Add Insights
              </button>
            </div>
            <DndProvider backend={HTML5Backend}>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                {insightCardData.map((card, idx) => (
                  <DraggableInsightCard key={card.label} index={idx} card={card} moveCard={moveInsight} onRemove={(label) => setActiveInsights(prev => prev.filter(i => i.label !== label))} />
                ))}
              </div>
            </DndProvider>
          </div>
        )}

        {insightsCollapsed && activeInsights.length > 0 && !anyFullscreen && (
          <div className="flex items-center gap-2 shrink-0 mb-2">
            <button onClick={() => setInsightsCollapsed(false)} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
              <BarChart3 className="w-3 h-3" /> Show Insights
            </button>
          </div>
        )}


        {/* ─── White Card — search, pills, table / kanban, pagination ─── */}
        {!anyFullscreen && (
        <div className="bg-card border border-border relative flex flex-col min-h-0 flex-1 overflow-clip rounded-xl" style={{ marginBottom: 24 }} ref={contentCardRef}>

          {/* ── Toolbar ── */}
          <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground/40 pointer-events-none" />
                <input className="w-full h-[34px] bg-secondary/50 border border-border/60 rounded-lg pl-8 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-all focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/20" placeholder="Search orders…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ fontWeight: 400 }} />
                {search && <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"><X className="w-3 h-3" /></button>}
              </div>
              <SOFilterBar
                filters={advancedFilters}
                onFiltersChange={(f) => { setAdvancedFilters(f); setPage(1); }}
                isKanbanView={density === "kanban"}
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm tabular-nums mr-1 hidden sm:inline" style={{ fontWeight: 500 }}>
                {filtered.length !== salesOrders.filter(s => s.status !== "Archived").length ? (
                  <><span className="text-foreground">{filtered.length}</span><span className="text-muted-foreground/60"> of </span><span className="text-muted-foreground">{salesOrders.length}</span><span className="text-muted-foreground/70"> orders</span></>
                ) : (
                  <><span className="text-foreground">{filtered.length}</span><span className="text-muted-foreground/70"> orders</span></>
                )}
              </span>
              <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block" />

              {/* Fullscreen toggle — icon only, before insights */}
              <div className="relative group/fs">
                <button type="button" onClick={() => { if (isKanban) setKanbanFullscreen(!kanbanFullscreen); else setListingFullscreen(!listingFullscreen); }} className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none shrink-0">
                  {(isKanban ? kanbanFullscreen : listingFullscreen) ? <Minimize2 className="w-[18px] h-[18px] text-muted-foreground/80" /> : <Maximize2 className="w-[18px] h-[18px] text-muted-foreground/80" />}
                </button>
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover/fs:opacity-100 transition-opacity pointer-events-none z-50">
                  <div className="bg-[#1E293B] text-white text-[11px] px-2.5 py-1.5 rounded-md whitespace-nowrap" style={{ fontWeight: 500 }}>
                    {(isKanban ? kanbanFullscreen : listingFullscreen) ? "Exit fullscreen view" : "Expand to fullscreen view"}
                  </div>
                </div>
              </div>

              {/* Insights toggle */}
              <button type="button" onClick={() => { if (!showInsights) { setInsightsCollapsed(false); } setShowInsights(true); }} className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${showInsights ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"}`}>
                <BarChart3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Insights</span>
                {insightCardData.length > 0 && (
                  <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]" style={{ backgroundColor: "#EDF4FF", color: "#0A77FF", fontWeight: 600 }}>{insightCardData.length}</span>
                )}
              </button>

              {/* Density dropdown */}
              <div className="relative">
                <button type="button" onClick={() => setDensityOpen(!densityOpen)} className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none">
                  {density === "condensed" && <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  {density === "comfort" && <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  {density === "kanban" && <LayoutGrid className="w-[18px] h-[18px] text-muted-foreground/80" />}
                  <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>{DENSITY_CONFIG.find(d => d.key === density)?.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                </button>
                {densityOpen && (
                  <div className="absolute right-0 top-full mt-1 w-[230px] bg-popover border border-border rounded-lg z-[200] p-1.5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
                    {DENSITY_CONFIG.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button key={opt.key} onClick={() => { setDensity(opt.key); setDensityOpen(false); }} className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md w-full hover:bg-muted/50 transition-colors">
                          <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                            <div className="text-xs text-muted-foreground">{opt.description}</div>
                          </div>
                          {density === opt.key && <Check className="w-4 h-4 shrink-0" style={{ color: '#0A77FF' }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Column selector trigger */}
              <button onClick={() => setShowColumns(!showColumns)} className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${showColumns ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"}`}>
                <Columns3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Columns</span>
                <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-full text-[11px]" style={{ backgroundColor: "#EDF4FF", color: "#0A77FF", fontWeight: 600 }}>{visibleColCount}</span>
              </button>


            </div>
          </div>

          {/* Filter pills removed — filters managed via modal only */}

          {/* ── Quick Filter Pills OR Bulk Action Bar (Cycle Count pattern) ── */}
          <div className="flex items-center gap-1.5 px-4 pb-3 shrink-0" style={{ overflowX: isKanban ? 'visible' : 'auto', flexWrap: isKanban ? 'wrap' : 'nowrap' }}>
          {selectedIds.size > 0 && statusFilter !== "Archived" && isTableView ? (
            <div className="flex items-center w-full" style={{ height: "30px", gap: "12px" }}>
              <span style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)", color: "var(--muted-foreground)" }}>
                {selectedIds.size} {selectedIds.size === 1 ? "order" : "orders"} selected
              </span>
              <div style={{ width: "1px", height: "20px", background: "var(--border)", flexShrink: 0 }} />
              <div className="inline-flex items-center" style={{ gap: "4px" }}>
                {bulkSubmitCount > 0 && isCreator && (
                  <button
                    className="inline-flex items-center gap-1.5 border transition-all duration-150"
                    style={{ height: "30px", padding: "0 var(--space-inline-gap)", borderRadius: "var(--radius)", background: "var(--card)", cursor: "pointer", fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)", color: "var(--foreground)", borderColor: "var(--border)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(10,119,255,0.04)"; e.currentTarget.style.borderColor = "rgba(10,119,255,0.25)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(10,119,255,0.10)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--card)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                    onClick={(e) => { e.stopPropagation(); handleBulkSubmitForReview(); }}
                  >
                    <Send size={14} style={{ color: "var(--primary)" }} />
                    <span>Submit</span>
                  </button>
                )}
                {bulkApprovableCount > 0 && isReviewer && (
                  <button
                    className="inline-flex items-center gap-1.5 border transition-all duration-150"
                    style={{ height: "30px", padding: "0 var(--space-inline-gap)", borderRadius: "var(--radius)", background: "var(--card)", cursor: "pointer", fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)", color: "var(--foreground)", borderColor: "var(--border)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(10,119,255,0.04)"; e.currentTarget.style.borderColor = "rgba(10,119,255,0.25)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(10,119,255,0.10)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--card)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                    onClick={(e) => { e.stopPropagation(); handleBulkApprove(); }}
                  >
                    <CheckCircle size={14} style={{ color: "var(--primary)" }} />
                    <span>Clear</span>
                  </button>
                )}
                {bulkArchivableCount > 0 && (
                  <button
                    className="inline-flex items-center gap-1.5 border transition-all duration-150"
                    style={{ height: "30px", padding: "0 var(--space-inline-gap)", borderRadius: "var(--radius)", background: "var(--card)", cursor: "pointer", fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)", color: "var(--foreground)", borderColor: "var(--border)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(10,119,255,0.04)"; e.currentTarget.style.borderColor = "rgba(10,119,255,0.25)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(10,119,255,0.10)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--card)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                    onClick={(e) => { e.stopPropagation(); handleBulkArchive(); }}
                  >
                    <Archive size={14} style={{ color: "var(--primary)" }} />
                    <span>Archive</span>
                  </button>
                )}
                <button
                  className="inline-flex items-center gap-1.5 border transition-all duration-150"
                  style={{ height: "30px", padding: "0 var(--space-inline-gap)", borderRadius: "var(--radius)", background: "var(--card)", cursor: "pointer", fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)", color: "var(--foreground)", borderColor: "var(--border)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(10,119,255,0.04)"; e.currentTarget.style.borderColor = "rgba(10,119,255,0.25)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(10,119,255,0.10)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--card)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                  onClick={(e) => { e.stopPropagation(); handleBulkExportCSV(); }}
                >
                  <FileDown size={14} style={{ color: "var(--primary)" }} />
                  <span>Export</span>
                </button>
                <button
                  className="inline-flex items-center gap-1.5 border transition-all duration-150"
                  style={{ height: "30px", padding: "0 var(--space-inline-gap)", borderRadius: "var(--radius)", background: "var(--card)", cursor: "pointer", fontSize: "var(--text-label)", fontWeight: "var(--font-weight-medium)", color: "var(--foreground)", borderColor: "var(--border)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(10,119,255,0.04)"; e.currentTarget.style.borderColor = "rgba(10,119,255,0.25)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(10,119,255,0.10)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--card)"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                  onClick={(e) => { e.stopPropagation(); handleBulkPrint(); }}
                >
                  <Printer size={14} style={{ color: "var(--primary)" }} />
                  <span>Print</span>
                </button>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center gap-1 transition-colors hover:opacity-80"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "var(--font-weight-medium)", color: "var(--muted-foreground)" }}
              >
                Esc to clear
                <X size={12} />
              </button>
            </div>
          ) : (
          <>
            <button onClick={() => { setMeMode(!meMode); setPage(1); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${meMode ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: meMode ? 500 : 400, color: meMode ? "#0A77FF" : undefined }}>
              <User className="w-3.5 h-3.5" /> Me mode
            </button>
            {/* In kanban view, only show Me mode and Show All — status pills are redundant as columns represent statuses */}
            {!isKanban && (
              <>
                <div className="w-px h-5 bg-border shrink-0" />
                {MAIN_STATUS_FILTERS.map(sf => {
                  const isActive = statusFilter === sf;
                  const count = statusCount(sf);
                  return (
                    <button key={sf} onClick={() => { setStatusFilter(sf); setPage(1); setSelectedIds(new Set()); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${isActive ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"}`} style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "#0A77FF" : undefined }}>
                      {STATUS_FILTER_LABELS[sf] || sf}
                      {sf !== "All" && <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`} style={{ fontWeight: 600, color: isActive ? "#0A77FF" : "#475569" }}>{count}</span>}
                    </button>
                  );
                })}
                <div className="w-px h-5 bg-border mx-1 shrink-0" />
                <button onClick={() => { setStatusFilter("Archived"); setPage(1); setSelectedIds(new Set()); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors shrink-0 cursor-pointer ${statusFilter === "Archived" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`} style={{ fontWeight: statusFilter === "Archived" ? 500 : 400 }}>
                  <Archive className="w-3 h-3" /> Archived
                  <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${statusFilter === "Archived" ? "bg-destructive/10" : "bg-muted"}`} style={{ fontWeight: 600, color: statusFilter === "Archived" ? undefined : "hsl(var(--foreground))" }}>{statusCount("Archived")}</span>
                </button>
              </>
            )}
            {isKanban && (
              <>
                {/* Separator between Me mode and Kanban controls */}
                <div className="w-px h-5 bg-border mx-1 shrink-0" />

                {/* Group By button — next to Me mode */}
                <div ref={kanbanGroupByRef} className="relative shrink-0">
                  <button type="button" onClick={() => setKanbanGroupByOpen(!kanbanGroupByOpen)} className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${kanbanGroupBy !== "none" ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: kanbanGroupBy !== "none" ? 500 : 400, color: kanbanGroupBy !== "none" ? "#0A77FF" : undefined }}>
                    <Layers className="w-3.5 h-3.5" />
                    <span>{kanbanGroupBy === "none" ? "Group By" : (kanbanGroupBy === "salesRep" ? "Sales Rep" : kanbanGroupBy === "customer" ? "Customer" : "Priority")}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {kanbanGroupByOpen && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setKanbanGroupByOpen(false)} />
                      <div className="fixed z-[9999] w-[230px] bg-popover border border-border rounded-lg p-1.5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)", top: (kanbanGroupByRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: (kanbanGroupByRef.current?.getBoundingClientRect().right ?? 0) - 230 }}>
                        {([
                          { value: "none" as const, label: "None", description: "No grouping", icon: Layers },
                          { value: "salesRep" as const, label: "Sales Rep", description: "Group by representative", icon: Users },
                          { value: "customer" as const, label: "Customer", description: "Group by customer", icon: Building2 },
                          { value: "priority" as const, label: "Priority", description: "Group by urgency", icon: Flag },
                        ]).map(opt => {
                          const Icon = opt.icon;
                          return (
                            <button key={opt.value} onClick={() => { setKanbanGroupBy(opt.value); setKanbanGroupByOpen(false); }} className="flex items-center gap-3 py-2.5 px-3 cursor-pointer rounded-md w-full hover:bg-muted/50 transition-colors">
                              <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-sm" style={{ fontWeight: 500 }}>{opt.label}</div>
                                <div className="text-xs text-muted-foreground">{opt.description}</div>
                              </div>
                              {kanbanGroupBy === opt.value && <Check className="w-4 h-4 shrink-0" style={{ color: '#0A77FF' }} />}
                            </button>
                          );
                        })}
                      </div>
                    </>,
                    document.body
                  )}
                </div>

                {/* Time Duration button — next to Group By */}
                <div ref={kanbanTimeDurationRef} className="relative shrink-0">
                  <button type="button" onClick={() => setKanbanTimeDurationOpen(!kanbanTimeDurationOpen)} className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${kanbanTimeDuration !== "all" ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: kanbanTimeDuration !== "all" ? 500 : 400, color: kanbanTimeDuration !== "all" ? "#0A77FF" : undefined }}>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{
                      kanbanTimeDuration === "last_7_days" ? "Last 7 days" :
                      kanbanTimeDuration === "last_30_days" ? "Last 30 days" :
                      kanbanTimeDuration === "last_6_months" ? "Last 6 months" :
                      kanbanTimeDuration === "last_12_months" ? "Last 12 months" : "All"
                    }</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {kanbanTimeDurationOpen && createPortal(
                    <>
                      <div className="fixed inset-0 z-[9998]" onClick={() => setKanbanTimeDurationOpen(false)} />
                      <div className="fixed z-[9999] w-[200px] bg-popover border border-border rounded-lg p-1.5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)", top: (kanbanTimeDurationRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: (kanbanTimeDurationRef.current?.getBoundingClientRect().right ?? 0) - 200 }}>
                        {[
                          { value: "last_7_days", label: "Last 7 days" },
                          { value: "last_30_days", label: "Last 30 days" },
                          { value: "last_6_months", label: "Last 6 months" },
                          { value: "last_12_months", label: "Last 12 months" },
                          { value: "all", label: "All" },
                        ].map(opt => (
                          <button key={opt.value} onClick={() => { setKanbanTimeDuration(opt.value); setKanbanTimeDurationOpen(false); }} className="flex items-center gap-3 py-2 px-3 cursor-pointer rounded-md w-full hover:bg-muted/50 transition-colors">
                            <span className="flex-1 text-sm text-left" style={{ fontWeight: 500, color: kanbanTimeDuration === opt.value ? '#0A77FF' : undefined }}>{opt.label}</span>
                            {kanbanTimeDuration === opt.value && <Check className="w-4 h-4 shrink-0" style={{ color: '#0A77FF' }} />}
                          </button>
                        ))}
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              </>
            )}
            </>
          )}
          </div>

          <div className="border-t border-border shrink-0" />

          {/* Archived banner */}
          {statusFilter === "Archived" && (
            <div className="flex items-center justify-between bg-muted/50 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2.5"><Archive className="w-4 h-4 text-muted-foreground" /><span className="text-[13px] text-muted-foreground" style={{ fontWeight: 500 }}>Showing archived orders — these are hidden from the default view</span></div>
              {selectedIds.size > 0 && <button onClick={handleBulkUnarchive} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] text-white cursor-pointer" style={{ fontWeight: 600, backgroundColor: "#0A77FF" }}><ArchiveRestore className="w-3.5 h-3.5" /> Unarchive {selectedIds.size}</button>}
            </div>
          )}


          {/* ── Content: Table or Kanban ── */}
          {!isTableView ? (
            <div className="flex-1 min-h-0 flex relative">
              <SOKanbanBoard salesOrders={filtered} search={search} columnVisibility={columnVisibility} groupBy={kanbanGroupBy} isFullscreen={false} onToggleFullscreen={() => setKanbanFullscreen(true)} onStatusChange={handleKanbanStatusChange} onCancelRequest={handleKanbanCancelRequest} />
              {/* Column Configurator Panel for Kanban */}
              {showColumns && (
                <div className="shrink-0 h-full" style={{ zIndex: 20 }}>
                  <SOColumnConfigurator columns={legacyColumns} onChange={handleLegacyColumnsChange} onClose={() => setShowColumns(false)} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 flex relative">
              <div ref={scrollContainerRef} className={`flex-1 min-h-0 overflow-auto ${isResizing || draggingColumnKey ? "select-none" : ""}`}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-20 bg-card">
                    <tr className={`bg-[#f8fafc] hover:bg-[#f8fafc] border-b border-border ${density === "condensed" ? "[&>th]:h-9" : "[&>th]:h-11"}`}>
                      {/* Checkbox */}
                      <th className="sticky left-0 z-20 bg-[#f8fafc] text-left whitespace-nowrap !pl-2 !pr-0 w-[40px] min-w-[40px] max-w-[40px]">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={selectedIds.size > 0 && selectedIds.size === paginated.length}
                            onClick={toggleSelectAll}
                            className="shrink-0 flex items-center justify-center"
                            style={{
                              width: "16px", height: "16px", borderRadius: "4px",
                              border: selectedIds.size > 0 && selectedIds.size === paginated.length ? "1.5px solid #2563EB" : "1.5px solid #D1D5DB",
                              background: selectedIds.size > 0 && selectedIds.size === paginated.length ? "#2563EB" : "#fff",
                              cursor: "pointer", padding: 0, outline: "none", transition: "all 0.15s ease",
                            }}
                          >
                            {selectedIds.size > 0 && selectedIds.size === paginated.length && <Check size={11} strokeWidth={2.5} style={{ color: "#fff" }} />}
                          </button>
                        </div>
                      </th>
                      {/* Dynamic columns with header menus */}
                      {visibleColumns.map(key => {
                        const def = colDef(key);
                        const isFrozen = frozenColumns.has(key);
                        const isLocked = LOCKED_COLUMNS.includes(key);
                        const isDraggable = !isLocked;
                        const currentColSort: "asc" | "desc" | null = sortConfig?.key === key ? sortConfig.direction : null;
                        const width = columnWidths[key] ?? def.minWidth;
                        const isBeingDragged = draggingColumnKey === key;

                        return (
                          <th
                            key={key}
                            data-col-drag-key={key}
                            onMouseDown={isDraggable ? (e) => handleHeaderMouseDown(e, key) : undefined}
                            onClickCapture={isDraggable ? (e) => { if (suppressNextClickRef.current) { e.stopPropagation(); e.preventDefault(); } } : undefined}
                            className={`whitespace-nowrap relative group/colheader ${isFrozen ? "sticky bg-[#f8fafc] z-20" : ""} ${isDraggable ? "cursor-grab" : ""} ${def.align === "right" ? "text-right" : ""}`}
                            style={{
                              width: `${width}px`,
                              overflow: "hidden",
                              ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px` } : {}),
                              ...(key === lastFrozenKey && !isBeingDragged ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                              ...(isBeingDragged ? { background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)" } : {}),
                            }}
                          >
                            {isBeingDragged && <div className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full" style={{ backgroundColor: "#0A77FF" }} />}
                            {isDraggable && <GripVertical className={`absolute left-1 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${isBeingDragged ? "opacity-100 text-primary" : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"}`} />}

                            <div className={`flex items-center ${def.align === "right" ? "w-full" : ""} px-2`}>
                              <SOColumnHeaderMenu
                                columnKey={key}
                                label={def.label}
                                sortable={def.sortable}
                                sortConfig={sortConfig}
                                onSort={handleSort}
                                onAddFilter={handleAddColumnFilter}
                                onHideColumn={handleHideColumn}
                                onFreezeColumn={handleFreezeColumn}
                                isFrozen={isFrozen}
                                isLocked={isLocked}
                              >
                                <div className={`inline-flex items-center gap-1 ${def.align === "right" ? "w-full justify-end" : ""}`}>
                                  <span className="text-[13px]" style={currentColSort ? { color: "#0A77FF" } : undefined}>{def.label}</span>
                                  {currentColSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
                                  {currentColSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "#0A77FF" }} />}
                                  {!currentColSort && def.sortable && <ArrowUpDown className="w-3 h-3 shrink-0 text-muted-foreground opacity-0 group-hover/colheader:opacity-100 transition-opacity" />}
                                </div>
                              </SOColumnHeaderMenu>
                            </div>

                            {/* Resize handle */}
                            <div
                              onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, key); }}
                              onClick={(e) => e.stopPropagation()}
                              onDoubleClick={(e) => { e.stopPropagation(); setColumnWidths(prev => ({ ...prev, [key]: def.minWidth })); }}
                              className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                              style={{ touchAction: "none" }}
                            >
                              <div className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${resizingColumnKey === key ? "bg-primary" : "bg-transparent group-hover/resize:bg-primary/40"}`} />
                            </div>
                          </th>
                        );
                      })}
                      {/* Actions */}
                      <th className="sticky right-0 bg-[#f8fafc] z-20 whitespace-nowrap w-[60px] !pl-2 !pr-2" style={{ boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)" }}>
                        <span className="text-[13px]">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((so, idx) => {
                      const globalIdx = (page - 1) * perPage + idx;
                      const versionNum = so.version?.number ?? (1 + (globalIdx % 4));
                      const hoveredRow2 = hoveredRow === so.id;
                      const canArchiveRow = ARCHIVABLE_STATES.includes(so.status);
                      const canUnarchiveRow = so.status === "Archived";
                      const canCancelRow = !["Cancelled", "Archived", "Cancellation Requested", "Shipped"].includes(so.status);
                      const hasShippedLinesRow = so.lines.some(l => !l.cancelled && l.shippedQty > 0);
                      const cancellableLinesRow = so.lines.filter(l => !l.cancelled && l.shippedQty < l.orderedQty);
                      const isFullCancelBlockedRow = hasShippedLinesRow;
                      const isPartialOnlyRow = canCancelRow && isFullCancelBlockedRow && cancellableLinesRow.length > 0;
                      const canApproveRow = so.status === "Pending Review" || so.status === "Draft";
                      const canSubmitRow = so.status === "Draft";
                      const canCloseRow = so.status === "Shipped" || so.status === "Partially Shipped";

                      const isRowDisabled = ["Cancelled", "Archived", "Cancellation Requested"].includes(so.status);
                      const isSelected = selectedIds.has(so.id);
                      const selectionActive = selectedIds.size > 0;

                      return (
                        <tr key={so.id}
                          className={`border-b border-border/50 transition-colors group ${isSelected ? "" : "hover:bg-[#F0F7FF] cursor-pointer"}`}
                          onClick={() => {
                            if (selectionActive) {
                              if (!isRowDisabled) toggleSelectSO(so.id);
                              return;
                            }
                            navigate(`/sales-orders/${so.id}`);
                          }}
                          style={{
                             background: isSelected ? "#EFF6FF" : undefined,
                            opacity: isRowDisabled && selectionActive ? 0.45 : 1,
                            cursor: selectionActive ? (isRowDisabled ? "not-allowed" : "pointer") : "pointer",
                            transition: "background 0.15s ease, opacity 0.15s ease",
                          }}
                        >
                          <td className={`sticky left-0 transition-colors ${rowH} !pl-2 !pr-0 z-10`} style={{ width: 40, background: isSelected ? "#EFF6FF" : undefined, borderBottom: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={isSelected}
                                disabled={isRowDisabled && selectionActive}
                                onClick={() => { if (!isRowDisabled) toggleSelectSO(so.id); }}
                                className="shrink-0 flex items-center justify-center"
                                style={{
                                  width: "16px", height: "16px", borderRadius: "4px",
                                  border: (isRowDisabled && selectionActive) ? "1.5px solid #D5D7DB" : isSelected ? "1.5px solid #2563EB" : "1.5px solid #D1D5DB",
                                  background: (isRowDisabled && selectionActive) ? "#F0F1F3" : isSelected ? "#2563EB" : "#fff",
                                  cursor: (isRowDisabled && selectionActive) ? "not-allowed" : "pointer",
                                  padding: 0, outline: "none", transition: "all 0.15s ease",
                                }}
                              >
                                {isSelected && !(isRowDisabled && selectionActive) && <Check size={11} strokeWidth={2.5} style={{ color: "#fff" }} />}
                              </button>
                            </div>
                          </td>
                          {visibleColumns.map(key => {
                            const isFrozen = frozenColumns.has(key);
                            const def2 = colDef(key);
                            const width = columnWidths[key] ?? def2.minWidth;

                            if (key === "so") {
                              return (
                                <td key={key} className={`sticky group-hover:bg-[#F0F7FF] transition-colors ${rowH} px-2 z-10`} style={{ left: frozenOffsets[key] ?? CHECKBOX_COL_WIDTH, width: `${width}px`, background: isSelected ? "#EFF6FF" : undefined, ...(key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}) }}>
                                  <div className="flex items-center" style={{ gap: 8 }}>
                                    <div
                                      onMouseEnter={() => setHoveredRow(so.id)}
                                      onMouseLeave={() => setHoveredRow(null)}
                                    >
                                      <VersionBadge
                                        version={versionNum}
                                        compact
                                        showExpandIcon={hoveredRow2}
                                        onClick={(e) => { e.stopPropagation(); setVersionModalSO(so); }}
                                      />
                                    </div>
                                    <span className="text-foreground hover:text-primary hover:underline cursor-pointer whitespace-nowrap text-[13px]" style={{ fontWeight: 500 }}><HighlightText text={so.soNumber} search={search} /></span>
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td key={key} className={`${isFrozen ? "sticky group-hover:bg-[#F0F7FF] transition-colors z-10" : ""} ${rowH} px-2 ${def2.align === "right" ? "text-right" : ""}`}
                                style={{
                                  width: `${width}px`,
                                  ...(isFrozen ? { left: `${frozenOffsets[key] ?? 0}px`, background: isSelected ? "#EFF6FF" : "var(--background)" } : {}),
                                  ...(key === lastFrozenKey ? { boxShadow: "inset -1px 0 0 0 rgba(0,0,0,0.08), 3px 0 6px -2px rgba(0,0,0,0.06)" } : {}),
                                }}
                              >
                                {renderCell(key, so, globalIdx)}
                              </td>
                            );
                          })}
                          {/* Actions */}
                          <td className={`sticky right-0 group-hover:bg-[#F0F7FF] transition-colors ${rowH} z-10 !pl-2 !pr-2`} style={{ width: 60, boxShadow: "inset 1px 0 0 0 rgba(0,0,0,0.08)", background: isSelected ? "#EFF6FF" : undefined }} onClick={e => e.stopPropagation()}>
                            <div className="relative flex items-center justify-center" ref={openActionId === so.id ? actionRef : undefined}>
                              <button onClick={() => setOpenActionId(openActionId === so.id ? null : so.id)} className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer">
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                              {openActionId === so.id && createPortal(
                                <>
                                  <div className="fixed inset-0 z-[9998]" onClick={() => setOpenActionId(null)} />
                                  <div className="fixed z-[9999] w-[220px] bg-popover border border-border rounded-lg" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)", padding: "4px 0", top: (actionRef.current?.getBoundingClientRect().bottom ?? 0) + 4, left: (actionRef.current?.getBoundingClientRect().left ?? 0) - 160 }}>
                                    <button onClick={() => { navigate(`/sales-orders/${so.id}`); setOpenActionId(null); }} className="w-full text-left flex items-center gap-2 text-foreground/80 hover:bg-muted/50 transition-colors text-[13px] px-3 py-[7px]"><Eye className="w-4 h-4 mr-0.5" /> View Details</button>
                                    {canSubmitRow && isCreator && <button onClick={() => handleSubmitForReview(so.id)} className="w-full text-left flex items-center gap-2 text-foreground/80 hover:bg-muted/50 transition-colors text-[13px] px-3 py-[7px]"><Send className="w-4 h-4 mr-0.5" /> Submit for Review</button>}
                                    {canApproveRow && isReviewer && <button onClick={() => handleApproveRow(so.id)} className="w-full text-left flex items-center gap-2 text-foreground/80 hover:bg-muted/50 transition-colors text-[13px] px-3 py-[7px]"><CheckCircle className="w-4 h-4 mr-0.5" /> Clear for Processing</button>}
                                    {canCloseRow && <button onClick={() => handleCloseRow(so.id)} className="w-full text-left flex items-center gap-2 text-foreground/80 hover:bg-muted/50 transition-colors text-[13px] px-3 py-[7px]"><Lock className="w-4 h-4 mr-0.5" /> Close Order</button>}
                                    <div className="border-t border-border/60 my-1 mx-2" />
                                    <button onClick={() => handleDuplicate(so.id)} className="w-full text-left flex items-center gap-2 text-foreground/80 hover:bg-muted/50 transition-colors text-[13px] px-3 py-[7px]"><Copy className="w-4 h-4 mr-0.5" /> Duplicate</button>
                                    <button onClick={() => handleViewPDF(so.id)} className="w-full text-left flex items-center gap-2 text-foreground/80 hover:bg-muted/50 transition-colors text-[13px] px-3 py-[7px]"><Printer className="w-4 h-4 mr-0.5" /> View PDF</button>
                                    <button onClick={() => handleExportCSV(so.id)} className="w-full text-left flex items-center gap-2 text-foreground/80 hover:bg-muted/50 transition-colors text-[13px] px-3 py-[7px]"><FileDown className="w-4 h-4 mr-0.5" /> Export CSV</button>
                                    {(canArchiveRow || canUnarchiveRow || canCancelRow) && <div className="border-t border-border/60 my-1 mx-2" />}
                                    {canUnarchiveRow && <button onClick={() => handleUnarchiveRow(so.id)} className="w-full text-left flex items-center gap-2 text-foreground/80 hover:bg-muted/50 transition-colors text-[13px] px-3 py-[7px]"><ArchiveRestore className="w-4 h-4 mr-0.5" /> Unarchive</button>}
                                    {canArchiveRow && <button onClick={() => handleArchiveRow(so.id)} className="w-full text-left flex items-center gap-2 text-destructive hover:bg-destructive/5 transition-colors text-[13px] px-3 py-[7px]"><Archive className="w-4 h-4 mr-0.5" /> Archive</button>}
                                    {canCancelRow && !isPartialOnlyRow && <button onClick={() => handleCancelRow(so.id)} className="w-full text-left flex items-center gap-2 text-destructive hover:bg-destructive/5 transition-colors text-[13px] px-3 py-[7px]"><Ban className="w-4 h-4 mr-0.5" /> Cancel Order</button>}
                                    {isPartialOnlyRow && <button onClick={() => handleCancelRow(so.id, true)} className="w-full text-left flex items-center gap-2 hover:bg-orange-50 transition-colors text-[13px] px-3 py-[7px]" style={{ color: "#D97706" }}><Ban className="w-4 h-4 mr-0.5" /> Cancel Lines <span className="ml-auto text-[10px] text-muted-foreground">partial</span></button>}
                                  </div>
                                </>,
                                document.body
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {paginated.length === 0 && <tr><td colSpan={visibleColumns.length + 2} className="text-center text-muted-foreground py-12 text-[13px]">No sales orders match your filters.</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Column Configurator Panel */}
              {showColumns && (
                <div className="shrink-0 h-full" style={{ zIndex: 20 }}>
                  <SOColumnConfigurator columns={legacyColumns} onChange={handleLegacyColumnsChange} onClose={() => setShowColumns(false)} />
                </div>
              )}
              </div>
            </div>
          )}

          {/* ── Pagination ── */}
          {isTableView && (
            <div className="flex items-center justify-center border-t border-border px-4 py-3">
              <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span>Records per page</span>
                  <div className="relative">
                    <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="appearance-none bg-card border border-border rounded-md cursor-pointer outline-none hover:border-muted-foreground/30 text-foreground text-[13px] px-2 py-1 pr-6">
                      <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                    </select>
                    <ChevronDown className="w-3 h-3 text-muted-foreground/50 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div className="w-px h-4 bg-border" />
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setPage(1)} disabled={page === 1} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex items-center gap-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors px-2 py-1"><ChevronLeft className="w-3 h-3" /> Prev</button>
                  {getPageNumbers().map((p, i) => p === "..." ? <span key={`dots-${i}`} className="w-7 h-7 flex items-center justify-center text-muted-foreground/50">…</span> : <button key={p} onClick={() => setPage(p as number)} className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors text-[13px] ${p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground/80"}`} style={{ fontWeight: 500 }}>{p}</button>)}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="flex items-center gap-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors px-2 py-1">Next <ChevronRight className="w-3 h-3" /></button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages || totalPages === 0} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors"><ChevronsRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* ═══ Fullscreen Portal ═══ */}
        {anyFullscreen && createPortal(
          <div className="fixed inset-0 z-[200] flex flex-col bg-background" style={{ overflow: 'hidden' }}>
            {/* Insights in fullscreen */}
            {!insightsCollapsed && activeInsights.length > 0 && (
              <div className="shrink-0 px-5 pt-3" style={{ paddingBottom: 4 }}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground" style={{ fontWeight: 500 }}>Performance Insights</span>
                  </div>
                  <button onClick={() => setInsightsCollapsed(true)} className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <DndProvider backend={HTML5Backend}>
                  <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
                    {insightCardData.map((card, idx) => (
                      <DraggableInsightCard key={card.label} index={idx} card={card} moveCard={moveInsight} onRemove={(label) => setActiveInsights(prev => prev.filter(i => i.label !== label))} />
                    ))}
                  </div>
                </DndProvider>
              </div>
            )}
            {insightsCollapsed && activeInsights.length > 0 && (
              <div className="flex items-center gap-2 shrink-0 px-5 py-2">
                <button onClick={() => setInsightsCollapsed(false)} className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer" style={{ fontWeight: 500 }}>
                  <BarChart3 className="w-3 h-3" /> Show Insights
                </button>
              </div>
            )}
            {/* White card with full content */}
            <div className="bg-card border border-border relative flex flex-col min-h-0 flex-1 overflow-clip rounded-xl mx-4 mb-4 mt-2">
              {isKanban ? (
                <>
                  {/* Kanban fullscreen toolbar */}
                  <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 shrink-0">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground/40 pointer-events-none" />
                        <input className="w-full h-[34px] bg-secondary/50 border border-border/60 rounded-lg pl-8 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-all focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/20" placeholder="Search orders…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ fontWeight: 400 }} />
                        {search && <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"><X className="w-3 h-3" /></button>}
                      </div>
                      <SOFilterBar
                        filters={advancedFilters}
                        onFiltersChange={(f) => { setAdvancedFilters(f); setPage(1); }}
                        isKanbanView={true}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Insights toggle */}
                      <button type="button" onClick={() => { setInsightsCollapsed(!insightsCollapsed); }} className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${!insightsCollapsed ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"}`}>
                        <BarChart3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                        <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Insights</span>
                      </button>
                      {/* Columns */}
                      <button onClick={() => setShowColumns(!showColumns)} className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${showColumns ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"}`}>
                        <Columns3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                        <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Columns</span>
                      </button>
                      <div className="w-px h-5 bg-border/60 mx-1" />
                      {/* Exit fullscreen */}
                      <div className="relative group/fs">
                        <button type="button" onClick={() => { setKanbanFullscreen(false); }} className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none shrink-0">
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
                  {/* Kanban pills row */}
                  <div className="flex items-center gap-1.5 px-4 pb-3 shrink-0" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
                    <button onClick={() => { setMeMode(!meMode); setPage(1); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${meMode ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: meMode ? 500 : 400, color: meMode ? "#0A77FF" : undefined }}>
                      <User className="w-3.5 h-3.5" /> Me mode
                    </button>
                    <div className="w-px h-5 bg-border mx-1 shrink-0" />
                    {/* Group By */}
                    <div ref={kanbanGroupByRef} className="relative shrink-0">
                      <button type="button" onClick={() => setKanbanGroupByOpen(!kanbanGroupByOpen)} className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${kanbanGroupBy !== "none" ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: kanbanGroupBy !== "none" ? 500 : 400, color: kanbanGroupBy !== "none" ? "#0A77FF" : undefined }}>
                        <Layers className="w-3.5 h-3.5" />
                        <span>{kanbanGroupBy === "none" ? "Group By" : (kanbanGroupBy === "salesRep" ? "Sales Rep" : kanbanGroupBy === "customer" ? "Customer" : "Priority")}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Time Duration */}
                    <div ref={kanbanTimeDurationRef} className="relative shrink-0">
                      <button type="button" onClick={() => setKanbanTimeDurationOpen(!kanbanTimeDurationOpen)} className={`inline-flex items-center justify-center h-[30px] gap-1.5 px-3 rounded-full border text-xs transition-colors cursor-pointer outline-none ${kanbanTimeDuration !== "all" ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: kanbanTimeDuration !== "all" ? 500 : 400, color: kanbanTimeDuration !== "all" ? "#0A77FF" : undefined }}>
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{kanbanTimeDuration === "last_7_days" ? "Last 7 days" : kanbanTimeDuration === "last_30_days" ? "Last 30 days" : kanbanTimeDuration === "last_6_months" ? "Last 6 months" : kanbanTimeDuration === "last_12_months" ? "Last 12 months" : "All"}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="w-px h-5 bg-border mx-1 shrink-0" />
                    {MAIN_STATUS_FILTERS.map(sf => {
                      const isActive = statusFilter === sf;
                      const count = statusCount(sf);
                      return (
                        <button key={sf} onClick={() => { setStatusFilter(sf); setPage(1); setSelectedIds(new Set()); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${isActive ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"}`} style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "#0A77FF" : undefined }}>
                          {STATUS_FILTER_LABELS[sf] || sf}
                          {sf !== "All" && <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`} style={{ fontWeight: 600, color: isActive ? "#0A77FF" : "#475569" }}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="border-t border-border shrink-0" />
                  <div className="flex-1 min-h-0 flex relative">
                    <SOKanbanBoard salesOrders={filtered} search={search} columnVisibility={columnVisibility} groupBy={kanbanGroupBy} isFullscreen onToggleFullscreen={() => setKanbanFullscreen(false)} onStatusChange={handleKanbanStatusChange} onCancelRequest={handleKanbanCancelRequest} />
                  </div>
                </>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col">
                  {/* Toolbar in fullscreen — all controls visible */}
                  <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-muted-foreground/40 pointer-events-none" />
                        <input className="w-full h-[34px] bg-secondary/50 border border-border/60 rounded-lg pl-8 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none transition-all focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/20" placeholder="Search orders…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ fontWeight: 400 }} />
                        {search && <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground/40 hover:text-foreground transition-colors cursor-pointer"><X className="w-3 h-3" /></button>}
                      </div>
                      <SOFilterBar
                        filters={advancedFilters}
                        onFiltersChange={(f) => { setAdvancedFilters(f); setPage(1); }}
                        isKanbanView={false}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Insights toggle */}
                      <button type="button" onClick={() => { setInsightsCollapsed(!insightsCollapsed); }} className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${!insightsCollapsed ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"}`}>
                        <BarChart3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                        <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Insights</span>
                      </button>
                      {/* Density toggle */}
                      <button type="button" onClick={() => setDensity(density === "condensed" ? "comfort" : "condensed")} className="inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border border-border bg-white text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none">
                        {density === "condensed" ? <AlignJustify className="w-[18px] h-[18px] text-muted-foreground/80" /> : <List className="w-[18px] h-[18px] text-muted-foreground/80" />}
                        <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>{density === "condensed" ? "Condensed" : "Comfort"}</span>
                      </button>
                      {/* Columns */}
                      <button onClick={() => setShowColumns(!showColumns)} className={`inline-flex items-center justify-center h-9 gap-2 px-3 rounded-lg border shadow-sm transition-colors cursor-pointer outline-none ${showColumns ? "border-primary/30 bg-primary/[0.04] text-foreground" : "border-border bg-white text-foreground hover:bg-muted/40"}`}>
                        <Columns3 className="w-[18px] h-[18px] text-muted-foreground/80" />
                        <span className="text-sm hidden md:inline" style={{ fontWeight: 500 }}>Columns</span>
                      </button>
                      <div className="w-px h-5 bg-border/60 mx-1" />
                      {/* Exit fullscreen */}
                      <div className="relative group/fs">
                        <button type="button" onClick={() => { setListingFullscreen(false); setKanbanFullscreen(false); }} className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted/40 transition-colors cursor-pointer outline-none shrink-0">
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
                  {/* Pills in fullscreen */}
                  <div className="flex items-center gap-1.5 px-4 pb-3 shrink-0" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
                    <button onClick={() => { setMeMode(!meMode); setPage(1); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${meMode ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30"}`} style={{ fontWeight: meMode ? 500 : 400, color: meMode ? "#0A77FF" : undefined }}>
                      <User className="w-3.5 h-3.5" /> Me mode
                    </button>
                    <div className="w-px h-5 bg-border shrink-0" />
                    {MAIN_STATUS_FILTERS.map(sf => {
                      const isActive = statusFilter === sf;
                      const count = statusCount(sf);
                      return (
                        <button key={sf} onClick={() => { setStatusFilter(sf); setPage(1); setSelectedIds(new Set()); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${isActive ? "border-primary bg-[#EDF4FF] hover:bg-[#D6E8FF] active:bg-[#ADD1FF]" : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted"}`} style={{ fontWeight: isActive ? 500 : 400, color: isActive ? "#0A77FF" : undefined }}>
                          {STATUS_FILTER_LABELS[sf] || sf}
                          {sf !== "All" && <span className={`text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center ${isActive ? "bg-primary/10" : "bg-muted"}`} style={{ fontWeight: 600, color: isActive ? "#0A77FF" : "#475569" }}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="border-t border-border shrink-0" />
                  {/* Full table in fullscreen */}
                  <div className="flex-1 min-h-0 overflow-auto" style={{ scrollbarWidth: "thin" }}>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-20 bg-card">
                        <tr className="bg-[#f8fafc] hover:bg-[#f8fafc] border-b border-border [&>th]:h-9">
                          <th className="sticky left-0 z-20 bg-[#f8fafc] text-left whitespace-nowrap !pl-2 !pr-0 w-[40px] min-w-[40px] max-w-[40px]">
                            <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" checked={selectedIds.size > 0 && selectedIds.size === paginated.length} onChange={toggleSelectAll} />
                          </th>
                          {visibleColumns.map(key => {
                            const def = colDef(key);
                            const width = columnWidths[key] ?? def.minWidth;
                            return (
                              <th key={key} className={`whitespace-nowrap ${def.align === "right" ? "text-right" : ""}`} style={{ width: `${width}px`, padding: "0 8px" }}>
                                <span className="text-[13px]">{def.label}</span>
                              </th>
                            );
                          })}
                          <th className="whitespace-nowrap w-[60px] !pl-2 !pr-2"><span className="text-[13px]">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((so, idx) => {
                          const globalIdx = (page - 1) * perPage + idx;
                          return (
                            <tr key={so.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => navigate(`/sales-orders/${so.id}`)}>
                              <td className="!pl-2 !pr-0 py-1" style={{ width: 40 }} onClick={e => e.stopPropagation()}>
                                <input type="checkbox" className="w-3.5 h-3.5 rounded accent-primary cursor-pointer" checked={selectedIds.has(so.id)} onChange={() => toggleSelectSO(so.id)} />
                              </td>
                              {visibleColumns.map(key => (
                                <td key={key} className={`py-1 px-2 ${colDef(key).align === "right" ? "text-right" : ""}`}>
                                  {renderCell(key, so, globalIdx)}
                                </td>
                              ))}
                              <td className="!pl-2 !pr-2 py-1" style={{ width: 60 }} onClick={e => e.stopPropagation()}>
                                <button onClick={() => setOpenActionId(openActionId === so.id ? null : so.id)} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground/60 hover:text-foreground/80">
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {paginated.length === 0 && <tr><td colSpan={visibleColumns.length + 2} className="text-center text-muted-foreground py-12 text-[13px]">No sales orders match your filters.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>

      {/* Ghost element for column drag */}
      {draggingColumnKey && (
        <div ref={ghostElRef} className="fixed top-0 left-0 z-[9999] pointer-events-none" style={{ transform: "translate(-9999px, -9999px)" }}>
          <div className="px-3 py-1.5 bg-white border border-primary/30 rounded-md shadow-lg text-[13px] text-primary whitespace-nowrap" style={{ fontWeight: 500 }}>
            {colDef(draggingColumnKey).label}
          </div>
        </div>
      )}

      {/* Insights Panel — overlay drawer (not pushing) */}
      <InsightsPanel onClose={() => setShowInsights(false)} onActiveChange={setActiveInsights} open={showInsights} />
      <CreateSOModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onContinue={(payload: SOCreationPayload) => { setShowCreateModal(false); const so = createSO({ customer: payload.customer, customerInitials: payload.customerInitials, shippingAddress: payload.customerAddress, description: `Sales order for ${payload.customer} — ${payload.lineItems.length} line items`, priority: payload.priority, tags: payload.tags, lines: payload.lineItems.map(li => ({ id: "", itemCode: li.itemCode, itemName: li.itemName, itemType: li.itemType, warehouse: "Main Warehouse", orderedQty: li.qty, allocatedQty: 0, pickedQty: 0, shippedQty: 0, deliveredQty: 0, unitPrice: li.unitPrice, taxRate: 0.08, allocations: [], cancelled: false, cancelledQty: 0, readyToPick: false })) }); toast.success(`Sales Order ${so.soNumber} Created`); navigate(`/sales-orders/${so.id}`); }} />
      {confirmSingleSO && <ConfirmSOModal so={confirmSingleSO} onConfirm={() => handleSingleConfirmDone()} onClose={() => setConfirmSingleSO(null)} />}
      {showBulkConfirm && <BulkConfirmSOModal orders={selectedSOs} onConfirm={(soIds) => handleBulkConfirmDone(soIds)} onClose={() => setShowBulkConfirm(false)} />}
      {cancelTargetSO && <CancellationModal so={cancelTargetSO} mode={cancelModalMode} onConfirmFull={handleCancelFull} onConfirmPartial={handleCancelPartial} onClose={() => setCancelTargetSO(null)} />}
      {showBulkSubmitReview && <BulkSubmitForReviewModal orders={selectedSOs} onConfirm={handleBulkSubmitConfirmed} onClose={() => setShowBulkSubmitReview(false)} />}
      {showBulkClose && <BulkCloseOrdersModal orders={selectedSOs} onConfirm={handleBulkCloseConfirmed} onClose={() => setShowBulkClose(false)} />}
      {showBulkCancel && <BulkCancellationModal orders={selectedSOs} onConfirm={handleBulkCancelConfirmed} onClose={() => setShowBulkCancel(false)} />}
      {versionModalSO && <VersionHistoryModal soNumber={versionModalSO.soNumber} currentVersion={versionModalSO.version?.number ?? 1} onClose={() => setVersionModalSO(null)} />}
    </>
  );
}
