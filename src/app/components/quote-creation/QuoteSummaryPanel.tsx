import { QuoteDraft } from '@/app/components/CreateQuoteModal';
import { Building2, User, Package, DollarSign } from 'lucide-react';
import { CurrencyAmount } from '@/app/components/ui/CurrencyAmount';
import { BaseCurrencyKPI } from '@/app/components/currency/BaseCurrencyKPI';
import { BASE_CURRENCY, convertBetween } from '@/app/data/currencyLibrary';

interface QuoteSummaryPanelProps {
  quoteDraft: QuoteDraft;
}

/**
 * Render a PKR amount as the canonical base value with a customer-currency
 * hover when the quote settles in a non-PKR currency.
 */
function Money({ valuePKR, quote }: { valuePKR: number; quote: QuoteDraft }) {
  const customerCur = (quote.currency ?? quote.customerDefaultCurrency ?? BASE_CURRENCY).toUpperCase();
  const isBase = customerCur === BASE_CURRENCY;
  if (isBase) {
    return <BaseCurrencyKPI compact={false} valuePKR={valuePKR} />;
  }
  return (
    <CurrencyAmount
      mode="listing-base"
      currency={BASE_CURRENCY}
      value={valuePKR}
      partnerDefaultCurrency={customerCur}
      partnerDefaultValue={convertBetween(valuePKR, BASE_CURRENCY, customerCur)}
    />
  );
}

export function QuoteSummaryPanel({ quoteDraft }: QuoteSummaryPanelProps) {
  const subtotal = quoteDraft.lineItems.reduce((sum, item) => sum + item.total, 0);
  const totalDiscount = quoteDraft.lineItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity * item.discount / 100), 0);
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + tax;

  return (
    <div className="w-80 border-l border-[#E5E7EB] bg-[#FAFBFC] flex flex-col">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#E5E7EB]">
        <h3 className="text-[16px] font-semibold text-[#1F2937] mb-1" style={{ fontWeight: 600 }}>
          Quote Summary
        </h3>
        <p className="text-[12px] text-[#9CA3AF]">
          Live preview of your quote
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {/* Customer Info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-[#6B7280]" />
            <span className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide" style={{ fontWeight: 500 }}>
              Customer
            </span>
          </div>
          
          {quoteDraft.customer ? (
            <div className="bg-white rounded border border-[#E5E7EB] p-3" style={{ borderRadius: '6px' }}>
              <div className="text-[13px] font-medium text-[#1F2937] mb-1" style={{ fontWeight: 500 }}>
                {quoteDraft.customer.name}
              </div>
              {quoteDraft.customer.location && (
                <div className="text-[12px] text-[#6B7280]">
                  {quoteDraft.customer.location}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded border border-dashed border-[#E5E7EB] p-3 text-center" style={{ borderRadius: '6px' }}>
              <div className="text-[12px] text-[#9CA3AF]">
                No customer selected
              </div>
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-[#6B7280]" />
            <span className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide" style={{ fontWeight: 500 }}>
              Point of Contact
            </span>
          </div>
          
          {quoteDraft.primaryPoC ? (
            <div className="bg-white rounded border border-[#E5E7EB] p-3" style={{ borderRadius: '6px' }}>
              <div className="text-[13px] font-medium text-[#1F2937] mb-1" style={{ fontWeight: 500 }}>
                {quoteDraft.primaryPoC.name}
              </div>
              <div className="text-[12px] text-[#6B7280]">
                {quoteDraft.primaryPoC.email}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded border border-dashed border-[#E5E7EB] p-3 text-center" style={{ borderRadius: '6px' }}>
              <div className="text-[12px] text-[#9CA3AF]">
                No contact selected
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-[#6B7280]" />
            <span className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide" style={{ fontWeight: 500 }}>
              Items ({quoteDraft.lineItems.length})
            </span>
          </div>
          
          {quoteDraft.lineItems.length > 0 ? (
            <div className="space-y-2">
              {quoteDraft.lineItems.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white rounded border border-[#E5E7EB] p-3"
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
                      <div className="text-[12px] font-medium text-[#1F2937] truncate mb-1" style={{ fontWeight: 500 }}>
                        {item.description}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                        <span className="inline-flex items-center gap-1">
                          {item.quantity}x <Money valuePKR={item.unitPrice} quote={quoteDraft} />
                        </span>
                        <span className="font-medium text-[#1F2937]" style={{ fontWeight: 500 }}>
                          <Money valuePKR={item.total} quote={quoteDraft} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded border border-dashed border-[#E5E7EB] p-3 text-center" style={{ borderRadius: '6px' }}>
              <div className="text-[12px] text-[#9CA3AF]">
                No items added
              </div>
            </div>
          )}
        </div>

        {/* Financial Summary */}
        {quoteDraft.lineItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-[#6B7280]" />
              <span className="text-[12px] font-medium text-[#6B7280] uppercase tracking-wide" style={{ fontWeight: 500 }}>
                Total
              </span>
            </div>
            
            <div className="bg-white rounded border border-[#E5E7EB] p-3 space-y-2" style={{ borderRadius: '6px' }}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#6B7280]">Subtotal</span>
                <span className="text-[#1F2937]"><Money valuePKR={subtotal} quote={quoteDraft} /></span>
              </div>

              {totalDiscount > 0 && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-[#6B7280]">Discount</span>
                  <span className="text-[#10B981]">- <Money valuePKR={totalDiscount} quote={quoteDraft} /></span>
                </div>
              )}

              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#6B7280]">Tax (10%)</span>
                <span className="text-[#1F2937]"><Money valuePKR={tax} quote={quoteDraft} /></span>
              </div>

              <div className="pt-2 border-t border-[#E5E7EB]">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-[#1F2937]" style={{ fontWeight: 600 }}>
                    Grand Total
                  </span>
                  <span
                    className="text-[16px] font-semibold text-[#1B6EF3]"
                    style={{ fontWeight: 600 }}
                  >
                    <Money valuePKR={total} quote={quoteDraft} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="px-6 py-4 border-t border-[#E5E7EB]">
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
