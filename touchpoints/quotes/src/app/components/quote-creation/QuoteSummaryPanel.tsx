import { formatCurrency } from '@/app/utils/quoteUtils';
import { QuoteDraft } from '@/app/components/CreateQuoteModal';
import { Building2, User, Package, DollarSign } from 'lucide-react';

interface QuoteSummaryPanelProps {
  quoteDraft: QuoteDraft;
}

export function QuoteSummaryPanel({ quoteDraft }: QuoteSummaryPanelProps) {
  const subtotal = quoteDraft.lineItems.reduce((sum, item) => sum + item.total, 0);
  const totalDiscount = quoteDraft.lineItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity * item.discount / 100), 0);
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;

  return (
    <div className="w-80 border-l border-border bg-muted/40 flex flex-col">
      {/* Header */}
      <div className="px-6 py-6 border-b border-border">
        <h3 className="text-[16px] font-semibold text-foreground mb-1" style={{ fontWeight: 600 }}>
          Quote Summary
        </h3>
        <p className="text-[12px] text-muted-foreground">
          Live preview of your quote
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {/* Customer Info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 500 }}>
              Customer
            </span>
          </div>
          
          {quoteDraft.customer ? (
            <div className="bg-white rounded border border-border p-3" style={{ borderRadius: '6px' }}>
              <div className="text-[13px] font-medium text-foreground mb-1" style={{ fontWeight: 500 }}>
                {quoteDraft.customer.name}
              </div>
              {quoteDraft.customer.location && (
                <div className="text-[12px] text-muted-foreground">
                  {quoteDraft.customer.location}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded border border-dashed border-border p-3 text-center" style={{ borderRadius: '6px' }}>
              <div className="text-[12px] text-muted-foreground">
                No customer selected
              </div>
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 500 }}>
              Point of Contact
            </span>
          </div>
          
          {quoteDraft.primaryPoC ? (
            <div className="bg-white rounded border border-border p-3" style={{ borderRadius: '6px' }}>
              <div className="text-[13px] font-medium text-foreground mb-1" style={{ fontWeight: 500 }}>
                {quoteDraft.primaryPoC.name}
              </div>
              <div className="text-[12px] text-muted-foreground">
                {quoteDraft.primaryPoC.email}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded border border-dashed border-border p-3 text-center" style={{ borderRadius: '6px' }}>
              <div className="text-[12px] text-muted-foreground">
                No contact selected
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 500 }}>
              Items ({quoteDraft.lineItems.length})
            </span>
          </div>
          
          {quoteDraft.lineItems.length > 0 ? (
            <div className="space-y-2">
              {quoteDraft.lineItems.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white rounded border border-border p-3"
                  style={{ borderRadius: '6px' }}
                >
                  <div className="flex items-start gap-2">
                    {item.image && (
                      <img 
                        src={item.image} 
                        alt={item.description}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                        style={{ borderRadius: '4px' }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-foreground truncate mb-1" style={{ fontWeight: 500 }}>
                        {item.description}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{item.quantity}x {formatCurrency(item.unitPrice)}</span>
                        <span className="font-medium text-foreground" style={{ fontWeight: 500 }}>
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded border border-dashed border-border p-3 text-center" style={{ borderRadius: '6px' }}>
              <div className="text-[12px] text-muted-foreground">
                No items added
              </div>
            </div>
          )}
        </div>

        {/* Financial Summary */}
        {quoteDraft.lineItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide" style={{ fontWeight: 500 }}>
                Total
              </span>
            </div>
            
            <div className="bg-white rounded border border-border p-3 space-y-2" style={{ borderRadius: '6px' }}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              
              {totalDiscount > 0 && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-success">-{formatCurrency(totalDiscount)}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Tax (10%)</span>
                <span className="text-foreground">{formatCurrency(tax)}</span>
              </div>
              
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-foreground" style={{ fontWeight: 600 }}>
                    Grand Total
                  </span>
                  <span 
                    className="text-[16px] font-semibold text-primary" 
                    style={{ fontWeight: 600 }}
                  >
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="px-6 py-4 border-t border-border">
        <div className="flex items-start gap-2 p-3 bg-[#FEF3C7] rounded" style={{ borderRadius: '6px' }}>
          <span className="text-[16px]">💡</span>
          <div className="text-[11px] text-[#92400E]">
            Your progress is automatically saved. You can close this and continue later.
          </div>
        </div>
      </div>
    </div>
  );
}
