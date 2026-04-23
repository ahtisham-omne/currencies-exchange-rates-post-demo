import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDrag, useDrop } from "react-dnd";
import {
  Search, X, Columns3, Plus, ArrowDown, ArrowUp, FileX2,
  MoreHorizontal, SlidersHorizontal, ChevronDown,
  Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  GripVertical, AlignJustify, Eye, EyeOff, RotateCcw, Lock,
  Send, CheckCircle2, PackageCheck, Package, Copy,
  Printer, Download, Archive, Trash2, User,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { FONT, typography as sharedStyles } from "./designTokens";
import { type POFilterState } from "./POFilterBar";
import POFiltersModal, { countAllFilters } from "./POFiltersModal";

/* ═══════════════════════════════════════════════════════════════
   PO DATA TABLE
   Self-contained data table with inline columns side-panel.
   The columns panel pushes/squeezes the table (not an overlay).
   ═══════════════════════════════════════════════════════════════ */

/* ── Types ───────────────��────────────────────────────── */

type ViewMode = "compact" | "comfort" | "grid";
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
  | "archive" | "delete-draft";

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
  onNavigate: (id: string) => void;
  onCreateNew: () => void;
  onResetFilters: () => void;
  renderCell: (col: ColumnDef, item: PurchaseOrder, viewMode?: "compact" | "comfort" | "grid") => React.ReactNode;
  highlightText: (text: string, query: string) => React.ReactNode;
  activeInsightCount: number;
  onInsightsDrawerOpen: () => void;
  renderGridCard?: (item: PurchaseOrder) => React.ReactNode;
  filters: POFilterState;
  onFiltersChange: (f: POFilterState) => void;
  filterPanelOpen: boolean;
  onFilterPanelToggle: () => void;
  /** Optional: the pinned column label (defaults to "PO No") */
  pinnedColumnLabel?: string;
  /** Row action handler */
  onRowAction?: (action: PORowAction, item: PurchaseOrder) => void;
}

/* ── Constants ────────────────────────────────────────────── */

const ITEMS_PER_PAGE_OPTIONS = [20, 50, 100] as const;
const COL_DND_TYPE = "PO_HEADER_COL";
const DRAWER_COL_DND = "DRAWER_COL";
const PANEL_WIDTH = 280;

/* ── Pinned column widths (px) ── */
const ME_ICON_W = 28;
const PO_NO_W = 120;
const PARTNER_W = 210;
const ACTION_W = 56;
const PINNED_LEFT_TOTAL = ME_ICON_W + PO_NO_W + PARTNER_W;
const STICKY_SHADOW_LEFT = "2px 0 6px -2px color-mix(in srgb, var(--foreground) 6%, transparent)";
const STICKY_SHADOW_RIGHT = "-2px 0 6px -2px color-mix(in srgb, var(--foreground) 6%, transparent)";

/* ── Typography — CSS-var bound, Inter only ────────────── */

