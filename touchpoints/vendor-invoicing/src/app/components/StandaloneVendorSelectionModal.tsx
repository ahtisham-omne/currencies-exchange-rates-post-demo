import { useState, useMemo } from 'react';
import { X, Search, Check, Building2, Calendar, User, Maximize2, Minimize2, FileText, ArrowRight } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { mockVendors, Vendor } from '@/app/data/mockVendors';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

export interface StandaloneVendorData {
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  vendorCategory: string;
  currency: string;
  paymentTerms: string;
  imageUrl?: string;
}

interface StandaloneVendorSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVendor: (vendor: StandaloneVendorData) => void;
}

export function StandaloneVendorSelectionModal({ isOpen, onClose, onSelectVendor }: StandaloneVendorSelectionModalProps) {
  const [search, setSearch] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredVendors = useMemo(() => {
    if (!search.trim()) return mockVendors;
    const q = search.toLowerCase();
    return mockVendors.filter(v =>
      v.vendorName.toLowerCase().includes(q) ||
      v.vendorCode.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.createdBy.toLowerCase().includes(q)
    );
  }, [search]);

  const selectedVendor = useMemo(() => {
    if (!selectedId) return null;
    return mockVendors.find(v => v.id === selectedId) || null;
  }, [selectedId]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim() || query.length < 2) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-amber-200/80 text-amber-900 rounded-sm px-0.5">{part}</mark> : part
    );
  };

  const handleContinue = () => {
    if (!selectedVendor) return;
    onSelectVendor({
      vendorId: selectedVendor.id,
      vendorCode: selectedVendor.vendorCode,
      vendorName: selectedVendor.vendorName,
      vendorCategory: selectedVendor.category,
      currency: selectedVendor.currency,
      paymentTerms: selectedVendor.paymentTerms,
      imageUrl: selectedVendor.imageUrl,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`bg-white shadow-2xl flex flex-col overflow-hidden border border-gray-100 transition-all duration-300 ${
        isFullScreen
          ? 'w-full h-full rounded-none'
          : 'w-full max-w-2xl max-h-[85vh] rounded-2xl'
      }`}>
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-100">
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                <FileText className="w-4.5 h-4.5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 tracking-tight">Select Vendor</h2>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">Standalone Invoice &mdash; choose a vendor to invoice</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="h-8 w-8 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={onClose}
                className="h-8 w-8 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-6 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendors by name, code, or category..."
                className="pl-10 h-9 bg-gray-50 border-gray-200 text-[12px] font-medium focus:ring-1 focus:ring-purple-200 focus:border-purple-300 shadow-none rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Vendor Count */}
        <div className="flex-shrink-0 px-6 py-2.5 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} available
          </span>
          <span className="text-[10px] font-medium text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
            Standalone
          </span>
        </div>

        {/* Vendor List */}
        <div className="flex-1 overflow-y-auto">
          {filteredVendors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                <Search className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-[13px] font-bold text-gray-400">No vendors found</p>
              <p className="text-[11px] text-gray-400 mt-1">Try adjusting your search criteria.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredVendors.map((vendor) => {
                const isHovered = hoveredId === vendor.id;
                const isSelected = selectedId === vendor.id;
                return (
                  <div
                    key={vendor.id}
                    className={`flex items-center gap-4 px-6 py-4 cursor-pointer group select-none transition-all duration-150 ${
                      isSelected
                        ? 'bg-purple-50/60'
                        : isHovered
                          ? 'bg-purple-50/40'
                          : 'bg-white hover:bg-gray-50/70'
                    }`}
                    onClick={() => setSelectedId(vendor.id === selectedId ? null : vendor.id)}
                    onMouseEnter={() => setHoveredId(vendor.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Selection Checkbox */}
                    <div className={`flex-shrink-0 flex items-center justify-center w-[18px] h-[18px] rounded border-[1.5px] transition-all duration-150 ${
                      isSelected
                        ? 'bg-purple-600 border-purple-600 shadow-sm'
                        : isHovered
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-gray-300 bg-white group-hover:border-gray-400'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>

                    {/* Avatar */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center transition-all ${
                      isSelected ? 'ring-2 ring-purple-200 ring-offset-1' : isHovered ? 'ring-2 ring-purple-200 ring-offset-1' : 'border border-gray-100 shadow-sm'
                    } bg-white`}>
                      {vendor.imageUrl ? (
                        <ImageWithFallback
                          src={vendor.imageUrl}
                          alt={vendor.vendorName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className={`w-5 h-5 ${isSelected || isHovered ? 'text-purple-500' : 'text-gray-400'}`} />
                      )}
                    </div>

                    {/* Vendor Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <h3 className={`text-[13px] font-bold truncate tracking-tight transition-colors ${
                          isSelected ? 'text-purple-700' : isHovered ? 'text-purple-700' : 'text-gray-900 group-hover:text-gray-700'
                        }`}>
                          {highlightText(vendor.vendorName, search)}
                        </h3>
                        <span className="text-[10px] font-semibold text-gray-400 px-1.5 py-0.5 rounded-md bg-gray-50 border border-gray-100 flex-shrink-0">
                          {highlightText(vendor.vendorCode, search)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                          isSelected || isHovered
                            ? 'text-purple-600 bg-purple-50 border-purple-200'
                            : 'text-gray-500 bg-gray-50 border-gray-200'
                        } transition-colors`}>
                          {vendor.category}
                        </span>
                        <div className="flex items-center gap-3 text-[11px] text-gray-400">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span className="font-medium text-gray-500">{vendor.createdBy}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span className="font-medium text-gray-500">{vendor.createdOn}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Omne ERP</p>
          <div className="flex items-center gap-3">
            {selectedVendor && (
              <span className="text-[11px] font-semibold text-purple-600 animate-in fade-in slide-in-from-right-2 duration-200">
                {selectedVendor.vendorName}
              </span>
            )}
            <Button
              onClick={handleContinue}
              disabled={!selectedId}
              className="h-8 px-4 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed gap-1.5"
            >
              Continue
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
