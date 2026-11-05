import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDrag, useDrop } from "react-dnd";
import {
  Search, X, Columns3, Plus, ArrowDown, ArrowUp, FileX2,
  MoreHorizontal, SlidersHorizontal, ChevronDown,
  Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  GripVertical, AlignJustify, List, LayoutGrid, Eye, EyeOff, RotateCcw, Lock,
  Send, CheckCircle2, PackageCheck, Package, Copy,
  Printer, Download, Archive, ArchiveRestore, User, ChartColumn,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { ColumnSelector } from "./ColumnSelector";
import { FONT, typography as sharedStyles } from "./designTokens";
import { type POFilterState } from "./POFilterBar";
import POFiltersModal, { countAllFilters } from "./POFiltersModal";
/* OutdatedConfigsPill import removed — the compact row chip was
   dropped per the SO-V5 sync; outdated state now surfaces only on
   the detail page banner. */

/* ═══════════════════════════════════════════════════════════════
   PO DATA TABLE
   Self-contained data table with inline columns side-panel.
   The columns panel pushes/squeezes the table (not an overlay).
   ═══════════════════════════════════════════════════════════════ */

/* ── Types ───────────────��────────────────────────────── */

type ViewMode = "compact" | "comfort" | "grid";
type CardSize = "large" | "medium" | "small";
type SortDir = "asc" | "desc" | null;

type POStatus =
  | "Draft" | "Sent" | "Confirmed" | "Cancelled"
  | "Partially Received" | "Fully Received"
  | "Active with Cancellation" | "Closed with Cancellations" | "Closed";

interface OrderedItem { code: string; image: string; }

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  version: number;
  partnerLocation: string;
  partnerAbbr: string;
  status: POStatus;
  orderedItems: OrderedItem[];
  pointOfContact: string;
  pointOfContactAbbr: string;
  quoteValue: number;
  location: string;
  locationAddress?: string;
  createdBy: string;
  dueDeliveryDate: string;
  orderDate: string;
  owner: "me" | "other";
  hasNotification?: boolean;
  /** Archived POs are hidden from every view except the Archived pill. */
  archived?: boolean;
}

export type ColumnId =
  | "partnerLocation" | "status" | "orderedItems" | "pointOfContact"
  | "location" | "createdBy" | "dueDeliveryDate" | "orderDate";

export interface ColumnDef {
  id: ColumnId;
  label: string;
  minWidth: number;
  align?: "left" | "right";
  sortable?: boolean;
}

interface TabDef { value: string; label: string; }

export type PORowAction =
  | "view" | "edit" | "send-to-vendor" | "mark-confirmed"
  | "mark-partially-received" | "mark-fully-received"
  | "duplicate" | "print" | "download-pdf"
  | "archive" | "restore";

export interface PODataTableProps {
  filteredData: PurchaseOrder[];
  /** All PO data (unfiltered) — used to derive available filter options */
  allData?: PurchaseOrder[];
  columns: ColumnDef[];
  columnOrder: ColumnId[];
  onColumnOrderChange: (order: ColumnId[]) => void;
  hiddenColumnIds: ColumnId[];
  onHiddenColumnsChange: (ids: ColumnId[]) => void;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  tabDefs: TabDef[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabCounts: Record<string, number>;
  tabColor: (val: string, active: boolean) => React.CSSProperties;
  ownershipFilter: "all" | "me";
  ownershipCount?: number;
  isCurrentUserPO?: (item: PurchaseOrder) => boolean;
  onOwnershipToggle: () => void;
  /** `opts.outdated` deep-links into the detail page with the
      Outdated Configurations modal auto-opened (query param
      `?outdated=1`). Row-body click passes no opts. */
  /** Callback to open the PO detail page.
      · `outdated` — deep-link that triggers the outdated-configs modal.
      · `versionHistory` — deep-link that lands on the Versions tab
        (fired by clicking the V{n} chip on this row). */
  onNavigate: (id: string, opts?: { outdated?: boolean; versionHistory?: boolean }) => void;
  onCreateNew: () => void;
  onResetFilters: () => void;
  renderCell: (col: ColumnDef, item: PurchaseOrder, viewMode?: "compact" | "comfort" | "grid") => React.ReactNode;
  highlightText: (text: string, query: string) => React.ReactNode;
  activeInsightCount: number;
  onInsightsDrawerOpen: () => void;
  renderGridCard?: (item: PurchaseOrder, cardSize?: "large" | "medium" | "small") => React.ReactNode;
  filters: POFilterState;
  onFiltersChange: (f: POFilterState) => void;
  filterPanelOpen: boolean;
  onFilterPanelToggle: () => void;
  /** Quick-pill state — single-select, independent from the modal's
      multi-select `filters.status`. Pills overwrite the previous value
      instead of toggling, so only one is active at a time. */
  quickStatus: "all" | POStatus | "Archived";
  onQuickStatusChange: (value: "all" | POStatus) => void;
  /** Optional: the pinned column label (defaults to "PO No") */
  pinnedColumnLabel?: string;
  /** Row action handler */
  onRowAction?: (action: PORowAction, item: PurchaseOrder) => void;

  /* ── PR-listing options ──
     The Purchase Requests page reuses this table but doesn't need
     the PO-specific chrome. These flags let a caller opt out
     without affecting existing PO-listing behavior. */
  /** Hide the sticky-right Actions column + RowActionsMenu. */
  hideActionsColumn?: boolean;
  /** Hide the `V{item.version}` chip next to the pinned id. */
  hideVersion?: boolean;
  /** Hide the Insights toolbar button + badge. */
  hideInsights?: boolean;
  /** Punch up the row hover: deeper blue tint + inset ring so the
      row that the buyer's cursor is on reads as clearly active. */
  rowHoverAccent?: boolean;
  /** Hide the Vendor Contact filter section — PR listing has no
      point-of-contact column. */
  hideFilterPointOfContact?: boolean;
  /** Hide the Location filter section — PR listing has no delivery
      location column. */
  hideFilterLocation?: boolean;
  /** Hide the Status filter section — PR listing surfaces status
      through the tab strip, and the modal's status vocabulary is PO-
      specific so it would be misleading there anyway. */
  hideFilterStatus?: boolean;
  /** Optional Item filter — PR listing enables it so buyers can
      narrow to a specific item code. Parent owns the state so item
      vocabulary doesn't leak into POFilterState. */
  filterItemOptions?: string[];
  filterItemSelected?: string[];
  onFilterItemToggle?: (item: string) => void;
  /** Optional filter-section label overrides so the modal's section
      titles + subtitles match the calling table's column labels
      (PR listing renames Partner Location → Preferred Vendor, etc.). */
  filterLabels?: {
    partnerLocation?: { title: string; subtitle: string; placeholder?: string };
    createdBy?: { title: string; subtitle: string; placeholder?: string };
    dueDate?: { title: string; subtitle: string };
    orderDate?: { title: string; subtitle: string };
    item?: { title: string; subtitle: string; placeholder?: string };
  };
  /** Toolbar search input placeholder (defaults to the PO copy). */
  searchPlaceholder?: string;
  /** Result-count noun in the toolbar count strip. PR listing passes
      "requests" so the copy reads "N of N requests". */
  resultNoun?: { singular: string; plural: string };
  /** Empty-state copy shown when the table has no rows after
      filtering. PR listing supplies distinct messages per state so
      buyers see accurate copy for search, filters, Me mode, and
      status-tab misses. */
  emptyState?: {
    title: string;
    description: string;
    createLabel?: string;
    hideCreateAction?: boolean;
    hideResetAction?: boolean;
  };
}

/* ── Constants ────────────────────────────────────────────── */

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100] as const;
const COL_DND_TYPE = "PO_HEADER_COL";
const DRAWER_COL_DND = "DRAWER_COL";
const PANEL_WIDTH = 280;