const s = {
  ...sharedStyles,
  thLabel: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
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
   DRAGGABLE TABLE HEADER
   ═══════════════════════════════════════════════════════════ */

interface DraggableHeaderProps {
  col: ColumnDef;
  index: number;
  width: number;
  sortCol: ColumnId | null;
  sortDir: SortDir;
  onSort: (id: ColumnId) => void;
  moveColumn: (from: number, to: number) => void;
  onResizeStart: (e: React.MouseEvent, colId: ColumnId) => void;
  vPad: string;
}

function DraggableHeader({
  col, index, width, sortCol, sortDir, onSort, moveColumn, onResizeStart, vPad,
}: DraggableHeaderProps) {
  const ref = useRef<HTMLTableCellElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: COL_DND_TYPE,
    item: () => ({ index, id: col.id, label: col.label }),
    collect: (m) => ({ isDragging: m.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: COL_DND_TYPE,
    hover(item: { index: number }) {
      if (item.index !== index) { moveColumn(item.index, index); item.index = index; }
    },
    collect: (m) => ({ isOver: m.isOver() }),
  });

  drag(drop(ref));
  const isSorted = sortCol === col.id;

  return (
    <th
      ref={ref}
      className={`${col.align === "right" ? "text-right" : "text-left"} relative select-none group/th ${isDragging ? "opacity-30" : ""}`}
      style={{
        ...s.thLabel, width, minWidth: col.minWidth,
        padding: `${vPad} 12px`,
        backgroundColor: isOver ? "var(--primary-tint)" : "var(--secondary)",
        borderBottom: "1px solid var(--border)", cursor: "grab",
        color: "var(--muted-foreground)",
      }}
    >
      <div
        className={`flex items-center gap-1.5 ${col.sortable ? "cursor-pointer" : ""} select-none ${col.align === "right" ? "justify-end" : ""}`}
        onClick={() => col.sortable && onSort(col.id)}
      >
        {col.label}
        {col.sortable && (
          isSorted
            ? sortDir === "asc"
              ? <ArrowUp className="size-3" style={{ color: "var(--primary)" }} />
              : <ArrowDown className="size-3" style={{ color: "var(--primary)" }} />
            : <ArrowDown className="size-3 opacity-0 group-hover/th:opacity-40 transition-opacity" />
        )}
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-[4px] cursor-col-resize opacity-0 group-hover/th:opacity-100 hover:!opacity-100 transition-opacity z-10"
        style={{ backgroundColor: "var(--border)" }}
        onMouseDown={(e) => onResizeStart(e, col.id)}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );
}

/* ════════════════════════════════════��══════════════════════
   GHOST PORTAL (for table column drag)
   ══════════════════════════════════════════════════════════ */

function GhostPortal({ label, pos }: { label: string; pos: { x: number; y: number } }) {
  return createPortal(
    <div
      className="fixed pointer-events-none z-[9999] flex items-center gap-1.5 px-3 py-1.5"
      style={{
        left: pos.x + 12, top: pos.y - 14,
        backgroundColor: "var(--card)", boxShadow: "var(--elevation-drag)",
        borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
        ...({ fontSize: "11px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px", fontFamily: FONT, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--primary)" } as React.CSSProperties),
      }}
    >
      <GripVertical className="size-3" style={{ color: "var(--primary)", opacity: 0.5 }} />
      {label}
    </div>,
    document.body
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
            border: "1.5px dashed var(--primary)",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--primary-tint)",
            margin: "0 0 -1px 0",
          }}
        >
          <span style={{ ...s.uiCaption, color: "var(--primary)", fontSize: "11px", fontFamily: FONT }}>Drop here</span>
        </div>
      )}
      <div
        ref={preview}
        className={`group flex items-center transition-colors ${isDragging ? "opacity-30" : ""}`}
        style={{
          /* Match table cell padding exactly */
          padding: `${vPad} 12px`,
          borderBottom: "1px solid var(--border)",
          backgroundColor: isDragging ? "var(--primary-tint)" : "var(--card)",
          boxShadow: isDragging ? "var(--elevation-sm)" : "none",
        }}
        onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isDragging ? "var(--primary-tint)" : "var(--card)"; }}
      >
        {/* Drag handle — visible on hover, same size as table icons */}
        <div ref={ref} className="cursor-grab opacity-0 group-hover:opacity-50 transition-opacity shrink-0 mr-2.5" style={{ marginLeft: "-2px" }}>
          <GripVertical className="size-3.5" style={{ color: "var(--muted-foreground)" }} />
        </div>
        {/* Eye toggle — small rounded badge, sized to match text row */}
        <button
          className="shrink-0 cursor-pointer inline-flex items-center justify-center rounded-[var(--radius-sm)] transition-colors mr-2.5"
          style={{
            width: 24,
            height: 24,
            backgroundColor: isHidden ? "var(--secondary)" : "var(--primary-tint)",
          }}
          onClick={onToggle}
          aria-label={isHidden ? "Show column" : "Hide column"}
        >
          {isHidden
            ? <EyeOff className="size-3.5" style={{ color: "var(--muted-foreground)", opacity: 0.45 }} />
            : <Eye className="size-3.5" style={{ color: "var(--primary)" }} />
          }
        </button>
        {/* Column name — same font as table cell text */}
        <span
          className={`flex-1 truncate ${isHidden ? "line-through" : ""}`}
          style={{
            ...s.cellText,
            color: isHidden ? "var(--muted-foreground)" : "var(--foreground)",
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
      style={{ width: PANEL_WIDTH, minWidth: PANEL_WIDTH, backgroundColor: "var(--card)", fontFamily: FONT }}
    >
      {/* ── Header — matches toolbar bar (px-3 py-2.5, same bg) ── */}
      <div
        className="shrink-0 px-3 py-2.5 border-b border-border flex items-center justify-between"
        style={{ backgroundColor: "var(--card)" }}
      >
        <div className="flex items-center gap-2">
          {/* Small blue icon badge — table-scale, not oversized */}
          <div
            className="flex items-center justify-center rounded-[var(--radius-sm)] shrink-0"
            style={{ width: 26, height: 26, backgroundColor: "var(--primary-tint)" }}
          >
            <Columns3 className="size-3.5" style={{ color: "var(--primary)" }} />
          </div>
          <span style={{
            fontSize: "var(--text-base)",
            fontWeight: "var(--font-weight-semibold)" as string,
            lineHeight: "20px",
            fontFamily: FONT,
            color: "var(--foreground)",
          }}>
            Columns
          </span>
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-[4px] px-1"
            style={{
              fontSize: "10px",
              fontWeight: "var(--font-weight-semibold)" as string,
              fontFamily: FONT,
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            {visibleCount}/{totalCount}
          </span>
        </div>
        <button
          className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] cursor-pointer transition-colors"
          style={{ color: "var(--muted-foreground)" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          onClick={onClose}
          aria-label="Close columns panel"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* ── Search + actions — matches toolbar search (h-8, same tokens) ── */}
      <div className="shrink-0 px-3 py-2.5 border-b border-border" style={{ backgroundColor: "var(--card)" }}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "var(--muted-foreground)" }} />
          <input
            type="search"
            placeholder="Search columns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-[var(--radius-sm)] border border-border pl-8 pr-8 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
            style={{ ...s.uiCaption, backgroundColor: "var(--input-background)", color: "var(--foreground)" }}
          />
          {searchQuery && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
              style={{ color: "var(--muted-foreground)" }}
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
            style={{ ...s.uiLabel, color: "var(--primary)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-tint)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            onClick={showAll}
          >
            <Eye className="size-3" />
            Show All
          </button>
          <button
            className="cursor-pointer flex items-center gap-1 h-7 px-2 rounded-[var(--radius-sm)] transition-colors"
            style={{ ...s.uiLabel, color: "var(--foreground)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            onClick={hideAll}
          >
            <EyeOff className="size-3" />
            Hide All
          </button>
          <button
            className="cursor-pointer flex items-center gap-1 h-7 px-2 rounded-[var(--radius-sm)] ml-auto transition-colors"
            style={{ ...s.uiLabel, color: "var(--muted-foreground)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
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
        <div style={{ padding: "6px 12px", backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
          <span style={{ ...s.thLabel, color: "var(--muted-foreground)" }}>PINNED</span>
        </div>
        {/* Pinned row — same padding as table cells */}
        <div
          className="flex items-center"
          style={{ padding: `${vPad} 12px`, borderBottom: "1px solid var(--border)", backgroundColor: "var(--card)" }}
        >
          <Lock className="size-3.5 shrink-0 mr-2.5" style={{ color: "var(--muted-foreground)", opacity: 0.35 }} />
          <span className="flex-1 truncate" style={{ ...s.cellText, color: "var(--foreground)" }}>
            {pinnedLabel}
          </span>
          <Eye className="size-3.5 shrink-0 ml-2" style={{ color: "var(--muted-foreground)", opacity: 0.25 }} />
        </div>
      </div>

      {/* ── COLUMNS — section label matches table header exactly ── */}
      <div
        className="shrink-0"
        style={{ padding: "6px 12px", backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}
      >
        <span style={{ ...s.thLabel, color: "var(--muted-foreground)" }}>COLUMNS</span>
      </div>

      {/* ── Scrollable column rows — each row matches table cell rhythm ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}
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

function getActionsForStatus(status: string): ActionItem[][] {
  const view: ActionItem = { action: "view", label: "View Details", icon: <Eye className="size-4" /> };
  const send: ActionItem = { action: "send-to-vendor", label: "Send to Vendor", icon: <Send className="size-4" />, stateTransition: true };
  const confirm: ActionItem = { action: "mark-confirmed", label: "Mark as Confirmed", icon: <CheckCircle2 className="size-4" />, stateTransition: true };
  const partial: ActionItem = { action: "mark-partially-received", label: "Mark as Partially Received", icon: <Package className="size-4" />, stateTransition: true };
  const full: ActionItem = { action: "mark-fully-received", label: "Mark as Fully Received", icon: <PackageCheck className="size-4" />, stateTransition: true };
  const dup: ActionItem = { action: "duplicate", label: "Duplicate PO", icon: <Copy className="size-4" /> };
  const print: ActionItem = { action: "print", label: "Print PO", icon: <Printer className="size-4" /> };
  const pdf: ActionItem = { action: "download-pdf", label: "Download PDF", icon: <Download className="size-4" /> };
  const archive: ActionItem = { action: "archive", label: "Archive PO", icon: <Archive className="size-4" />, destructive: true };
  const del: ActionItem = { action: "delete-draft", label: "Delete Draft", icon: <Trash2 className="size-4" />, destructive: true };

  switch (status) {
    case "Draft":
      return [[view], [dup, print, pdf], [del]];
    case "Sent":
      return [[view], [confirm], [dup, print, pdf]];
    case "Confirmed":
      return [[view], [dup, print, pdf]];
    case "Partially Received":
      return [[view], [dup, print, pdf]];
    case "Fully Received":
      return [[view], [dup, print, pdf], [archive]];
    case "Cancelled":
      return [[view], [dup, print, pdf], [archive]];
    case "Active with Cancellation":
      return [[view], [dup, print, pdf]];
    case "Closed with Cancellations":
      return [[view], [dup, print, pdf], [archive]];
    default:
      return [[view], [dup, print, pdf]];
  }
}

function RowActionsMenu({ item, onAction }: { item: PurchaseOrder; onAction?: (action: PORowAction, item: PurchaseOrder) => void }) {
  const sections = getActionsForStatus(item.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center justify-center size-7 rounded-[var(--radius-sm)] transition-colors cursor-pointer border border-transparent hover:border-border hover:bg-secondary"
          style={{ color: "var(--muted-foreground)" }}
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
  renderGridCard, filters, onFiltersChange, filterPanelOpen, onFilterPanelToggle,
  pinnedColumnLabel = "PO No", allData, onRowAction,
}: PODataTableProps) {

  /* ── State ── */
  const [viewMode, setViewMode] = useState<ViewMode>("compact");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
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

  const [ghostLabel, setGhostLabel] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });

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

  /* ── Column reorder (table header) ── */
  const moveColumn = useCallback((from: number, to: number) => {
    const visible = columnOrder.filter((id) => !hiddenColumnIds.includes(id) && id !== "partnerLocation");
    const fromId = visible[from], toId = visible[to];
    if (!fromId || !toId) return;
    const o = [...columnOrder]; const fi = o.indexOf(fromId); const ti = o.indexOf(toId);
    const [r] = o.splice(fi, 1); o.splice(ti, 0, r);
    onColumnOrderChange(o);
  }, [columnOrder, hiddenColumnIds, onColumnOrderChange]);

  /* ── Sort ── */
  const handleSort = useCallback((id: ColumnId) => {
    if (sortCol === id) { if (sortDir === "asc") setSortDir("desc"); else { setSortCol(null); setSortDir(null); } }
    else { setSortCol(id); setSortDir("asc"); }
  }, [sortCol, sortDir]);

  /* ── Selection (removed — no checkboxes) ── */

  /* ── Ghost ── */
  useEffect(() => {
    if (!ghostLabel) return;
    const m = (e: MouseEvent) => setGhostPos({ x: e.clientX, y: e.clientY });
    document.addEventListener("mousemove", m);
    return () => document.removeEventListener("mousemove", m);
  }, [ghostLabel]);

  /* ── Computed ── */
  const densityLabel = viewMode === "compact" ? "Condensed" : viewMode === "comfort" ? "Relaxed" : "Card View";
  const vPad = viewMode === "comfort" ? "12px" : "8px";
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
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-[4px] px-1"
      style={{
        fontSize: "10px", fontWeight: "var(--font-weight-semibold)", fontFamily: FONT,
        backgroundColor: variant === "primary" ? "var(--primary)" : "var(--secondary)",
        color: variant === "primary" ? "var(--primary-foreground)" : "var(--muted-foreground)",
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
      style={{ backgroundColor: "var(--card)" }}
    >
      {/* ══════════ LEFT: Table area (shrinks when panel open) ══════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ─── TOOLBAR ─── */}
        <div className="shrink-0 px-4 py-2.5 border-b border-border" style={{ backgroundColor: "var(--card)" }}>
          <div className="flex items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[140px] flex-1 xl:max-w-[360px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "var(--muted-foreground)" }} />
              <input
                type="search"
                placeholder="Search by PO, partner, item..."
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                maxLength={75}
                className="h-8 w-full rounded-[var(--radius-sm)] border border-border pl-8 pr-8 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-ring/20"
                style={{ ...s.uiCaption, backgroundColor: "var(--input-background)", color: "var(--foreground)" }}
              />
              {searchTerm && (
                <button className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: "var(--muted-foreground)" }} onClick={() => onSearchTermChange("")} aria-label="Clear">
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Filters */}
            <Button
              variant="outline" size="sm"
              className="h-8 gap-1.5 px-3 shrink-0"
              style={{
                ...s.uiLabel,
                ...(filterPanelOpen || activeFilterCount > 0
                  ? { borderColor: "var(--primary)", backgroundColor: "var(--primary-tint)", color: "var(--primary)" }
                  : {}),
              }}
              onClick={onFilterPanelToggle}
            >
              <SlidersHorizontal className="size-3.5" />
              Filters
              {activeFilterCount > 0 && <ToolbarBadge count={activeFilterCount} />}
            </Button>

            {/* Count */}
            {sortedData.length > 0 ? (
              <div className="flex items-center gap-2 shrink-0">
                <span style={{ ...s.uiCaption, color: "var(--muted-foreground)" }}>{sortedData.length} records</span>
              </div>
            ) : (
              <span className="shrink-0 whitespace-nowrap" style={{ ...s.uiCaption, color: "var(--muted-foreground)" }}>
                {filteredData.length} orders
              </span>
            )}

            {/* Spacer — pushes right-side controls apart on xl+ */}
            <div className="hidden xl:block xl:flex-1" />

            <Separator orientation="vertical" className="!h-4 shrink-0" />

            {/* Density */}
            <div className="relative shrink-0" ref={densityRef}>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3 shrink-0" style={s.uiLabel} onClick={() => setDensityOpen((p) => !p)}>
                  <AlignJustify className="size-3.5" />
                  {densityLabel}
                  <ChevronDown className="size-3 opacity-50" />
                </Button>
                {densityOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 w-[200px] py-1"
                    style={{ backgroundColor: "var(--card)", boxShadow: "var(--elevation-sm)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}
                  >
                    {([
                      { mode: "compact" as ViewMode, label: "Condensed", desc: "Compact rows" },
                      { mode: "comfort" as ViewMode, label: "Relaxed", desc: "Spacious rows" },
                      { mode: "grid" as ViewMode, label: "Card View", desc: "Grid layout" },
                    ]).map((opt) => (
                      <button
                        key={opt.mode}
                        className="flex items-center justify-between w-full px-3 py-2 cursor-pointer transition-colors"
                        style={{ backgroundColor: viewMode === opt.mode ? "var(--secondary)" : "transparent" }}
                        onMouseEnter={(e) => { if (viewMode !== opt.mode) e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
                        onMouseLeave={(e) => { if (viewMode !== opt.mode) e.currentTarget.style.backgroundColor = "transparent"; }}
                        onClick={() => { setViewMode(opt.mode); setDensityOpen(false); }}
                      >
                        <div className="flex flex-col items-start">
                          <span style={{ ...s.uiLabel, color: "var(--foreground)" }}>{opt.label}</span>
                          <span style={{ ...s.uiCaption, fontSize: "11px", color: "var(--muted-foreground)" }}>{opt.desc}</span>
                        </div>
                        {viewMode === opt.mode && <Check className="size-3.5 shrink-0" style={{ color: "var(--primary)" }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Separator orientation="vertical" className="!h-4 shrink-0" />

              {/* Columns (toggles inline panel) */}
              <Button
                variant="outline" size="sm"
                className="h-8 gap-1.5 px-3 shrink-0"
                style={{
                  ...s.uiLabel,
                  ...(columnsPanelOpen
                    ? { borderColor: "var(--primary)", backgroundColor: "var(--primary-tint)", color: "var(--primary)" }
                    : {}),
                }}
                onClick={() => setColumnsPanelOpen((p) => !p)}
              >
                <Columns3 className="size-3.5" />
                Columns
                <ToolbarBadge count={visibleColumns.length + 1} variant={columnsPanelOpen ? "primary" : "primary"} />
              </Button>
          </div>
        </div>

        {/* ─── TAB PILLS ROW (multi-select) ─── */}
        <div
          className="shrink-0 px-4 py-2 border-b border-border overflow-x-auto"
          style={{ backgroundColor: "var(--card)", scrollbarWidth: "none" }}
        >
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 h-7 px-2.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer shrink-0"
              style={{
                ...s.uiLabel,
                backgroundColor: ownershipFilter === "me" ? "var(--primary-tint)" : "transparent",
                color: ownershipFilter === "me" ? "var(--primary)" : "var(--muted-foreground)",
                border: "1px solid",
                borderColor: ownershipFilter === "me" ? "var(--primary)" : "var(--border)",
              }}
              onClick={onOwnershipToggle}
            >
              Me
              <span style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", fontFamily: FONT }}>{ownershipCount}</span>
            </button>
            {tabDefs.map((t) => {
              const isAllTab = t.value === "all";
              const active = isAllTab
                ? filters.status.length === 0
                : filters.status.includes(t.label as typeof filters.status[number]);
              const count = tabCounts[t.value] ?? 0;

              const handleClick = () => {
                if (isAllTab) {
                  onFiltersChange({ ...filters, status: [] });
                } else {
                  const statusValue = t.label;
                  const current = filters.status;
                  const next = current.includes(statusValue as POStatus)
                    ? current.filter((sv) => sv !== statusValue)
                    : [...current, statusValue as POStatus];
                  onFiltersChange({ ...filters, status: next as typeof filters.status });
                }
              };

              return (
                <button
                  key={t.value}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-full transition-colors cursor-pointer shrink-0"
                  style={{
                    ...s.uiLabel,
                    ...(active
                      ? {
                          backgroundColor: "#eff6ff",
                          color: "#1d4ed8",
                          border: "1px solid #2563eb",
                        }
                      : {
                          backgroundColor: "var(--card)",
                          color: "var(--muted-foreground)",
                          border: "1px solid var(--border)",
                        }
                    ),
                  }}
                  onMouseEnter={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "#f9fafb"; e.currentTarget.style.borderColor = "#d1d5db"; } }}
                  onMouseLeave={(e) => { if (!active) { e.currentTarget.style.backgroundColor = "var(--card)"; e.currentTarget.style.borderColor = "var(--border)"; } }}
                  onClick={handleClick}
                >
                  {isAllTab ? "Show All" : t.label}
                  <span style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", fontFamily: FONT }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── TABLE / GRID / EMPTY CONTENT ─── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}>

            {sortedData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-6">
                <div className="flex flex-col items-center gap-5 max-w-xs text-center">
                  <div className="flex items-center justify-center size-16 rounded-full" style={{ backgroundColor: "var(--secondary)" }}>
                    <FileX2 className="size-7" style={{ color: "var(--muted-foreground)", opacity: 0.4 }} strokeWidth={1.5} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span style={{ ...s.cellId, color: "var(--foreground)" }}>No purchase orders found</span>
                    <span style={{ ...s.uiCaption, color: "var(--muted-foreground)" }}>We couldn't find any results matching your current search or filters.</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Button variant="outline" size="sm" className="h-8" style={s.uiLabel} onClick={onResetFilters}>Clear all filters</Button>
                    <Button size="sm" className="h-8 gap-1.5" style={s.uiLabel} onClick={onCreateNew}><Plus className="size-3.5" /> New Purchase Order</Button>
                  </div>
                </div>
              </div>

            ) : viewMode === "grid" ? (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pageData.map((item) => <div key={item.id} className="contents">{renderGridCard?.(item)}</div>)}
              </div>

            ) : (
              <table className="w-full border-separate border-spacing-0" style={{ fontFamily: FONT, minWidth: PINNED_LEFT_TOTAL + ACTION_W + 400 }}>
                <thead className="sticky top-0 z-20">
                  <tr>
                    {/* ── Pinned: Me icon spacer ── */}
                    <th className="sticky left-0 z-30" style={{ width: ME_ICON_W, minWidth: ME_ICON_W, maxWidth: ME_ICON_W, padding: `${vPad} 0 ${vPad} 8px`, backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                    </th>
                    {/* ── Pinned: PO No ── */}
                    <th className="text-left sticky z-30" style={{ ...s.thLabel, left: ME_ICON_W, width: PO_NO_W, minWidth: PO_NO_W, maxWidth: PO_NO_W, padding: `${vPad} 12px`, backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                      <div className="flex items-center gap-1.5 cursor-pointer select-none">PO No<ArrowDown className="size-3 opacity-40" /></div>
                    </th>
                    {/* ── Pinned: Partner Location ── */}
                    <th className="text-left sticky z-30" style={{ ...s.thLabel, left: ME_ICON_W + PO_NO_W, width: PARTNER_W, minWidth: PARTNER_W, maxWidth: PARTNER_W, padding: `${vPad} 12px`, backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", boxShadow: STICKY_SHADOW_LEFT }}>
                      <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => handleSort("partnerLocation")}>
                        Vendor
                        {sortCol === "partnerLocation"
                          ? sortDir === "asc" ? <ArrowUp className="size-3" style={{ color: "var(--primary)" }} /> : <ArrowDown className="size-3" style={{ color: "var(--primary)" }} />
                          : <ArrowDown className="size-3 opacity-40" />}
                      </div>
                    </th>
                    {/* ── Scrollable columns (excl. partnerLocation) ── */}
                    {scrollableColumns.map((col, idx) => (
                      <DraggableHeader
                        key={col.id} col={col} index={idx}
                        width={columnWidths[col.id] || col.minWidth}
                        sortCol={sortCol} sortDir={sortDir}
                        onSort={handleSort} moveColumn={moveColumn}
                        onResizeStart={handleResizeStart} vPad={vPad}
                      />
                    ))}
                    {/* ── Pinned: Actions (right) ── */}
                    <th className="text-center sticky right-0 z-30" style={{ ...s.thLabel, width: ACTION_W, minWidth: ACTION_W, maxWidth: ACTION_W, padding: `${vPad} 8px`, backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)", boxShadow: STICKY_SHADOW_RIGHT }}>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((item) => {
                    const isMe = isCurrentUserPO ? isCurrentUserPO(item) : item.owner === "me";
                    const baseBg = "var(--card)";
                    const cp: React.CSSProperties = { padding: `${vPad} 12px`, borderBottom: "1px solid var(--border)" };
                    return (
                      <tr
                        key={item.id} className="group cursor-pointer"
                        style={{ backgroundColor: baseBg }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--primary-tint)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = baseBg; }}
                        onClick={() => onNavigate(item.id)}
                      >
                        {/* ── Pinned: Me icon ── */}
                        <td className="sticky left-0 z-10" style={{ ...cp, width: ME_ICON_W, minWidth: ME_ICON_W, maxWidth: ME_ICON_W, padding: `${vPad} 0 ${vPad} 8px`, backgroundColor: "inherit" }}>
                          <div className="flex items-center justify-center" title={isMe ? "Created by you" : undefined}>
                            {isMe ? (
                              <User className="size-3.5" style={{ color: "var(--primary)" }} />
                            ) : (
                              <span className="size-3.5" />
                            )}
                          </div>
                        </td>
                        {/* ── Pinned: PO No ── */}
                        <td className="sticky z-10" style={{ ...cp, left: ME_ICON_W, width: PO_NO_W, minWidth: PO_NO_W, maxWidth: PO_NO_W, backgroundColor: "inherit" }}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate block" style={{ ...s.cellId, color: "var(--foreground)" }}>{highlightText(item.poNumber, searchTerm)}</span>
                            <span
                              className="inline-flex items-center justify-center rounded-[4px] px-1.5 shrink-0"
                              style={{
                                fontSize: "10px",
                                lineHeight: "14px",
                                fontWeight: "var(--font-weight-semibold)",
                                fontFamily: FONT,
                                backgroundColor: "var(--secondary)",
                                color: "var(--muted-foreground)",
                                border: "1px solid var(--border)",
                              }}
                              title={`Version ${item.version}`}
                            >
                              V{item.version}
                            </span>
                          </div>
                        </td>
                        {/* ── Pinned: Partner Location ── */}
                        <td className="sticky z-10" style={{ ...cp, left: ME_ICON_W + PO_NO_W, width: PARTNER_W, minWidth: PARTNER_W, maxWidth: PARTNER_W, backgroundColor: "inherit", boxShadow: STICKY_SHADOW_LEFT }}>
                          {partnerCol && renderCell(partnerCol, item, viewMode)}
                        </td>
                        {/* ── Scrollable columns ── */}
                        {scrollableColumns.map((col) => (
                          <td key={col.id} style={{ ...cp, width: columnWidths[col.id] || col.minWidth }}>{renderCell(col, item, viewMode)}</td>
                        ))}
                        {/* ── Pinned: Actions (right) ── */}
                        <td className="text-center sticky right-0 z-10" style={{ ...cp, width: ACTION_W, minWidth: ACTION_W, maxWidth: ACTION_W, backgroundColor: "inherit", boxShadow: STICKY_SHADOW_RIGHT }} onClick={(e) => e.stopPropagation()}>
                          <RowActionsMenu item={item} onAction={onRowAction} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── PAGINATION ─── */}
          <div className="shrink-0 px-4 py-3 border-t border-border flex items-center justify-center" style={{ backgroundColor: "var(--card)" }}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span style={{ ...s.uiCaption, color: "var(--muted-foreground)" }}>Records per page</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="h-6 rounded-[var(--radius-sm)] border border-border px-1.5 outline-none cursor-pointer"
                  style={{ ...s.uiCaption, color: "var(--foreground)", backgroundColor: "var(--input-background)", fontFamily: FONT }}
                >
                  {ITEMS_PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-0.5">
                <button className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: "var(--muted-foreground)" }} disabled={currentPage <= 1} onClick={() => setCurrentPage(1)} aria-label="First" onMouseEnter={(e) => { if (currentPage > 1) e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <ChevronsLeft className="size-3.5" />
                </button>
                <button className="px-2 py-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1" style={{ ...s.uiCaption, color: "var(--muted-foreground)" }} disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} onMouseEnter={(e) => { if (currentPage > 1) e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
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
                      <span key={`e${idx}`} className="flex items-center justify-center size-7" style={{ ...s.uiCaption, color: "var(--muted-foreground)" }}>…</span>
                    ) : (
                      <button key={p} className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] transition-colors cursor-pointer" style={{ ...s.uiCaption, fontWeight: p === currentPage ? "var(--font-weight-semibold)" : "var(--font-weight-normal)", backgroundColor: p === currentPage ? "var(--primary)" : "transparent", color: p === currentPage ? "var(--primary-foreground)" : "var(--muted-foreground)", fontFamily: FONT }}
                        onMouseEnter={(e) => { if (p !== currentPage) e.currentTarget.style.backgroundColor = "var(--secondary)"; }}
                        onMouseLeave={(e) => { if (p !== currentPage) e.currentTarget.style.backgroundColor = "transparent"; }}
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}
                <button className="px-2 py-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1" style={{ ...s.uiCaption, color: "var(--muted-foreground)" }} disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} onMouseEnter={(e) => { if (currentPage < totalPages) e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                  Next <ChevronRight className="size-3" />
                </button>
                <button className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: "var(--muted-foreground)" }} disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)} aria-label="Last" onMouseEnter={(e) => { if (currentPage < totalPages) e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <ChevronsRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ RIGHT: Inline Columns Panel (pushes table left) ══════════ */}
      <div
        className="shrink-0 overflow-hidden border-l transition-all duration-300 ease-in-out"
        style={{
          width: columnsPanelOpen ? PANEL_WIDTH : 0,
          borderColor: columnsPanelOpen ? "var(--border)" : "transparent",
          opacity: columnsPanelOpen ? 1 : 0,
        }}
      >
        <InlineColumnsPanel
          columns={columns}
          columnOrder={columnOrder}
          hiddenColumnIds={hiddenColumnIds}
          pinnedLabel={pinnedColumnLabel}
          vPad={vPad}
          onColumnOrderChange={onColumnOrderChange}
          onHiddenColumnsChange={onHiddenColumnsChange}
          onClose={() => setColumnsPanelOpen(false)}
        />
      </div>

      {ghostLabel && <GhostPortal label={ghostLabel} pos={ghostPos} />}

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
      />
    </div>
  );
}