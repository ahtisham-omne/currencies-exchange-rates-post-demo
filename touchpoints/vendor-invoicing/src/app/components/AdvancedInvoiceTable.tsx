import React, { useState, useRef, useEffect, useCallback } from 'react';
import { formatUsDate } from '@/app/lib/dueBucket';
import { 
  MoreHorizontal, 
  GripVertical, 
  Eye, 
  Edit3, 
  Download, 
  Ban, 
  DollarSign, 
  GitCompare, 
  FileText, 
  Truck, 
  Calculator, 
  Package, 
  Lock, 
  AlertTriangle, 
  ExternalLink,
  ChevronRight,
  Calendar,
  Wallet,
  CheckCircle2,
  Clock,
  X, Pencil, Banknote } from 'lucide-react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/app/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/app/components/ui/hover-card";
import { Invoice } from '@/app/data/mockInvoices';
import { mockVendors } from '@/app/data/mockVendors';
import {
  getRowActions,
  getQuickActions,
  type InvoiceActionId,
} from '@/app/data/invoiceActions';
import { VendorAvatar } from '@/app/components/VendorAvatar';
import {
  InvoiceColumnHeaderMenu,
  type ColumnFilterState,
  type SortConfig,
  isInvoiceFilterActive,
} from '@/app/components/InvoiceColumnHeaderMenu';
import { palette } from '@/styles/tokens';

const ACTION_ICONS: Partial<Record<InvoiceActionId, React.ComponentType<{ className?: string }>>> = {
  view: Eye,
  export: Download,
  submit: GitCompare,
  edit: Pencil,
  approve: GitCompare,
  reject: Ban,
  addPayment: Banknote,
  paymentHold: Lock,
  cancel: Ban,
  download: Download,
  match: GitCompare,
};

interface ColumnConfig {
  id: string;
  label: string;
  width: number;
  minWidth: number;
  visible: boolean;
  resizable: boolean;
  sortable: boolean;
}

interface AdvancedInvoiceTableProps {
  invoices: Invoice[];
  selectedInvoices: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  /** Bulk set selection state for a range of ids — used by drag-select. */
  onSelectMany?: (ids: string[], selected: boolean) => void;
  onViewInvoice: (id: string) => void;
  onEditInvoice: (id: string, e: React.MouseEvent) => void;
  onDownload: (id: string, e: React.MouseEvent) => void;
  onVoid: (id: string, e: React.MouseEvent) => void;
  onAddPayment: (id: string, e: React.MouseEvent) => void;
  onMatch: (id: string, e: React.MouseEvent) => void;
  /** PRD §1.7 — single dispatcher for status-gated row actions. */
  onRowAction?: (actionId: InvoiceActionId, invoiceId: string, e: React.MouseEvent) => void;
  /** Optional external column order — when set, overrides internal column order at render time. */
  columnOrder?: string[];
  /** Called when the user reorders columns via header drag. Required for the drag to actually
   *  persist when the parent controls `columnOrder`. */
  onColumnOrderChange?: (next: string[]) => void;
  /** Optional external column visibility — when set, overrides internal visibility at render time. */
  columnVisibility?: Record<string, boolean>;
  /** Per-column filter state, keyed by column id. Drives the filter dot on the header. */
  columnFilters?: Record<string, ColumnFilterState>;
  /** Active sort, drives the asc/desc arrow on the header. */
  sortConfig?: SortConfig | null;
  /** Called when the user picks a sort direction in the column-header menu. */
  onSort?: (columnKey: string, direction: 'asc' | 'desc') => void;
  /** Called when the user changes / clears a column filter. */
  onColumnFilterChange?: (columnKey: string, filter: ColumnFilterState) => void;
  /** Called when the user hides a column from the header menu. */
  onHideColumn?: (columnKey: string) => void;
  /** Column ids that cannot be hidden (e.g. invoiceNumber). */
  lockedColumnKeys?: string[];
  /** Full invoice list (for the multiselect filter's unique-values dropdown). */
  allInvoices?: Invoice[];
  densityMode: 'condensed' | 'comfort';
  TypeBadge: React.ComponentType<{ type: Invoice['type'] }>;
  StatusBadge: React.ComponentType<{ status: Invoice['status'] }>;
}

