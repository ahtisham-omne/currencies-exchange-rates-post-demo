import { X, Package, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface InvoiceTypeSelectionModalProps {
  onClose: () => void;
  onSelectType: (type: 'draft' | 'receiving' | 'po' | 'standalone') => void;
}

export function InvoiceTypeSelectionModal({ onClose, onSelectType }: InvoiceTypeSelectionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 text-center relative">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Create Vendor Invoice</h2>
          <p className="text-[13px] text-gray-500 font-medium mt-1">Choose how you want to create the invoice</p>
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - Horizontal Layout for Equal Hierarchy */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Option 1: Inventory Invoice */}
          <div className="flex flex-col h-full border border-gray-100 rounded-xl p-5 hover:border-blue-100 hover:shadow-md transition-all bg-white group border-t-2 border-t-blue-500">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <Package className="w-5 h-5" />
            </div>
            
            <div className="flex-1 space-y-2 mb-6">
              <h3 className="text-[15px] font-bold text-gray-900 leading-tight">Inventory Invoice</h3>
              <p className="text-[12px] text-gray-600 leading-snug font-normal">
                Create an invoice or pre-invoice from purchase orders, receiving documents, or items.
              </p>
              <div className="pt-1">
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full">
                  Linked to inventory
                </span>
              </div>
            </div>

            <Button 
              onClick={() => onSelectType('po')}
              className="w-full bg-[#1e293b] hover:bg-[#0f172a] text-white h-9 font-bold rounded-lg text-[11px] uppercase tracking-wider transition-all shadow-sm active:scale-95"
            >
              Continue
            </Button>
          </div>

          {/* Option 2: Standalone Invoice */}
          <div className="flex flex-col h-full border border-gray-100 rounded-xl p-5 hover:border-purple-100 hover:shadow-md transition-all bg-white group border-t-2 border-t-purple-500">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <FileText className="w-5 h-5" />
            </div>
            
            <div className="flex-1 space-y-2 mb-6">
              <h3 className="text-[15px] font-bold text-gray-900 leading-tight">Standalone Invoice</h3>
              <p className="text-[12px] text-gray-600 leading-snug font-normal">
                Create an invoice without a purchase order, such as utilities, rent, or services.
              </p>
              <div className="pt-1">
                <span className="text-[10px] font-semibold text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-full">
                  No documents required
                </span>
              </div>
            </div>

            <Button 
              onClick={() => onSelectType('standalone')}
              className="w-full bg-[#1e293b] hover:bg-[#0f172a] text-white h-9 font-bold rounded-lg text-[11px] uppercase tracking-wider transition-all shadow-sm active:scale-95"
            >
              Continue
            </Button>
          </div>

        </div>
        
        <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Omne ERP</p>
          <div className="flex items-center gap-1 text-[9px] font-bold text-blue-600 uppercase tracking-wider">
            <span>Help Center</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
