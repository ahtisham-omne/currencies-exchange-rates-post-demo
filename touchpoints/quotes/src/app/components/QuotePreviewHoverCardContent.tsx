import { Quote } from '@/app/types/quote';
import { Package, Calendar, DollarSign, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '@/app/utils/quoteUtils';

interface QuotePreviewHoverCardContentProps {
  quote: Quote;
}

export function QuotePreviewHoverCardContent({ quote }: QuotePreviewHoverCardContentProps) {
  // Mock line items with thumbnails
  const mockLineItems = [
    { id: 1, name: 'Industrial Motor Assembly', qty: 5, uom: 'EA', price: 12500 },
    { id: 2, name: 'Control Panel System', qty: 3, uom: 'EA', price: 8200 },
    { id: 3, name: 'Safety Switch Kit', qty: 10, uom: 'Box', price: 450 },
    { id: 4, name: 'Mounting Bracket Set', qty: 15, uom: 'EA', price: 280 },
  ];

  const totalItems = mockLineItems.length;
  const visibleItems = mockLineItems.slice(0, 3);

  return (
    <div className="w-[340px]">
      {/* Header */}
      <div className="p-4 border-b border-[#E5E7EB]">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-[#E7F3FF] flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-[#1B6EF3]" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[14px] font-semibold text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
              {quote.quoteNumber}
            </h4>
            <p className="text-[12px] text-[#6B7280] line-clamp-1">
              {quote.description}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-[#9CA3AF] uppercase font-medium mb-0.5" style={{ fontWeight: 500 }}>
              Items
            </p>
            <p className="text-[13px] font-semibold text-[#1F2937]" style={{ fontWeight: 600 }}>
              {totalItems}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#9CA3AF] uppercase font-medium mb-0.5" style={{ fontWeight: 500 }}>
              Value
            </p>
            <p className="text-[13px] font-semibold text-[#1F2937]" style={{ fontWeight: 600 }}>
              {formatCurrency(quote.totalValue)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#9CA3AF] uppercase font-medium mb-0.5" style={{ fontWeight: 500 }}>
              Version
            </p>
            <p className="text-[13px] font-semibold text-[#1F2937]" style={{ fontWeight: 600 }}>
              v{quote.version}
            </p>
          </div>
        </div>
      </div>

      {/* Line Items Preview */}
      <div className="p-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2 mb-3">
          <Package className="w-4 h-4 text-[#6B7280]" />
          <h5 className="text-[12px] font-medium text-[#374151]" style={{ fontWeight: 500 }}>
            Line Items
          </h5>
        </div>
        
        <div className="space-y-0">
          {/* Column header */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-10 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Item</span>
            </div>
            <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0, width: '24px', textAlign: 'right' }}>Qty</span>
            <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0, width: '28px', textAlign: 'center' }}>Unit</span>
            <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0, width: '52px', textAlign: 'right' }}>Price</span>
          </div>
          {visibleItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-2 bg-[#FAFBFC] rounded" style={{ borderRadius: '4px' }}>
              {/* Thumbnail */}
              <div className="w-10 h-10 rounded bg-[#E5E7EB] flex items-center justify-center flex-shrink-0" style={{ borderRadius: '4px' }}>
                <Package className="w-5 h-5 text-[#9CA3AF]" />
              </div>
              
              {/* Item Details */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-[#1F2937] truncate" style={{ fontWeight: 500 }}>
                  {item.name}
                </p>
              </div>
              <span style={{ fontSize: '11px', color: '#6B7280', flexShrink: 0, width: '24px', textAlign: 'right' }}>{item.qty}</span>
              <span style={{ fontSize: '10px', color: '#9CA3AF', flexShrink: 0, width: '28px', textAlign: 'center' }}>{item.uom}</span>
              <span style={{ fontSize: '11px', color: '#6B7280', flexShrink: 0, width: '52px', textAlign: 'right' }}>{formatCurrency(item.price)}</span>
            </div>
          ))}
          
          {totalItems > 3 && (
            <div className="text-center py-1">
              <span className="text-[11px] text-[#9CA3AF] font-medium" style={{ fontWeight: 500 }}>
                +{totalItems - 3} more items
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Key Dates */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-[#6B7280]" />
          <h5 className="text-[12px] font-medium text-[#374151]" style={{ fontWeight: 500 }}>
            Key Dates
          </h5>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#6B7280]">Created</span>
            <span className="text-[12px] font-medium text-[#1F2937]" style={{ fontWeight: 500 }}>
              {formatDate(quote.createdDate)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#6B7280]">Expires</span>
            <span className="text-[12px] font-medium text-[#1F2937]" style={{ fontWeight: 500 }}>
              {formatDate(quote.expiryDate)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#6B7280]">Days in Stage</span>
            <span className="text-[12px] font-medium text-[#1F2937]" style={{ fontWeight: 500 }}>
              {quote.daysInCurrentStage} days
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}