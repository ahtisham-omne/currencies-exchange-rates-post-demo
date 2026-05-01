import { useState } from 'react';
import { Plus, Search, Filter, ChevronDown, MoreHorizontal, AlignJustify, LayoutGrid, Check, ChevronLeft, ChevronRight, Eye, Edit3, Download, Ban, DollarSign, GitCompare } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
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
import { Checkbox } from '@/app/components/ui/checkbox';
import { mockPrepayments, Prepayment } from '@/app/data/mockPrepayments';
import { toast } from 'sonner';

type DensityMode = 'condensed' | 'comfort' | 'relaxed' | 'card';

export function PrepaymentsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabs, setActiveTabs] = useState<string[]>(['all']);
  const [densityMode, setDensityMode] = useState<DensityMode>('comfort');
  const [selectedPrepayments, setSelectedPrepayments] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(50);

  const filteredPrepayments = mockPrepayments.filter(prep => {
    // Filter by tabs (multi-select)
    if (!activeTabs.includes('all')) {
      const statusMatch = activeTabs.some(tab => {
        if (tab === 'active') return prep.status === 'Active';
        if (tab === 'partial') return prep.status === 'Partial';
        if (tab === 'applied') return prep.status === 'Applied';
        return false;
      });
      
      if (!statusMatch) return false;
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        prep.prepaymentNumber.toLowerCase().includes(query) ||
        prep.vendor.toLowerCase().includes(query) ||
        prep.poNumber?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Calculate KPIs
  const totalAmount = mockPrepayments.reduce((sum, prep) => sum + prep.originalAmount, 0);
  const totalCount = mockPrepayments.length;
  
  const appliedAmount = mockPrepayments.reduce((sum, prep) => sum + prep.appliedAmount, 0);
  const fullyAppliedCount = mockPrepayments.filter(prep => prep.status === 'Applied').length;
  
  const remainingAmount = mockPrepayments.reduce((sum, prep) => sum + prep.remainingBalance, 0);
  const partialCount = mockPrepayments.filter(prep => prep.status === 'Partial').length;
  
  const availableCount = mockPrepayments.filter(prep => prep.status === 'Active').length;

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedPrepayments.length === filteredPrepayments.length && filteredPrepayments.length > 0) {
      setSelectedPrepayments([]);
    } else {
      setSelectedPrepayments(filteredPrepayments.map(prep => prep.id));
    }
  };

  const toggleSelectPrepayment = (id: string) => {
    if (selectedPrepayments.includes(id)) {
      setSelectedPrepayments(selectedPrepayments.filter(prepId => prepId !== id));
    } else {
      setSelectedPrepayments([...selectedPrepayments, id]);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredPrepayments.length / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedPrepayments = filteredPrepayments.slice(startIndex, endIndex);

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

  const handleRecordsPerPageChange = (value: number) => {
    setRecordsPerPage(value);
    setCurrentPage(1);
  };

  // Toggle tab selection (multi-select)
  const toggleTab = (tab: string) => {
    if (tab === 'all') {
      setActiveTabs(['all']);
    } else {
      setActiveTabs(prev => {
        // Remove 'all' if selecting a specific tab
        const withoutAll = prev.filter(t => t !== 'all');
        
        if (withoutAll.includes(tab)) {
          // Deselecting a tab
          const newTabs = withoutAll.filter(t => t !== tab);
          // If no tabs selected, default to 'all'
          return newTabs.length === 0 ? ['all'] : newTabs;
        } else {
          // Adding a tab
          return [...withoutAll, tab];
        }
      });
    }
  };

  // Prepayment action handlers
  const handleViewDetails = (prepaymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const prepayment = mockPrepayments.find(p => p.id === prepaymentId);
    toast.info('Opening prepayment details', {
      description: prepayment?.prepaymentNumber || prepaymentId
    });
  };

  const handleEditPrepayment = (prepaymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.info('Edit mode enabled', {
      description: 'You can now modify prepayment details.'
    });
  };

  const handleReconcile = (prepaymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success('Reconciliation complete', {
      description: 'Prepayment has been reconciled with vendor records.'
    });
  };

  const handleApplyToInvoice = (prepaymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const prepayment = mockPrepayments.find(p => p.id === prepaymentId);
    if (prepayment && prepayment.remainingBalance > 0) {
      toast.info('Applying prepayment', {
        description: `$${prepayment.remainingBalance.toLocaleString()} available to apply`
      });
    } else {
      toast.error('No balance available', {
        description: 'This prepayment has been fully applied.'
      });
    }
  };

  const handleDownload = (prepaymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success('Download started', {
      description: 'Prepayment document is being downloaded...'
    });
  };

  const handleVoid = (prepaymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success('Prepayment voided', {
      description: 'The prepayment has been voided successfully.'
    });
  };

  // Bulk action handlers
  const handleBulkApply = () => {
    if (selectedPrepayments.length === 0) {
      toast.error('No prepayments selected', {
        description: 'Please select at least one prepayment.'
      });
      return;
    }
    toast.info('Bulk application', {
      description: `Applying ${selectedPrepayments.length} prepayment${selectedPrepayments.length > 1 ? 's' : ''} to invoices...`
    });
  };

  const handleBulkExport = () => {
    if (selectedPrepayments.length === 0) {
      toast.error('No prepayments selected', {
        description: 'Please select at least one prepayment to export.'
      });
      return;
    }
    toast.success('Exporting prepayments', {
      description: `Exporting ${selectedPrepayments.length} record${selectedPrepayments.length > 1 ? 's' : ''}...`
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#fafafa]">
      {/* Header Section */}
      <div className="px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 mb-0.5">Vendor Prepayments</h1>
            <p className="text-xs text-gray-500">
              Manage advance payments and track application to invoices
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-xs border-gray-300 hover:bg-gray-50"
                  disabled={selectedPrepayments.length === 0}
                >
                  Actions
                  <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
                  {selectedPrepayments.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {selectedPrepayments.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleBulkApply}>
                  <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                  Apply to Invoices
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkExport}>
                  <Download className="w-4 h-4 mr-2 text-gray-600" />
                  Export Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex">
              <Button size="sm" className="h-8 text-xs bg-[#2563eb] hover:bg-[#1d4ed8] rounded-r-none">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Create Prepayment
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="h-8 w-8 bg-[#2563eb] hover:bg-[#1d4ed8] rounded-l-none border-l border-blue-400 p-0">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Create from Scratch</DropdownMenuItem>
                  <DropdownMenuItem>Create from PO</DropdownMenuItem>
                  <DropdownMenuItem>Import Prepayment</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white border border-gray-200 rounded p-2">
            <div className="flex items-start gap-1.5">
              <div className="p-1 bg-blue-50 rounded">
                <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-500 mb-0.5">Total Prepaid</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-base font-semibold text-gray-900 leading-tight">${(totalAmount / 1000).toFixed(0)}k</div>
                  <div className="text-[10px] text-gray-500 truncate">{totalCount} prepayments</div>
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
                <div className="text-[10px] text-gray-500 mb-0.5">Applied</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-base font-semibold text-green-600 leading-tight">${(appliedAmount / 1000).toFixed(0)}k</div>
                  <div className="text-[10px] text-gray-500 truncate">{fullyAppliedCount} applied</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded p-2">
            <div className="flex items-start gap-1.5">
              <div className="p-1 bg-yellow-50 rounded">
                <svg className="w-3 h-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-500 mb-0.5">Remaining</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-base font-semibold text-yellow-600 leading-tight">${(remainingAmount / 1000).toFixed(0)}k</div>
                  <div className="text-[10px] text-gray-500 truncate">{partialCount} partial</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded p-2">
            <div className="flex items-start gap-1.5">
              <div className="p-1 bg-purple-50 rounded">
                <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-500 mb-0.5">Available</div>
                <div className="flex items-baseline gap-1.5">
                  <div className="text-base font-semibold text-purple-600 leading-tight">{availableCount}</div>
                  <div className="text-[10px] text-gray-500 truncate">{availableCount} active prepayments</div>
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
                placeholder="Search by prepayment #, vendor, or PO..."
                className="pl-9 h-9 text-sm border-gray-300 bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" className="h-9 text-sm border-gray-300 bg-white hover:bg-gray-50">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{filteredPrepayments.length} Prepayments</span>
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
            <TabButton active={activeTabs.includes('active')} onClick={() => toggleTab('active')}>Active</TabButton>
            <TabButton active={activeTabs.includes('partial')} onClick={() => toggleTab('partial')}>Partial</TabButton>
            <TabButton active={activeTabs.includes('applied')} onClick={() => toggleTab('applied')}>Applied</TabButton>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <Table>
          <TableHeader className="sticky top-0 z-10">
            <TableRow className={`border-b border-gray-200 bg-gray-50 hover:bg-gray-50 ${
              densityMode === 'condensed' ? 'h-10' : densityMode === 'relaxed' ? 'h-16' : 'h-12'
            }`}>
              <TableHead className="w-[50px] bg-gray-50">
                <Checkbox 
                  checked={selectedPrepayments.length === filteredPrepayments.length && filteredPrepayments.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className={`text-xs font-medium text-gray-700 uppercase bg-gray-50 ${
                densityMode === 'condensed' ? 'text-[10px]' : 'text-xs'
              }`}>Prepayment #</TableHead>
              <TableHead className={`text-xs font-medium text-gray-700 uppercase bg-gray-50 ${
                densityMode === 'condensed' ? 'text-[10px]' : 'text-xs'
              }`}>Vendor</TableHead>
              <TableHead className={`text-xs font-medium text-gray-700 uppercase bg-gray-50 ${
                densityMode === 'condensed' ? 'text-[10px]' : 'text-xs'
              }`}>PO Number</TableHead>
              <TableHead className={`text-xs font-medium text-gray-700 uppercase bg-gray-50 ${
                densityMode === 'condensed' ? 'text-[10px]' : 'text-xs'
              }`}>Date</TableHead>
              <TableHead className={`text-xs font-medium text-gray-700 uppercase text-right bg-gray-50 ${
                densityMode === 'condensed' ? 'text-[10px]' : 'text-xs'
              }`}>Original Amount</TableHead>
              <TableHead className={`text-xs font-medium text-gray-700 uppercase text-right bg-gray-50 ${
                densityMode === 'condensed' ? 'text-[10px]' : 'text-xs'
              }`}>Applied</TableHead>
              <TableHead className={`text-xs font-medium text-gray-700 uppercase text-right bg-gray-50 ${
                densityMode === 'condensed' ? 'text-[10px]' : 'text-xs'
              }`}>Remaining</TableHead>
              <TableHead className={`text-xs font-medium text-gray-700 uppercase bg-gray-50 ${
                densityMode === 'condensed' ? 'text-[10px]' : 'text-xs'
              }`}>Status</TableHead>
              <TableHead className={`text-xs font-medium text-gray-700 uppercase bg-gray-50 ${
                densityMode === 'condensed' ? 'text-[10px]' : 'text-xs'
              }`}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPrepayments.map((prepayment) => (
              <TableRow key={prepayment.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                <TableCell 
                  onClick={(e) => e.stopPropagation()} 
                  className={
                    densityMode === 'condensed' ? 'py-2' : 
                    densityMode === 'relaxed' ? 'py-6' : 
                    'py-4'
                  }
                >
                  <Checkbox 
                    checked={selectedPrepayments.includes(prepayment.id)}
                    onCheckedChange={() => toggleSelectPrepayment(prepayment.id)}
                  />
                </TableCell>
                <TableCell className={`text-sm font-medium text-gray-900 ${
                  densityMode === 'condensed' ? 'py-2 text-xs' : 
                  densityMode === 'relaxed' ? 'py-6' : 
                  'py-4'
                }`}>{prepayment.prepaymentNumber}</TableCell>
                <TableCell className={`text-sm text-gray-900 ${
                  densityMode === 'condensed' ? 'py-2 text-xs' : 
                  densityMode === 'relaxed' ? 'py-6' : 
                  'py-4'
                }`}>{prepayment.vendor}</TableCell>
                <TableCell className={`text-sm text-gray-600 ${
                  densityMode === 'condensed' ? 'py-2 text-xs' : 
                  densityMode === 'relaxed' ? 'py-6' : 
                  'py-4'
                }`}>
                  {prepayment.poNumber || '—'}
                </TableCell>
                <TableCell className={`text-sm text-gray-900 ${
                  densityMode === 'condensed' ? 'py-2 text-xs' : 
                  densityMode === 'relaxed' ? 'py-6' : 
                  'py-4'
                }`}>{prepayment.date}</TableCell>
                <TableCell className={`text-sm text-right font-semibold text-gray-900 ${
                  densityMode === 'condensed' ? 'py-2 text-xs' : 
                  densityMode === 'relaxed' ? 'py-6' : 
                  'py-4'
                }`}>
                  ${prepayment.originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className={`text-sm text-right font-medium text-green-600 ${
                  densityMode === 'condensed' ? 'py-2 text-xs' : 
                  densityMode === 'relaxed' ? 'py-6' : 
                  'py-4'
                }`}>
                  ${prepayment.appliedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className={`text-sm text-right font-medium text-blue-600 ${
                  densityMode === 'condensed' ? 'py-2 text-xs' : 
                  densityMode === 'relaxed' ? 'py-6' : 
                  'py-4'
                }`}>
                  ${prepayment.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className={
                  densityMode === 'condensed' ? 'py-2' : 
                  densityMode === 'relaxed' ? 'py-6' : 
                  'py-4'
                }>
                  <StatusBadge status={prepayment.status} />
                </TableCell>
                <TableCell 
                  onClick={(e) => e.stopPropagation()}
                  className={
                    densityMode === 'condensed' ? 'py-2' : 
                    densityMode === 'relaxed' ? 'py-6' : 
                    'py-4'
                  }
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100">
                        <MoreHorizontal className="w-4 h-4 text-gray-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={(e) => handleViewDetails(prepayment.id, e)} className="cursor-pointer">
                        <Eye className="w-4 h-4 mr-2 text-gray-600" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleEditPrepayment(prepayment.id, e)} className="cursor-pointer">
                        <Edit3 className="w-4 h-4 mr-2 text-gray-600" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleReconcile(prepayment.id, e)} className="cursor-pointer">
                        <GitCompare className="w-4 h-4 mr-2 text-gray-600" />
                        Reconcile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleApplyToInvoice(prepayment.id, e)} className="cursor-pointer">
                        <DollarSign className="w-4 h-4 mr-2 text-gray-600" />
                        Apply to Invoice
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleDownload(prepayment.id, e)} className="cursor-pointer">
                        <Download className="w-4 h-4 mr-2 text-gray-600" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => handleVoid(prepayment.id, e)} 
                        className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Ban className="w-4 h-4 mr-2" />
                        Void
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-gray-300 bg-white hover:bg-gray-50"
              onClick={goToPreviousPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-gray-300 bg-white hover:bg-gray-50"
              onClick={goToNextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500">Records per page:</div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-gray-300 bg-white hover:bg-gray-50"
                >
                  {recordsPerPage}
                  <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleRecordsPerPageChange(10)}>10</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleRecordsPerPageChange(20)}>20</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleRecordsPerPageChange(50)}>50</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleRecordsPerPageChange(100)}>100</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
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
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: Prepayment['status'] }) {
  const variants: Record<Prepayment['status'], { bg: string; text: string }> = {
    'Active': { bg: 'bg-green-100', text: 'text-green-700' },
    'Partial': { bg: 'bg-orange-100', text: 'text-orange-700' },
    'Applied': { bg: 'bg-gray-100', text: 'text-gray-700' }
  };

  const variant = variants[status];

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${variant.bg} ${variant.text}`}>
      {status}
    </span>
  );
}