import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  X
} from 'lucide-react';
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
import { VIMoneyCell } from '@/app/components/currency/VIMoneyCell';
import { InvoiceViewModeProvider, type InvoiceViewMode } from '@/app/components/currency/InvoiceViewModeContext';
import { AmountColumnHeaderMenu } from '@/app/components/currency/AmountColumnHeaderMenu';

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
  onViewInvoice: (id: string) => void;
  onEditInvoice: (id: string, e: React.MouseEvent) => void;
  onDownload: (id: string, e: React.MouseEvent) => void;
  onVoid: (id: string, e: React.MouseEvent) => void;
  onAddPayment: (id: string, e: React.MouseEvent) => void;
  onMatch: (id: string, e: React.MouseEvent) => void;
  densityMode: 'condensed' | 'comfort' | 'relaxed';
  TypeBadge: React.ComponentType<{ type: Invoice['type'] }>;
  StatusBadge: React.ComponentType<{ status: Invoice['status'] }>;
}

export function AdvancedInvoiceTable({
  invoices,
  selectedInvoices,
  onToggleSelect,
  onToggleSelectAll,
  onViewInvoice,
  onEditInvoice,
  onDownload,
  onVoid,
  onAddPayment,
  onMatch,
  densityMode,
  TypeBadge,
  StatusBadge
}: AdvancedInvoiceTableProps) {
  const [columns, setColumns] = useState<ColumnConfig[]>([
    { id: 'invoiceNumber', label: 'INVOICE ID', width: 180, minWidth: 140, visible: true, resizable: true, sortable: true },
    { id: 'vendor', label: 'VENDOR', width: 240, minWidth: 180, visible: true, resizable: true, sortable: true },
    { id: 'vendorInvoiceNumber', label: 'VENDOR INV #', width: 180, minWidth: 140, visible: true, resizable: true, sortable: true },
    { id: 'type', label: 'TYPE', width: 200, minWidth: 160, visible: true, resizable: true, sortable: true },
    { id: 'invoiceDate', label: 'VENDOR INVOICE DATE', width: 180, minWidth: 140, visible: true, resizable: true, sortable: true },
    { id: 'dueDate', label: 'DUE DATE', width: 160, minWidth: 120, visible: true, resizable: true, sortable: true },
    { id: 'apAccount', label: 'A/P ACCOUNT', width: 180, minWidth: 140, visible: true, resizable: true, sortable: true },
    { id: 'status', label: 'STATUS', width: 200, minWidth: 150, visible: true, resizable: true, sortable: true },
    { id: 'amount', label: 'AMOUNT', width: 160, minWidth: 120, visible: true, resizable: true, sortable: true },
    { id: 'currency', label: 'CURRENCY', width: 120, minWidth: 90, visible: true, resizable: true, sortable: true },
    { id: 'description', label: 'DESCRIPTION', width: 300, minWidth: 200, visible: true, resizable: true, sortable: true },
    { id: 'linkedRecords', label: 'LINKED RECORDS', width: 280, minWidth: 200, visible: true, resizable: true, sortable: false },
    { id: 'createdBy', label: 'CREATED BY', width: 180, minWidth: 140, visible: true, resizable: true, sortable: true },
    { id: 'createdDate', label: 'CREATED ON', width: 160, minWidth: 120, visible: true, resizable: true, sortable: true },
  ]);

  const [resizing, setResizing] = useState<{ columnId: string; startX: number; startWidth: number } | null>(null);
  const [dragging, setDragging] = useState<{ columnId: string; startIndex: number } | null>(null);
  const [quickViewRecord, setQuickViewRecord] = useState<{ id: string; type: 'PO' | 'GRN' } | null>(null);
  const [amountViewMode, setAmountViewMode] = useState<InvoiceViewMode>('base');
  const tableRef = useRef<HTMLDivElement>(null);

  // Render type with icon
  const renderTypeWithIcon = (type: Invoice['type']) => {
    const typeConfig: Record<string, { icon: any; label: string; color: string }> = {
      'PO-based': { icon: FileText, label: 'PO Invoice', color: 'text-blue-600' },
      'Receiving-based': { icon: Truck, label: 'Receiving', color: 'text-green-600' },
      'GRN-based': { icon: Truck, label: 'Receiving', color: 'text-green-600' }, // Legacy support
      'Standalone': { icon: Calculator, label: 'Non-PO', color: 'text-purple-600' },
      'Pre-Invoice': { icon: Package, label: 'Pre-Invoice', color: 'text-orange-600' }
    };

    const config = typeConfig[type] || typeConfig['Standalone']; // Fallback to Standalone if type not found
    const Icon = config.icon;

    return (
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className="text-sm text-gray-900">{config.label}</span>
      </div>
    );
  };

  // Render status badge with colors and icons
  const renderStatusBadge = (status: Invoice['status']) => {
    const statusConfig: Record<Invoice['status'], { bg: string; text: string; icon?: any }> = {
      'Pending Approval': { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      'Approved': { bg: 'bg-green-100', text: 'text-green-800' },
      'Partially Paid': { bg: 'bg-emerald-100', text: 'text-emerald-800' },
      'Paid': { bg: 'bg-green-100', text: 'text-green-800' },
      'Exception': { bg: 'bg-orange-100', text: 'text-orange-800', icon: AlertTriangle },
      'Payment Hold': { bg: 'bg-red-100', text: 'text-red-800', icon: Lock },
      'Cancelled': { bg: 'bg-gray-100', text: 'text-gray-600' }
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
    const Icon = config.icon;

    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}>
        {Icon && <Icon className={`w-3.5 h-3.5 ${config.text}`} />}
        <span className={`text-xs font-medium ${config.text}`}>{status}</span>
      </div>
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
      return <span className="text-sm text-gray-400">—</span>;
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
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-100/50 shadow-sm shrink-0"
        >
          {first.type === 'PO' ? <FileText className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
          {first.id}
        </button>

        {others.length > 0 && (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={(e) => e.stopPropagation()}
                  className="px-1.5 py-0.5 rounded text-[10px] font-black text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
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
                        <span className="text-[9px] text-gray-400 font-medium uppercase mt-0.5">{record.type === 'PO' ? 'Purchase Order' : 'Receiving Doc'}</span>
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

  // Handle column reorder
  const handleDragStart = (columnId: string, index: number, e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    setDragging({ columnId, startIndex: index });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    if (!dragging) return;

    const newColumns = [...columns];
    const [movedColumn] = newColumns.splice(dragging.startIndex, 1);
    newColumns.splice(targetIndex, 0, movedColumn);

    setColumns(newColumns);
    setDragging(null);
  };

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

  const rowClass = densityMode === 'condensed' ? 'h-10' : densityMode === 'relaxed' ? 'h-16' : 'h-12';
  const cellPadding = densityMode === 'condensed' ? 'py-2 px-3' : densityMode === 'relaxed' ? 'py-4 px-4' : 'py-3 px-3';

  return (
    <InvoiceViewModeProvider value={amountViewMode}>
    <div ref={tableRef} className="flex-1 overflow-hidden bg-white relative">
      <div className="overflow-auto h-full">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-gray-50">
            <tr className={`border-b border-gray-200 ${rowClass}`}>
              {/* Sticky Checkbox Column - Left */}
              <th className="sticky left-0 z-30 bg-gray-50 border-r border-gray-200 w-[50px]">
                <div className="flex items-center justify-center px-3">
                  <Checkbox
                    checked={selectedInvoices.length === invoices.length && invoices.length > 0}
                    onCheckedChange={onToggleSelectAll}
                  />
                </div>
              </th>

              {/* Scrollable Columns */}
              {columns.filter(col => col.visible).map((column, index) => (
                column.id === 'amount' ? (
                  <th
                    key={column.id}
                    className="relative bg-gray-50 text-left group"
                    style={{ width: column.width, minWidth: column.minWidth }}
                  >
                    <AmountColumnHeaderMenu
                      label={column.label}
                      viewMode={amountViewMode}
                      onViewModeChange={setAmountViewMode}
                    />
                    {column.resizable && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500 transition-colors z-10"
                        style={{
                          background: resizing?.columnId === column.id ? '#3b82f6' : undefined
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(column.id, e.clientX, e);
                        }}
                      />
                    )}
                  </th>
                ) : (
                  <th
                    key={column.id}
                    className="relative bg-gray-50 text-left group"
                    style={{ width: column.width, minWidth: column.minWidth }}
                    draggable
                    onDragStart={(e) => handleDragStart(column.id, index, e)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(index, e)}
                  >
                    <div className="flex items-center gap-2 px-3 py-3 pointer-events-none">
                      <GripVertical className="w-3.5 h-3.5 text-gray-400 cursor-move opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto" />
                      <span className="text-xs font-medium text-gray-700 select-none">
                        {column.label}
                      </span>
                    </div>

                    {/* Resize Handle */}
                    {column.resizable && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500 transition-colors z-10"
                        style={{
                          background: resizing?.columnId === column.id ? '#3b82f6' : undefined
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(column.id, e.clientX, e);
                        }}
                      />
                    )}
                  </th>
                )
              ))}

              {/* Sticky Actions Column - Right */}
              <th className="sticky right-0 z-30 bg-gray-50 border-l border-gray-200 w-[60px]">
                <div className="px-3 py-3">
                  <span className="text-xs font-medium text-gray-700">Actions</span>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${rowClass}`}
                onClick={() => onViewInvoice(invoice.id)}
              >
                {/* Sticky Checkbox Cell - Left */}
                <td
                  className="sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-gray-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center px-3">
                    <Checkbox
                      checked={selectedInvoices.includes(invoice.id)}
                      onCheckedChange={() => onToggleSelect(invoice.id)}
                    />
                  </div>
                </td>

                {/* Scrollable Cells */}
                {columns.filter(col => col.visible).map((column) => (
                  <td key={column.id} className={cellPadding} style={{ width: column.width }}>
                    {column.id === 'invoiceNumber' && (
                      <span className="text-sm font-medium text-blue-600 hover:underline">
                        {invoice.invoiceNumber}
                      </span>
                    )}
                    {column.id === 'vendorInvoiceNumber' && (
                      <span className="text-sm text-gray-900">{invoice.vendorInvoiceNumber}</span>
                    )}
                    {column.id === 'invoiceDate' && (
                      <span className="text-sm text-gray-600">{invoice.invoiceDate}</span>
                    )}
                    {column.id === 'vendor' && (
                      <span className="text-sm text-gray-900">{invoice.vendor}</span>
                    )}
                    {column.id === 'currency' && (
                      <span className="text-sm text-gray-600">{invoice.currency}</span>
                    )}
                    {column.id === 'createdDate' && (
                      <span className="text-sm text-gray-600">{invoice.createdDate}</span>
                    )}
                    {column.id === 'dueDate' && (
                      <span className="text-sm text-gray-900">{invoice.dueDate}</span>
                    )}
                    {column.id === 'amount' && (
                      <VIMoneyCell value={invoice.amount} invoice={invoice} className="text-sm font-semibold text-gray-900 text-right block" />
                    )}
                    {column.id === 'linkedRecords' && renderLinkedRecords(invoice)}
                    {column.id === 'apAccount' && (
                      <span className="text-sm text-gray-600">{invoice.apAccount}</span>
                    )}
                    {column.id === 'type' && renderTypeWithIcon(invoice.type)}
                    {column.id === 'description' && (
                      <span className="text-sm text-gray-600 truncate block">{invoice.description}</span>
                    )}
                    {column.id === 'status' && renderStatusBadge(invoice.status)}
                    {column.id === 'createdBy' && (
                      <span className="text-sm text-gray-600">{invoice.createdBy}</span>
                    )}
                  </td>
                ))}

                {/* Sticky Actions Cell - Right */}
                <td
                  className="sticky right-0 z-10 bg-white border-l border-gray-100 group-hover:bg-gray-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center px-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100">
                          <MoreHorizontal className="w-4 h-4 text-gray-400" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewInvoice(invoice.id); }}>
                          <Eye className="w-4 h-4 mr-2 text-gray-600" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => onEditInvoice(invoice.id, e)}>
                          <Edit3 className="w-4 h-4 mr-2 text-gray-600" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => onMatch(invoice.id, e)}>
                          <GitCompare className="w-4 h-4 mr-2 text-gray-600" />
                          Match
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => onAddPayment(invoice.id, e)}>
                          <DollarSign className="w-4 h-4 mr-2 text-gray-600" />
                          Add Payment
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => onDownload(invoice.id, e)}>
                          <Download className="w-4 h-4 mr-2 text-gray-600" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => onVoid(invoice.id, e)} className="text-red-600 focus:text-red-600">
                          <Ban className="w-4 h-4 mr-2" />
                          Void
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick View Modal */}
      <QuickViewModal
        record={quickViewRecord}
        onClose={() => setQuickViewRecord(null)}
      />
    </div>
    </InvoiceViewModeProvider>
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
                      {data.type === 'PO' ? (data as any).poNumber : (data as any).grnNumber}
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
                  <VIMoneyCell value={(data as any).poAmount || data.items.reduce((s: any, i: any) => s + (i.totalPrice || 0), 0)} currency="USD" className="text-xl font-bold text-gray-900" />
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
                        <th className="px-3 py-2 font-bold text-gray-500">Item / SKU</th>
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
                                  {item.invoicedQty && item.invoicedQty > 0 && (
                                    <div className="flex flex-wrap justify-end gap-1 mt-0.5">
                                      <HoverCard openDelay={100}>
                                        <HoverCardTrigger asChild>
                                          <span className="text-[7px] bg-green-50 text-green-700 px-1 py-0 rounded border border-green-100 font-bold cursor-help">PINV-001</span>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="top" className="w-64 p-3 bg-white border-green-100 shadow-xl rounded-xl z-[60]">
                                          <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                              <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Pre-Invoice</span>
                                              <span className="text-[9px] font-bold text-gray-400">2024-01-15</span>
                                            </div>
                                            <div className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                                              <span className="text-[11px] font-bold text-gray-900">PINV-001</span>
                                              <VIMoneyCell value={item.unitPrice * (item.invoicedQty || 0)} currency="USD" className="text-[11px] font-black text-green-600" />
                                            </div>
                                            <p className="text-[9px] text-gray-500 font-medium">Pre-billing record for partial quantities. Offsets against this receiving document.</p>
                                          </div>
                                        </HoverCardContent>
                                      </HoverCard>
                                      {item.invoicedQty > 20 && (
                                        <HoverCard openDelay={100}>
                                          <HoverCardTrigger asChild>
                                            <span className="text-[7px] bg-green-50 text-green-700 px-1 py-0 rounded border border-green-100 font-bold cursor-help">PINV-002</span>
                                          </HoverCardTrigger>
                                          <HoverCardContent side="top" className="w-64 p-3 bg-white border-green-100 shadow-xl rounded-xl z-[60]">
                                            <div className="space-y-2">
                                              <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Pre-Invoice</span>
                                                <span className="text-[9px] font-bold text-gray-400">2024-02-01</span>
                                              </div>
                                              <div className="flex items-center justify-between border-b border-gray-50 pb-1.5">
                                                <span className="text-[11px] font-bold text-gray-900">PINV-002</span>
                                                <VIMoneyCell value={2400} currency="USD" className="text-[11px] font-black text-green-600" />
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
                                <VIMoneyCell value={(item.invoicedQty || 0) * item.unitPrice} currency="USD" />
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2.5 text-right font-medium text-gray-600"><VIMoneyCell value={item.unitPrice} currency="USD" /></td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-900"><VIMoneyCell value={item.totalPrice} currency="USD" /></td>
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