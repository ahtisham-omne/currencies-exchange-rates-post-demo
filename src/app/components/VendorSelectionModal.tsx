import { useState, useMemo } from 'react';
import { X, Search, ChevronRight, ChevronDown, Maximize2, Minimize2, ShoppingCart, Package, Building2, GripVertical } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Checkbox } from '@/app/components/ui/checkbox';
import { mockVendors, Vendor, VendorPO, VendorGRN } from '@/app/data/mockVendors';
import { VIMoneyCell } from '@/app/components/currency/VIMoneyCell';

interface VendorSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinueWithPOs: (selectedPOs: SelectedPOData[]) => void;
}

export interface SelectedPOData {
  vendorCode: string;
  vendorName: string;
  vendorCategory: string;
  currency: string;
  paymentTerms: string;
  poNumber: string;
  poDate: string;
  poAmount: number;
  poStatus: string;
  itemCount: number;
}

type FilterType = 'all' | 'withPOs' | 'withGRNs';

export function VendorSelectionModal({ isOpen, onClose, onContinueWithPOs }: VendorSelectionModalProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
  const [selectedPOs, setSelectedPOs] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<FilterType>('all');

  if (!isOpen) return null;

  const toggleVendor = (vendorId: string) => {
    const newExpanded = new Set(expandedVendors);
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId);
    } else {
      newExpanded.add(vendorId);
    }
    setExpandedVendors(newExpanded);
  };

  const togglePO = (poKey: string) => {
    const newExpanded = new Set(expandedPOs);
    if (newExpanded.has(poKey)) {
      newExpanded.delete(poKey);
    } else {
      newExpanded.add(poKey);
    }
    setExpandedPOs(newExpanded);
  };

  const togglePOSelection = (poKey: string) => {
    const newSelected = new Set(selectedPOs);
    if (newSelected.has(poKey)) {
      newSelected.delete(poKey);
    } else {
      newSelected.add(poKey);
    }
    setSelectedPOs(newSelected);
  };

  const selectAllVendorPOs = (vendor: Vendor, select: boolean) => {
    const newSelected = new Set(selectedPOs);
    vendor.purchaseOrders.forEach(po => {
      const poKey = `${vendor.vendorCode}-${po.poNumber}`;
      if (select) {
        newSelected.add(poKey);
      } else {
        newSelected.delete(poKey);
      }
    });
    setSelectedPOs(newSelected);
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 text-gray-900 font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const filteredVendors = useMemo(() => {
    let vendors = mockVendors;

    // Apply filter type
    if (filterType === 'withPOs') {
      vendors = vendors.filter(v => v.purchaseOrders.length > 0);
    } else if (filterType === 'withGRNs') {
      vendors = vendors.filter(v => v.receivingDocuments.length > 0);
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      vendors = vendors.filter(vendor => 
        vendor.vendorName.toLowerCase().includes(query) ||
        vendor.vendorCode.toLowerCase().includes(query) ||
        vendor.category.toLowerCase().includes(query) ||
        vendor.purchaseOrders.some(po => po.poNumber.toLowerCase().includes(query)) ||
        vendor.receivingDocuments.some(grn => grn.grnNumber.toLowerCase().includes(query))
      );
    }

    return vendors;
  }, [searchQuery, filterType]);

  const handleContinue = () => {
    const selectedPOsData: SelectedPOData[] = [];
    
    filteredVendors.forEach(vendor => {
      vendor.purchaseOrders.forEach(po => {
        const poKey = `${vendor.vendorCode}-${po.poNumber}`;
        if (selectedPOs.has(poKey)) {
          selectedPOsData.push({
            vendorCode: vendor.vendorCode,
            vendorName: vendor.vendorName,
            vendorCategory: vendor.category,
            currency: vendor.currency,
            paymentTerms: vendor.paymentTerms,
            poNumber: po.poNumber,
            poDate: po.poDate,
            poAmount: po.poAmount,
            poStatus: po.status,
            itemCount: po.itemCount
          });
        }
      });
    });

    onContinueWithPOs(selectedPOsData);
  };

  const modalClasses = isFullScreen
    ? "fixed inset-0 z-50 bg-white"
    : "fixed inset-4 z-50 bg-white rounded-lg shadow-2xl max-w-[95vw] mx-auto my-auto max-h-[95vh]";

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={modalClasses}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Select Purchase Orders for Invoice</h2>
                <p className="text-sm text-gray-600 mt-1">Search and select one or more purchase orders from vendors. Receiving documents are shown for reference only.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="h-9 px-3"
                >
                  {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-9 w-9 p-0"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search vendors, vendor codes, categories, PO numbers, or receiving document numbers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={filterType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('all')}
                  className="h-10"
                >
                  All Vendors
                </Button>
                <Button
                  variant={filterType === 'withPOs' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('withPOs')}
                  className="h-10"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  With POs
                </Button>
                <Button
                  variant={filterType === 'withGRNs' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('withGRNs')}
                  className="h-10"
                >
                  <Package className="w-4 h-4 mr-2" />
                  With Receiving Docs
                </Button>
              </div>
            </div>

            {/* Results Count */}
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold text-gray-900">{filteredVendors.length}</span> vendors
                {searchQuery && (
                  <span> matching "<span className="font-semibold text-gray-900">{searchQuery}</span>"</span>
                )}
              </div>
              {selectedPOs.size > 0 && (
                <div className="text-sm font-medium text-blue-600">
                  {selectedPOs.size} PO{selectedPOs.size !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-hidden bg-white relative">
            {filteredVendors.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Building2 className="w-16 h-16 mb-4 text-gray-300" />
                <p className="text-lg font-medium">No vendors found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="overflow-auto h-full">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-20 bg-gray-50">
                    {/* First Level - Group Headers */}
                    <tr className="border-b-2 border-gray-300">
                      {/* Sticky Select Column - Left */}
                      <th className="sticky left-0 z-30 bg-gray-50 border-r border-gray-200 w-[50px]" rowSpan={2}>
                        <div className="flex items-center justify-center px-3 h-full">
                          <span className="text-xs font-medium text-gray-700 uppercase">Select</span>
                        </div>
                      </th>
                      
                      {/* Sticky Expand Column */}
                      <th className="sticky left-[50px] z-30 bg-gray-50 border-r border-gray-200 w-[60px] shadow-[2px_0_4px_rgba(0,0,0,0.08)]" rowSpan={2}>
                        <div className="px-3 py-2">
                          <span className="text-xs font-medium text-gray-700 uppercase">View</span>
                        </div>
                      </th>

                      {/* Vendor Section Header */}
                      <th colSpan={4} className="bg-blue-50 border-r-2 border-gray-300">
                        <div className="flex items-center gap-2 px-4 py-2">
                          <Building2 className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">Vendor Information</span>
                        </div>
                      </th>

                      {/* Purchase Order Section Header */}
                      <th colSpan={5} className="bg-green-50 border-r-2 border-gray-300">
                        <div className="flex items-center gap-2 px-4 py-2">
                          <ShoppingCart className="w-4 h-4 text-green-600" />
                          <span className="text-xs font-bold text-green-900 uppercase tracking-wide">Purchase Order Details</span>
                        </div>
                      </th>

                      {/* Receiving Documents Section Header */}
                      <th colSpan={4} className="bg-purple-50">
                        <div className="flex items-center gap-2 px-4 py-2">
                          <Package className="w-4 h-4 text-purple-600" />
                          <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">Receiving Documents (View Only)</span>
                        </div>
                      </th>
                    </tr>

                    {/* Second Level - Column Headers */}
                    <tr className="border-b border-gray-200 h-12">
                      {/* Vendor Columns */}
                      <th className="sticky left-[110px] z-30 bg-blue-50/50 text-left px-3 min-w-[220px] border-r border-gray-200 shadow-[2px_0_4px_rgba(0,0,0,0.08)]">
                        <span className="text-xs font-medium text-gray-700 uppercase">Vendor Name</span>
                      </th>
                      <th className="bg-blue-50/50 text-left px-3 min-w-[120px]">
                        <span className="text-xs font-medium text-gray-700 uppercase">Code</span>
                      </th>
                      <th className="bg-blue-50/50 text-left px-3 min-w-[140px]">
                        <span className="text-xs font-medium text-gray-700 uppercase">Category</span>
                      </th>
                      <th className="bg-blue-50/50 text-left px-3 min-w-[160px] border-r-2 border-gray-300">
                        <span className="text-xs font-medium text-gray-700 uppercase">Payment Terms</span>
                      </th>

                      {/* Purchase Order Columns */}
                      <th className="bg-green-50/50 text-left px-3 min-w-[140px]">
                        <span className="text-xs font-medium text-gray-700 uppercase">PO Number</span>
                      </th>
                      <th className="bg-green-50/50 text-left px-3 min-w-[120px]">
                        <span className="text-xs font-medium text-gray-700 uppercase">PO Date</span>
                      </th>
                      <th className="bg-green-50/50 text-left px-3 min-w-[140px]">
                        <span className="text-xs font-medium text-gray-700 uppercase">Amount</span>
                      </th>
                      <th className="bg-green-50/50 text-left px-3 min-w-[140px]">
                        <span className="text-xs font-medium text-gray-700 uppercase">Status</span>
                      </th>
                      <th className="bg-green-50/50 text-left px-3 min-w-[80px] border-r-2 border-gray-300">
                        <span className="text-xs font-medium text-gray-700 uppercase">Items</span>
                      </th>

                      {/* Receiving Document Columns */}
                      <th className="bg-purple-50/50 text-left px-3 min-w-[140px]">
                        <span className="text-xs font-medium text-gray-700 uppercase">Receiving Doc #</span>
                      </th>
                      <th className="bg-purple-50/50 text-left px-3 min-w-[120px]">
                        <span className="text-xs font-medium text-gray-700 uppercase">Received Date</span>
                      </th>
                      <th className="bg-purple-50/50 text-left px-3 min-w-[100px]">
                        <span className="text-xs font-medium text-gray-700 uppercase">Quantity</span>
                      </th>
                      <th className="bg-purple-50/50 text-left px-3 min-w-[140px]">
                        <span className="text-xs font-medium text-gray-700 uppercase">Status</span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredVendors.map((vendor) => (
                      <VendorTableRows
                        key={vendor.id}
                        vendor={vendor}
                        searchQuery={searchQuery}
                        isExpanded={expandedVendors.has(vendor.id)}
                        onToggle={() => toggleVendor(vendor.id)}
                        selectedPOs={selectedPOs}
                        onTogglePO={togglePOSelection}
                        onSelectAllPOs={selectAllVendorPOs}
                        highlightText={highlightText}
                        expandedPOs={expandedPOs}
                        onTogglePOExpand={togglePO}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{selectedPOs.size}</span> purchase order{selectedPOs.size !== 1 ? 's' : ''} selected from <span className="font-medium text-gray-900">{filteredVendors.length}</span> vendor{filteredVendors.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleContinue}
                  disabled={selectedPOs.size === 0}
                  className="min-w-[120px]"
                >
                  Continue ({selectedPOs.size})
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

interface VendorTableRowsProps {
  vendor: Vendor;
  searchQuery: string;
  isExpanded: boolean;
  onToggle: () => void;
  selectedPOs: Set<string>;
  onTogglePO: (poKey: string) => void;
  onSelectAllPOs: (vendor: Vendor, select: boolean) => void;
  highlightText: (text: string, query: string) => React.ReactNode;
  expandedPOs: Set<string>;
  onTogglePOExpand: (poKey: string) => void;
}

function VendorTableRows({
  vendor,
  searchQuery,
  isExpanded,
  onToggle,
  selectedPOs,
  onTogglePO,
  onSelectAllPOs,
  highlightText,
  expandedPOs,
  onTogglePOExpand
}: VendorTableRowsProps) {
  const allPOsSelected = vendor.purchaseOrders.length > 0 && 
    vendor.purchaseOrders.every(po => selectedPOs.has(`${vendor.vendorCode}-${po.poNumber}`));
  const somePOsSelected = vendor.purchaseOrders.some(po => 
    selectedPOs.has(`${vendor.vendorCode}-${po.poNumber}`)
  ) && !allPOsSelected;

  const statusColors: Record<string, string> = {
    'Open': 'bg-blue-50 text-blue-700 border-blue-200',
    'Partially Received': 'bg-amber-50 text-amber-700 border-amber-200',
    'Fully Received': 'bg-green-50 text-green-700 border-green-200',
    'Closed': 'bg-gray-50 text-gray-700 border-gray-200'
  };

  const grnStatusColors: Record<string, string> = {
    'Received': 'bg-blue-50 text-blue-700 border-blue-200',
    'Inspected': 'bg-purple-50 text-purple-700 border-purple-200',
    'Accepted': 'bg-green-50 text-green-700 border-green-200',
    'Partially Invoiced': 'bg-amber-50 text-amber-700 border-amber-200',
    'Fully Invoiced': 'bg-gray-50 text-gray-700 border-gray-200'
  };

  return (
    <>
      {/* Vendor Header Row */}
      <tr className={`border-b border-gray-200 h-12 transition-colors ${
        isExpanded 
          ? 'bg-blue-50/30 hover:bg-blue-50/40 border-b-2 border-blue-300' 
          : 'hover:bg-gray-50'
      }`}>
        {/* Sticky Select Checkbox - Left */}
        <td className={`sticky left-0 z-10 border-r border-gray-200 shadow-[2px_0_2px_rgba(0,0,0,0.05)] ${
          isExpanded ? 'bg-blue-50' : 'bg-white'
        }`}>
          <div className="flex items-center justify-center px-3">
            <Checkbox
              checked={allPOsSelected}
              onCheckedChange={(checked) => onSelectAllPOs(vendor, checked as boolean)}
              className={somePOsSelected ? 'data-[state=checked]:bg-blue-600' : ''}
            />
          </div>
        </td>

        {/* Sticky Expand Button */}
        <td className={`sticky left-[50px] z-10 border-r border-gray-200 shadow-[2px_0_2px_rgba(0,0,0,0.05)] ${
          isExpanded ? 'bg-blue-50' : 'bg-white'
        }`}>
          <div className="flex items-center justify-center px-3">
            <button
              onClick={onToggle}
              className={`flex items-center justify-center w-8 h-8 rounded transition-colors ${
                isExpanded ? 'bg-blue-100 hover:bg-blue-200' : 'hover:bg-gray-100'
              }`}
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-blue-600" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </td>

        {/* Vendor Information */}
        <td className={`sticky left-[110px] z-10 px-3 py-2 border-r border-gray-200 shadow-[2px_0_4px_rgba(0,0,0,0.08)] ${
          isExpanded ? 'bg-blue-50' : 'bg-white'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
              isExpanded ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              <Building2 className={`w-4 h-4 ${isExpanded ? 'text-blue-600' : 'text-gray-600'}`} />
            </div>
            <div className="font-semibold text-gray-900">
              {highlightText(vendor.vendorName, searchQuery)}
            </div>
          </div>
        </td>
        <td className="px-3 py-2">
          <span className="text-sm font-medium text-gray-700">
            {highlightText(vendor.vendorCode, searchQuery)}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className="text-sm text-gray-600">
            {highlightText(vendor.category, searchQuery)}
          </span>
        </td>
        <td className="px-3 py-2 border-r-2 border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-700">{vendor.currency}</span>
            <span className="text-gray-400">•</span>
            <span>{vendor.paymentTerms}</span>
          </div>
        </td>

        {/* Summary Counts */}
        <td colSpan={5} className="px-3 py-2 border-r-2 border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded border ${
              isExpanded 
                ? 'bg-green-100 border-green-300' 
                : 'bg-gray-100 border-gray-300'
            }`}>
              <span className={`text-sm font-semibold ${
                isExpanded ? 'text-green-900' : 'text-gray-700'
              }`}>{vendor.purchaseOrders.length} POs</span>
            </div>
            <div className={`px-3 py-1 rounded border ${
              isExpanded 
                ? 'bg-purple-100 border-purple-300' 
                : 'bg-gray-100 border-gray-300'
            }`}>
              <span className={`text-sm font-semibold ${
                isExpanded ? 'text-purple-900' : 'text-gray-700'
              }`}>{vendor.receivingDocuments.length} Receiving Docs</span>
            </div>
          </div>
        </td>

        {/* GRN Section Empty */}
        <td colSpan={4} className="px-3 py-2"></td>
      </tr>

      {/* Expanded PO Rows */}
      {isExpanded && vendor.purchaseOrders.map((po) => {
        const poKey = `${vendor.vendorCode}-${po.poNumber}`;
        const isSelected = selectedPOs.has(poKey);
        const isPOExpanded = expandedPOs.has(poKey);
        const relatedGRNs = vendor.receivingDocuments.filter(grn => grn.poNumber === po.poNumber);

        return (
          <tr 
            key={po.poNumber}
            onClick={() => onTogglePO(poKey)}
            className={`border-b border-gray-100 h-12 cursor-pointer transition-colors ${
              isSelected 
                ? 'bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-600' 
                : 'hover:bg-gray-50'
            }`}
          >
            {/* Sticky Select Checkbox - Left */}
            <td 
              className={`sticky left-0 z-10 border-r border-gray-100 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-center px-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onTogglePO(poKey)}
                />
              </div>
            </td>

            {/* Sticky Expand Column Empty */}
            <td className={`sticky left-[50px] z-10 border-r border-gray-100 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}>
              <div className="flex items-center justify-center px-3">
                <ShoppingCart className="w-4 h-4 text-green-600" />
              </div>
            </td>

            {/* Sticky Vendor Name */}
            <td className={`sticky left-[110px] z-10 px-3 py-2 border-r border-gray-200 shadow-[2px_0_4px_rgba(0,0,0,0.08)] ${isSelected ? 'bg-blue-50' : 'bg-white'}`}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3 h-3 text-gray-500" />
                </div>
                <div className="text-xs text-gray-600 font-medium truncate">
                  {vendor.vendorName}
                </div>
              </div>
            </td>

            {/* Other Vendor Columns */}
            <td className="px-3 py-2" colSpan={3}>
              <div className="text-xs text-gray-400 italic">
                Purchase Order #{po.poNumber}
              </div>
            </td>

            {/* PO Details */}
            <td className="px-3 py-2">
              <span className="text-sm font-semibold text-gray-900">
                {highlightText(po.poNumber, searchQuery)}
              </span>
            </td>
            <td className="px-3 py-2">
              <span className="text-sm text-gray-700">{po.poDate}</span>
            </td>
            <td className="px-3 py-2">
              <VIMoneyCell value={po.poAmount} currency={vendor.currency} className="text-sm font-semibold text-gray-900" />
            </td>
            <td className="px-3 py-2">
              <span className={`px-2 py-1 text-xs font-medium rounded border ${statusColors[po.status]}`}>
                {po.status}
              </span>
            </td>
            <td className="px-3 py-2 border-r-2 border-gray-200">
              <span className="text-sm text-gray-700">{po.itemCount}</span>
            </td>

            {/* GRN Summary */}
            <td colSpan={4} className="px-3 py-2">
              {relatedGRNs.length > 0 ? (
                <div className="text-sm text-gray-600">
                  {relatedGRNs.length} receiving doc{relatedGRNs.length !== 1 ? 's' : ''} linked
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic">No receiving docs linked</div>
              )}
            </td>
          </tr>
        );
      })}

      {/* Expanded GRN Rows (View Only) */}
      {isExpanded && vendor.receivingDocuments.map((grn) => {
        const relatedPO = vendor.purchaseOrders.find(po => po.poNumber === grn.poNumber);
        if (!relatedPO) return null;

        return (
          <tr 
            key={grn.grnNumber}
            className="border-b border-gray-100 bg-purple-50/10 h-10"
          >
            {/* Sticky Columns - Empty */}
            <td className="sticky left-0 z-10 bg-white border-r border-gray-100"></td>
            <td className="sticky left-[50px] z-10 bg-white border-r border-gray-100 shadow-[2px_0_2px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-center px-3">
                <Package className="w-4 h-4 text-purple-600" />
              </div>
            </td>

            {/* Sticky Vendor Name */}
            <td className="sticky left-[110px] z-10 px-3 py-1 bg-white border-r border-gray-200 shadow-[2px_0_4px_rgba(0,0,0,0.08)]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3 h-3 text-purple-600" />
                </div>
                <div className="text-xs text-gray-600 font-medium truncate">
                  {vendor.vendorName}
                </div>
              </div>
            </td>

            {/* Other Vendor + PO Sections */}
            <td colSpan={3} className="px-3 py-1">
              <div className="text-xs text-gray-400 italic">
                Linked to {grn.poNumber}
              </div>
            </td>

            {/* GRN Details */}
            <td className="px-3 py-1">
              <span className="text-sm font-medium text-gray-700">
                {highlightText(grn.grnNumber, searchQuery)}
              </span>
            </td>
            <td className="px-3 py-1">
              <span className="text-sm text-gray-600">{grn.grnDate}</span>
            </td>
            <td className="px-3 py-1">
              <span className="text-sm text-gray-600">Qty: {grn.receivedQty}</span>
            </td>
            <td className="px-3 py-1">
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${grnStatusColors[grn.status]}`}>
                {grn.status}
              </span>
            </td>
          </tr>
        );
      })}
    </>
  );
}