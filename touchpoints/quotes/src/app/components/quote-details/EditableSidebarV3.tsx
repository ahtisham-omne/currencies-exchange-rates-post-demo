// @ts-nocheck
import { useState } from 'react';
import { Building2, MapPin, Phone, Mail, User, CreditCard, Truck, Clock, Pencil, X, Check, Search, Tag as TagIcon } from 'lucide-react';
import { PaymentMethodSelectionModal } from '@/app/components/quote-creation/PaymentMethodSelectionModal';
import { PaymentTermsLibrary } from '@/app/components/quote-creation/PaymentTermsLibrary';

interface EditableSidebarProps {
  isEditable: boolean;
  subtotal: number;
  totalPricingRuleDiscounts: number;
  totalAdjustments: number;
  grandTotal: number;
  formatCurrency: (amount: number) => string;
}

const SALES_REPS = [
  { id: 'rep1', name: 'Sarah Chen', initials: 'SC', isCurrentUser: false, isCustomerDefault: true },
  { id: 'rep2', name: 'Michael Rodriguez', initials: 'MR', isCurrentUser: true, isCustomerDefault: false },
  { id: 'rep3', name: 'Emily Johnson', initials: 'EJ', isCurrentUser: false, isCustomerDefault: false },
  { id: 'rep4', name: 'David Kim', initials: 'DK', isCurrentUser: false, isCustomerDefault: false },
];

