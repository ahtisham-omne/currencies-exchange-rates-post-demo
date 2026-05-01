import { useState, useMemo } from 'react';
import { Search, X, Package, CheckCircle2, Circle, Truck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { mockVendorSearchData, ReceivingDocument } from '@/app/data/mockVendorSearchData';
import { VIMoneyCell } from '@/app/components/currency/VIMoneyCell';

interface ReceivingSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedReceivings: ReceivingDocument[]) => void;
  vendorId: string;
  vendorName: string;
}

export function ReceivingSelectionModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  vendorId,
  vendorName 
}: ReceivingSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceivingIds, setSelectedReceivingIds] = useState<Set<string>>(new Set());

  // Get all receiving documents for this vendor
  const vendorData = mockVendorSearchData.find(v => v.id === vendorId);
  const allReceivings = vendorData?.receivingDocuments || [];

  // Filter receivings based on search and only show Open/Partial status
  const filteredReceivings = useMemo(() => {
    let receivings = allReceivings.filter(rec => rec.status === 'Open' || rec.status === 'Partial' || rec.status === 'Completed');
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      receivings = receivings.filter(rec => 
        rec.receivingNumber.toLowerCase().includes(query) ||
        rec.poNumber.toLowerCase().includes(query) ||
        rec.items.some(item => 
          item.itemCode.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
        )
      );
    }
    
    return receivings;
  }, [allReceivings, searchQuery]);

  const toggleReceiving = (receivingId: string) => {
    setSelectedReceivingIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(receivingId)) {
        newSet.delete(receivingId);
      } else {
        newSet.add(receivingId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    const selectedReceivings = allReceivings.filter(rec => selectedReceivingIds.has(rec.id));
    onConfirm(selectedReceivings);
  };

  const totalSelectedAmount = useMemo(() => {
    return allReceivings
      .filter(rec => selectedReceivingIds.has(rec.id))
      .reduce((sum, rec) => sum + rec.totalAmount, 0);
  }, [allReceivings, selectedReceivingIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Select Receiving Documents</h2>
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
                placeholder="Search by receiving number, PO, or item..."
                className="pl-10 h-11 bg-white"
                autoFocus
              />
            </div>
            <div className="text-sm text-gray-600 whitespace-nowrap">
              {selectedReceivingIds.size} selected
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
            <Truck className="w-4 h-4" />
            <span>You can select multiple receiving documents from this vendor to create a consolidated invoice</span>
          </div>
        </div>

        {/* Receiving List */}
        <div className="flex-1 overflow-y-auto">
          {filteredReceivings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Package className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-sm">No receiving documents found</p>
              {searchQuery && (
                <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredReceivings.map((receiving) => {
                const isSelected = selectedReceivingIds.has(receiving.id);
                return (
                  <button
                    key={receiving.id}
                    onClick={() => toggleReceiving(receiving.id)}
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

                      {/* Receiving Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-gray-900">{receiving.receivingNumber}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              receiving.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' :
                              receiving.status === 'Partial' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                              receiving.status === 'Open' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                            }`}
                          >
                            {receiving.status}
                          </Badge>
                          <span className="text-sm text-gray-500">{receiving.date}</span>
                        </div>

                        {/* PO Reference */}
                        <div className="text-sm text-gray-600 mb-2">
                          From PO: <span className="font-medium text-gray-700">{receiving.poNumber}</span>
                        </div>

                        {/* Items Preview */}
                        <div className="space-y-1.5 mb-2">
                          {receiving.items.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="text-gray-400">•</span>
                              <span className="flex-1">
                                <span className="font-medium text-gray-700">{item.itemCode}</span> - {item.description}
                                <span className="text-gray-500 ml-2">
                                  ({item.quantity} {item.quantity > 1 ? 'units' : 'unit'} @ <VIMoneyCell value={item.unitPrice} currency="USD" />)
                                </span>
                              </span>
                            </div>
                          ))}
                          {receiving.items.length > 3 && (
                            <div className="text-xs text-gray-500 pl-4">
                              +{receiving.items.length - 3} more item{receiving.items.length - 3 > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <span className="text-sm text-gray-600">Receiving Total</span>
                          <VIMoneyCell value={receiving.totalAmount} currency="USD" className="font-semibold text-gray-900" />
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
                {selectedReceivingIds.size} receiving document{selectedReceivingIds.size !== 1 ? 's' : ''} selected
              </div>
              {selectedReceivingIds.size > 0 && (
                <div className="text-lg font-semibold text-gray-900 mt-1">
                  Total: <VIMoneyCell value={totalSelectedAmount} currency="USD" />
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
                disabled={selectedReceivingIds.size === 0}
              >
                Continue with {selectedReceivingIds.size} Document{selectedReceivingIds.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
