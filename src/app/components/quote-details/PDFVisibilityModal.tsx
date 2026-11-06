import { useState } from 'react';
import { X, Eye, Percent, DollarSign, Paperclip, CreditCard, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface VisibilityConfig {
  pricingRules: boolean;
  showDiscountBreakdown: boolean;
  showPremium: boolean;
  usePremiumLabel: boolean;
  premiumLabel: string;
  attachments: boolean;
  paymentCharges: boolean;
}

interface PDFVisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Toggle({ checked, onChange, size = 'default' }: { checked: boolean; onChange: (val: boolean) => void; size?: 'default' | 'small' }) {
  const w = size === 'small' ? 32 : 36;
  const h = size === 'small' ? 18 : 20;
  const dot = size === 'small' ? 14 : 16;
  const offset = size === 'small' ? 2 : 2;

  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: `${w}px`, height: `${h}px`, borderRadius: `${h}px`, padding: 0, border: 'none',
        backgroundColor: checked ? 'var(--primary)' : 'var(--border)', cursor: 'pointer',
        position: 'relative', transition: 'background-color 200ms ease', flexShrink: 0,
      }}
    >
      <div style={{
        width: `${dot}px`, height: `${dot}px`, borderRadius: '50%', backgroundColor: 'var(--background)',
        position: 'absolute', top: `${offset}px`,
        left: checked ? `${w - dot - offset}px` : `${offset}px`,
        transition: 'left 200ms ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </button>
  );
}

export function PDFVisibilityModal({ isOpen, onClose }: PDFVisibilityModalProps) {
  const [config, setConfig] = useState<VisibilityConfig>({
    pricingRules: true,
    showDiscountBreakdown: true,
    showPremium: true,
    usePremiumLabel: false,
    premiumLabel: '',
    attachments: true,
    paymentCharges: true,
  });

  const [pricingExpanded, setPricingExpanded] = useState(true);

  if (!isOpen) return null;

  const updateConfig = (key: keyof VisibilityConfig, value: boolean | string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    toast.success('Visibility settings applied');
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--card)', borderRadius: '12px', width: '480px', maxWidth: '95vw',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', fontFamily: 'Inter, system-ui, sans-serif',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye style={{ width: '16px', height: '16px', color: 'var(--primary)' }} />
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1', margin: 0 }}>
                Quote Visibility Options
              </h2>
            </div>
            <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--muted)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <X style={{ width: '16px', height: '16px', color: 'var(--muted-foreground)' }} />
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: 0, lineHeight: '1.4' }}>
            Choose what details your customer will see on this quote.
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '8px 0', overflowY: 'auto', maxHeight: '60vh' }}>

          {/* ── Pricing Rules Section ── */}
          <div style={{ borderBottom: '1px solid var(--muted)' }}>
            {/* Main toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}>
              <button
                onClick={() => setPricingExpanded(!pricingExpanded)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}
              >
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Percent style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Pricing Rules
                    {config.pricingRules && (
                      pricingExpanded
                        ? <ChevronDown style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
                        : <ChevronRight style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.3' }}>
                    Show calculation details and adjustments that affected prices.
                  </div>
                </div>
              </button>
              <Toggle checked={config.pricingRules} onChange={val => updateConfig('pricingRules', val)} />
            </div>

            {/* Nested options */}
            {config.pricingRules && pricingExpanded && (
              <div style={{ padding: '0 24px 14px', paddingLeft: '62px' }}>
                <div style={{ backgroundColor: 'var(--muted)', borderRadius: '8px', border: '1px solid var(--muted)', overflow: 'hidden' }}>
                  {/* Show discount breakdown */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--muted)' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1', marginBottom: '4px' }}>
                        Show pricing rules breakdown
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.3' }}>
                        Display pricing rules applied to each line item and at quote level.
                      </div>
                    </div>
                    <Toggle checked={config.showDiscountBreakdown} onChange={val => updateConfig('showDiscountBreakdown', val)} size="small" />
                  </div>

                  {/* Show premium */}
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1', marginBottom: '4px' }}>
                          Show premium
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.3' }}>
                          Show any additional charges added by rules or manual adjustments.
                        </div>
                      </div>
                      <Toggle checked={config.showPremium} onChange={val => updateConfig('showPremium', val)} size="small" />
                    </div>

                    {/* Label premium as — nested under Show premium */}
                    {config.showPremium && (
                      <div style={{ marginTop: '10px', padding: '10px 12px', backgroundColor: 'var(--background)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: config.usePremiumLabel ? '8px' : 0 }}>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1', marginBottom: '4px' }}>
                              Label premium as
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', lineHeight: '1.3' }}>
                              Custom label to show instead of "Premium"
                            </div>
                          </div>
                          <Toggle checked={config.usePremiumLabel} onChange={val => updateConfig('usePremiumLabel', val)} size="small" />
                        </div>
                        {config.usePremiumLabel && (
                          <input
                            type="text"
                            value={config.premiumLabel}
                            onChange={e => updateConfig('premiumLabel', e.target.value)}
                            placeholder="Additional Charges"
                            style={{
                              width: '100%', height: '32px', padding: '0 10px', fontSize: '12px',
                              color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '6px',
                              outline: 'none', backgroundColor: '#FAFBFC', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box',
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Attachments ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--muted)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(217, 119, 6, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Paperclip style={{ width: '14px', height: '14px', color: 'var(--warning)' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1', marginBottom: '5px' }}>
                  Attachments
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.3' }}>
                  Include references to any uploaded files or links on the quote.
                </div>
              </div>
            </div>
            <Toggle checked={config.attachments} onChange={val => updateConfig('attachments', val)} />
          </div>

          {/* ── Payment Charges ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(5, 150, 105, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CreditCard style={{ width: '14px', height: '14px', color: 'var(--success)' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1', marginBottom: '5px' }}>
                  Payment Charges
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.3' }}>
                  Show any fees based on the partner's payment method choice.
                </div>
              </div>
            </div>
            <Toggle checked={config.paymentCharges} onChange={val => updateConfig('paymentCharges', val)} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 24px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{
            height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: 'var(--muted-foreground)',
            backgroundColor: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
          }}>
            Cancel
          </button>
          <button onClick={handleApply} style={{
            height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: '#FFFFFF',
            backgroundColor: 'var(--primary)', border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms',
          }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--primary)'}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}