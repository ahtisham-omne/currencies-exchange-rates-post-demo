import { useState, useMemo } from 'react';
import { Search, X, ShoppingCart, CheckCircle2, Circle, Package } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { mockVendorSearchData, PurchaseOrder } from '@/app/data/mockVendorSearchData';

interface POSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedPOs: PurchaseOrder[]) => void;
  vendorId: string;
  vendorName: string;
}

export function POSelectionModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  vendorId,
  vendorName 
}: POSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPOIds, setSelectedPOIds] = useState<Set<string>>(new Set());

  // Get all POs for this vendor
  const vendorData = mockVendorSearchData.find(v => v.id === vendorId);
  const allPOs = vendorData?.purchaseOrders || [];

  // Filter POs based on search and only show Open/Partial status
  const filteredPOs = useMemo(() => {
    let pos = allPOs.filter(po => po.status === 'Open' || po.status === 'Partial');
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      pos = pos.filter(po => 
        po.poNumber.toLowerCase().includes(query) ||
        po.items.some(item => 
          item.itemCode.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
        )
      );
    }
    
    return pos;
  }, [allPOs, searchQuery]);

  const togglePO = (poId: string) => {
    setSelectedPOIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(poId)) {
        newSet.delete(poId);
      } else {
        newSet.add(poId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    const selectedPOs = allPOs.filter(po => selectedPOIds.has(po.id));
    onConfirm(selectedPOs);
  };

  const totalSelectedAmount = useMemo(() => {
    return allPOs
      .filter(po => selectedPOIds.has(po.id))
      .reduce((sum, po) => sum + po.totalAmount, 0);
  }, [allPOs, selectedPOIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Select Purchase Orders</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Vendor: <span className="font-medium text-gray-700">{vendorName}</span>
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-9 w-9 p-0 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search and Info */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by PO number or item..."
                className="pl-10 h-11 bg-white"
                autoFocus
              />
            </div>
            <div className="text-sm text-gray-600 whitespace-nowrap">
              {selectedPOIds.size} selected
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
            <Package className="w-4 h-4" />
            <span>You can select multiple POs from this vendor to create a consolidated invoice</span>
          </div>
        </div>

        {/* PO List */}
        <div className="flex-1 overflow-y-auto">
          {filteredPOs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <ShoppingCart className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-sm">No open purchase orders found</p>
              {searchQuery && (
                <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredPOs.map((po) => {
                const isSelected = selectedPOIds.has(po.id);
                return (
                  <button
                    key={po.id}
                    onClick={() => togglePO(po.id)}
                    className={`w-full px-6 py-4 hover:bg-gray-50 transition-colors text-left ${
                      isSelected ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <div className="pt-1 flex-shrink-0">
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300" />
                        )}
                      </div>

                      {/* PO Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-gray-900">{po.poNumber}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              po.status === 'Open' ? 'bg-green-50 text-green-700 border-green-200' :
                              po.status === 'Partial' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                            }`}
                          >
                            {po.status}
                          </Badge>
                          <span className="text-sm text-gray-500">{po.date}</span>
                        </div>

                        {/* Items Preview */}
                        <div className="space-y-1.5 mb-2">
                          {po.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="text-gray-400">•</span>
                              <span className="flex-1">
                                <span className="font-medium text-gray-700">{item.itemCode}</span> - {item.description}
                                <span className="text-gray-500 ml-2">
                                  ({item.quantity} {item.quantity > 1 ? 'units' : 'unit'} @ ${item.unitPrice.toFixed(2)})
                                </span>
                              </span>
                            </div>
                          ))}
                          {po.items.length > 3 && (
                            <div className="text-xs text-gray-500 pl-4">
                              +{po.items.length - 3} more item{po.items.length - 3 > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <span className="text-sm text-gray-600">PO Total</span>
                          <span className="font-semibold text-gray-900">${po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">
                {selectedPOIds.size} PO{selectedPOIds.size !== 1 ? 's' : ''} selected
              </div>
              {selectedPOIds.size > 0 && (
                <div className="text-lg font-semibold text-gray-900 mt-1">
                  Total: ${totalSelectedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleConfirm}
                disabled={selectedPOIds.size === 0}
              >
                Continue with {selectedPOIds.size} PO{selectedPOIds.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