/* ── Pinned column widths (px) ──
   PO # column has two widths — the narrow one keeps the number
   + V1 badge + optional outdated-configs chip on ONE line without
   the number truncating to `395-…`, so most laptops get the
   roomier layout. Wide-desktop layout keeps a modest 148 (up
   from the original 120) — 28 more pixels are barely visible on
   a 2K/4K screen but give the chip the room it needs. */
const ME_ICON_W = 28;
const PO_NO_W_WIDE = 148;
const PO_NO_W_NARROW = 184;
const PO_NO_BREAKPOINT_PX = 1600;
const PARTNER_W = 210;
const ACTION_W = 56;

function usePoNoWidth(): number {
  const [w, setW] = useState<number>(() => {
    if (typeof window === "undefined") return PO_NO_W_WIDE;
    return window.innerWidth < PO_NO_BREAKPOINT_PX ? PO_NO_W_NARROW : PO_NO_W_WIDE;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(min-width: ${PO_NO_BREAKPOINT_PX}px)`);
    const onChange = () => setW(mql.matches ? PO_NO_W_WIDE : PO_NO_W_NARROW);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return w;
}
const STICKY_SHADOW_LEFT = "inset -1px 0 0 0 rgba(0,0,0,0.08)";
const STICKY_SHADOW_RIGHT = "inset 1px 0 0 0 rgba(0,0,0,0.08)";

/* ── Typography — CSS-var bound, Inter only ────────────── */

const s = {
  ...sharedStyles,
  thLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
    letterSpacing: "normal",
    textTransform: "none" as const,
  } as React.CSSProperties,
  cellId: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,
  cellText: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "20px",
    fontFamily: FONT,
  } as React.CSSProperties,
};

/* ═══════════════════════════════════════════════════════════
   TABLE HEADER — Partners' mousedown-tracked live-swap pattern
   No react-dnd; ghost follows cursor via direct DOM transform;
   live-swap triggers when cursor exits the dragged col's bounds.
   ═══════════════════════════════════════════════════════════ */

interface DraggableHeaderProps {
  col: ColumnDef;
  width: number;
  sortCol: ColumnId | null;
  sortDir: SortDir;
  onSort: (id: ColumnId) => void;
  onHeaderMouseDown: (e: React.MouseEvent, colId: ColumnId) => void;
  isBeingDragged: boolean;
  suppressNextClickRef: React.MutableRefObject<boolean>;
  onResizeStart: (e: React.MouseEvent, colId: ColumnId) => void;
}

function DraggableHeader({
  col, width, sortCol, sortDir, onSort, onHeaderMouseDown,
  isBeingDragged, suppressNextClickRef, onResizeStart,
}: DraggableHeaderProps) {
  const isSorted = sortCol === col.id;

  return (
    <th
      data-col-drag-key={col.id}
      onMouseDown={(e) => onHeaderMouseDown(e, col.id)}
      onClickCapture={(e) => {
        if (suppressNextClickRef.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      className={`${col.align === "right" ? "text-right" : "text-left"} relative select-none group/colheader cursor-grab`}
      style={{
        ...s.thLabel, width, minWidth: col.minWidth,
        padding: `1px 8px 1px 24px`,
        backgroundColor: "rgb(248, 250, 252)",
        borderBottom: "1px solid hsl(var(--border))",
        color: "hsl(var(--muted-foreground))",
        overflow: "hidden",
        ...(isBeingDragged ? {
          background: "linear-gradient(180deg, rgba(10,119,255,0.08) 0%, rgba(10,119,255,0.03) 100%)",
        } : {}),
      }}
    >
      {/* Blue accent bar on top edge when dragged */}
      {isBeingDragged && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-b-full pointer-events-none"
          style={{ backgroundColor: "hsl(var(--primary))" }}
        />
      )}
      {/* Drag grip — appears on hover (or always when dragged) */}
      <GripVertical
        className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 transition-opacity z-[5] pointer-events-none ${
          isBeingDragged
            ? "opacity-100 text-primary"
            : "opacity-0 group-hover/colheader:opacity-100 text-muted-foreground/40"
        }`}
      />
      <div
        className={`flex items-center gap-1.5 ${col.sortable ? "cursor-pointer" : ""} select-none ${col.align === "right" ? "justify-end" : ""}`}
        onClick={() => col.sortable && onSort(col.id)}
      >
        {col.label}
        {col.sortable && (
          isSorted
            ? sortDir === "asc"
              ? <ArrowUp className="size-3" style={{ color: "hsl(var(--primary))" }} />
              : <ArrowDown className="size-3" style={{ color: "hsl(var(--primary))" }} />
            : <ArrowDown className="size-3 opacity-0 group-hover/colheader:opacity-40 transition-opacity" />
        )}
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize opacity-0 group-hover/colheader:opacity-100 hover:!opacity-100 transition-opacity z-10"
        style={{ backgroundColor: "hsl(var(--border))" }}
        onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e, col.id); }}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );
}

/* ═══════════════════════════════════════════════════════════
   INLINE COLUMNS PANEL — Draggable column row
   Aligns with data table row height, typography, and borders.
   Uses same vPad / cellText tokens as the table body.
   ═══════════════════════════════════════════════════════════ */

interface PanelColumnRowProps {
  column: { id: string; label: string };
  index: number;
  isHidden: boolean;
  vPad: string;
  onToggle: () => void;
  moveColumn: (from: number, to: number) => void;
}