export function EditableSidebarV3({ isEditable, subtotal, totalPricingRuleDiscounts, totalAdjustments, grandTotal, formatCurrency }: EditableSidebarProps) {
  // Sales Reps - Multiple support
  const [selectedSalesReps, setSelectedSalesReps] = useState([
    { id: 'rep1', name: 'Sarah Chen', initials: 'SC', isPrimary: true },
    { id: 'rep2', name: 'Michael Rodriguez', initials: 'MR', isPrimary: false },
  ]);
  const [showSalesRepDropdown, setShowSalesRepDropdown] = useState(false);
  const [salesRepSearch, setSalesRepSearch] = useState('');

  // Payment & Shipping
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState({
    id: 'ach',
    name: 'ACH/Direct Deposit',
    icon: 'CreditCard' as const,
  });
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState('Net 30');
  const [showPaymentTermsLibrary, setShowPaymentTermsLibrary] = useState(false);
  const [shippingMethod, setShippingMethod] = useState('Standard (5-7 business days)');

  const toggleSalesRep = (repId: string) => {
    const isSelected = selectedSalesReps.some(r => r.id === repId);
    if (isSelected) {
      const rep = selectedSalesReps.find(r => r.id === repId);
      if (!rep?.isPrimary && selectedSalesReps.length > 1) {
        setSelectedSalesReps(selectedSalesReps.filter(r => r.id !== repId));
      }
    } else {
      const rep = SALES_REPS.find(r => r.id === repId);
      if (rep) {
        setSelectedSalesReps([...selectedSalesReps, { id: rep.id, name: rep.name, initials: rep.initials, isPrimary: false }]);
      }
    }
  };

  const setPrimarySalesRep = (repId: string) => {
    setSelectedSalesReps(selectedSalesReps.map(r => ({
      ...r,
      isPrimary: r.id === repId
    })));
  };

  const filteredSalesReps = SALES_REPS.filter(rep =>
    rep.name.toLowerCase().includes(salesRepSearch.toLowerCase())
  );

  const primaryRep = selectedSalesReps.find(r => r.isPrimary);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Section Label */}
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none' }}>
        QUOTE DETAILS
      </div>

      {/* Total Summary */}
      <div className="bg-white" style={{ borderRadius: '12px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px 0 rgba(0,0,0,0.06)', padding: '16px' }}>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span style={{ fontSize: '13px', color: 'var(--muted-foreground)', fontWeight: 500 }}>Subtotal</span>
            <span style={{ fontSize: '13px', color: 'var(--foreground-soft)', fontWeight: 500 }}>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ fontSize: '13px', color: 'var(--muted-foreground)', fontWeight: 500 }}>Pricing Rules</span>
            <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 600 }}>-{formatCurrency(totalPricingRuleDiscounts)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ fontSize: '13px', color: 'var(--muted-foreground)', fontWeight: 500 }}>Adjustments</span>
            <span style={{ fontSize: '13px', color: totalAdjustments >= 0 ? 'var(--destructive)' : 'var(--success)', fontWeight: 600 }}>
              {totalAdjustments >= 0 ? '+' : ''}{formatCurrency(totalAdjustments)}
            </span>
          </div>
          <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '8px 0' }} />
          <div className="flex justify-between items-center">
            <span style={{ fontSize: '14px', color: 'var(--foreground)', fontWeight: 700 }}>Grand Total</span>
            <span style={{ fontSize: '18px', color: 'var(--primary)', fontWeight: 700 }}>{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Customer & Contact */}
      <div className="bg-white" style={{ borderRadius: '12px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px 0 rgba(0,0,0,0.06)', padding: '16px' }}>
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: '8px' }}>
              <Building2 className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)' }}>Tri-County EMS Authority</span>
            </div>
            <div className="flex items-start gap-2" style={{ marginBottom: '4px', paddingLeft: '24px' }}>
              <MapPin className="w-3.5 h-3.5 mt-0.5" style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: 'var(--muted-foreground)', lineHeight: '1.4' }}>
                1234 Commerce St<br />
                San Francisco, CA 94105
              </span>
            </div>
          </div>
          <div style={{ height: '1px', backgroundColor: 'var(--muted)' }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '6px' }}>Primary Contact</div>
            <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
              <User className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
              <span style={{ fontSize: '13px', color: 'var(--foreground)', fontWeight: 500 }}>John Martinez</span>
            </div>
            <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
              <Mail className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
              <span style={{ fontSize: '13px', color: 'var(--primary)' }}>k.rodriguez@tricountyems.gov</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
              <span style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>+1 (415) 555-0123</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment & Shipping - Like creation flow */}
      <div className="bg-white" style={{ borderRadius: '12px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px 0 rgba(0,0,0,0.06)', padding: '12px' }}>
        <div className="space-y-1">
          {/* Payment Terms */}
          <div 
            className={`flex items-center justify-between px-3 py-2 rounded-md ${isEditable ? 'hover:bg-[var(--muted)] cursor-pointer' : ''} transition-all group`}
            onClick={() => isEditable && setShowPaymentTermsLibrary(true)}
            style={{
              transition: 'all 150ms ease',
            }}
          >
            <label className="text-[13px] text-muted-foreground" style={{ fontWeight: 400 }}>
              Payment terms
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                {selectedPaymentTerms}
              </span>
              {isEditable && <Pencil className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />}
            </div>
          </div>
          
          {/* Payment Method */}
          <div 
            className={`flex items-center justify-between px-3 py-2 rounded-md ${isEditable ? 'hover:bg-[var(--muted)] cursor-pointer' : ''} transition-all group`}
            onClick={() => isEditable && setShowPaymentMethodModal(true)}
            style={{
              transition: 'all 150ms ease',
            }}
          >
            <label className="text-[13px] text-muted-foreground" style={{ fontWeight: 400 }}>
              Payment method
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                  {selectedPaymentMethod.name}
                </span>
              </div>
              {isEditable && <Pencil className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />}
            </div>
          </div>
          
          {/* Sales Representative */}
          <div className="relative">
            <div 
              className={`flex items-center justify-between px-3 py-2 rounded-md ${isEditable ? 'hover:bg-[var(--muted)] cursor-pointer' : ''} transition-all group`}
              onClick={() => isEditable && setShowSalesRepDropdown(!showSalesRepDropdown)}
              style={{
                transition: 'all 150ms ease',
              }}
            >
              <label className="text-[13px] text-muted-foreground" style={{ fontWeight: 400 }}>
                Sales Representative{selectedSalesReps.length > 1 ? 's' : ''}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-white" style={{ fontWeight: 600 }}>
                    {primaryRep?.initials || 'SC'}
                  </div>
                  <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                    {primaryRep?.name || 'Sarah Chen'}
                  </span>
                  {selectedSalesReps.length > 1 && (
                    <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 500 }}>
                      +{selectedSalesReps.length - 1}
                    </span>
                  )}
                </div>
                {isEditable && <Pencil className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />}
              </div>
            </div>

            {/* Sales Rep Dropdown */}
            {showSalesRepDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSalesRepDropdown(false)}
                />
                <div
                  className="absolute right-0 bottom-full mb-1 w-80 bg-white rounded-lg shadow-lg border border-[var(--border)] z-20"
                  style={{ boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)' }}
                >
                  <div className="p-3 border-b border-[var(--border)]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search sales representatives..."
                        value={salesRepSearch}
                        onChange={(e) => setSalesRepSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-[13px] text-foreground border border-[var(--border)] rounded focus:outline-none focus:ring-2 focus:ring-[rgba(10, 119, 255, 0.4)] focus:border-transparent placeholder:text-border"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {filteredSalesReps.map((rep) => {
                      const isSelected = selectedSalesReps.some(r => r.id === rep.id);
                      const selectedRep = selectedSalesReps.find(r => r.id === rep.id);
                      return (
                        <div
                          key={rep.id}
                          className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                            isSelected ? 'bg-accent' : 'hover:bg-[var(--muted)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSalesRep(rep.id)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[11px] text-white flex-shrink-0" style={{ fontWeight: 600 }}>
                            {rep.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                                {rep.name}
                              </span>
                              {rep.isCurrentUser && (
                                <span className="text-[11px] text-muted-foreground">(You)</span>
                              )}
                              {rep.isCustomerDefault && (
                                <span className="inline-flex items-center h-4 px-1.5 text-[10px] bg-accent text-primary rounded" style={{ fontWeight: 500 }}>
                                  Customer Default
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <button
                              onClick={() => setPrimarySalesRep(rep.id)}
                              className="text-[10px] transition-colors"
                              style={{
                                padding: '2px 6px',
                                borderRadius: '3px',
                                backgroundColor: selectedRep?.isPrimary ? 'var(--primary)' : 'var(--muted)',
                                color: selectedRep?.isPrimary ? 'var(--background)' : 'var(--muted-foreground)',
                                fontWeight: 600,
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              {selectedRep?.isPrimary ? 'Primary' : 'Set Primary'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Shipping */}
          <div 
            className={`flex items-center justify-between px-3 py-2 rounded-md ${isEditable ? 'hover:bg-[var(--muted)] cursor-pointer' : ''} transition-all group`}
            style={{
              transition: 'all 150ms ease',
            }}
          >
            <label className="text-[13px] text-muted-foreground" style={{ fontWeight: 400 }}>
              Shipping
            </label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                  {shippingMethod}
                </span>
              </div>
              {isEditable && <Pencil className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Preview */}
      <div className="bg-white" style={{ borderRadius: '12px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px 0 rgba(0,0,0,0.06)', padding: '16px' }}>
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 mt-0.5" style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '13px', color: 'var(--foreground)', marginBottom: '4px' }}>Pricing updated</div>
              <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>2 hours ago</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 mt-0.5" style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '13px', color: 'var(--foreground)', marginBottom: '4px' }}>Status → Sent</div>
              <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Yesterday at 3:24 PM</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 mt-0.5" style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '13px', color: 'var(--foreground)', marginBottom: '4px' }}>Quote created</div>
              <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>01/20/2026</div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentMethodModal && (
        <PaymentMethodSelectionModal
          onClose={() => setShowPaymentMethodModal(false)}
          onSelect={(method) => {
            setSelectedPaymentMethod(method);
            setShowPaymentMethodModal(false);
          }}
          selectedMethod={selectedPaymentMethod}
        />
      )}

      {/* Payment Terms Library Modal */}
      {showPaymentTermsLibrary && (
        <PaymentTermsLibrary
          onClose={() => setShowPaymentTermsLibrary(false)}
          onSelect={(terms) => {
            setSelectedPaymentTerms(terms.name);
            setShowPaymentTermsLibrary(false);
          }}
          selectedTerms={selectedPaymentTerms}
        />
      )}
    </div>
  );
}