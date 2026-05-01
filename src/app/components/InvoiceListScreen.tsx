import { useState } from 'react';
import { Search, Filter, ChevronDown, Plus, MoreHorizontal, FileText, Package, Calculator, Truck, X, Calendar, Check, LayoutGrid, AlignJustify, ChevronLeft, ChevronRight, ShoppingCart, Edit3, Eye, Download, Ban, DollarSign, GitCompare, AlertTriangle, Lock, Layers, File } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
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
import { mockInvoices, Invoice } from '@/app/data/mockInvoices';
import { InvoiceSearchModal, SearchSelection } from '@/app/components/InvoiceSearchModal';
import { CreateInvoiceFromPO } from '@/app/components/CreateInvoiceFromPO';
import { InvoiceCreationFromGRN } from '@/app/components/InvoiceCreationFromGRN';
import { InvoiceTypeSelectionModal } from '@/app/components/InvoiceTypeSelectionModal';
import { VendorSelectionModalNested as VendorSelectionModal, SelectedPOData } from '@/app/components/VendorSelectionModalNested';
import { BulkActionDialog } from '@/app/components/BulkActionDialog';
import { SavedViewsDialog } from '@/app/components/SavedViewsDialog';
import { ExportDialog } from '@/app/components/ExportDialog';
import { AdvancedInvoiceTable } from '@/app/components/AdvancedInvoiceTable';
import { toast } from 'sonner';

interface InvoiceListScreenProps {
  invoices: Invoice[];
  onCreateInvoice: () => void;
  onViewInvoice: (invoiceId: string) => void;
}

type DensityMode = 'condensed' | 'comfort' | 'relaxed' | 'card';
type InvoiceCreationType = 'receiving' | 'po' | 'manual' | 'prepayment' | 'draft' | 'standalone' | null;
type BulkActionType = 'approve' | 'post' | 'void' | 'hold' | 'export' | null;