function PanelColumnRow({ column, index, isHidden, vPad, onToggle, moveColumn }: PanelColumnRowProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop({
    accept: DRAWER_COL_DND,
    hover(item: { index: number }) {
      if (item.index !== index) { moveColumn(item.index, index); item.index = index; }
    },
    collect: (m) => ({ isOver: m.isOver() }),
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: DRAWER_COL_DND,
    item: () => ({ index }),
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  drag(drop(ref));

  return (
    <>
      {/* Drop zone — dashed blue indicator matching row height */}
      {isOver && (
        <div
          className="flex items-center justify-center"
          style={{
            padding: `${vPad} 12px`,
            border: "1.5px dashed hsl(var(--primary))",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "hsl(var(--primary-tint))",
            margin: "0 0 -1px 0",
          }}
        >
          <span style={{ ...s.uiCaption, color: "hsl(var(--primary))", fontSize: "11px", fontFamily: FONT }}>Drop here</span>
        </div>
      )}
      <div
        ref={preview}
        className={`group flex items-center transition-colors ${isDragging ? "opacity-30" : ""}`}
        style={{
          /* Match table cell padding exactly */
          padding: `${vPad} 12px`,
          borderBottom: "1px solid hsl(var(--border))",
          backgroundColor: isDragging ? "hsl(var(--primary-tint))" : "hsl(var(--card))",
          boxShadow: isDragging ? "var(--elevation-sm)" : "none",
        }}
        onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isDragging ? "hsl(var(--primary-tint))" : "hsl(var(--card))"; }}
      >
        {/* Drag handle — visible on hover, same size as table icons */}
        <div ref={ref} className="cursor-grab opacity-0 group-hover:opacity-50 transition-opacity shrink-0 mr-2.5" style={{ marginLeft: "-2px" }}>
          <GripVertical className="size-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
        </div>
        {/* Eye toggle — small rounded badge, sized to match text row */}
        <button
          className="shrink-0 cursor-pointer inline-flex items-center justify-center rounded-[var(--radius-sm)] transition-colors mr-2.5"
          style={{
            width: 24,
            height: 24,
            backgroundColor: isHidden ? "hsl(var(--secondary))" : "hsl(var(--primary-tint))",
          }}
          onClick={onToggle}
          aria-label={isHidden ? "Show column" : "Hide column"}
        >
          {isHidden
            ? <EyeOff className="size-3.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45 }} />
            : <Eye className="size-3.5" style={{ color: "hsl(var(--primary))" }} />
          }
        </button>
        {/* Column name — same font as table cell text */}
        <span
          className={`flex-1 truncate ${isHidden ? "line-through" : ""}`}
          style={{
            ...s.cellText,
            color: isHidden ? "hsl(var(--muted-foreground))" : "hsl(var(--foreground))",
            opacity: isHidden ? 0.45 : 1,
          }}
        >
          {column.label}
        </span>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   INLINE COLUMNS PANEL
   Styled as a seamless extension of the data table:
   - Header bar matches table toolbar (same bg, padding, h-8)
   - Search matches toolbar search input exactly
   - Section labels use thLabel style (11px uppercase semibold)
   - Column rows use cellText (13px) + same vPad + border-bottom
   ═══════════════════════════════════════════════════════════ */

interface InlineColumnsPanelProps {
  columns: ColumnDef[];
  columnOrder: ColumnId[];
  hiddenColumnIds: ColumnId[];
  pinnedLabel: string;
  vPad: string;
  onColumnOrderChange: (order: ColumnId[]) => void;
  onHiddenColumnsChange: (ids: ColumnId[]) => void;
  onClose: () => void;
}

function InlineColumnsPanel({
  columns, columnOrder, hiddenColumnIds, pinnedLabel, vPad,
  onColumnOrderChange, onHiddenColumnsChange, onClose,
}: InlineColumnsPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const visibleCount = columnOrder.filter((id) => !hiddenColumnIds.includes(id)).length + 1;
  const totalCount = columns.length + 1;

  const moveColumn = useCallback((from: number, to: number) => {
    const o = [...columnOrder];
    const [r] = o.splice(from, 1);
    o.splice(to, 0, r);
    onColumnOrderChange(o);
  }, [columnOrder, onColumnOrderChange]);

  const toggleColumn = useCallback((id: ColumnId) => {
    onHiddenColumnsChange(
      hiddenColumnIds.includes(id)
        ? hiddenColumnIds.filter((c) => c !== id)
        : [...hiddenColumnIds, id]
    );
  }, [hiddenColumnIds, onHiddenColumnsChange]);

  const showAll = () => onHiddenColumnsChange([]);
  const hideAll = () => onHiddenColumnsChange(columns.map((c) => c.id));
  const reset = () => { onHiddenColumnsChange([]); onColumnOrderChange(columns.map((c) => c.id)); };

  const filteredOrder = searchQuery
    ? columnOrder.filter((id) => columns.find((c) => c.id === id)?.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : columnOrder;

  return (
    <div
      className="shrink-0 flex flex-col overflow-hidden"
      style={{ width: PANEL_WIDTH, minWidth: PANEL_WIDTH, backgroundColor: "hsl(var(--card))", fontFamily: FONT }}
    >
      {/* ── Header — matches toolbar bar (px-3 py-2.5, same bg) ── */}
      <div
        className="shrink-0 px-3 py-2.5 border-b border-border flex items-center justify-between"
        style={{ backgroundColor: "hsl(var(--card))" }}
      >
        <div className="flex items-center gap-2">
          {/* Small blue icon badge — table-scale, not oversized */}
          <div
            className="flex items-center justify-center rounded-[var(--radius-sm)] shrink-0"
            style={{ width: 26, height: 26, backgroundColor: "hsl(var(--primary-tint))" }}
          >
            <Columns3 className="size-3.5" style={{ color: "hsl(var(--primary))" }} />
          </div>
          <span style={{
            fontSize: "var(--text-base)",
            fontWeight: "var(--font-weight-semibold)" as string,
            lineHeight: "20px",
            fontFamily: FONT,
            color: "hsl(var(--foreground))",
          }}>
            Columns
          </span>
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-[4px] px-1"
            style={{
              fontSize: "10px",
              fontWeight: "var(--font-weight-semibold)" as string,
              fontFamily: FONT,
              backgroundColor: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            {visibleCount}/{totalCount}
          </span>
        </div>
        <button
          className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] cursor-pointer transition-colors"
          style={{ color: "hsl(var(--muted-foreground))" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          onClick={onClose}
          aria-label="Close columns panel"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* ── Search + actions — matches toolbar search (h-8, same tokens) ── */}
      <div className="shrink-0 px-3 py-2.5 border-b border-border" style={{ backgroundColor: "hsl(var(--card))" }}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "hsl(var(--muted-foreground))" }} />
          <input
            type="text"
            placeholder="Search columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-[var(--radius-sm)] border border-border pl-8 pr-8 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
            style={{ ...s.uiCaption, backgroundColor: "hsl(var(--input-background))", color: "hsl(var(--foreground))" }}
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
              style={{ color: "hsl(var(--muted-foreground))" }}
              onClick={() => setSearchQuery("")}
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        {/* Action row — same uiLabel size as toolbar buttons */}
        <div className="flex items-center gap-0.5 mt-2">
          <button
            className="cursor-pointer flex items-center gap-1 h-7 px-2 rounded-[var(--radius-sm)] transition-colors"
            style={{ ...s.uiLabel, color: "hsl(var(--primary))" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--primary-tint))"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            onClick={showAll}
          >
            <Eye className="size-3" />
            Show All
          </button>
          <button
            className="cursor-pointer flex items-center gap-1 h-7 px-2 rounded-[var(--radius-sm)] transition-colors"
            style={{ ...s.uiLabel, color: "hsl(var(--foreground))" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            onClick={hideAll}
          >
            <EyeOff className="size-3" />
            Hide All
          </button>
          <button
            className="cursor-pointer flex items-center gap-1 h-7 px-2 rounded-[var(--radius-sm)] ml-auto transition-colors"
            style={{ ...s.uiLabel, color: "hsl(var(--muted-foreground))" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            onClick={reset}
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        </div>
      </div>

      {/* ── PINNED — section label uses thLabel (11px semibold uppercase) ── */}
      <div className="shrink-0">
        <div style={{ padding: "6px 12px", backgroundColor: "rgba(241, 245, 249, 0.5)", borderBottom: "1px solid hsl(var(--border))" }}>
          <span style={{ ...s.thLabel, color: "hsl(var(--muted-foreground))" }}>PINNED</span>
        </div>
        {/* Pinned row — same padding as table cells */}
        <div
          className="flex items-center"
          style={{ padding: `${vPad} 12px`, borderBottom: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }}
        >
          <Lock className="size-3.5 shrink-0 mr-2.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35 }} />
          <span className="flex-1 truncate" style={{ ...s.cellText, color: "hsl(var(--foreground))" }}>
            {pinnedLabel}
          </span>
          <Eye className="size-3.5 shrink-0 ml-2" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.25 }} />
        </div>
      </div>

      {/* ── COLUMNS — section label matches table header exactly ── */}
      <div
        className="shrink-0"
        style={{ padding: "6px 12px", backgroundColor: "rgba(241, 245, 249, 0.5)", borderBottom: "1px solid hsl(var(--border))" }}
      >
        <span style={{ ...s.thLabel, color: "hsl(var(--muted-foreground))" }}>COLUMNS</span>
      </div>

      {/* ── Scrollable column rows — each row matches table cell rhythm ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
      >
        {filteredOrder.map((colId, idx) => {
          const col = columns.find((c) => c.id === colId);
          if (!col) return null;
          return (
            <PanelColumnRow
              key={col.id}
              column={col}
              index={idx}
              isHidden={hiddenColumnIds.includes(col.id)}
              vPad={vPad}
              onToggle={() => toggleColumn(col.id)}
              moveColumn={moveColumn}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ROW ACTIONS MENU — contextual actions based on PO status
   ═══════════════════════════════════════════════════════════ */

type ActionItem = {
  action: PORowAction;
  label: string;
  icon: React.ReactNode;
  destructive?: boolean;
  stateTransition?: boolean;
};

function getActionsForStatus(status: string, archived = false): ActionItem[][] {
  const view: ActionItem = { action: "view", label: "View Details", icon: <Eye className="size-4" /> };
  const send: ActionItem = { action: "send-to-vendor", label: "Send to Vendor", icon: <Send className="size-4" />, stateTransition: true };
  const confirm: ActionItem = { action: "mark-confirmed", label: "Mark as Confirmed", icon: <CheckCircle2 className="size-4" />, stateTransition: true };
  const partial: ActionItem = { action: "mark-partially-received", label: "Mark as Partially Received", icon: <Package className="size-4" />, stateTransition: true };
  const full: ActionItem = { action: "mark-fully-received", label: "Mark as Fully Received", icon: <PackageCheck className="size-4" />, stateTransition: true };
  const dup: ActionItem = { action: "duplicate", label: "Duplicate PO", icon: <Copy className="size-4" /> };
  const print: ActionItem = { action: "print", label: "Print PO", icon: <Printer className="size-4" /> };
  const pdf: ActionItem = { action: "download-pdf", label: "Download PDF", icon: <Download className="size-4" /> };
  const archive: ActionItem = { action: "archive", label: "Archive PO", icon: <Archive className="size-4 text-destructive" />, destructive: true };

  const restore: ActionItem = { action: "restore", label: "Restore PO", icon: <ArchiveRestore className="size-4" /> };

  /* Archived rows (Archived pill) only offer Restore. Otherwise Archive
     PO is offered until something is received — Draft, Sent, Confirmed,
     Cancelled; there is no Delete Draft (ERP-4744 / ERP-4772). */
  if (archived) return [[view], [dup, print, pdf], [restore]];
  switch (status) {
    case "Draft":
    case "Confirmed":
    case "Cancelled":
      return [[view], [dup, print, pdf], [archive]];
    case "Sent":
      return [[view], [confirm], [dup, print, pdf], [archive]];
    default:
      return [[view], [dup, print, pdf]];
  }
}

function RowActionsMenu({ item, onAction }: { item: PurchaseOrder; onAction?: (action: PORowAction, item: PurchaseOrder) => void }) {
  const sections = getActionsForStatus(item.status, !!item.archived);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center justify-center size-7 rounded-[var(--radius-sm)] transition-colors cursor-pointer border border-transparent hover:border-border hover:bg-secondary"
          style={{ color: "hsl(var(--muted-foreground))" }}
          aria-label="Actions"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[220px]">
        {sections.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && <DropdownMenuSeparator />}
            {group.map((a) => (
              <DropdownMenuItem
                key={a.action}
                className={`gap-2.5 ${a.destructive ? "text-destructive focus:text-destructive" : ""}`}
                style={a.stateTransition ? { borderLeft: "2px solid hsl(var(--primary))", borderRadius: "0 var(--radius-sm) var(--radius-sm) 0" } : undefined}
                onClick={() => onAction?.(a.action, item)}
              >
                {a.icon}
                <span style={{ fontFamily: FONT, fontSize: "var(--text-label)" }}>{a.label}</span>
              </DropdownMenuItem>
            ))}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function PODataTable({
  filteredData, columns, columnOrder, onColumnOrderChange, hiddenColumnIds, onHiddenColumnsChange,
  searchTerm, onSearchTermChange, tabDefs, activeTab: _activeTab, onTabChange: _onTabChange, tabCounts, tabColor,
  ownershipFilter, ownershipCount = 0, isCurrentUserPO, onOwnershipToggle, onNavigate, onCreateNew, onResetFilters,
  renderCell, highlightText, activeInsightCount, onInsightsDrawerOpen,
  hideActionsColumn = false, hideVersion = false, hideInsights = false,
  rowHoverAccent = false,
  hideFilterPointOfContact = false, hideFilterLocation = false,
  hideFilterStatus = false,
  filterItemOptions,
  filterItemSelected,
  onFilterItemToggle,
  filterLabels,
  searchPlaceholder,
  resultNoun,
  emptyState,
  renderGridCard, filters, onFiltersChange, filterPanelOpen, onFilterPanelToggle,
  quickStatus, onQuickStatusChange,
  pinnedColumnLabel = "PO No", allData, onRowAction,
}: PODataTableProps) {

  /* ── State ── */
  const [viewMode, setViewMode] = useState<ViewMode>("compact");
  const [cardSize, setCardSize] = useState<CardSize>("medium");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  /* Pinned PO# column width — grows on narrow viewports so
     the PO number + V1 badge + outdated-configs chip all fit
     without truncating to "395-…". Wide-desktop layout is
     unaffected. */
  const poNoW = usePoNoWidth();
  const pinnedLeftTotal = ME_ICON_W + poNoW + PARTNER_W;
  const [densityOpen, setDensityOpen] = useState(false);
  const densityRef = useRef<HTMLDivElement>(null);
  
  const [sortCol, setSortCol] = useState<ColumnId | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    columns.forEach((c) => { w[c.id] = c.minWidth; });
    return w;
  });
  const resizeRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);


  /* ── Derived ── */
  const visibleColumns = useMemo(() => {
    return columnOrder
      .filter((id) => !hiddenColumnIds.includes(id))
      .map((id) => columns.find((c) => c.id === id)!)
      .filter(Boolean);
  }, [columnOrder, hiddenColumnIds, columns]);

  /* partnerLocation is always pinned — exclude from scrollable cols */
  const partnerCol = useMemo(() => columns.find((c) => c.id === "partnerLocation"), [columns]);
  const scrollableColumns = useMemo(
    () => visibleColumns.filter((c) => c.id !== "partnerLocation"),
    [visibleColumns],
  );

  /* ── Sorting ── */
  const sortedData = useMemo(() => {
    if (!sortCol || !sortDir) return filteredData;
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      let aVal = "", bVal = "";
      switch (sortCol) {
        case "partnerLocation": aVal = a.partnerLocation; bVal = b.partnerLocation; break;
        case "pointOfContact": aVal = a.pointOfContact; bVal = b.pointOfContact; break;
        case "orderedItems": aVal = a.orderedItems[0]?.code || ""; bVal = b.orderedItems[0]?.code || ""; break;
        case "createdBy": aVal = a.createdBy; bVal = b.createdBy; break;
        case "dueDeliveryDate": aVal = a.dueDeliveryDate; bVal = b.dueDeliveryDate; break;
        case "orderDate": aVal = a.orderDate; bVal = b.orderDate; break;
        default: return 0;
      }
      return sortDir === "asc" ? aVal.localeCompare(bVal) : -aVal.localeCompare(bVal);
    });
    return sorted;
  }, [filteredData, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
  const pageData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filters.status, itemsPerPage, filteredData.length]);

  /* ── Density close ── */
  useEffect(() => {
    if (!densityOpen) return;
    const h = (e: MouseEvent) => { if (densityRef.current && !densityRef.current.contains(e.target as Node)) setDensityOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [densityOpen]);

  /* ── Column resize ── */
  const handleResizeStart = useCallback((e: React.MouseEvent, colId: ColumnId) => {
    e.preventDefault(); e.stopPropagation();
    resizeRef.current = { colId, startX: e.clientX, startW: columnWidths[colId] || 150 };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const col = columns.find((c) => c.id === resizeRef.current!.colId);
      setColumnWidths((p) => ({ ...p, [resizeRef.current!.colId]: Math.max(col?.minWidth || 80, resizeRef.current!.startW + ev.clientX - resizeRef.current!.startX) }));
    };
    const onUp = () => { resizeRef.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  }, [columnWidths, columns]);

  /* ── Column reorder (drawer panel uses index-based) ── */
  const moveColumn = useCallback((from: number, to: number) => {
    const visible = columnOrder.filter((id) => !hiddenColumnIds.includes(id) && id !== "partnerLocation");
    const fromId = visible[from], toId = visible[to];
    if (!fromId || !toId) return;
    const o = [...columnOrder]; const fi = o.indexOf(fromId); const ti = o.indexOf(toId);
    const [r] = o.splice(fi, 1); o.splice(ti, 0, r);
    onColumnOrderChange(o);
  }, [columnOrder, hiddenColumnIds, onColumnOrderChange]);

  /* ── Column reorder (table header) — Partners' mousedown live-swap pattern ── */
  const colDragRef = useRef<{ columnKey: ColumnId; startX: number; startY: number; isDragging: boolean; lastSwapTime: number } | null>(null);
  const ghostElRef = useRef<HTMLDivElement>(null);
  const suppressNextClickRef = useRef<boolean>(false);
  const [draggingColumnKey, setDraggingColumnKey] = useState<ColumnId | null>(null);

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent, columnKey: ColumnId) => {
    // Locked columns: partnerLocation is sticky/pinned in this table
    if (columnKey === "partnerLocation") return;
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
      if (ghost) {
        ghost.style.transform = `translate(${moveEvt.clientX}px, ${moveEvt.clientY}px)`;
      }

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
        const k = th.getAttribute("data-col-drag-key") as ColumnId | null;
        if (!k || k === draggedKey || k === "partnerLocation") break;

        onColumnOrderChange((() => {
          const prev = columnOrder;
          const srcIdx = prev.indexOf(draggedKey);
          const tgtIdx = prev.indexOf(k);
          if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) return prev;
          const next = [...prev];
          next.splice(srcIdx, 1);
          next.splice(tgtIdx, 0, draggedKey);
          return next;
        })());
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
  }, [columnOrder, onColumnOrderChange]);

  /* ── Sort ── */
  const handleSort = useCallback((id: ColumnId) => {
    if (sortCol === id) { if (sortDir === "asc") setSortDir("desc"); else { setSortCol(null); setSortDir(null); } }
    else { setSortCol(id); setSortDir("asc"); }
  }, [sortCol, sortDir]);

  /* ── Selection (removed — no checkboxes) ── */

  /* ── Computed ── */
  const densityLabel = viewMode === "compact" ? "Condensed" : viewMode === "comfort" ? "Relaxed" : "Card View";
  const vPad = viewMode === "comfort" ? "10px" : "4px";
  const activeFilterCount = countAllFilters(filters);

  /* ── Derive unique filter options from allData ── */
  const sourceData = allData || filteredData;
  const filterOptions = useMemo(() => {
    const partners = [...new Set(sourceData.map((d) => d.partnerLocation))].sort();
    const contacts = [...new Set(sourceData.map((d) => d.pointOfContact))].sort();
    const creators = [...new Set(sourceData.map((d) => d.createdBy))].sort();
    const locs = [...new Set(sourceData.map((d) => d.location))].sort();
    const quotes = sourceData.map((d) => d.quoteValue);
    return { partners, contacts, creators, locs, quotes };
  }, [sourceData]);

  /* ═══════════════════════════════════════════════════════
     BADGE — toolbar count badge
     ═══════════════════════════════════════════════════════ */
  const ToolbarBadge = ({ count, variant = "primary" }: { count: number; variant?: "primary" | "muted" }) => (
    <span
      className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full px-1.5"
      style={{
        fontSize: "11px", fontWeight: 600, fontFamily: FONT,
        backgroundColor: variant === "primary" ? "hsl(var(--accent))" : "hsl(var(--secondary))",
        color: variant === "primary" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
      }}
    >
      {count}
    </span>
  );

  /* ═══════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════ */

  return (
    <div
      className="flex-1 min-h-0 flex overflow-hidden rounded-[var(--radius-lg)] border border-border"
      style={{ backgroundColor: "hsl(var(--card))" }}
    >
      {/* ══════════ LEFT: Table area (shrinks when panel open) ══════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ─── TOOLBAR ─── */}
        <div className="shrink-0 px-4 py-2.5 border-b border-border" style={{ backgroundColor: "hsl(var(--card))" }}>
          <div className="flex items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[140px] flex-1 xl:max-w-[360px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
              <input
                type="text"
                placeholder={searchPlaceholder ?? "Search by PO, partner, item..."}
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                maxLength={75}
                className="h-9 w-full rounded-md border border-border pl-9 pr-9 text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
                style={{ fontFamily: FONT, backgroundColor: "hsl(var(--input-background))", color: "hsl(var(--foreground))" }}
              />
              {searchTerm && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: "hsl(var(--muted-foreground))" }} onClick={() => onSearchTermChange("")} aria-label="Clear">
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Filters */}
            <Button
              variant="outline" size="sm"
              className="h-9 gap-1.5 px-3 rounded-lg border border-border bg-white shadow-sm shrink-0 hover:!bg-muted/50 hover:!text-foreground"
              style={{
                ...s.uiLabel,
                ...(filterPanelOpen || activeFilterCount > 0
                  ? { borderColor: "hsl(var(--primary))", backgroundColor: "hsl(var(--primary-tint))", color: "hsl(var(--primary))" }
                  : {}),
              }}
              onClick={onFilterPanelToggle}
            >
              <SlidersHorizontal className="size-3.5" />
              Filters
              {activeFilterCount > 0 && <ToolbarBadge count={activeFilterCount} />}
            </Button>

            {/* Spacer — pushes right-side controls (count + actions) to the far right */}
            <div className="hidden xl:block xl:flex-1" />

            {/* Count — right-aligned next to action buttons (Partners pattern) */}
            <span
              className="text-sm tabular-nums mr-1 hidden sm:inline shrink-0 whitespace-nowrap"
              style={{
                fontWeight: 500,
                lineHeight: "20px",
                color: "hsl(var(--foreground))",
                fontFamily: FONT,
              }}
            >
              {(() => {
                const nounSingular = resultNoun?.singular ?? "order";
                const nounPlural = resultNoun?.plural ?? "orders";
                const noun = (n: number) => (n === 1 ? nounSingular : nounPlural);
                if (sortedData.length > 0) {
                  return `${sortedData.length} of ${filteredData.length} ${noun(filteredData.length)}`;
                }
                return `${filteredData.length} ${noun(filteredData.length)}`;
              })()}
            </span>

            {/* Single separator before action button group (Partners pattern) */}
            <div className="w-px h-5 bg-border/60 mx-1 hidden sm:block shrink-0" />

            {/* Insights badge — opens insights drawer. Suppressed on
                surfaces that don't have an insights drawer (e.g. PR
                listing via `hideInsights`). */}
            {!hideInsights && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 px-3 rounded-lg border border-border bg-white shadow-sm shrink-0 hover:!bg-muted/40 hover:!text-foreground"
                style={s.uiLabel}
                onClick={onInsightsDrawerOpen}
              >
                <ChartColumn className="size-3.5" />
                Insights
                <span
                  className="inline-flex items-center justify-center min-w-[20px] h-[20px] rounded-full px-1.5 text-[11px]"
                  style={{
                    fontWeight: 600,
                    fontFamily: FONT,
                    backgroundColor: "hsl(var(--accent))",
                    color: "hsl(var(--primary))",
                  }}
                >
                  {activeInsightCount}
                </span>
              </Button>
            )}

            {/* Density */}
            <div className="relative shrink-0" ref={densityRef}>
                <Button variant="outline" size="sm" className="h-9 gap-2 px-3 rounded-lg border border-border bg-white shadow-sm shrink-0 hover:!bg-muted/40 hover:!text-foreground" style={s.uiLabel} onClick={() => setDensityOpen((p) => !p)}>
                  <AlignJustify className="size-3.5" />
                  {densityLabel}
                  <ChevronDown className="size-3 opacity-50" />
                </Button>
                {densityOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 w-[230px] p-1.5"
                    style={{ backgroundColor: "hsl(var(--card))", boxShadow: "var(--elevation-sm)", borderRadius: "var(--radius)", border: "1px solid hsl(var(--border))" }}
                  >
                    {([
                      { mode: "compact" as ViewMode, label: "Condensed", desc: "Compact rows", Icon: AlignJustify },
                      { mode: "comfort" as ViewMode, label: "Relaxed", desc: "Spacious rows", Icon: List },
                      { mode: "grid" as ViewMode, label: "Card View", desc: "Grid layout", Icon: LayoutGrid },
                    ]).map((opt) => {
                      const ItemIcon = opt.Icon;
                      return (
                        <button
                          key={opt.mode}
                          className="flex items-center gap-3 w-full py-2.5 px-3 cursor-pointer rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
                          onClick={() => { setViewMode(opt.mode); if (opt.mode !== "grid") setDensityOpen(false); }}
                        >
                          <ItemIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm" style={{ fontWeight: 500, fontFamily: FONT, color: "hsl(var(--foreground))" }}>{opt.label}</div>
                            <div className="text-xs text-muted-foreground" style={{ fontFamily: FONT }}>{opt.desc}</div>
                          </div>
                          {viewMode === opt.mode && <Check className="w-4 h-4 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                        </button>
                      );
                    })}
                    {/* Card size pills — only when card view is active */}
                    {viewMode === "grid" && (
                      <>
                        <div className="mx-2 my-1.5 border-t border-muted" />
                        <div className="px-3 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide mb-2" style={{ fontWeight: 600, color: "rgb(148, 163, 184)" }}>Card Size</p>
                          <div className="flex items-center gap-1.5">
                            {(["large", "medium", "small"] as const).map((size) => (
                              <button
                                key={size}
                                onClick={() => setCardSize(size)}
                                className={`flex-1 py-1.5 rounded-md text-[11px] text-center transition-all cursor-pointer ${
                                  cardSize === size
                                    ? "bg-primary text-white shadow-sm"
                                    : "bg-muted text-slate-500 hover:bg-border"
                                }`}
                                style={{ fontWeight: cardSize === size ? 600 : 500, fontFamily: FONT }}
                              >
                                {size === "large" ? "Large" : size === "medium" ? "Medium" : "Small"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Columns (toggles inline panel) */}
              <Button
                variant="outline" size="sm"
                disabled={viewMode === "grid"}
                className={`h-9 gap-2 px-3 rounded-lg border shadow-sm shrink-0 ${
                  viewMode === "grid"
                    ? "border-border bg-slate-50 text-muted-foreground/60 cursor-not-allowed"
                    : "border-border bg-white hover:!bg-muted/40 hover:!text-foreground"
                }`}
                style={{
                  ...s.uiLabel,
                  ...(columnsPanelOpen && viewMode !== "grid"
                    ? { borderColor: "hsl(var(--primary))", backgroundColor: "hsl(var(--primary-tint))", color: "hsl(var(--primary))" }
                    : {}),
                }}
                title={viewMode === "grid" ? "Column selector is disabled in card view" : undefined}
                onClick={() => { if (viewMode !== "grid") setColumnsPanelOpen((p) => !p); }}
              >
                <Columns3 className={`size-3.5 ${viewMode === "grid" ? "text-muted-foreground/40" : "text-muted-foreground/80"}`} />
                Columns
                <ToolbarBadge count={visibleColumns.length + 1} variant={viewMode === "grid" ? "muted" : "primary"} />
              </Button>
          </div>
        </div>

        {/* ─── TAB PILLS ROW (multi-select) ─── */}
        <div
          className="shrink-0 px-4 py-2 border-b border-border overflow-x-auto"
          style={{ backgroundColor: "hsl(var(--card))", scrollbarWidth: "none" }}
        >
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs hover:bg-muted/60 hover:text-foreground hover:border-muted-foreground/30 active:bg-muted transition-colors cursor-pointer shrink-0"
              style={{
                fontWeight: 500,
                lineHeight: "16px",
                fontFamily: FONT,
                backgroundColor: ownershipFilter === "me" ? "hsl(var(--accent))" : "transparent",
                color: ownershipFilter === "me" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                borderColor: ownershipFilter === "me" ? "hsl(var(--primary))" : "hsl(var(--border))",
              }}
              onClick={onOwnershipToggle}
            >
              <User className="w-3.5 h-3.5" />
              Me mode
              <span
                className="inline-flex items-center justify-center rounded-full"
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  lineHeight: "16px",
                  fontFamily: FONT,
                  height: "18px",
                  padding: "1px 6px",
                  backgroundColor: ownershipFilter === "me" ? "rgba(10, 124, 255, 0.1)" : "hsl(var(--secondary))",
                  color: ownershipFilter === "me" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                }}
              >
                {ownershipCount}
              </span>
            </button>
            {/* Vertical divider — separates the Me-mode pill from the
                status quick-filter pills. Matches Partners' listing
                table recipe (`Partners/.../DataTableStyleReference.tsx:951`):
                `w-px h-5 bg-border shrink-0`. */}
            <div className="w-px h-5 bg-border shrink-0" />
            {tabDefs.map((t) => {
              const isAllTab = t.value === "all";
              // Single-select pill — active when `quickStatus` matches this
              // tab's status. "All" pill is active when quickStatus === "all".
              const active = isAllTab
                ? quickStatus === "all"
                : quickStatus === (t.label as POStatus | "Archived");
              const count = tabCounts[t.value] ?? 0;

              // Click overwrites the previous pill selection (radio behavior).
              // Modal's `filters.status` array is untouched — the two filter
              // mechanisms are independent and both apply via AND.
              const handleClick = () => {
                if (isAllTab) onQuickStatusChange("all");
                else onQuickStatusChange(t.label as POStatus);
              };

              return (
                <button
                  key={t.value}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors cursor-pointer shrink-0"
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    lineHeight: "16px",
                    fontFamily: FONT,
                    ...(active
                      ? {
                          backgroundColor: "hsl(var(--accent))",
                          color: "hsl(var(--primary))",
                          border: "1px solid hsl(var(--primary))",
                        }
                      : {
                          backgroundColor: "transparent",
                          color: "hsl(var(--muted-foreground))",
                          border: "1px solid hsl(var(--border))",
                        }
                    ),
                  }}
                  onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "hsl(var(--muted))"; e.currentTarget.style.color = "hsl(var(--foreground))"; } }}
                  onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "hsl(var(--muted-foreground))"; } }}
                  onClick={handleClick}
                >
                  {isAllTab ? "Show All" : t.label}
                  <span
                    className="inline-flex items-center justify-center rounded-full"
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      lineHeight: "16px",
                      fontFamily: FONT,
                      height: "18px",
                      padding: "1px 6px",
                      backgroundColor: active ? "rgba(10, 124, 255, 0.1)" : "hsl(var(--secondary))",
                      color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── TABLE / GRID / EMPTY CONTENT ─── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}>

            {sortedData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-6">
                <div className="flex flex-col items-center gap-5 max-w-xs text-center">
                  <div className="flex items-center justify-center size-16 rounded-full" style={{ backgroundColor: "hsl(var(--secondary))" }}>
                    <FileX2 className="size-7" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }} strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span style={{ ...s.cellId, color: "hsl(var(--foreground))" }}>
                      {emptyState?.title ?? "No purchase orders found"}
                    </span>
                    <span style={{ ...s.uiCaption, color: "hsl(var(--muted-foreground))" }}>
                      {emptyState?.description ?? "We couldn't find any results matching your current search or filters."}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {!emptyState?.hideResetAction && (
                      <Button variant="outline" size="sm" className="h-8" style={s.uiLabel} onClick={onResetFilters}>Clear all filters</Button>
                    )}
                    {!emptyState?.hideCreateAction && (
                      <Button size="sm" className="h-8 gap-1.5" style={s.uiLabel} onClick={onCreateNew}>
                        <Plus className="size-3.5" /> {emptyState?.createLabel ?? "New Purchase Order"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

            ) : viewMode === "grid" ? (
              <div className={`p-4 grid gap-4 ${
                cardSize === "large" ? "grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2" :
                cardSize === "small" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" :
                "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              }`}>
                {pageData.map((item) => <div key={item.id} className="contents">{renderGridCard?.(item, cardSize)}</div>)}
              </div>

            ) : (
              <table className="w-full border-separate border-spacing-0" style={{ fontFamily: FONT, minWidth: pinnedLeftTotal + ACTION_W + 400 }}>
                <thead className="sticky top-0 z-20">
                  <tr style={{ height: "32px" }}>
                    {/* ── Pinned: Me icon spacer ── */}
                    <th className="sticky left-0 z-30" style={{ width: ME_ICON_W, minWidth: ME_ICON_W, maxWidth: ME_ICON_W, padding: `1px 0 1px 8px`, backgroundColor: "rgb(248, 250, 252)", borderBottom: "1px solid hsl(var(--border))" }}>
                    </th>
                    {/* ── Pinned: PO No ── */}
                    <th className="text-left sticky z-30" style={{ ...s.thLabel, left: ME_ICON_W, width: poNoW, minWidth: poNoW, maxWidth: poNoW, padding: `1px 8px 1px 16px`, backgroundColor: "rgb(248, 250, 252)", borderBottom: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}>
                      <div className="flex items-center gap-1.5 cursor-pointer select-none">{pinnedColumnLabel}<ArrowDown className="size-3 opacity-40" /></div>
                    </th>
                    {/* ── Pinned: Partner Location ── */}
                    <th className="text-left sticky z-30" style={{ ...s.thLabel, left: ME_ICON_W + poNoW, width: PARTNER_W, minWidth: PARTNER_W, maxWidth: PARTNER_W, padding: `1px 8px 1px 16px`, backgroundColor: "rgb(248, 250, 252)", borderBottom: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", boxShadow: STICKY_SHADOW_LEFT }}>
                      <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => handleSort("partnerLocation")}>
                        Vendor
                        {sortCol === "partnerLocation"
                          ? sortDir === "asc" ? <ArrowUp className="size-3" style={{ color: "hsl(var(--primary))" }} /> : <ArrowDown className="size-3" style={{ color: "hsl(var(--primary))" }} />
                          : <ArrowDown className="size-3 opacity-40" />}
                      </div>
                    </th>
                    {/* ── Scrollable columns (excl. partnerLocation) ── */}
                    {scrollableColumns.map((col) => (
                      <DraggableHeader
                        key={col.id} col={col}
                        width={columnWidths[col.id] || col.minWidth}
                        sortCol={sortCol} sortDir={sortDir}
                        onSort={handleSort}
                        onHeaderMouseDown={handleHeaderMouseDown}
                        isBeingDragged={draggingColumnKey === col.id}
                        suppressNextClickRef={suppressNextClickRef}
                        onResizeStart={handleResizeStart}
                      />
                    ))}
                    {/* ── Pinned: Actions (right) — suppressed when
                         the caller hides the actions column (e.g. PR
                         listing has no row-level actions). */}
                    {!hideActionsColumn && (
                      <th className="text-center sticky right-0 z-30" style={{ ...s.thLabel, width: ACTION_W, minWidth: ACTION_W, maxWidth: ACTION_W, padding: `1px 8px`, backgroundColor: "rgb(248, 250, 252)", borderBottom: "1px solid hsl(var(--border))", color: "hsl(var(--muted-foreground))", boxShadow: STICKY_SHADOW_RIGHT }}>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((item) => {
                    const isMe = isCurrentUserPO ? isCurrentUserPO(item) : item.owner === "me";
                    const baseBg = "hsl(var(--card))";
                    const cp: React.CSSProperties = { padding: `${vPad} 8px ${vPad} 16px`, borderBottom: "1px solid hsl(var(--border))", fontSize: "14px" };
                    return (
                      <tr
                        key={item.id}
                        className={`group cursor-pointer transition-colors bg-card ${
                          rowHoverAccent
                            ? "hover:bg-[#E6F0FF] hover:shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                            : "hover:bg-[#F0F7FF]"
                        }`}
                        onClick={() => onNavigate(item.id)}
                      >
                        {/* ── Pinned: Me icon ── */}
                        <td className="sticky left-0 z-10" style={{ ...cp, width: ME_ICON_W, minWidth: ME_ICON_W, maxWidth: ME_ICON_W, padding: `${vPad} 0 ${vPad} 8px`, backgroundColor: "inherit" }}>
                          <div className="flex items-center justify-center" title={isMe ? "Created by you" : undefined}>
                            {isMe ? (
                              <User className="size-3.5" style={{ color: "hsl(var(--primary))" }} />
                            ) : (
                              <span className="size-3.5" />
                            )}
                          </div>
                        </td>
                        {/* ── Pinned: PO No ── */}
                        <td className="sticky z-10" style={{ ...cp, left: ME_ICON_W, width: poNoW, minWidth: poNoW, maxWidth: poNoW, backgroundColor: "inherit" }}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate block" style={{ ...s.cellId, color: "hsl(var(--foreground))" }}>{highlightText(item.poNumber, searchTerm)}</span>
                            {/* Version chip — hidden on surfaces that
                                don't version records (e.g. PR listing).
                                Clickable now (2026-07-10) — mirrors SO's
                                `QuoteNumberCell.tsx:22-46` clickable badge.
                                Navigates to the PO detail page with the
                                versions tab pre-selected via `?tab=versions`
                                so buyers can review the history in one
                                click. `stopPropagation` on the row-level
                                click handler so the chip doesn't also
                                fire the normal row-open path. */}
                            {!hideVersion && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate?.(item.id, { versionHistory: true });
                                }}
                                title={`View version ${item.version} history`}
                                aria-label={`View version ${item.version} history`}
                                className="inline-flex items-center justify-center rounded-[4px] px-1.5 shrink-0 cursor-pointer transition-colors hover:brightness-95"
                                style={{
                                  fontSize: "10px",
                                  lineHeight: "14px",
                                  fontWeight: "var(--font-weight-semibold)",
                                  fontFamily: FONT,
                                  backgroundColor: "hsl(var(--secondary))",
                                  color: "hsl(var(--muted-foreground))",
                                  border: "1px solid hsl(var(--border))",
                                }}
                              >
                                V{item.version}
                              </button>
                            )}
                            {/* Outdated-configs chip removed from the
                                listing per SO-V5 sync — outdated state
                                surfaces on the detail page banner only.
                                Deep-link via `?outdated=1` still works
                                so callers who route through the modal
                                (e.g. notifications) auto-open it. */}
                          </div>
                        </td>
                        {/* ── Pinned: Partner Location ── */}
                        <td className="sticky z-10" style={{ ...cp, left: ME_ICON_W + poNoW, width: PARTNER_W, minWidth: PARTNER_W, maxWidth: PARTNER_W, backgroundColor: "inherit", boxShadow: STICKY_SHADOW_LEFT }}>
                          {partnerCol && renderCell(partnerCol, item, viewMode)}
                        </td>
                        {/* ── Scrollable columns ── */}
                        {scrollableColumns.map((col) => {
                          const isDraggedCol = draggingColumnKey === col.id;
                          return (
                            <td
                              key={col.id}
                              style={{
                                ...cp,
                                width: columnWidths[col.id] || col.minWidth,
                                ...(isDraggedCol ? { backgroundColor: "rgba(10,119,255,0.035)" } : {}),
                              }}
                            >
                              {renderCell(col, item, viewMode)}
                            </td>
                          );
                        })}
                        {/* ── Pinned: Actions (right) — suppressed
                             per `hideActionsColumn`. */}
                        {!hideActionsColumn && (
                          <td className="text-center sticky right-0 z-10" style={{ ...cp, width: ACTION_W, minWidth: ACTION_W, maxWidth: ACTION_W, backgroundColor: "inherit", boxShadow: STICKY_SHADOW_RIGHT }} onClick={(e) => e.stopPropagation()}>
                            <RowActionsMenu item={item} onAction={onRowAction} />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── PAGINATION ─── */}
          <div className="shrink-0 px-4 py-3 border-t border-border flex items-center justify-center" style={{ backgroundColor: "hsl(var(--card))" }}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span style={{ ...s.uiCaption, color: "hsl(var(--muted-foreground))" }}>Records per page</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="h-6 rounded-[var(--radius-sm)] border border-border px-1.5 outline-none cursor-pointer"
                  style={{ ...s.uiCaption, color: "hsl(var(--foreground))", backgroundColor: "hsl(var(--input-background))", fontFamily: FONT }}
                >
                  {ITEMS_PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-0.5">
                <button className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: "hsl(var(--muted-foreground))" }} disabled={currentPage <= 1} onClick={() => setCurrentPage(1)} aria-label="First" onMouseEnter={(e) => { if (currentPage > 1) e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <ChevronsLeft className="size-3.5" />
                </button>
                <button className="px-2 py-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1" style={{ ...s.uiCaption, color: "hsl(var(--muted-foreground))" }} disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} onMouseEnter={(e) => { if (currentPage > 1) e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <ChevronLeft className="size-3" /> Prev
                </button>
                {(() => {
                  const pages: (number | "…")[] = [];
                  if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
                  else {
                    pages.push(1);
                    if (currentPage > 3) pages.push("…");
                    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
                    if (currentPage < totalPages - 2) pages.push("…");
                    pages.push(totalPages);
                  }
                  return pages.map((p, idx) =>
                    p === "…" ? (
                      <span key={`e${idx}`} className="flex items-center justify-center size-7" style={{ ...s.uiCaption, color: "hsl(var(--muted-foreground))" }}>…</span>
                    ) : (
                      <button key={p} className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] transition-colors cursor-pointer" style={{ ...s.uiCaption, fontWeight: p === currentPage ? "var(--font-weight-semibold)" : "var(--font-weight-normal)", backgroundColor: p === currentPage ? "hsl(var(--primary))" : "transparent", color: p === currentPage ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))", fontFamily: FONT }}
                        onMouseEnter={(e) => { if (p !== currentPage) e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; }}
                        onMouseLeave={(e) => { if (p !== currentPage) e.currentTarget.style.backgroundColor = "transparent"; }}
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}
                <button className="px-2 py-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1" style={{ ...s.uiCaption, color: "hsl(var(--muted-foreground))" }} disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} onMouseEnter={(e) => { if (currentPage < totalPages) e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                  Next <ChevronRight className="size-3" />
                </button>
                <button className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: "hsl(var(--muted-foreground))" }} disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} aria-label="Last" onMouseEnter={(e) => { if (currentPage < totalPages) e.currentTarget.style.backgroundColor = "hsl(var(--secondary))"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <ChevronsRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ RIGHT: Column Selector drawer (Partners port) ══════════ */}
      <ColumnSelector
        columns={columns.map((c) => ({ key: c.id, label: c.label }))}
        columnOrder={columnOrder}
        columnVisibility={(() => {
          const map: Record<string, boolean> = {};
          columns.forEach((c) => { map[c.id] = !hiddenColumnIds.includes(c.id); });
          map["partnerLocation"] = true;
          return map;
        })()}
        onColumnOrderChange={(newOrder) => onColumnOrderChange(newOrder as ColumnId[])}
        onColumnVisibilityChange={(newVis) => {
          const hidden = Object.keys(newVis).filter((k) => !newVis[k] && k !== "partnerLocation");
          onHiddenColumnsChange(hidden as ColumnId[]);
        }}
        lockedColumns={["partnerLocation"]}
        open={columnsPanelOpen}
        onOpenChange={setColumnsPanelOpen}
      />

      {/* Column drag ghost — Partners pattern: portal-mounted, positioned via DOM transform */}
      {createPortal(
        <div
          ref={ghostElRef}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 9999,
            pointerEvents: "none",
            opacity: draggingColumnKey ? 1 : 0,
            transition: "opacity 80ms ease-out",
            willChange: "transform",
          }}
        >
          {draggingColumnKey && (() => {
            const def = columns.find((c) => c.id === draggingColumnKey);
            const ghostSort = sortCol === draggingColumnKey ? sortDir : null;
            return (
              <div
                className="flex items-center gap-1.5 h-[32px] pl-2 pr-3 rounded-md whitespace-nowrap"
                style={{
                  marginLeft: 12,
                  marginTop: -14,
                  backgroundColor: "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid rgba(10,119,255,0.3)",
                  boxShadow: "0 1px 3px rgba(10,119,255,0.08), 0 6px 20px rgba(0,0,0,0.10)",
                }}
              >
                <GripVertical className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                <span className="text-[13px]" style={{ color: "hsl(var(--primary))", fontWeight: 500, fontFamily: FONT }}>
                  {def?.label}
                </span>
                {ghostSort === "asc" && <ArrowUp className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
                {ghostSort === "desc" && <ArrowDown className="w-3 h-3 shrink-0" style={{ color: "hsl(var(--primary))" }} />}
              </div>
            );
          })()}
        </div>,
        document.body
      )}

      {/* ══════════ FILTERS MODAL ══════════ */}
      <POFiltersModal
        open={filterPanelOpen}
        onOpenChange={(open) => { if (!open) onFilterPanelToggle(); }}
        filters={filters}
        onFiltersChange={onFiltersChange}
        partnerLocations={filterOptions.partners}
        contacts={filterOptions.contacts}
        creators={filterOptions.creators}
        locations={filterOptions.locs}
        quoteValues={filterOptions.quotes}
        filteredCount={filteredData.length}
        hidePointOfContact={hideFilterPointOfContact}
        hideLocation={hideFilterLocation}
        hideStatus={hideFilterStatus}
        itemOptions={filterItemOptions}
        itemSelected={filterItemSelected}
        onItemToggle={onFilterItemToggle}
        labels={filterLabels}
      />
    </div>
  );
}