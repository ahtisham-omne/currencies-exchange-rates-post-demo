import { useState, useMemo } from 'react';
import { Search, X, ChevronRight, ChevronDown, FileText, Package, Truck, Clock, Filter, Building2, ShoppingCart } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Label } from '@/app/components/ui/label';
import { mockVendorSearchData, VendorSearchResult } from '@/app/data/mockVendorSearchData';

interface InvoiceSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: SearchSelection) => void;
  invoiceType: 'receiving' | 'po' | 'manual' | 'prepayment' | 'draft' | 'standalone';
  selectionMode?: 'receiving-only' | 'po-only' | 'all'; // New prop for controlling what's selectable
}

export interface SearchSelection {
  type: 'vendor' | 'po' | 'receiving' | 'item';
  vendorId: string;
  vendorName: string;
  poNumber?: string;
  receivingNumber?: string;
  itemId?: string;
}

interface RecentSearch {
  id: string;
  query: string;
  timestamp: Date;
}

export function InvoiceSearchModal({ isOpen, onClose, onSelect, invoiceType, selectionMode }: InvoiceSearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set());
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set());
  const [expandedReceivings, setExpandedReceivings] = useState<Set<string>>(new Set());
  
  // Recent searches - mock data
  const [recentSearches] = useState<RecentSearch[]>([
    { id: '1', query: 'Acme Corp', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
    { id: '2', query: 'PO-001234', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
    { id: '3', query: 'Tech Solutions', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5) },
    { id: '4', query: 'RCV-005123', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) },
  ]);
  
  // Filters
  const [filters, setFilters] = useState({
    showVendors: true,
    showPOs: true,
    showReceivings: true,
    showItems: true,
  });

  const toggleVendor = (vendorId: string) => {
    setExpandedVendors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vendorId)) {
        newSet.delete(vendorId);
      } else {
        newSet.add(vendorId);
      }
      return newSet;
    });
  };

  const togglePO = (poId: string) => {
    setExpandedPOs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(poId)) {
        newSet.delete(poId);
      } else {
        newSet.add(poId);
      }
      return newSet;
    });
  };

  const toggleReceiving = (recId: string) => {
    setExpandedReceivings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recId)) {
        newSet.delete(recId);
      } else {
        newSet.add(recId);
      }
      return newSet;
    });
  };

  // Search and filter results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: VendorSearchResult[] = [];

    mockVendorSearchData.forEach(vendor => {
      const vendorMatches = vendor.name.toLowerCase().includes(query) || 
                           vendor.code.toLowerCase().includes(query);
      
      const matchingPOs = filters.showPOs 
        ? vendor.purchaseOrders.filter(po => 
            po.poNumber.toLowerCase().includes(query) ||
            po.status.toLowerCase().includes(query)
          )
        : [];
      
      const matchingReceivings = filters.showReceivings
        ? vendor.receivingDocuments.filter(rec => 
            rec.receivingNumber.toLowerCase().includes(query) ||
            rec.poNumber.toLowerCase().includes(query) ||
            rec.status.toLowerCase().includes(query)
          )
        : [];
      
      const matchingItems = filters.showItems
        ? vendor.items.filter(item => 
            item.itemCode.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
          )
        : [];

      // Include vendor if it matches OR has matching children
      if ((vendorMatches && filters.showVendors) || 
          matchingPOs.length > 0 || 
          matchingReceivings.length > 0 || 
          matchingItems.length > 0) {
        results.push({
          ...vendor,
          purchaseOrders: matchingPOs.length > 0 ? matchingPOs : vendor.purchaseOrders,
          receivingDocuments: matchingReceivings.length > 0 ? matchingReceivings : vendor.receivingDocuments,
          items: matchingItems.length > 0 ? matchingItems : vendor.items,
        });
      }
    });

    return results.slice(0, 50); // Limit to 50 results
  }, [searchQuery, filters]);

  const handleSelectVendor = (vendor: VendorSearchResult) => {
    onSelect({
      type: 'vendor',
      vendorId: vendor.id,
      vendorName: vendor.name,
    });
  };

  const handleSelectPO = (vendor: VendorSearchResult, poNumber: string) => {
    onSelect({
      type: 'po',
      vendorId: vendor.id,
      vendorName: vendor.name,
      poNumber,
    });
  };

  const handleSelectReceiving = (vendor: VendorSearchResult, receivingNumber: string) => {
    onSelect({
      type: 'receiving',
      vendorId: vendor.id,
      vendorName: vendor.name,
      receivingNumber,
    });
  };

  const handleSelectItem = (vendor: VendorSearchResult, itemId: string) => {
    onSelect({
      type: 'item',
      vendorId: vendor.id,
      vendorName: vendor.name,
      itemId,
    });
  };

  const handleRecentSearchClick = (query: string) => {
    setSearchQuery(query);
  };

  if (!isOpen) return null;

  const getInvoiceTypeLabel = () => {
    switch (invoiceType) {
      case 'receiving': return 'Invoice from Receiving Document';
      case 'po': return 'Invoice from Purchase Order';
      case 'manual': return 'Manual Invoice Entry';
      case 'prepayment': return 'Invoice with Prepayment';
      case 'draft': return 'Draft Invoice';
      case 'standalone': return 'Standalone Invoice';
      default: return 'Create Invoice';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{getInvoiceTypeLabel()}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Search for vendor, PO, receiving document, or item</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search vendors, POs, receiving documents, items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 h-10"
              autoFocus
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Checkbox 
                  id="filter-vendors" 
                  checked={filters.showVendors}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showVendors: !!checked }))}
                />
                <Label htmlFor="filter-vendors" className="text-sm text-gray-600 cursor-pointer">
                  Vendors
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox 
                  id="filter-pos" 
                  checked={filters.showPOs}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showPOs: !!checked }))}
                />
                <Label htmlFor="filter-pos" className="text-sm text-gray-600 cursor-pointer">
                  Purchase Orders
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox 
                  id="filter-receivings" 
                  checked={filters.showReceivings}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showReceivings: !!checked }))}
                />
                <Label htmlFor="filter-receivings" className="text-sm text-gray-600 cursor-pointer">
                  Receiving Documents
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Checkbox 
                  id="filter-items" 
                  checked={filters.showItems}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, showItems: !!checked }))}
                />
                <Label htmlFor="filter-items" className="text-sm text-gray-600 cursor-pointer">
                  Items
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex">
          {/* Recent Searches Sidebar */}
          {!searchQuery && (
            <div className="w-64 border-r border-gray-200 p-4 overflow-y-auto">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700">Recent Searches</h3>
              </div>
              <div className="space-y-1">
                {recentSearches.map(recent => (
                  <button
                    key={recent.id}
                    onClick={() => handleRecentSearchClick(recent.query)}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors group"
                  >
                    <div className="text-sm text-gray-900 group-hover:text-blue-600">{recent.query}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {recent.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-4">
            {!searchQuery ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Search className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">Start typing to search</p>
                <p className="text-gray-400 text-xs mt-1">Search across vendors, POs, receiving documents, and items</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Search className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No results found</p>
                <p className="text-gray-400 text-xs mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-gray-500 mb-3">
                  Showing {searchResults.length} vendor{searchResults.length !== 1 ? 's' : ''} 
                  {searchResults.length === 50 ? ' (limited to 50 results)' : ''}
                </div>
                {searchResults.map(vendor => (
                  <div key={vendor.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Vendor Row */}
                    <div className="bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <button
                          onClick={() => toggleVendor(vendor.id)}
                          className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                        >
                          {expandedVendors.has(vendor.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-gray-900">{vendor.name}</span>
                            <span className="text-xs text-gray-500">({vendor.code})</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                            <span>{vendor.totalPOs} POs</span>
                            <span>•</span>
                            <span>{vendor.totalReceivings} Receivings</span>
                            <span>•</span>
                            <span>Balance: ${vendor.openBalance.toLocaleString()}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSelectVendor(vendor)}
                          className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                        >
                          Select Vendor
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedVendors.has(vendor.id) && (
                      <div className="bg-white">
                        {/* Purchase Orders */}
                        {filters.showPOs && vendor.purchaseOrders.length > 0 && (
                          <div className="border-b border-gray-200">
                            <div className="px-3 py-2 bg-gray-50/50">
                              <div className="flex items-center gap-2">
                                <ShoppingCart className="w-3.5 h-3.5 text-green-600" />
                                <span className="text-xs font-semibold text-gray-700">Purchase Orders ({vendor.purchaseOrders.length})</span>
                              </div>
                            </div>
                            {vendor.purchaseOrders.map(po => (
                              <div key={po.id}>
                                <div className="flex items-center gap-2 px-3 py-2 pl-10 hover:bg-gray-50">
                                  <button
                                    onClick={() => togglePO(po.id)}
                                    className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                  >
                                    {expandedPOs.has(po.id) ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                                    )}
                                  </button>
                                  <FileText className="w-3.5 h-3.5 text-green-600" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm text-gray-900">{po.poNumber}</span>
                                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">{po.status}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {po.date} • ${po.totalAmount.toLocaleString()} • {po.items.length} items
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSelectPO(vendor, po.poNumber)}
                                    className="h-6 text-xs"
                                  >
                                    Select PO
                                  </Button>
                                </div>

                                {/* PO Items */}
                                {expandedPOs.has(po.id) && filters.showItems && (
                                  <div className="bg-gray-50/30">
                                    {po.items.map(item => (
                                      <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 pl-20 hover:bg-gray-100">
                                        <Package className="w-3 h-3 text-purple-600" />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs text-gray-900">
                                            <span className="font-medium">{item.itemCode}</span> - {item.description}
                                          </div>
                                          <div className="text-xs text-gray-500 mt-0.5">
                                            Qty: {item.quantity} • ${item.unitPrice} • Total: ${item.amount.toLocaleString()}
                                          </div>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleSelectItem(vendor, item.id)}
                                          className="h-5 text-xs"
                                        >
                                          Select
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Receiving Documents */}
                        {filters.showReceivings && vendor.receivingDocuments.length > 0 && (
                          <div className="border-b border-gray-200">
                            <div className="px-3 py-2 bg-gray-50/50">
                              <div className="flex items-center gap-2">
                                <Truck className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-xs font-semibold text-gray-700">Receiving Documents ({vendor.receivingDocuments.length})</span>
                              </div>
                            </div>
                            {vendor.receivingDocuments.map(rec => (
                              <div key={rec.id}>
                                <div className="flex items-center gap-2 px-3 py-2 pl-10 hover:bg-gray-50">
                                  <button
                                    onClick={() => toggleReceiving(rec.id)}
                                    className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                                  >
                                    {expandedReceivings.has(rec.id) ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                                    )}
                                  </button>
                                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm text-gray-900">{rec.receivingNumber}</span>
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{rec.status}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      PO: {rec.poNumber} • {rec.date} • ${rec.totalAmount.toLocaleString()} • {rec.items.length} items
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSelectReceiving(vendor, rec.receivingNumber)}
                                    className="h-6 text-xs"
                                  >
                                    Select
                                  </Button>
                                </div>

                                {/* Receiving Items */}
                                {expandedReceivings.has(rec.id) && filters.showItems && (
                                  <div className="bg-gray-50/30">
                                    {rec.items.map(item => (
                                      <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 pl-20 hover:bg-gray-100">
                                        <Package className="w-3 h-3 text-purple-600" />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs text-gray-900">
                                            <span className="font-medium">{item.itemCode}</span> - {item.description}
                                          </div>
                                          <div className="text-xs text-gray-500 mt-0.5">
                                            Qty: {item.quantity} • ${item.unitPrice} • Total: ${item.amount.toLocaleString()}
                                          </div>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleSelectItem(vendor, item.id)}
                                          className="h-5 text-xs"
                                        >
                                          Select
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}