export function AdvancedInvoiceTable({
  invoices,
  selectedInvoices,
  onToggleSelect,
  onToggleSelectAll,
  onSelectMany,
  onViewInvoice,
  onEditInvoice,
  onDownload,
  onVoid,
  onAddPayment,
  onMatch,
  onRowAction,
  columnOrder,
  onColumnOrderChange,
  columnVisibility,
  columnFilters,
  sortConfig,
  onSort,
  onColumnFilterChange,
  onHideColumn,
  lockedColumnKeys,
  allInvoices,
  densityMode,
  TypeBadge,
  StatusBadge
}: AdvancedInvoiceTableProps) {
  // Bridge from the new actionId dispatcher to the legacy callback props so
  // either wiring works. Used by both the dropdown menu and the hover-quick
  // action buttons.
  const dispatchAction = (
    actionId: InvoiceActionId,
    invoiceId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (onRowAction) {
      onRowAction(actionId, invoiceId, e);
      return;
    }
    switch (actionId) {
      case 'view':
        onViewInvoice(invoiceId);
        break;
      case 'edit':
        onEditInvoice(invoiceId, e);
        break;
      case 'addPayment':
        onAddPayment(invoiceId, e);
        break;
      case 'download':
      case 'export':
        onDownload(invoiceId, e);
        break;
      case 'match':
        onMatch(invoiceId, e);
        break;
      case 'cancel':
        onVoid(invoiceId, e);
        break;
      default:
        // submit/approve/reject/paymentHold — no legacy fallback; ignore.
        break;
    }
  };
  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'invoiceNumber', label: 'Invoice ID', width: 200, minWidth: 180, visible: true, resizable: true, sortable: true },
    { id: 'vendor', label: 'Vendor', width: 240, minWidth: 180, visible: true, resizable: true, sortable: true },
    { id: 'vendorInvoiceNumber', label: 'Vendor Invoice No.', width: 180, minWidth: 140, visible: true, resizable: true, sortable: true },
    { id: 'type', label: 'Type', width: 200, minWidth: 160, visible: true, resizable: true, sortable: true },
    { id: 'invoiceDate', label: 'Vendor Invoice Date', width: 180, minWidth: 140, visible: true, resizable: true, sortable: true },
    { id: 'dueDate', label: 'Due Date', width: 160, minWidth: 120, visible: true, resizable: true, sortable: true },
    { id: 'apAccount', label: 'A/P Account', width: 180, minWidth: 140, visible: true, resizable: true, sortable: true },
    { id: 'status', label: 'Status', width: 200, minWidth: 150, visible: true, resizable: true, sortable: true },
    { id: 'amount', label: 'Amount', width: 160, minWidth: 120, visible: true, resizable: true, sortable: true },
    // Linked Records sits after Amount (feedback 7/16/26).
    { id: 'linkedRecords', label: 'Linked Records', width: 280, minWidth: 200, visible: true, resizable: true, sortable: false },
    { id: 'currency', label: 'Currency', width: 120, minWidth: 90, visible: true, resizable: true, sortable: true },
    { id: 'description', label: 'Description', width: 300, minWidth: 200, visible: true, resizable: true, sortable: true },
    { id: 'updatedBy', label: 'Last Updated By', width: 180, minWidth: 140, visible: true, resizable: true, sortable: true },
    { id: 'updatedDate', label: 'Last Updated On', width: 160, minWidth: 120, visible: true, resizable: true, sortable: true },
    { id: 'createdBy', label: 'Created By', width: 180, minWidth: 140, visible: true, resizable: true, sortable: true },
    { id: 'createdDate', label: 'Created On', width: 160, minWidth: 120, visible: true, resizable: true, sortable: true },
  ]);

  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const [draggingColumnKey, setDraggingColumnKey] = useState<string | null>(null);
  const [quickViewRecord, setQuickViewRecord] = useState<{ id: string; type: 'PO' | 'GRN' } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // ─── Column drag state (custom mouse-event tracking, ported from partner
  // module). HTML5 draggable on the <th> swallowed the resize handle's
  // mousedown, which broke resize entirely. Custom drag also gives the
  // smoother edge-trigger swap-on-cursor-exit behaviour partners use.
  const colDragRef = useRef<{
    columnKey: string;
    startX: number;
    startY: number;
    isDragging: boolean;
    lastSwapTime: number;
  } | null>(null);
  const suppressNextClickRef = useRef(false);

  // Drag-select state — click on a row checkbox + drag across adjacent rows
  // to select/deselect a contiguous range. Tracks the anchor id, the
  // intended mode (true = add to selection, false = remove), and the set
  // of ids the cursor has touched while the pointer is down.
  const dragSelectRef = useRef<{
    anchorId: string;
    mode: boolean;
    touched: Set<string>;
  } | null>(null);

  const beginDragSelect = (id: string) => {
    const currentlySelected = selectedInvoices.includes(id);
    const mode = !currentlySelected;
    dragSelectRef.current = { anchorId: id, mode, touched: new Set([id]) };
    // Apply to the anchor immediately so the click feels responsive
    if (onSelectMany) onSelectMany([id], mode);
    else onToggleSelect(id);
  };

  const extendDragSelect = (id: string) => {
    const ctx = dragSelectRef.current;
    if (!ctx || ctx.touched.has(id)) return;
    ctx.touched.add(id);
    if (onSelectMany) onSelectMany([id], ctx.mode);
    else {
      const isCurrentlySelected = selectedInvoices.includes(id);
      if (isCurrentlySelected !== ctx.mode) onToggleSelect(id);
    }
  };

  const endDragSelect = () => {
    dragSelectRef.current = null;
  };

  useEffect(() => {
    const onUp = () => endDragSelect();
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mouseleave', onUp);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mouseleave', onUp);
    };
  }, []);

  // Render type with icon
  const renderTypeWithIcon = (type: Invoice['type']) => {
    const typeConfig: Record<string, { icon: any; label: string; color: string }> = {
      // System type identities (user 10/10): blue inventory, violet
      // pre-invoice, teal standalone.
      'PO-based': { icon: Package, label: 'Inventory Invoice', color: palette.blue[700] },
      'Receiving-based': { icon: Package, label: 'Inventory Invoice', color: palette.blue[700] },
      'GRN-based': { icon: Package, label: 'Inventory Invoice', color: palette.blue[700] },
      'Standalone': { icon: Calculator, label: 'Standalone Invoice', color: palette.teal[700] },
      'Pre-Invoice': { icon: Wallet, label: 'Pre-Invoice', color: palette.violet[700] },
    };

    const config = typeConfig[type] || typeConfig['Standalone'];
    const Icon = config.icon;

    return (
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
        <span className="text-[13px] text-foreground">{config.label}</span>
      </div>
    );
  };

  // Render status badge — partners-style chip
  const renderStatusBadge = (status: Invoice['status']) => {
    const statusConfig: Record<Invoice['status'], { bg: string; text: string; border: string; icon?: any }> = {
      'Draft': { bg: palette.slate[50], text: palette.slate[600], border: palette.slate[200] },
      'Pending Approval': { bg: palette.amber[50], text: palette.amber[700], border: palette.amber[200] },
      'Approved': { bg: palette.emerald[50], text: palette.emerald[700], border: palette.emerald[200] },
      'Partially Paid': { bg: palette.blue[50], text: palette.blue[700], border: palette.blue[200] },
      'Paid in Full': { bg: palette.emerald[50], text: palette.emerald[700], border: palette.emerald[200] },
      'Exception': { bg: palette.orange[50], text: palette.orange[700], border: palette.orange[200], icon: AlertTriangle },
      'Payment Hold': { bg: palette.yellow[50], text: palette.yellow[700], border: palette.yellow[200], icon: Lock },
      'Cancelled': { bg: palette.slate[100], text: palette.slate[600], border: palette.slate[200] },
    };

    const config = statusConfig[status] || statusConfig['Cancelled'];
    const Icon = config.icon;

    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md border"
        style={{
          backgroundColor: config.bg,
          color: config.text,
          borderColor: config.border,
          fontWeight: 500,
        }}
      >
        {Icon && <Icon className="w-3 h-3" />}
        {status}
      </span>
    );
  };

  // Render linked records (POs and Receiving Documents)
  const renderLinkedRecords = (invoice: Invoice) => {
    const linkedPOs = invoice.linkedPOs || [];
    const linkedGRNs = invoice.linkedGRNs || [];
    const allRecords = [
      ...linkedPOs.map(id => ({ id, type: 'PO' as const })),
      ...linkedGRNs.map(id => ({ id, type: 'GRN' as const }))
    ];
    
    if (allRecords.length === 0) {
      return null;
    }

    const first = allRecords[0];
    const others = allRecords.slice(1);

    return (
      <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap overflow-hidden">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setQuickViewRecord(first);
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border transition-colors shrink-0"
          style={{
            backgroundColor: palette.blue[50],
            color: palette.blue[700],
            borderColor: palette.blue[200],
            fontWeight: 500,
          }}
        >
          {first.type === 'PO' ? <FileText className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
          {first.id}
        </button>

        {others.length > 0 && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs border cursor-default shrink-0"
                  style={{
                    backgroundColor: 'hsl(var(--muted))',
                    color: 'hsl(var(--muted-foreground))',
                    borderColor: 'hsl(var(--border))',
                    fontWeight: 600,
                  }}
                >
                  +{others.length} more
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="w-56 p-2 bg-white border border-gray-100 shadow-xl rounded-lg">
                <div className="flex flex-col gap-1">
                  <p className="text-[9px] font-black text-gray-400 mb-1 px-1">Linked Documents</p>
                  {others.map((record, idx) => (
                    <button
                      key={idx}
                      className="flex items-center gap-2 w-full p-1.5 rounded-md hover:bg-gray-50 transition-colors text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickViewRecord(record);
                      }}
                    >
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${record.type === 'PO' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {record.type === 'PO' ? <FileText className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-gray-900 leading-none">{record.id}</span>
                        <span className="text-[9px] text-gray-400 font-medium mt-0.5">{record.type === 'PO' ? 'Purchase Order' : 'Receiving Doc'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };

  // Handle column resize
  const handleResizeStart = (columnId: string, startX: number, e: React.MouseEvent) => {
    e.preventDefault();
    const column = columns.find(c => c.id === columnId);
    if (column) {
      setResizing({ columnId, startX, startWidth: column.width });
    }
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizing) return;
    
    const diff = e.clientX - resizing.startX;
    const newWidth = Math.max(
      columns.find(c => c.id === resizing.columnId)?.minWidth || 100,
      resizing.startWidth + diff
    );

    setColumns(cols =>
      cols.map(col =>
        col.id === resizing.columnId ? { ...col, width: newWidth } : col
      )
    );
  };

  const handleResizeEnd = () => {
    setResizing(null);
  };

  // Custom column-drag handler — ported from partner module's
  // VendorsListPage. Tracks pointer movement directly so the resize handle
  // inside each <th> isn't hijacked by HTML5 native drag.
  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent, columnKey: string) => {
      if ((lockedColumnKeys ?? []).includes(columnKey)) return;
      if (resizing) return;
      if (e.button !== 0) return; // left-click only

      const startX = e.clientX;
      const startY = e.clientY;
      colDragRef.current = {
        columnKey,
        startX,
        startY,
        isDragging: false,
        lastSwapTime: 0,
      };

      const DRAG_THRESHOLD = 5;
      const SWAP_SETTLE_MS = 60;

      // Snapshot the order we'll mutate. If the parent supplies columnOrder,
      // use that; otherwise fall back to the internal column array order.
      let workingOrder = columnOrder && columnOrder.length > 0
        ? [...columnOrder]
        : columns.map((c) => c.id);

      const onMove = (moveEvt: MouseEvent) => {
        if (!colDragRef.current) return;
        const dx = moveEvt.clientX - colDragRef.current.startX;
        const dy = moveEvt.clientY - colDragRef.current.startY;

        if (!colDragRef.current.isDragging) {
          if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
          colDragRef.current.isDragging = true;
          document.body.style.userSelect = 'none';
          document.body.style.cursor = 'grabbing';
          setDraggingColumnKey(colDragRef.current.columnKey);
        }

        const now = performance.now();
        if (now - colDragRef.current.lastSwapTime < SWAP_SETTLE_MS) return;

        const cursorX = moveEvt.clientX;
        const draggedKey = colDragRef.current.columnKey;

        const draggedTh = document.querySelector<HTMLElement>(
          `th[data-col-drag-key="${draggedKey}"]`
        );
        if (!draggedTh) return;
        const draggedRect = draggedTh.getBoundingClientRect();

        if (cursorX >= draggedRect.left && cursorX <= draggedRect.right) return;

        const allThs = document.querySelectorAll<HTMLElement>('th[data-col-drag-key]');
        for (const th of allThs) {
          const rect = th.getBoundingClientRect();
          if (cursorX < rect.left || cursorX > rect.right) continue;
          const k = th.getAttribute('data-col-drag-key');
          if (!k || k === draggedKey || (lockedColumnKeys ?? []).includes(k)) break;

          const srcIdx = workingOrder.indexOf(draggedKey);
          const tgtIdx = workingOrder.indexOf(k);
          if (srcIdx === -1 || tgtIdx === -1 || srcIdx === tgtIdx) break;
          const next = [...workingOrder];
          next.splice(srcIdx, 1);
          next.splice(tgtIdx, 0, draggedKey);
          workingOrder = next;
          if (onColumnOrderChange) {
            onColumnOrderChange(next);
          } else {
            // Fallback: shuffle the internal columns array to mirror the order
            setColumns((cols) => {
              const byKey = new Map(cols.map((c) => [c.id, c]));
              return next.map((key) => byKey.get(key)!).filter(Boolean);
            });
          }
          colDragRef.current.lastSwapTime = now;
          break;
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        if (colDragRef.current?.isDragging) {
          suppressNextClickRef.current = true;
          requestAnimationFrame(() => {
            suppressNextClickRef.current = false;
          });
        }

        colDragRef.current = null;
        setDraggingColumnKey(null);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [resizing, columnOrder, columns, lockedColumnKeys, onColumnOrderChange]
  );

  // Setup resize listeners
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing]);

  // Compose the rendered column list. Internal column array is the source for
  // widths/labels/sortable flags; optional external columnOrder + columnVisibility
  // (driven by the ColumnSelector drawer) reorder and hide columns at render time.
  const orderedVisibleColumns = (() => {
    const visible = columns.filter((col) => {
      if (!col.visible) return false;
      if (columnVisibility && columnVisibility[col.id] === false) return false;
      return true;
    });
    if (columnOrder && columnOrder.length > 0) {
      const byKey = new Map(visible.map((c) => [c.id, c]));
      const sorted: ColumnConfig[] = [];
      for (const key of columnOrder) {
        const col = byKey.get(key);
        if (col) {
          sorted.push(col);
          byKey.delete(key);
        }
      }
      // Append any visible columns not present in columnOrder (e.g. newly added)
      byKey.forEach((col) => sorted.push(col));
      return sorted;
    }
    return visible;
  })();

  // Match partners' condensed row height — they show ~36px rows. Comfort
  // bumps to ~52px to host the vendor subtitle line.
  const rowHeight = densityMode === 'condensed' ? 'h-9' : 'h-[52px]';
  const cellPadding = densityMode === 'condensed' ? 'py-1 pl-4 pr-2' : 'py-2 pl-4 pr-2';
  const cellText = densityMode === 'condensed' ? 'text-[13px]' : 'text-[13px]';
  const showVendorSubtitle = densityMode === 'comfort';
  // Sticky-cell shadows removed per design — partners' table has no edge
  // shadow on the frozen-left or frozen-right scroll boundary.
  const frozenLeftShadow: string | undefined = undefined;
  const frozenRightShadow: string | undefined = undefined;

  return (
    <div ref={tableRef} className="flex-1 overflow-hidden bg-card relative w-full">
      <div className="overflow-auto h-full">
        <table
          className="w-full"
          style={{ borderCollapse: 'separate', borderSpacing: 0 }}
        >
          <thead className="sticky top-0 z-20">
            <tr className={rowHeight} style={{ backgroundColor: 'hsl(var(--muted) / 0.3)' }}>
              {/* Sticky Checkbox Column - Left — bg matches header band, no divider */}
              <th
                className="sticky left-0 z-30 w-[44px] min-w-[44px]"
                style={{ backgroundColor: 'hsl(var(--muted) / 0.3)' }}
              >
                <div className="flex items-center justify-center px-3">
                  <Checkbox
                    checked={selectedInvoices.length === invoices.length && invoices.length > 0}
                    onCheckedChange={onToggleSelectAll}
                  />
                </div>
              </th>

              {/* Scrollable Columns */}
              {orderedVisibleColumns.map((column, index) => {
                // First content column (Invoice ID by default) is sticky after the
                // checkbox column — matches partners' "Partners" column behaviour.
                const isFirstStickyCol = index === 0 && column.id === 'invoiceNumber';
                const isDragLocked = (lockedColumnKeys ?? ['invoiceNumber']).includes(column.id);
                const isDraggingThis = draggingColumnKey === column.id;
                return (
                <th
                  key={column.id}
                  data-col-drag-key={column.id}
                  className={`relative text-left group/colheader whitespace-nowrap select-none ${
                    isFirstStickyCol ? 'sticky left-[44px] z-20' : ''
                  } ${isDraggingThis ? 'opacity-50' : ''} ${
                    isDragLocked ? '' : 'cursor-grab active:cursor-grabbing'
                  }`}
                  style={{
                    width: column.width,
                    minWidth: column.minWidth,
                    backgroundColor: isFirstStickyCol ? 'hsl(var(--muted) / 0.3)' : 'hsl(var(--muted) / 0.3)',
                  }}
                  onMouseDown={
                    isDragLocked ? undefined : (e) => handleHeaderMouseDown(e, column.id)
                  }
                >
                  <div className="flex items-center gap-2 pl-4 pr-2 py-2">
                    <GripVertical className="w-3 h-3 text-muted-foreground/40 opacity-0 group-hover/colheader:opacity-100 transition-opacity pointer-events-none" />
                    {onSort && onColumnFilterChange ? (
                      <InvoiceColumnHeaderMenu
                        columnKey={column.id}
                        label={column.label}
                        sortable={!!column.sortable}
                        sortConfig={sortConfig ?? null}
                        onSort={onSort}
                        filter={columnFilters?.[column.id] ?? null}
                        hasActiveFilter={
                          !!columnFilters?.[column.id] && isInvoiceFilterActive(columnFilters[column.id])
                        }
                        onFilterChange={onColumnFilterChange}
                        onHideColumn={onHideColumn ?? (() => undefined)}
                        isLocked={lockedColumnKeys?.includes(column.id)}
                        invoices={allInvoices ?? invoices}
                        suppressOpenRef={suppressNextClickRef}
                      >
                        <span
                          className="text-[13px] select-none"
                          style={{
                            fontWeight: 500,
                            color:
                              sortConfig?.key === column.id ||
                              (columnFilters?.[column.id] && isInvoiceFilterActive(columnFilters[column.id]))
                                ? 'hsl(var(--primary))'
                                : 'hsl(var(--foreground))',
                          }}
                        >
                          {column.label}
                        </span>
                        {columnFilters?.[column.id] && isInvoiceFilterActive(columnFilters[column.id]) && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0 ml-1"
                            style={{ backgroundColor: 'hsl(var(--primary))' }}
                          />
                        )}
                        {sortConfig?.key === column.id && sortConfig.direction === 'asc' && (
                          <svg className="w-3 h-3 shrink-0 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'hsl(var(--primary))' }}>
                            <path d="M12 19V5M5 12l7-7 7 7" />
                          </svg>
                        )}
                        {sortConfig?.key === column.id && sortConfig.direction === 'desc' && (
                          <svg className="w-3 h-3 shrink-0 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'hsl(var(--primary))' }}>
                            <path d="M12 5v14M19 12l-7 7-7-7" />
                          </svg>
                        )}
                      </InvoiceColumnHeaderMenu>
                    ) : (
                      <span
                        className="text-[13px] text-foreground select-none"
                        style={{ fontWeight: 500 }}
                      >
                        {column.label}
                      </span>
                    )}
                  </div>

                  {column.resizable && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group/resize"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleResizeStart(column.id, e.clientX, e);
                      }}
                    >
                      <div
                        className={`absolute right-0 top-1 bottom-1 w-[2px] rounded-full transition-colors ${
                          resizing?.columnId === column.id
                            ? 'bg-primary'
                            : 'bg-transparent group-hover/resize:bg-primary/40'
                        }`}
                      />
                    </div>
                  )}
                </th>
                );
              })}

              {/* Sticky Actions Column - Right */}
              <th
                className="sticky right-0 z-30 w-[56px] min-w-[56px]"
                style={{ backgroundColor: 'hsl(var(--muted) / 0.3)' }}
              >
                <div className="pl-2 pr-2 py-2 text-right">
                  <span
                    className="text-[13px] text-foreground"
                    style={{ fontWeight: 500 }}
                  >
                    Actions
                  </span>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => {
              const isSelected = selectedInvoices.includes(invoice.id);
              // Sticky-cell background classes — must use Tailwind variants
              // (not inline style) so group-hover/row actually applies the
              // row-hover tint on the frozen checkbox / first / actions
              // columns. Inline styles win over hover, breaking the effect.
              const stickyBgClass = isSelected
                ? 'bg-accent-row-selected group-hover/row:bg-accent-row-hover'
                : 'bg-card group-hover/row:bg-accent-row-hover';
              return (
                <tr
                  key={invoice.id}
                  className={`group/row cursor-pointer ${rowHeight} [&>td]:border-b [&>td]:border-border/60 ${
                    isSelected ? 'bg-accent-row-selected hover:bg-accent-row-hover' : 'hover:bg-accent-row-hover'
                  }`}
                  onClick={() => onViewInvoice(invoice.id)}
                >
                  {/* Sticky Checkbox Cell - Left — bg matches row, no inset shadow */}
                  <td
                    className={`sticky left-0 z-10 w-[44px] min-w-[44px] select-none ${stickyBgClass}`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      beginDragSelect(invoice.id);
                    }}
                    onMouseEnter={() => extendDragSelect(invoice.id)}
                  >
                    <div className="flex items-center justify-center px-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => {
                          // Pure click (no drag) still toggles a single row
                          if (!dragSelectRef.current) onToggleSelect(invoice.id);
                        }}
                      />
                    </div>
                  </td>

                  {/* Scrollable Cells */}
                  {orderedVisibleColumns.map((column, colIdx) => {
                    const isFirstStickyCol = colIdx === 0 && column.id === 'invoiceNumber';
                    return (
                    <td
                      key={column.id}
                      className={`${cellPadding} ${cellText} ${
                        isFirstStickyCol ? `sticky left-[44px] z-10 ${stickyBgClass}` : ''
                      }`}
                      style={{
                        width: column.width,
                        boxShadow: isFirstStickyCol ? frozenLeftShadow : undefined,
                      }}
                    >
                      {column.id === 'invoiceNumber' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewInvoice(invoice.id);
                          }}
                          className="text-foreground hover:text-primary hover:underline transition-colors text-left whitespace-nowrap"
                          style={{ fontWeight: 500 }}
                        >
                          {invoice.invoiceNumber}
                        </button>
                      )}
                      {column.id === 'vendorInvoiceNumber' && (
                        <span className="text-foreground">{invoice.vendorInvoiceNumber}</span>
                      )}
                      {column.id === 'invoiceDate' && (
                        <span className="text-muted-foreground">{formatUsDate(invoice.invoiceDate)}</span>
                      )}
                      {column.id === 'vendor' && (
                        <div className="flex items-center gap-2 min-w-0">
                          <VendorAvatar
                            name={invoice.vendor}
                            size={showVendorSubtitle ? 'md' : 'sm'}
                          />
                          <div className="min-w-0 flex flex-col">
                            <span
                              className="text-foreground truncate"
                              style={{ fontWeight: 500 }}
                              title={invoice.vendor}
                            >
                              {invoice.vendor}
                            </span>
                            {showVendorSubtitle && invoice.description && (
                              <span
                                className="text-[11px] text-muted-foreground truncate"
                                title={invoice.description}
                              >
                                {invoice.description}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {column.id === 'currency' && (
                        <span className="text-muted-foreground">{invoice.currency}</span>
                      )}
                      {column.id === 'createdDate' && (
                        <span className="text-muted-foreground">{formatUsDate(invoice.createdDate)}</span>
                      )}
                      {column.id === 'dueDate' && (
                        <span className="text-foreground">{formatUsDate(invoice.dueDate)}</span>
                      )}
                      {column.id === 'amount' && (
                        <span
                          className="text-foreground"
                          style={{ fontWeight: 500 }}
                        >
                          ${invoice.amount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                      {column.id === 'linkedRecords' && renderLinkedRecords(invoice)}
                      {column.id === 'apAccount' && (
                        <span className="text-muted-foreground">{invoice.apAccount}</span>
                      )}
                      {column.id === 'type' && renderTypeWithIcon(invoice.type)}
                      {column.id === 'description' && (
                        <span className="text-muted-foreground truncate block">
                          {invoice.description}
                        </span>
                      )}
                      {column.id === 'status' && renderStatusBadge(invoice.status)}
                      {column.id === 'updatedBy' && (
                        <span className="text-muted-foreground">{invoice.updatedBy ?? invoice.createdBy}</span>
                      )}
                      {column.id === 'updatedDate' && (
                        <span className="text-muted-foreground">{invoice.updatedDate ?? invoice.createdDate}</span>
                      )}
                      {column.id === 'createdBy' && (
                        <span className="text-muted-foreground">{invoice.createdBy}</span>
                      )}
                    </td>
                    );
                  })}

                  {/* Sticky Actions Cell - Right */}
                  <td
                    className={`sticky right-0 z-10 w-[56px] min-w-[56px] ${stickyBgClass}`}
                    style={{ boxShadow: frozenRightShadow }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center px-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-muted">
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {getRowActions(invoice.status, invoice).map((action) => {
                            const Icon = ACTION_ICONS[action.id];
                            return (
                              <DropdownMenuItem
                                key={action.id}
                                onClick={(e) => dispatchAction(action.id, invoice.id, e)}
                                className={
                                  action.destructive
                                    ? 'text-rose-600 focus:text-rose-600 focus:bg-rose-50'
                                    : ''
                                }
                              >
                                <Icon
                                  className={`w-4 h-4 mr-2 ${
                                    action.destructive ? '' : 'text-muted-foreground'
                                  }`}
                                />
                                {action.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick View Modal */}
      <QuickViewModal 
        record={quickViewRecord} 
        onClose={() => setQuickViewRecord(null)} 
      />
    </div>
  );
}

// --- Helper Components & Functions ---

function getRecordData(id: string, type: 'PO' | 'GRN') {
  for (const vendor of mockVendors) {
    if (type === 'PO') {
      const po = vendor.purchaseOrders.find(p => p.poNumber === id);
      if (po) return { ...po, vendorName: vendor.vendorName, type: 'PO' as const };
    } else {
      for (const po of vendor.purchaseOrders) {
        const grn = vendor.receivingDocuments.find(g => g.grnNumber === id);
        if (grn) return { ...grn, vendorName: vendor.vendorName, type: 'GRN' as const };
      }
    }
  }
  return null;
}

function QuickViewModal({ record, onClose }: { record: { id: string, type: 'PO' | 'GRN' } | null, onClose: () => void }) {
  const data = record ? getRecordData(record.id, record.type) : null;
  
  return (
    <Dialog open={!!record} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-xl">
        {data ? (
          <div className="flex flex-col bg-white">
            {/* Header */}
            <div className="bg-gray-900 px-6 py-5 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.type === 'PO' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {data.type === 'PO' ? <FileText className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-bold leading-none">
                      {data.type === 'PO'
                        ? <><span className="text-white/50">PO No.</span> {(data as any).poNumber}</>
                        : (data as any).grnNumber}
                    </DialogTitle>
                    <DialogDescription className="text-[10px] font-black text-white/40 mt-1">
                      {data.type === 'PO' ? 'Purchase Order' : 'Receiving Document'}
                    </DialogDescription>
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                  data.status.includes('Fully') || data.status === 'Accepted' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {data.status}
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-white/60 font-medium">
                <div className="flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" />
                  {data.vendorName}
                </div>
                <div className="w-1 h-1 rounded-full bg-white/20" />
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {(data as any).poDate || (data as any).grnDate}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 mb-1">Total Items</p>
                  <p className="text-xl font-bold text-gray-900">{(data as any).itemCount || data.items.length}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 mb-1">Total Amount</p>
                  <p className="text-xl font-bold text-gray-900">${((data as any).poAmount || data.items.reduce((s: any, i: any) => s + (i.totalPrice || 0), 0)).toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <p className="text-[9px] font-black text-gray-400 mb-1">Currency</p>
                  <p className="text-xl font-bold text-gray-900">USD</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-gray-400">Line Items</h3>
                  <span className="text-[10px] font-bold text-blue-600">Showing top {Math.min(5, data.items.length)}</span>
                </div>
                <div className="border rounded-lg overflow-hidden border-gray-100">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-2 font-bold text-gray-500">Items</th>
                        <th className="px-3 py-2 font-bold text-gray-500 text-right">Qty</th>
                        {data.type === 'GRN' && data.status === 'Partially Invoiced' && (
                          <>
                            <th className="px-3 py-2 font-bold text-green-600 text-right">Pre-Inv Qty</th>
                            <th className="px-3 py-2 font-bold text-green-600 text-right">Pre-Inv Val</th>
                          </>
                        )}
                        <th className="px-3 py-2 font-bold text-gray-500 text-right">Price</th>
                        <th className="px-3 py-2 font-bold text-gray-500 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.items.slice(0, 5).map((item: any, idx: number) => (
                        <tr key={idx} className="bg-white">
                          <td className="px-3 py-2.5">
                            <p className="font-bold text-gray-900 leading-tight">{item.description}</p>
                            <p className="text-[9px] text-gray-400 font-medium mt-0.5">{item.sku}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-gray-600">{item.quantity} {item.uom}</td>
                          {data.type === 'GRN' && data.status === 'Partially Invoiced' && (
                            <>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex flex-col items-end">
                                  <span className="font-bold text-green-600">{item.invoicedQty || 0} {item.uom}</span>
                                  {(item.invoicedQty || 0) > 0 && (
                                    <div className="flex flex-wrap justify-end gap-1 mt-0.5">
                                      <HoverCard openDelay={300}>
                                        <HoverCardTrigger asChild>
                                          <span className="text-[7px] bg-green-50 text-green-700 px-1 py-0 rounded border border-green-100 font-bold cursor-help">PINV-001</span>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="top" className="w-64 p-3 bg-white border-green-100 shadow-xl rounded-xl z-[60]">
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[9px] font-black text-green-600 tracking-widest">Pre-Invoice</span>
                                              <span className="text-[9px] font-bold text-gray-400">2024-01-15</span>
                                            </div>
                                            <div className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                                              <span className="text-[11px] font-bold text-gray-900">PINV-001</span>
                                              <span className="text-[11px] font-black text-green-600">$ {(item.unitPrice * (item.invoicedQty || 0)).toLocaleString()}</span>
                                            </div>
                                            <p className="text-[9px] text-gray-500 font-medium">Pre-billing record for partial quantities. Offsets against this receiving document.</p>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                      {item.invoicedQty > 20 && (
                                        <HoverCard openDelay={300}>
                                          <HoverCardTrigger asChild>
                                            <span className="text-[7px] bg-green-50 text-green-700 px-1 py-0 rounded border border-green-100 font-bold cursor-help">PINV-002</span>
                                          </HoverCardTrigger>
                                          <HoverCardContent side="top" className="w-64 p-3 bg-white border-green-100 shadow-xl rounded-xl z-[60]">
                                            <div className="space-y-2">
                                              <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-green-600 tracking-widest">Pre-Invoice</span>
                                                <span className="text-[9px] font-bold text-gray-400">2024-02-01</span>
                                              </div>
                                              <div className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                                                <span className="text-[11px] font-bold text-gray-900">PINV-002</span>
                                                <span className="text-[11px] font-black text-green-600">$ 2,400.00</span>
                                              </div>
                                              <p className="text-[9px] text-gray-500 font-medium">Second billing record detected for this item. Offset logic applied.</p>
                                            </div>
                                          </HoverCardContent>
                                        </HoverCard>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-green-600">
                                ${((item.invoicedQty || 0) * item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2.5 text-right font-medium text-gray-600">${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-900">${item.totalPrice.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.items.length > 5 && (
                  <p className="text-center text-[10px] text-gray-400 font-medium italic">
                    + {data.items.length - 5} more items not shown in quick view
                  </p>
                )}
              </div>
            </div>

            {/* Footer / CTA */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-[11px] font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Close View
              </button>
              <Button className="h-9 px-5 bg-gray-900 hover:bg-black text-white text-[11px] font-bold gap-2 rounded-lg shadow-lg">
                Go to {data.type === 'PO' ? 'Purchase Order' : 'Receiving Document'}
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center space-y-4">
             <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-gray-900">Record Not Found</h3>
                <p className="text-sm text-gray-500">The document details could not be retrieved.</p>
             </div>
             <Button onClick={onClose} variant="outline" className="mt-4">Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}