import { Edit2, Download, Building2, MapPin, Package, DollarSign, FileText, Eye, Info, CheckCircle, Plus, X } from 'lucide-react';
import { QuoteDraft } from '@/app/components/CreateQuoteModal';
import { formatCurrency } from '@/app/utils/quoteUtils';
import { toast } from 'sonner';
import { useState } from 'react';

interface Step4ReviewProps {
  quoteDraft: QuoteDraft;
  onEdit: (step: number) => void;
}

export function Step4Review({ quoteDraft, onEdit }: Step4ReviewProps) {
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'discount' | 'fee'>('discount');
  const [adjustmentLabel, setAdjustmentLabel] = useState('');
  const [adjustmentValue, setAdjustmentValue] = useState('');
  const [adjustmentMethod, setAdjustmentMethod] = useState<'percentage' | 'fixed'>('percentage');

  const subtotal = quoteDraft.lineItems.reduce((sum, item) => sum + item.total, 0);
  const shipping = 50; // Mock shipping
  
  // Calculate adjustment
  let adjustmentAmount = 0;
  if (adjustmentValue) {
    const value = parseFloat(adjustmentValue);
    if (!isNaN(value)) {
      if (adjustmentMethod === 'percentage') {
        adjustmentAmount = (subtotal * value) / 100;
      } else {
        adjustmentAmount = value;
      }
    }
  }
  
  const finalAdjustment = adjustmentType === 'discount' ? -adjustmentAmount : adjustmentAmount;
  const total = subtotal + shipping + finalAdjustment;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Customer & Contact */}
          <div className="bg-white border border-border p-6" style={{ borderRadius: '8px' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-primary" />
                <h4 className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
                  Customer & Contact
                </h4>
              </div>
              <button
                onClick={() => onEdit(1)}
                className="flex items-center gap-2 h-8 px-3 text-[13px] text-primary hover:bg-[#F0F9FF] transition-colors"
                style={{ borderRadius: '6px', fontWeight: 500 }}
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div
                  className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2"
                  style={{ fontWeight: 500, letterSpacing: '0.5px' }}
                >
                  Customer
                </div>
                <div className="text-[14px] text-foreground mb-1" style={{ fontWeight: 500 }}>
                  {quoteDraft.customer?.name || <span className="text-muted-foreground">Not selected</span>}
                </div>
                {quoteDraft.customer?.location && (
                  <div className="text-[12px] text-muted-foreground">{quoteDraft.customer.location}</div>
                )}
              </div>

              <div>
                <div
                  className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2"
                  style={{ fontWeight: 500, letterSpacing: '0.5px' }}
                >
                  Point of Contact
                </div>
                {quoteDraft.primaryPoC ? (
                  <>
                    <div className="text-[14px] text-foreground mb-1" style={{ fontWeight: 500 }}>
                      {quoteDraft.primaryPoC.name}
                    </div>
                    <div className="text-[12px] text-muted-foreground">{quoteDraft.primaryPoC.email}</div>
                  </>
                ) : (
                  <div className="text-[13px] text-muted-foreground">Not selected</div>
                )}
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="bg-white border border-border p-6" style={{ borderRadius: '8px' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-primary" />
                <h4 className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
                  Configuration
                </h4>
              </div>
              <button
                onClick={() => onEdit(2)}
                className="flex items-center gap-2 h-8 px-3 text-[13px] text-primary hover:bg-[#F0F9FF] transition-colors"
                style={{ borderRadius: '6px', fontWeight: 500 }}
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div
                    className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2"
                    style={{ fontWeight: 500, letterSpacing: '0.5px' }}
                  >
                    Billing Address
                  </div>
                  <div className="text-[13px] text-foreground">
                    {quoteDraft.configuration.billingAddress || (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </div>
                </div>

                <div>
                  <div
                    className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2"
                    style={{ fontWeight: 500, letterSpacing: '0.5px' }}
                  >
                    Shipping Address
                  </div>
                  <div className="text-[13px] text-foreground">
                    {quoteDraft.configuration.shippingAddress || (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div
                    className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2"
                    style={{ fontWeight: 500, letterSpacing: '0.5px' }}
                  >
                    Pricing Rule
                  </div>
                  <div className="text-[13px] text-foreground">
                    {quoteDraft.configuration.pricingRule || (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </div>
                </div>

                <div>
                  <div
                    className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2"
                    style={{ fontWeight: 500, letterSpacing: '0.5px' }}
                  >
                    Valid Until
                  </div>
                  <div className="text-[13px] text-foreground">
                    {quoteDraft.configuration.validUntil || (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </div>
                </div>
              </div>

              {quoteDraft.configuration.tags.length > 0 && (
                <div>
                  <div
                    className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2"
                    style={{ fontWeight: 500, letterSpacing: '0.5px' }}
                  >
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quoteDraft.configuration.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-[11px] bg-accent text-primary"
                        style={{ borderRadius: '4px', fontWeight: 500 }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {quoteDraft.configuration.notes && (
                <div>
                  <div
                    className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2"
                    style={{ fontWeight: 500, letterSpacing: '0.5px' }}
                  >
                    Internal Notes
                  </div>
                  <div
                    className="text-[13px] text-foreground p-3 bg-muted/50"
                    style={{ borderRadius: '6px' }}
                  >
                    {quoteDraft.configuration.notes}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white border border-border p-6" style={{ borderRadius: '8px' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-primary" />
                <h4 className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
                  Line Items ({quoteDraft.lineItems.length})
                </h4>
              </div>
              <button
                onClick={() => onEdit(3)}
                className="flex items-center gap-2 h-8 px-3 text-[13px] text-primary hover:bg-[#F0F9FF] transition-colors"
                style={{ borderRadius: '6px', fontWeight: 500 }}
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            </div>

            {quoteDraft.lineItems.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-border mx-auto mb-3" />
                <p className="text-[13px] text-muted-foreground">No line items added</p>
              </div>
            ) : (
              <div>
                {/* Column header row */}
                <div className="flex items-center gap-4 px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="w-8" />
                  <div className="flex-1 min-w-0">
                    <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none' }}>Item</span>
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none', flexShrink: 0, width: '32px', textAlign: 'right' }}>Qty</span>
                  <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none', flexShrink: 0, width: '32px', textAlign: 'center' }}>Unit</span>
                  <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none', flexShrink: 0, width: '72px', textAlign: 'right' }}>Price</span>
                  <span style={{ fontSize: '9px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'none', flexShrink: 0, width: '72px', textAlign: 'right' }}>Total</span>
                </div>
                <div className="space-y-2 mt-2">
                  {quoteDraft.lineItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-3 bg-muted/50"
                      style={{ borderRadius: '6px' }}
                    >
                      <div
                        className="w-8 text-center text-[12px] text-muted-foreground"
                        style={{ fontWeight: 500 }}
                      >
                        {index + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-foreground mb-0.5 line-clamp-2" style={{ fontWeight: 500, lineHeight: '1.4' }}>
                          {item.description}
                        </div>
                        {item.discount > 0 && (
                          <div className="text-[10px] text-[#D97706]" style={{ fontWeight: 500 }}>
                            {item.discount}% off
                          </div>
                        )}
                      </div>

                      <span className="text-[12px] text-muted-foreground flex-shrink-0" style={{ width: '32px', textAlign: 'right' }}>{item.quantity}</span>
                      <span className="text-[11px] text-muted-foreground flex-shrink-0" style={{ width: '32px', textAlign: 'center' }}>EA</span>
                      <span className="text-[12px] text-muted-foreground flex-shrink-0" style={{ width: '72px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</span>
                      <div className="flex-shrink-0" style={{ width: '72px', textAlign: 'right' }}>
                        <div className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          {formatCurrency(item.total)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Financial Summary */}
          <div
            className="bg-white border-2 border-primary p-6"
            style={{ borderRadius: '8px' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <DollarSign className="w-5 h-5 text-primary" />
              <h4 className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
                Quote Summary
              </h4>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground" style={{ fontWeight: 500 }}>
                  {formatCurrency(subtotal)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[14px]">
                <span className="text-muted-foreground">Shipping & Handling</span>
                <span className="text-foreground" style={{ fontWeight: 500 }}>
                  {formatCurrency(shipping)}
                </span>
              </div>

              {/* One-time Adjustment - Collapsible */}
              {!showAdjustment ? (
                <div className="pt-1">
                  <button
                    onClick={() => setShowAdjustment(true)}
                    className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-primary transition-colors"
                    style={{ fontWeight: 500 }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add one-time adjustment
                  </button>
                </div>
              ) : (
                <div className="pt-3 pb-2">
                  <div className="p-3 bg-muted/50 space-y-3" style={{ borderRadius: '6px' }}>
                    {/* Header with Remove button */}
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>
                        One-time Adjustment
                      </span>
                      <button
                        onClick={() => {
                          setShowAdjustment(false);
                          setAdjustmentLabel('');
                          setAdjustmentValue('');
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove adjustment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Type Selection */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAdjustmentType('discount')}
                        className={`flex-1 h-7 px-2 text-[11px] border transition-colors ${
                          adjustmentType === 'discount'
                            ? 'bg-primary border-primary text-white'
                            : 'bg-white border-border text-muted-foreground hover:border-border'
                        }`}
                        style={{ borderRadius: '4px', fontWeight: 500 }}
                      >
                        Discount
                      </button>
                      <button
                        onClick={() => setAdjustmentType('fee')}
                        className={`flex-1 h-7 px-2 text-[11px] border transition-colors ${
                          adjustmentType === 'fee'
                            ? 'bg-primary border-primary text-white'
                            : 'bg-white border-border text-muted-foreground hover:border-border'
                        }`}
                        style={{ borderRadius: '4px', fontWeight: 500 }}
                      >
                        Additional Fee
                      </button>
                    </div>

                    {/* Label Input */}
                    <input
                      type="text"
                      value={adjustmentLabel}
                      onChange={(e) => setAdjustmentLabel(e.target.value)}
                      placeholder={adjustmentType === 'discount' ? 'e.g., Volume discount' : 'e.g., Rush fee'}
                      className="w-full h-7 px-2 text-[12px] border border-border bg-white focus:outline-none focus:border-primary transition-colors"
                      style={{ borderRadius: '4px' }}
                    />

                    {/* Value Input with Method Toggle */}
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        {adjustmentMethod === 'percentage' && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                            %
                          </span>
                        )}
                        {adjustmentMethod === 'fixed' && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                            $
                          </span>
                        )}
                        <input
                          type="number"
                          value={adjustmentValue}
                          onChange={(e) => setAdjustmentValue(e.target.value)}
                          placeholder="0"
                          className={`w-full h-7 text-[12px] border border-border bg-white focus:outline-none focus:border-primary transition-colors ${
                            adjustmentMethod === 'percentage' ? 'px-2 pr-6' : 'px-2 pl-6'
                          }`}
                          style={{ borderRadius: '4px' }}
                        />
                      </div>
                      <button
                        onClick={() => setAdjustmentMethod(adjustmentMethod === 'percentage' ? 'fixed' : 'percentage')}
                        className="h-7 px-2 text-[11px] border border-border bg-white text-muted-foreground hover:border-border transition-colors"
                        style={{ borderRadius: '4px', fontWeight: 500 }}
                      >
                        {adjustmentMethod === 'percentage' ? '%' : '$'}
                      </button>
                    </div>

                    {/* Preview */}
                    {adjustmentValue && (
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border">
                        <span className="text-muted-foreground">
                          {adjustmentLabel || (adjustmentType === 'discount' ? 'Discount' : 'Fee')}
                        </span>
                        <span className={`${adjustmentType === 'discount' ? 'text-success' : 'text-[#7C3AED]'}`} style={{ fontWeight: 600 }}>
                          {adjustmentType === 'discount' ? '-' : '+'}{formatCurrency(adjustmentAmount)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showAdjustment && adjustmentValue && (
                <div className="flex items-center justify-between text-[14px]">
                  <div className="flex items-center gap-2">
                    <div
                      className={`px-2 py-1 text-[11px] ${
                        adjustmentType === 'discount' 
                          ? 'bg-success/15 text-success' 
                          : 'bg-[#EDE9FE] text-[#7C3AED]'
                      }`}
                      style={{ borderRadius: '4px', fontWeight: 500 }}
                    >
                      {adjustmentType === 'discount' ? 'Discount' : 'Fee'}
                    </div>
                    <span className="text-muted-foreground">{adjustmentLabel || 'Adjustment'}</span>
                  </div>
                  <span className={`${adjustmentType === 'discount' ? 'text-success' : 'text-[#7C3AED]'}`} style={{ fontWeight: 500 }}>
                    {formatCurrency(finalAdjustment)}
                  </span>
                </div>
              )}

              <div className="pt-4 border-t-2 border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[16px] text-foreground" style={{ fontWeight: 600 }}>
                    Grand Total
                  </span>
                  <span className="text-[24px] text-primary" style={{ fontWeight: 600 }}>
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pb-6">
            <button
              onClick={() => {}}
              className="flex-1 flex items-center justify-center gap-2 h-10 px-4 text-[13px] text-muted-foreground border border-border bg-white hover:bg-[#F0F7FF] transition-colors"
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              <Eye className="w-4 h-4" />
              Preview Quote
            </button>

            <button
              onClick={() => {}}
              className="flex-1 flex items-center justify-center gap-2 h-10 px-4 text-[13px] text-muted-foreground border border-border bg-white hover:bg-[#F0F7FF] transition-colors"
              style={{ borderRadius: '6px', fontWeight: 500 }}
            >
              <Download className="w-4 h-4" />
              Download Quote
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Assistive Text */}
      <div className="w-[360px] flex-shrink-0 bg-muted/40 border-l border-border overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-primary" />
              <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                Review & Submit
              </h3>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Review all details before submitting. Click edit buttons to make changes.
            </p>
          </div>

          <div className="border-t border-border pt-6">
            <h4 className="text-[12px] text-foreground mb-3" style={{ fontWeight: 600 }}>
              Next Steps
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Preview the quote to see customer view
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Download quote for offline sharing
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Create quote to save as draft or send to customer
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}