export function InvoiceListScreen({ invoices, onCreateInvoice, onViewInvoice }: InvoiceListScreenProps) {
  const [activeTabs, setActiveTabs] = useState<string[]>(['all']);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [densityMode, setDensityMode] = useState<DensityMode>('comfort');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  const [bulkActionType, setBulkActionType] = useState<BulkActionType>(null);
  const [showBulkActionDialog, setShowBulkActionDialog] = useState(false);
  const [showSavedViewsDialog, setShowSavedViewsDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    types: [] as string[],
    statuses: [] as string[],
    createdBy: [] as string[],
  });
  
  // Dropdown open states
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  
  // Search within dropdowns
  const [typeSearch, setTypeSearch] = useState('');
  const [statusSearch, setStatusSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const filteredInvoices = invoices.filter(invoice => {
    // Filter by tabs (multi-select)
    if (!activeTabs.includes('all')) {
      const statusMap: Record<string, string[]> = {
        pending: ['Pending Approval'],
        approved: ['Approved'],
        partiallyPaid: ['Partially Paid'],
        paid: ['Paid'],
        exception: ['Exception'],
        hold: ['Payment Hold'],
        void: ['Cancelled']
      };
      
      // Check if invoice matches ANY of the selected tabs
      const matchesAnyTab = activeTabs.some(tab => 
        statusMap[tab]?.includes(invoice.status)
      );
      
      if (!matchesAnyTab) return false;
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!(
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.vendor.toLowerCase().includes(query) ||
        invoice.vendorInvoiceNumber.toLowerCase().includes(query) ||
        invoice.reference.toLowerCase().includes(query) ||
        invoice.description.toLowerCase().includes(query) ||
        invoice.apAccount.toLowerCase().includes(query)
      )) return false;
    }
    
    // Filter by date range
    if (filters.dateFrom) {
      const invoiceDate = new Date(invoice.date);
      const fromDate = new Date(filters.dateFrom);
      if (invoiceDate < fromDate) return false;
    }
    if (filters.dateTo) {
      const invoiceDate = new Date(invoice.date);
      const toDate = new Date(filters.dateTo);
      if (invoiceDate > toDate) return false;
    }
    
    // Filter by types
    if (filters.types.length > 0) {
      if (!filters.types.includes(invoice.type)) return false;
    }
    
    // Filter by statuses
    if (filters.statuses.length > 0) {
      if (!filters.statuses.includes(invoice.status)) return false;
    }
    
    // Filter by created by
    if (filters.createdBy.length >0) {
      if (!filters.createdBy.includes(invoice.createdBy)) return false;
    }

    return true;
  });
  
  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      types: [],
      statuses: [],
      createdBy: [],
    });
  };

  const handleApplySavedView = (savedFilters: any) => {
    setFilters(savedFilters);
    toast.success('View applied', {
      description: 'Filters have been updated.'
    });
  };
  
  const activeFiltersCount = 
    (filters.dateFrom || filters.dateTo ? 1 : 0) +
    filters.types.length +
    filters.statuses.length +
    filters.createdBy.length;

  // Calculate KPIs
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalCount = invoices.length;
  
  const pendingInvoices = invoices.filter(inv => 
    inv.status === 'Pending Approval'
  );
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const pendingCount = pendingInvoices.length;
  
  const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
  const paidAmount = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidCount = paidInvoices.length;
  
  const overdueInvoices = invoices.filter(inv => 
    inv.status !== 'Paid' && inv.status !== 'Void' && new Date(inv.dueDate) < new Date()
  );
  const overdueCount = overdueInvoices.length;

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id));
    }
  };

  const toggleSelectInvoice = (id: string) => {
    if (selectedInvoices.includes(id)) {
      setSelectedInvoices(selectedInvoices.filter(invId => invId !== id));
    } else {
      setSelectedInvoices([...selectedInvoices, id]);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredInvoices.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const getPaginationButtons = () => {
    const buttons: (number | string)[] = [];
    const maxButtons = 7;
    
    if (totalPages <= maxButtons) {
      // Show all pages if total is less than maxButtons
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(i);
      }
    } else {
      // Always show first page
      buttons.push(1);
      
      if (currentPage > 3) {
        buttons.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        buttons.push(i);
      }
      
      if (currentPage < totalPages - 2) {
        buttons.push('...');
      }
      
      // Always show last page
      buttons.push(totalPages);
    }
    
    return buttons;
  };

  const handleRecordsPerPageChange = (value: number) => {
    setRecordsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing records per page
  };

  // Reset to page 1 when filters change
  const resetPagination = () => {
    setCurrentPage(1);
  };

  // Toggle tab selection (multi-select)
  const toggleTab = (tabId: string) => {
    setActiveTabs(prev => {
      if (tabId === 'all') {
        return ['all'];
      }
      
      const newTabs = prev.filter(t => t !== 'all');
      if (newTabs.includes(tabId)) {
        const filtered = newTabs.filter(t => t !== tabId);
        return filtered.length === 0 ? ['all'] : filtered;
      } else {
        return [...newTabs, tabId];
      }
    });
    setCurrentPage(1);
  };
  const handleEditInvoice = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Edit invoice:', invoiceId);
    onViewInvoice(invoiceId); // For now, view opens edit
  };

  const handleVoidInvoice = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Void invoice:', invoiceId);
    // TODO: Implement void confirmation dialog
  };

  const handleReconcileInvoice = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Reconcile invoice:', invoiceId);
    // TODO: Open reconciliation dialog
  };

  const handleViewDetails = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onViewInvoice(invoiceId);
  };

  const handleDownloadInvoice = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Download invoice:', invoiceId);
    // TODO: Implement PDF download
  };

  const handleAddPrepayment = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Add prepayment to invoice:', invoiceId);
    // TODO: Open prepayment dialog
  };

  const handleDownload = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const invoice = invoices.find(inv => inv.id === invoiceId);
    toast.success('Download started', {
      description: `Downloading invoice ${invoice?.invoiceNumber || invoiceId} as PDF...`
    });
  };

  const handleAddPayment = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const invoice = invoices.find(inv => inv.id === invoiceId);
    toast.info('Add Payment', {
      description: `Opening payment dialog for invoice ${invoice?.invoiceNumber || invoiceId}...`
    });
  };

  const handleMatchInvoice = (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const invoice = invoices.find(inv => inv.id === invoiceId);
    toast.info('Match Invoice', {
      description: `Opening match dialog for invoice ${invoice?.invoiceNumber || invoiceId}...`
    });
  };

  // Bulk action handlers
  const handleBulkAction = (actionType: BulkActionType) => {
    if (selectedInvoices.length === 0) {
      toast.error('No invoices selected', {
        description: 'Please select at least one invoice to perform this action.'
      });
      return;
    }
    
    if (actionType === 'export') {
      setShowExportDialog(true);
      return;
    }
    
    setBulkActionType(actionType);
    setShowBulkActionDialog(true);
  };

  const handleBulkActionConfirm = () => {
    const selectedInvoiceObjects = invoices.filter(inv => selectedInvoices.includes(inv.id));
    const count = selectedInvoices.length;
    
    switch (bulkActionType) {
      case 'approve':
        const approvableCount = selectedInvoiceObjects.filter(inv => 
          inv.status === 'Pending Approval'
        ).length;
        toast.success(`Approved ${approvableCount} invoice${approvableCount !== 1 ? 's' : ''}`, {
          description: `${count - approvableCount} invoice${count - approvableCount !== 1 ? 's were' : ' was'} skipped (not in approvable status).`
        });
        break;
      case 'post':
        const postableCount = selectedInvoiceObjects.filter(inv => 
          inv.status === 'Approved'
        ).length;
        toast.success(`Posted ${postableCount} invoice${postableCount !== 1 ? 's' : ''}`, {
          description: `GL entries created successfully. ${count - postableCount} invoice${count - postableCount !== 1 ? 's were' : ' was'} skipped (not approved).`
        });
        break;
      case 'void':
        toast.success(`Voided ${count} invoice${count !== 1 ? 's' : ''}`, {
          description: 'Invoices have been voided and removed from AP balance.'
        });
        break;
      case 'hold':
        toast.success(`Placed ${count} invoice${count !== 1 ? 's' : ''} on payment hold`, {
          description: 'These invoices will not be included in payment runs.'
        });
        break;
    }
    
    setShowBulkActionDialog(false);
    setBulkActionType(null);
    setSelectedInvoices([]);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#fafafa]">
      {/* Header Section */}
      <div className="px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 mb-0.5">Vendor Invoices</h1>
            <p className="text-xs text-gray-500">
              Manage AP invoices with 3-way matching, approvals, and payment tracking.
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs border-gray-300 hover:bg-gray-50"
                  disabled={selectedInvoices.length === 0}
                >
                  Actions
                  <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
                  {selectedInvoices.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {selectedInvoices.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleBulkAction('approve')}>
                  <Check className="w-4 h-4 mr-2 text-green-600" />
                  Bulk Approve
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction('post')}>
                  <FileText className="w-4 h-4 mr-2 text-blue-600" />
                  Bulk Post
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction('hold')}>
                  <Lock className="w-4 h-4 mr-2 text-yellow-600" />
                  Place on Hold
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction('void')}>
                  <Ban className="w-4 h-4 mr-2 text-red-600" />
                  Bulk Void
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkAction('export')}>
                  <Download className="w-4 h-4 mr-2 text-gray-600" />
                  Export Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex">
              <Button size="sm" onClick={onCreateInvoice} className="h-8 text-xs bg-[#2563eb] hover:bg-[#1d4ed8]">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create Invoice
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white border border-gray-200 rounded p-2">
            <div className="flex items-start gap-1.5">
              <div className="p-1 bg-blue-50 rounded">
                <FileText className="w-3 h-3 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-500 mb-0.5">Total Invoices</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-base font-semibold text-gray-900 leading-tight">${(totalAmount / 1000).toFixed(0)}k</div>
                  <div className="text-[10px] text-gray-500 truncate">{totalCount} invoices</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded p-2">
            <div className="flex items-start gap-1.5">
              <div className="p-1 bg-orange-50 rounded">
                <svg className="w-3 h-3 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-500 mb-0.5">Pending Review</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-base font-semibold text-orange-600 leading-tight">${(pendingAmount / 1000).toFixed(0)}k</div>
                  <div className="text-[10px] text-gray-500 truncate">{pendingCount} invoices</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded p-2">
            <div className="flex items-start gap-1.5">
              <div className="p-1 bg-green-50 rounded">
                <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-500 mb-0.5">Paid</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-base font-semibold text-green-600 leading-tight">${(paidAmount / 1000).toFixed(0)}k</div>
                  <div className="text-[10px] text-gray-500 truncate">{paidCount} invoices</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded p-2">
            <div className="flex items-start gap-1.5">
              <div className="p-1 bg-red-50 rounded">
                <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-500 mb-0.5">Overdue</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-base font-semibold text-red-600 leading-tight">{overdueCount}</div>
                  <div className="text-[10px] text-gray-500 truncate">overdue invoices</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integrated Search, Filters, Tabs, and View Controls */}
      <div className="bg-white border-b border-gray-200">
        {/* Search and Filters Row */}
        <div className="px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-80 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by invoice #, vendor, PO or SO..."
                className="pl-9 h-9 text-sm border-gray-300 bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="h-9 text-sm border-gray-300 bg-white hover:bg-gray-50" onClick={() => setIsFilterOpen(true)}>
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{filteredInvoices.length} Invoices</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-sm border-gray-300 bg-white hover:bg-gray-50">
                  {densityMode === 'card' ? (
                    <LayoutGrid className="w-4 h-4 mr-2" />
                  ) : (
                    <AlignJustify className="w-4 h-4 mr-2" />
                  )}
                  {densityMode.charAt(0).toUpperCase() + densityMode.slice(1)}
                  <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setDensityMode('condensed')}>
                  <AlignJustify className="w-4 h-4 mr-2" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Condensed</div>
                    <div className="text-xs text-gray-500">Compact view</div>
                  </div>
                  {densityMode === 'condensed' && <Check className="w-4 h-4 ml-2 text-blue-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDensityMode('comfort')}>
                  <AlignJustify className="w-4 h-4 mr-2" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Comfort</div>
                    <div className="text-xs text-gray-500">Balanced view</div>
                  </div>
                  {densityMode === 'comfort' && <Check className="w-4 h-4 ml-2 text-blue-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDensityMode('relaxed')}>
                  <AlignJustify className="w-4 h-4 mr-2" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Relaxed</div>
                    <div className="text-xs text-gray-500">Spacious view</div>
                  </div>
                  {densityMode === 'relaxed' && <Check className="w-4 h-4 ml-2 text-blue-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDensityMode('card')}>
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Card View</div>
                    <div className="text-xs text-gray-500">Grid layout</div>
                  </div>
                  {densityMode === 'card' && <Check className="w-4 h-4 ml-2 text-blue-600" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs Row */}
        <div className="px-6 py-3 flex items-center border-t border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <TabButton active={activeTabs.includes('all')} onClick={() => toggleTab('all')}>All</TabButton>
            <TabButton active={activeTabs.includes('pending')} onClick={() => toggleTab('pending')}>Pending Approval</TabButton>
            <TabButton active={activeTabs.includes('approved')} onClick={() => toggleTab('approved')}>Approved</TabButton>
            <TabButton active={activeTabs.includes('partiallyPaid')} onClick={() => toggleTab('partiallyPaid')}>Partially Paid</TabButton>
            <TabButton active={activeTabs.includes('paid')} onClick={() => toggleTab('paid')}>Paid in Full</TabButton>
            <TabButton active={activeTabs.includes('exception')} onClick={() => toggleTab('exception')}>Exception</TabButton>
            <TabButton active={activeTabs.includes('hold')} onClick={() => toggleTab('hold')}>Payment Hold</TabButton>
            <TabButton active={activeTabs.includes('void')} onClick={() => toggleTab('void')}>Cancelled/Voided</TabButton>
          </div>
        </div>
      </div>
      {/* Filter Drawer */}
      {isFilterOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsFilterOpen(false)}
          />
          
          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Advanced Filters</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  onClick={() => setIsFilterOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 text-sm"
                onClick={() => setShowSavedViewsDialog(true)}
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Saved Views
              </Button>
            </div>
            
            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Date Range Filter */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-gray-100 rounded">
                    <Calendar className="w-4 h-4 text-gray-600" />
                  </div>
                  <Label className="text-sm font-semibold text-gray-800">Date Range</Label>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-1.5 block">From Date</Label>
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                      className="h-9 text-sm bg-white border-gray-300"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700 mb-1.5 block">To Date</Label>
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                      className="h-9 text-sm bg-white border-gray-300"
                    />
                  </div>
                </div>
              </div>
              
              {/* Type Filter */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-gray-100 rounded">
                    <FileText className="w-4 h-4 text-gray-600" />
                  </div>
                  <Label className="text-sm font-semibold text-gray-800">Invoice Type</Label>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setTypeDropdownOpen(!typeDropdownOpen);
                      setStatusDropdownOpen(false);
                      setUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-md text-sm hover:border-gray-400 transition-colors"
                  >
                    <span className="text-gray-700">
                      {filters.types.length > 0 ? `${filters.types.length} selected` : 'Select types...'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  {filters.types.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {filters.types.map(type => (
                        <span key={type} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                          {type}
                          <X className="w-3 h-3 cursor-pointer hover:text-gray-900" onClick={() => {
                            setFilters({...filters, types: filters.types.filter(t => t !== type)});
                          }} />
                        </span>
                      ))}
                    </div>
                  )}
                  {typeDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-20 max-h-64 overflow-hidden">
                      <div className="p-2 border-b border-gray-200">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <Input
                            placeholder="Search types..."
                            className="h-8 text-sm pl-7 border-gray-300"
                            value={typeSearch}
                            onChange={(e) => setTypeSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {[
                          { value: 'PO-based', icon: FileText },
                          { value: 'Receiving-based', icon: Package },
                          { value: 'Standalone', icon: Calculator },
                          { value: 'Pre-Invoice', icon: FileText }
                        ]
                          .filter(type => type.value.toLowerCase().includes(typeSearch.toLowerCase()))
                          .map(type => {
                            const Icon = type.icon;
                            return (
                              <label
                                key={type.value}
                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                              >
                                <Checkbox
                                  checked={filters.types.includes(type.value)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFilters({...filters, types: [...filters.types, type.value]});
                                    } else {
                                      setFilters({...filters, types: filters.types.filter(t => t !== type.value)});
                                    }
                                  }}
                                />
                                <div className="p-1.5 bg-gray-100 rounded">
                                  <Icon className="w-3.5 h-3.5 text-gray-600" />
                                </div>
                                <span className="text-sm text-gray-700 font-medium">{type.value}</span>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Status Filter */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-gray-100 rounded">
                    <Check className="w-4 h-4 text-gray-600" />
                  </div>
                  <Label className="text-sm font-semibold text-gray-800">Status</Label>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setStatusDropdownOpen(!statusDropdownOpen);
                      setTypeDropdownOpen(false);
                      setUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-md text-sm hover:border-gray-400 transition-colors"
                  >
                    <span className="text-gray-700">
                      {filters.statuses.length > 0 ? `${filters.statuses.length} selected` : 'Select statuses...'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  {filters.statuses.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {filters.statuses.map(status => {
                        const statusColors: Record<string, string> = {
                          'Pending Approval': 'bg-yellow-50 text-yellow-700',
                          'Approved': 'bg-green-50 text-green-700',
                          'Partially Paid': 'bg-blue-100 text-blue-700',
                          'Paid': 'bg-green-50 text-green-700',
                          'Exception': 'bg-red-50 text-red-700',
                          'Payment Hold': 'bg-red-50 text-red-700',
                          'Cancelled': 'bg-gray-100 text-gray-700'
                        };
                        return (
                          <span key={status} className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-700'}`}>
                            {status}
                            <X className="w-3 h-3 cursor-pointer" onClick={() => {
                              setFilters({...filters, statuses: filters.statuses.filter(s => s !== status)});
                            }} />
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {statusDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-20 max-h-64 overflow-hidden">
                      <div className="p-2 border-b border-gray-200">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <Input
                            placeholder="Search statuses..."
                            className="h-8 text-sm pl-7 border-gray-300"
                            value={statusSearch}
                            onChange={(e) => setStatusSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {[
                          { value: 'Pending Approval', color: 'bg-yellow-50 text-yellow-700' },
                          { value: 'Approved', color: 'bg-green-50 text-green-700' },
                          { value: 'Partially Paid', color: 'bg-blue-100 text-blue-700' },
                          { value: 'Paid', color: 'bg-green-50 text-green-700' },
                          { value: 'Exception', color: 'bg-red-50 text-red-700' },
                          { value: 'Payment Hold', color: 'bg-red-50 text-red-700' },
                          { value: 'Cancelled', color: 'bg-gray-100 text-gray-700' }
                        ]
                          .filter(status => status.value.toLowerCase().includes(statusSearch.toLowerCase()))
                          .map(status => (
                            <label
                              key={status.value}
                              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                              <Checkbox
                                checked={filters.statuses.includes(status.value)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setFilters({...filters, statuses: [...filters.statuses, status.value]});
                                  } else {
                                    setFilters({...filters, statuses: filters.statuses.filter(s => s !== status.value)});
                                  }
                                }}
                              />
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                                {status.value}
                              </span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Created By Filter */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-gray-100 rounded">
                    <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                    </svg>
                  </div>
                  <Label className="text-sm font-semibold text-gray-800">Created By</Label>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(!userDropdownOpen);
                      setTypeDropdownOpen(false);
                      setStatusDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-md text-sm hover:border-gray-400 transition-colors"
                  >
                    <span className="text-gray-700">
                      {filters.createdBy.length > 0 ? `${filters.createdBy.length} selected` : 'Select users...'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  {filters.createdBy.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {filters.createdBy.map(user => {
                        const initials = user.split(' ').map(n => n[0]).join('');
                        const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
                        const color = colors[user.length % colors.length];
                        return (
                          <span key={user} className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                            <div className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-white text-[10px] font-semibold`}>
                              {initials}
                            </div>
                            {user}
                            <X className="w-3 h-3 cursor-pointer hover:text-gray-900" onClick={() => {
                              setFilters({...filters, createdBy: filters.createdBy.filter(u => u !== user)});
                            }} />
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {userDropdownOpen && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-20 max-h-64 overflow-hidden">
                      <div className="p-2 border-b border-gray-200">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <Input
                            placeholder="Search users..."
                            className="h-8 text-sm pl-7 border-gray-300"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {[
                          { name: 'John Smith', email: 'john.smith@omne.com' },
                          { name: 'Sarah Johnson', email: 'sarah.j@omne.com' },
                          { name: 'Mike Wilson', email: 'mike.w@omne.com' },
                          { name: 'Emily Brown', email: 'emily.b@omne.com' },
                          { name: 'David Lee', email: 'david.lee@omne.com' },
                          { name: 'Jessica Martinez', email: 'jess.m@omne.com' },
                          { name: 'Robert Chen', email: 'robert.c@omne.com' },
                          { name: 'Amanda White', email: 'amanda.w@omne.com' }
                        ]
                          .filter(user => 
                            user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                            user.email.toLowerCase().includes(userSearch.toLowerCase())
                          )
                          .map(user => {
                            const initials = user.name.split(' ').map(n => n[0]).join('');
                            const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-rose-500', 'bg-teal-500'];
                            const color = colors[user.name.length % colors.length];
                            return (
                              <label
                                key={user.name}
                                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                              >
                                <Checkbox
                                  checked={filters.createdBy.includes(user.name)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setFilters({...filters, createdBy: [...filters.createdBy, user.name]});
                                    } else {
                                      setFilters({...filters, createdBy: filters.createdBy.filter(u => u !== user.name)});
                                    }
                                  }}
                                />
                                <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-semibold`}>
                                  {initials}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                  <div className="text-xs text-gray-500 truncate">{user.email}</div>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Drawer Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={clearFilters}
                className="text-gray-600 hover:text-gray-900"
              >
                Clear All
              </Button>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsFilterOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm"
                  onClick={() => setIsFilterOpen(false)}
                  className="bg-[#2563eb] hover:bg-[#1d4ed8]"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Data Display - Table or Card View */}
      {densityMode === 'card' ? (
        // Card View
        <div className="flex-1 overflow-auto bg-gray-50 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => onViewInvoice(invoice.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedInvoices.includes(invoice.id)}
                      onCheckedChange={() => toggleSelectInvoice(invoice.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm font-semibold text-gray-900">{invoice.invoiceNumber}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4 text-gray-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={(e) => handleViewDetails(invoice.id, e)} className="cursor-pointer">
                        <Eye className="w-4 h-4 mr-2 text-gray-600" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleEditInvoice(invoice.id, e)} className="cursor-pointer">
                        <Edit3 className="w-4 h-4 mr-2 text-gray-600" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleReconcileInvoice(invoice.id, e)} className="cursor-pointer">
                        <GitCompare className="w-4 h-4 mr-2 text-gray-600" />
                        Reconcile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleAddPrepayment(invoice.id, e)} className="cursor-pointer">
                        <DollarSign className="w-4 h-4 mr-2 text-gray-600" />
                        Add Prepayment
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleDownloadInvoice(invoice.id, e)} className="cursor-pointer">
                        <Download className="w-4 h-4 mr-2 text-gray-600" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => handleVoidInvoice(invoice.id, e)} 
                        className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        Void
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <TypeBadge type={invoice.type} />
                  </div>
                  
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {invoice.vendor}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{invoice.date}</span>
                    <span className="text-gray-400">→</span>
                    <span>{invoice.dueDate}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="text-lg font-semibold text-gray-900">
                    ${invoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <StatusBadge status={invoice.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Table View with Advanced Features
        <AdvancedInvoiceTable
          invoices={paginatedInvoices}
          selectedInvoices={selectedInvoices}
          onToggleSelect={toggleSelectInvoice}
          onToggleSelectAll={toggleSelectAll}
          onViewInvoice={onViewInvoice}
          onEditInvoice={handleEditInvoice}
          onDownload={handleDownload}
          onVoid={handleVoidInvoice}
          onAddPayment={handleAddPayment}
          onMatch={handleMatchInvoice}
          densityMode={densityMode}
          TypeBadge={TypeBadge}
          StatusBadge={StatusBadge}
        />
      )}
      
      {/* Pagination Footer */}
      <div className="px-6 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredInvoices.length)}</span> of <span className="font-medium">{filteredInvoices.length}</span> records
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-gray-600 whitespace-nowrap">Records per page:</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-16 text-sm border-gray-300"
                  >
                    {recordsPerPage}
                    <ChevronDown className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => handleRecordsPerPageChange(10)}>
                    <span className="text-sm">10</span>
                    {recordsPerPage === 10 && <Check className="w-4 h-4 ml-auto text-blue-600" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleRecordsPerPageChange(20)}>
                    <span className="text-sm">20</span>
                    {recordsPerPage === 20 && <Check className="w-4 h-4 ml-auto text-blue-600" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleRecordsPerPageChange(50)}>
                    <span className="text-sm">50</span>
                    {recordsPerPage === 50 && <Check className="w-4 h-4 ml-auto text-blue-600" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleRecordsPerPageChange(100)}>
                    <span className="text-sm">100</span>
                    {recordsPerPage === 100 && <Check className="w-4 h-4 ml-auto text-blue-600" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-sm border-gray-300"
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <div className="flex items-center gap-2">
              {getPaginationButtons().map((page, index) => (
                <Button
                  key={index}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  className={`h-8 w-8 text-sm ${
                    page === currentPage 
                      ? 'bg-blue-600 text-white hover:bg-blue-700' 
                      : 'border-gray-300'
                  }`}
                  onClick={() => typeof page === 'number' && goToPage(page)}
                  disabled={page === '...'}
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-sm border-gray-300"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {/* Bulk Action Dialog */}
      <BulkActionDialog
        open={showBulkActionDialog}
        onOpenChange={setShowBulkActionDialog}
        actionType={bulkActionType}
        selectedCount={selectedInvoices.length}
        onConfirm={handleBulkActionConfirm}
      />

      {/* Saved Views Dialog */}
      <SavedViewsDialog
        open={showSavedViewsDialog}
        onOpenChange={setShowSavedViewsDialog}
        currentFilters={filters}
        onApplyView={handleApplySavedView}
      />

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        recordCount={selectedInvoices.length > 0 ? selectedInvoices.length : filteredInvoices.length}
        recordType="invoice"
      />
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-sm' 
          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function TypeBadge({ type }: { type: Invoice['type'] }) {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-800';
  let label = type;

  switch (type) {
    case 'standard':
      bgColor = 'bg-blue-50';
      textColor = 'text-blue-700';
      label = 'Standard';
      break;
    case 'prepayment':
      bgColor = 'bg-purple-50';
      textColor = 'text-purple-700';
      label = 'Prepayment';
      break;
    case 'creditMemo':
      bgColor = 'bg-orange-50';
      textColor = 'text-orange-700';
      label = 'Credit Memo';
      break;
    case 'debitMemo':
      bgColor = 'bg-red-50';
      textColor = 'text-red-700';
      label = 'Debit Memo';
      break;
  }

  return (
    <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${bgColor} ${textColor}`}>
      {label}
    </div>
  );
}

function StatusBadge({ status }: { status: Invoice['status'] }) {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-800';
  let label = status;

  switch (status) {
    case 'pending':
      bgColor = 'bg-yellow-50';
      textColor = 'text-yellow-700';
      label = 'Pending';
      break;
    case 'approved':
      bgColor = 'bg-green-50';
      textColor = 'text-green-700';
      label = 'Approved';
      break;
    case 'paid':
      bgColor = 'bg-blue-50';
      textColor = 'text-blue-700';
      label = 'Paid';
      break;
    case 'partial':
      bgColor = 'bg-purple-50';
      textColor = 'text-purple-700';
      label = 'Partial';
      break;
    case 'void':
      bgColor = 'bg-red-50';
      textColor = 'text-red-700';
      label = 'Void';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}>
      {label}
    </span>
  );
}