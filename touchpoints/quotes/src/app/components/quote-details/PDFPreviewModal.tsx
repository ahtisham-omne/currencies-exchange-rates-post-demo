import { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Eye, Percent, Paperclip, CreditCard, ChevronDown, ChevronRight, Download, Mail, Printer, Calculator, StickyNote, ClipboardList, Settings2, PanelLeftClose, PanelLeft } from 'lucide-react';
import { toast } from 'sonner';

// ── Visibility config ──
interface VisibilityConfig {
  companyLogo: boolean;
  pricingRules: boolean;
  showDiscountBreakdown: boolean;
  showPremium: boolean;
  usePremiumLabel: boolean;
  premiumLabel: string;
  adjustments: boolean;
  attachments: boolean;
  paymentCharges: boolean;
  notes: boolean;
  termsAndConditions: boolean;
}

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteNumber?: string;
  customerName?: string;
  contactName?: string;
  quote?: {
    quoteNumber: string;
    customerName: string;
    version: number;
    items: any[];
    subtotal: number;
    tax: number;
    total: number;
    status: string;
  };
  mode?: 'download' | 'print';
  /** Customer's quote currency. Drives the FX header/footer + dual-column option. */
  customerCurrency?: string;
  /** Customer→base rate locked at quote send time. Used when rendering both currencies. */
  quoteLockedRate?: number;
  /** Active rate book at lock time. */
  rateType?: 'market' | 'corporate';
  /** ISO date the rate was locked (defaults to today). */
  lockedAt?: string;
}

// ── Toggle component ──
function Toggle({ checked, onChange, size = 'default' }: { checked: boolean; onChange: (val: boolean) => void; size?: 'default' | 'small' }) {
  const w = size === 'small' ? 32 : 36;
  const h = size === 'small' ? 18 : 20;
  const dot = size === 'small' ? 14 : 16;
  const offset = 2;

  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: `${w}px`, height: `${h}px`, borderRadius: `${h}px`, padding: 0, border: 'none',
        backgroundColor: checked ? '#3B82F6' : '#D1D5DB', cursor: 'pointer',
        position: 'relative', transition: 'background-color 200ms ease', flexShrink: 0,
      }}
    >
      <div style={{
        width: `${dot}px`, height: `${dot}px`, borderRadius: '50%', backgroundColor: '#FFFFFF',
        position: 'absolute', top: `${offset}px`,
        left: checked ? `${w - dot - offset}px` : `${offset}px`,
        transition: 'left 200ms ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </button>
  );
}

// ── Dummy line items ──
const DUMMY_ITEMS = [
  { id: 'LI-001', description: 'Cloud infrastructure setup — AWS/GCP environment provisioning, VPC configuration, IAM policies, and monitoring stack', qty: 1, uom: 'Project', unitPrice: 8500, ruleDiscount: 0, rulePremium: 0 },
  { id: 'LI-002', description: 'REST API integration module — ERP data sync connectors with retry logic, webhook endpoints, and error handling', qty: 3, uom: 'Module', unitPrice: 2200, ruleDiscount: 10, rulePremium: 0 },
  { id: 'LI-003', description: 'Legacy database migration service — Schema mapping, data cleansing, validation, and rollback procedures', qty: 1, uom: 'Service', unitPrice: 4800, ruleDiscount: 5, rulePremium: 0 },
  { id: 'LI-004', description: 'On-site user training — 2-day hands-on workshop for up to 25 users, includes printed materials', qty: 2, uom: 'Session', unitPrice: 1500, ruleDiscount: 0, rulePremium: 0 },
  { id: 'LI-005', description: 'Extended support & maintenance — 12-month post-deployment SLA with 4-hour response time', qty: 1, uom: 'Year', unitPrice: 3600, ruleDiscount: 0, rulePremium: 8 },
];

const DUMMY_ATTACHMENTS = [
  { name: 'Technical_Specifications_v2.pdf', size: '2.4 MB' },
  { name: 'SLA_Agreement_Draft.docx', size: '890 KB' },
  { name: 'Infrastructure_Diagram.png', size: '1.1 MB' },
];

export function PDFPreviewModal({ isOpen, onClose, quoteNumber = 'Q-2026-0142', customerName = 'Tri-County EMS Authority', contactName = 'Karen Rodriguez', mode = 'download', customerCurrency, quoteLockedRate, rateType = 'market', lockedAt }: PDFPreviewModalProps) {
  // Clean defaults: no rules/adjustments/payment charges shown
  const [config, setConfig] = useState<VisibilityConfig>({
    companyLogo: true,
    pricingRules: false,
    showDiscountBreakdown: false,
    showPremium: false,
    usePremiumLabel: false,
    premiumLabel: '',
    adjustments: false,
    attachments: true,
    paymentCharges: false,
    notes: true,
    termsAndConditions: true,
  });

  // ── FX-specific print/export options ────────────────────────────────
  // When the customer settles in PKR the toggle group is hidden because
  // there's nothing to convert; everything renders in base.
  const fxAvailable = !!customerCurrency && customerCurrency.toUpperCase() !== 'PKR';
  const [includeRateSource, setIncludeRateSource] = useState(true);
  // The "Print in" pick drives the currency for the entire preview body
  // (line items, subtotal, totals). The rate line beneath the Grand Total
  // surfaces the conversion the customer can verify.
  const [printIn, setPrintIn] = useState<'customer' | 'base'>('customer');
  const customerSym = (() => {
    const map: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', CAD: 'C$', AUD: 'A$', JPY: '¥', INR: '₹', SAR: '﷼' };
    return customerCurrency ? (map[customerCurrency.toUpperCase()] ?? customerCurrency.toUpperCase()) : '$';
  })();
  const lockedAtDisplay = (() => {
    const d = lockedAt ? new Date(lockedAt) : new Date();
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  })();
  const rateTypeLabel = rateType === 'market' ? 'Mid-market' : 'Corporate';

  const [pricingExpanded, setPricingExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  if (!isOpen) return null;

  const updateConfig = (key: keyof VisibilityConfig, value: boolean | string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleDownload = () => {
    toast.success('Generating Quote...', { description: `${quoteNumber} will be downloaded shortly.` });
    onClose();
  };

  const handlePrint = () => {
    toast.success('Preparing print preview...', { description: `${quoteNumber} print dialog opening.` });
    onClose();
    setTimeout(() => window.print(), 300);
  };

  const handleEmail = () => {
    toast.success('Email draft created', { description: `Quote ${quoteNumber} attached and ready to send to ${customerName}.` });
    onClose();
  };

  // ── Compute totals ──
  const subtotal = DUMMY_ITEMS.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const totalDiscount = DUMMY_ITEMS.reduce((sum, item) => sum + (item.qty * item.unitPrice * item.ruleDiscount / 100), 0);
  const premiumAmount = 1250;
  const adjustmentAmount = -480;
  const paymentChargeAmount = 375;
  const netAfterDiscount = subtotal - (config.pricingRules && config.showDiscountBreakdown ? totalDiscount : 0);
  const netAfterPremium = netAfterDiscount + (config.pricingRules && config.showPremium ? premiumAmount : 0);
  const netAfterAdjustments = netAfterPremium + (config.adjustments ? adjustmentAmount : 0);
  const grandTotal = netAfterAdjustments + (config.paymentCharges ? paymentChargeAmount : 0);

  const premiumLabel = config.usePremiumLabel && config.premiumLabel.trim() ? config.premiumLabel.trim() : 'Premium Surcharge';

  // Active print currency drives every amount rendered in the body — line
  // items, subtotal, total. Raw mock values are treated as customer-currency
  // amounts (legacy '$' rendering); converting to base multiplies by the
  // locked rate (PKR per 1 customer unit).
  const lr = quoteLockedRate ?? 0;
  const printingInBase = fxAvailable && printIn === 'base';
  const printSym = !fxAvailable ? '$' : (printingInBase ? '₨' : customerSym);
  const printCode = !fxAvailable ? '' : (printingInBase ? 'PKR' : customerCurrency!.toUpperCase());
  const toPrintAmount = (n: number) => printingInBase && lr ? n * lr : n;
  const fmtNumber = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtCurrency = (n: number) => `${printSym} ${fmtNumber(toPrintAmount(n))}`;

  // Count active overrides (non-default settings)
  const activeOverrides = [config.pricingRules, config.showDiscountBreakdown, config.showPremium, config.adjustments, config.paymentCharges].filter(Boolean).length;

  return ReactDOM.createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px', width: showSettings ? '1080px' : '740px',
          maxWidth: '95vw',
          height: '88vh', maxHeight: '800px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)', fontFamily: 'Inter, system-ui, sans-serif',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transition: 'width 250ms ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: mode === 'print' ? '#FEF3C7' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {mode === 'print'
                ? <Printer style={{ width: '16px', height: '16px', color: '#D97706' }} />
                : <Download style={{ width: '16px', height: '16px', color: '#3B82F6' }} />
              }
            </div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', lineHeight: '1', margin: 0, marginBottom: '5px' }}>
                {mode === 'print' ? 'Print Quote' : 'Export Quote'}
              </h2>
              <p style={{ fontSize: '11px', color: '#6B7280', margin: 0, lineHeight: '1' }}>
                Preview before {mode === 'print' ? 'printing' : 'exporting'} — customize what's visible
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Settings toggle button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                height: '28px', padding: '0 10px', borderRadius: '6px',
                borderWidth: '1px', borderStyle: 'solid',
                borderColor: showSettings ? '#1B6EF3' : '#E5E7EB',
                backgroundColor: showSettings ? '#E7F3FF' : '#FFFFFF',
                color: showSettings ? '#1B6EF3' : '#6B7280',
                fontSize: '11px', fontWeight: 500, cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { if (!showSettings) { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; } }}
              onMouseLeave={e => { if (!showSettings) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; } }}
            >
              {showSettings
                ? <><PanelLeftClose style={{ width: '13px', height: '13px' }} /> Hide Options</>
                : <><Settings2 style={{ width: '13px', height: '13px' }} /> Visibility Options{activeOverrides > 0 && (
                  <span style={{
                    fontSize: '9px', fontWeight: 700, color: '#FFFFFF', backgroundColor: '#1B6EF3',
                    width: '14px', height: '14px', borderRadius: '50%', display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center', lineHeight: '1', marginLeft: '1px',
                  }}>{activeOverrides}</span>
                )}</>
              }
            </button>
            <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              <X style={{ width: '16px', height: '16px', color: '#6B7280' }} />
            </button>
          </div>
        </div>

        {/* ── Body: Left settings (collapsible) + Right preview ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* ──── LEFT: Visibility Settings (shown only when toggled) ──── */}
          {showSettings && (
            <div style={{ width: '340px', flexShrink: 0, borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '14px 20px 8px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <Eye style={{ width: '13px', height: '13px', color: '#6B7280' }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>
                    Visibility Settings
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0, lineHeight: '1.4' }}>
                  Choose what your customer will see on this quote.
                </p>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}>

                {/* ─ Company Logo ─ */}
                <SettingRow
                  icon={<div style={{ width: '14px', height: '14px', borderRadius: '3px', backgroundColor: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '8px', fontWeight: 700, color: '#FFF', lineHeight: '1' }}>Co</span>
                  </div>}
                  iconBg="#F3F4F6"
                  title="Company Logo & Header"
                  desc="Show your company branding at the top."
                  checked={config.companyLogo}
                  onChange={val => updateConfig('companyLogo', val)}
                />

                {/* ─ Pricing Rules ─ */}
                <div style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px' }}>
                    <button
                      onClick={() => setPricingExpanded(!pricingExpanded)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}
                    >
                      <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Percent style={{ width: '13px', height: '13px', color: '#3B82F6' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Pricing Rules
                          {config.pricingRules && (
                            pricingExpanded
                              ? <ChevronDown style={{ width: '11px', height: '11px', color: '#9CA3AF' }} />
                              : <ChevronRight style={{ width: '11px', height: '11px', color: '#9CA3AF' }} />
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.3' }}>
                          Calculation details and adjustments.
                        </div>
                      </div>
                    </button>
                    <Toggle checked={config.pricingRules} onChange={val => updateConfig('pricingRules', val)} size="small" />
                  </div>

                  {config.pricingRules && pricingExpanded && (
                    <div style={{ padding: '0 20px 12px', paddingLeft: '54px' }}>
                      <div style={{ backgroundColor: '#F9FAFB', borderRadius: '8px', border: '1px solid #F3F4F6', overflow: 'hidden' }}>
                        <NestedToggle
                          title="Show discount breakdown"
                          desc="Display discounts on each line item."
                          checked={config.showDiscountBreakdown}
                          onChange={val => updateConfig('showDiscountBreakdown', val)}
                          borderBottom
                        />
                        <div style={{ padding: '8px 12px' }}>
                          <NestedToggle
                            title="Show premium"
                            desc="Additional charges from rules or adjustments."
                            checked={config.showPremium}
                            onChange={val => updateConfig('showPremium', val)}
                          />
                          {config.showPremium && (
                            <div style={{ marginTop: '8px', padding: '8px 10px', backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: config.usePremiumLabel ? '6px' : 0 }}>
                                <div>
                                  <div style={{ fontSize: '11px', fontWeight: 500, color: '#374151', lineHeight: '1', marginBottom: '1px' }}>Label premium as</div>
                                  <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.2' }}>Custom label instead of "Premium"</div>
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
                                    width: '100%', height: '28px', padding: '0 8px', fontSize: '11px',
                                    color: '#1F2937', border: '1px solid #E5E7EB', borderRadius: '5px',
                                    outline: 'none', backgroundColor: '#FAFBFC', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box',
                                  }}
                                  onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px #DBEAFE'; }}
                                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ─ Adjustments ─ */}
                <SettingRow
                  icon={<Calculator style={{ width: '13px', height: '13px', color: '#8B5CF6' }} />}
                  iconBg="#EDE9FE"
                  title="Adjustments"
                  desc="Item-level and quote-level adjustments."
                  checked={config.adjustments}
                  onChange={val => updateConfig('adjustments', val)}
                />

                {/* ─ Currency & FX (only when customer settles in non-PKR) —
                      drives the currency used throughout the preview body.
                      Placed right before Attachments per design feedback so
                      it sits with the document-content options rather than
                      at the top of the panel. ─ */}
                {fxAvailable && (
                  <>
                    <div style={{ borderBottom: '1px solid #F3F4F6', padding: '12px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', lineHeight: '1' }}>$₨</span>
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1', marginBottom: '4px' }}>Print currency</div>
                          <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.3' }}>Pick the currency used for line items, subtotal, and total.</div>
                        </div>
                      </div>
                      <div style={{ paddingLeft: '34px', display: 'flex', gap: 4 }}>
                        {(['customer', 'base'] as const).map((opt) => {
                          const selected = printIn === opt;
                          const label = opt === 'customer'
                            ? `${customerSym} ${customerCurrency!.toUpperCase()}`
                            : '₨ PKR';
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setPrintIn(opt)}
                              style={{
                                padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600, lineHeight: '1',
                                border: selected ? '1px solid #1B6EF3' : '1px solid #E5E7EB',
                                backgroundColor: selected ? '#EDF4FF' : '#FFFFFF',
                                color: selected ? '#1B6EF3' : '#6B7280',
                                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <SettingRow
                      icon={<span style={{ fontSize: '11px', fontWeight: 700, color: '#0891B2', lineHeight: '1' }}>R</span>}
                      iconBg="#ECFEFF"
                      title="Include rate source & timestamp"
                      desc="Print the rate book name and the date it was locked in the footer."
                      checked={includeRateSource}
                      onChange={setIncludeRateSource}
                    />
                  </>
                )}

                {/* ─ Attachments ─ */}
                <SettingRow
                  icon={<Paperclip style={{ width: '13px', height: '13px', color: '#D97706' }} />}
                  iconBg="#FEF3C7"
                  title="Attachments"
                  desc="Include uploaded files or link references."
                  checked={config.attachments}
                  onChange={val => updateConfig('attachments', val)}
                />

                {/* ─ Payment Charges ─ */}
                <SettingRow
                  icon={<CreditCard style={{ width: '13px', height: '13px', color: '#059669' }} />}
                  iconBg="#ECFDF5"
                  title="Payment Charges"
                  desc="Fees based on payment method."
                  checked={config.paymentCharges}
                  onChange={val => updateConfig('paymentCharges', val)}
                />

                {/* ─ Notes ─ */}
                <SettingRow
                  icon={<StickyNote style={{ width: '13px', height: '13px', color: '#6B7280' }} />}
                  iconBg="#FFF7ED"
                  title="Notes"
                  desc="Internal notes visible to customer."
                  checked={config.notes}
                  onChange={val => updateConfig('notes', val)}
                />

                {/* ─ Terms & Conditions ─ */}
                <SettingRow
                  icon={<ClipboardList style={{ width: '13px', height: '13px', color: '#6B7280' }} />}
                  iconBg="#F0FDF4"
                  title="Terms & Conditions"
                  desc="Standard terms and payment policies."
                  checked={config.termsAndConditions}
                  onChange={val => updateConfig('termsAndConditions', val)}
                  noBorder
                />
              </div>
            </div>
          )}

          {/* ──── RIGHT: Live Preview ──── */}
          <div style={{ flex: 1, backgroundColor: '#F3F4F6', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* Preview header bar */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>Preview</span>
            </div>

            {/* Scrollable preview */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', justifyContent: 'center' }}>
              {/* The "page" */}
              <div style={{
                width: '100%', maxWidth: '580px',
                backgroundColor: '#FFFFFF',
                borderRadius: '4px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
                padding: '36px 32px',
                fontFamily: 'Inter, system-ui, sans-serif',
                alignSelf: 'flex-start',
              }}>

                {/* ─ Company header ─ */}
                {config.companyLogo && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #3B82F6' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#FFF', lineHeight: '1' }}>O</span>
                        </div>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#1F2937', letterSpacing: '-0.3px' }}>Omne</span>
                      </div>
                      <div style={{ fontSize: '9px', color: '#9CA3AF', lineHeight: '1.5' }}>
                        200 Park Avenue, 18th Floor<br />
                        New York, NY 10166 · (212) 555-0482
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#1F2937', letterSpacing: '-0.5px', marginBottom: '2px' }}>QUOTATION</div>
                      <div style={{ fontSize: '10px', color: '#6B7280', lineHeight: '1.6' }}>
                        {quoteNumber}<br />
                        Date: 02/05/2026<br />
                        Valid Until: 03/07/2026
                      </div>
                    </div>
                  </div>
                )}

                {!config.companyLogo && (
                  <div style={{ marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1F2937', marginBottom: '2px' }}>QUOTATION</div>
                    <div style={{ fontSize: '10px', color: '#6B7280' }}>{quoteNumber} · 02/05/2026</div>
                  </div>
                )}

                {/* ─ Bill To ─ */}
                <div style={{ display: 'flex', gap: '32px', marginBottom: '20px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '8px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Bill To</div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#1F2937', marginBottom: '1px' }}>{customerName}</div>
                    <div style={{ fontSize: '9px', color: '#6B7280', lineHeight: '1.5' }}>
                      Attn: {contactName}<br />
                      456 Enterprise Blvd, Floor 12<br />
                      New York, NY 10001
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '8px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Quote Details</div>
                    <div style={{ fontSize: '9px', color: '#6B7280', lineHeight: '1.8' }}>
                      <span style={{ display: 'inline-block', width: '70px', color: '#9CA3AF' }}>Sales Rep:</span> <span style={{ color: '#1F2937', fontWeight: 500 }}>Sarah Chen</span><br />
                      <span style={{ display: 'inline-block', width: '70px', color: '#9CA3AF' }}>Currency:</span> <span style={{ color: '#1F2937', fontWeight: 500 }}>{fxAvailable ? printCode : 'USD'}</span><br />
                      <span style={{ display: 'inline-block', width: '70px', color: '#9CA3AF' }}>Payment:</span> <span style={{ color: '#1F2937', fontWeight: 500 }}>Net 30</span>
                    </div>
                  </div>
                </div>

                {/* ─ Line Items Table ─ */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0', fontSize: '9px' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'left', width: '36%' }}>Description</th>
                      <th style={{ ...thStyle, textAlign: 'right', width: '10%' }}>Qty</th>
                      <th style={{ ...thStyle, textAlign: 'left', width: '12%', paddingLeft: '8px' }}>UOM</th>
                      <th style={{ ...thStyle, textAlign: 'right', width: '16%' }}>Unit Price</th>
                      {config.pricingRules && config.showDiscountBreakdown && (
                        <th style={{ ...thStyle, textAlign: 'right', width: '12%' }}>Discount</th>
                      )}
                      <th style={{ ...thStyle, textAlign: 'right', width: '16%' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DUMMY_ITEMS.map((item) => {
                      const lineTotal = item.qty * item.unitPrice;
                      const discountAmt = lineTotal * item.ruleDiscount / 100;
                      return (
                        <tr key={item.id}>
                          <td style={{ ...tdStyle, textAlign: 'left' }}>
                            <div style={{ fontWeight: 600, color: '#1F2937', fontSize: '10px', lineHeight: '1.2' }}>{item.description}</div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1F2937' }}>{item.qty}</td>
                          <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: '8px', color: '#6B7280' }}>{item.uom}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#1F2937' }}>{fmtCurrency(item.unitPrice)}</td>
                          {config.pricingRules && config.showDiscountBreakdown && (
                            <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: item.ruleDiscount > 0 ? '#059669' : '#D1D5DB' }}>
                              {item.ruleDiscount > 0 ? `-${item.ruleDiscount}%` : '—'}
                            </td>
                          )}
                          <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#1F2937' }}>
                            {fmtCurrency(lineTotal - (config.pricingRules && config.showDiscountBreakdown ? discountAmt : 0))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* ─ Totals ─ */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0' }}>
                  <div style={{ width: '220px' }}>
                    <TotalRow label="Subtotal" value={fmtCurrency(subtotal)} />
                    {config.pricingRules && config.showDiscountBreakdown && totalDiscount > 0 && (
                      <TotalRow label="Discounts" value={`-${fmtCurrency(totalDiscount)}`} color="#059669" />
                    )}
                    {config.pricingRules && config.showPremium && (
                      <TotalRow label={premiumLabel} value={`+${fmtCurrency(premiumAmount)}`} color="#D97706" />
                    )}
                    {config.adjustments && (
                      <TotalRow label="Adjustments" value={`-${fmtCurrency(Math.abs(adjustmentAmount))}`} color="#8B5CF6" />
                    )}
                    {config.paymentCharges && (
                      <TotalRow label="Payment Processing Fee" value={`+${fmtCurrency(paymentChargeAmount)}`} color="#6B7280" />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: '4px', borderTop: '2px solid #1F2937' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#1F2937' }}>Total</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1F2937', fontVariantNumeric: 'tabular-nums' }}>{fmtCurrency(grandTotal)}</span>
                    </div>
                    {/* Rate line — sits directly below the Total so the
                        customer can verify the conversion that produced it. */}
                    {fxAvailable && lr > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginTop: 6, fontSize: '8.5px', color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: rateType === 'market' ? '#7c3aed' : '#d97706' }} />
                        <span>
                          1 {customerCurrency!.toUpperCase()} = ₨ {lr.toFixed(2)} · {rateTypeLabel}
                          {lockedAtDisplay ? ` · ${lockedAtDisplay}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ─ Attachments ─ */}
                {config.attachments && (
                  <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: '8px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Attachments</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {DUMMY_ATTACHMENTS.map((a, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', backgroundColor: '#F9FAFB', borderRadius: '4px', border: '1px solid #F3F4F6' }}>
                          <Paperclip style={{ width: '10px', height: '10px', color: '#9CA3AF', flexShrink: 0 }} />
                          <span style={{ fontSize: '9px', fontWeight: 500, color: '#374151', flex: 1 }}>{a.name}</span>
                          <span style={{ fontSize: '8px', color: '#9CA3AF' }}>{a.size}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─ Notes ─ */}
                {config.notes && (
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: '8px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Notes</div>
                    <div style={{ fontSize: '9px', color: '#6B7280', lineHeight: '1.6' }}>
                      Please review all line items and their descriptions carefully. This quote is valid for 30 days from the issue date. Contact your sales representative for any questions or modifications.
                    </div>
                  </div>
                )}

                {/* ─ Terms & Conditions ─ */}
                {config.termsAndConditions && (
                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: '8px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Terms & Conditions</div>
                    <div style={{ fontSize: '8px', color: '#9CA3AF', lineHeight: '1.6' }}>
                      1. Payment is due within 30 days of invoice date. 2. Late payments are subject to a 1.5% monthly finance charge.
                      3. All prices are in {fxAvailable ? printCode : 'USD'} unless otherwise noted. 4. This quote does not constitute a binding agreement until signed by both parties.
                      5. Pricing may be adjusted with 15 days written notice. 6. Subject to final verification at time of order conversion.
                    </div>
                  </div>
                )}

                {/* ─ FX footer disclaimer (rate source + lock timestamp + advisory) ─ */}
                {fxAvailable && includeRateSource && (
                  <div style={{
                    marginTop: '20px', padding: '8px 12px',
                    borderRadius: '4px', backgroundColor: '#FAFBFC', border: '1px solid #F3F4F6',
                    display: 'flex', flexDirection: 'column', gap: 3,
                  }}>
                    {includeRateSource && (
                      <div style={{ fontSize: '8.5px', color: '#6B7280', lineHeight: '1.5', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontWeight: 600 }}>Rate source:</span>{' '}
                        {rateType === 'market' ? 'Open Exchange Rates (Mid-market)' : 'Corporate Treasury (Q1 FY26)'}
                        {lockedAtDisplay && <> · Locked on {lockedAtDisplay}</>}
                      </div>
                    )}
                    <div style={{ fontSize: '8px', color: '#9CA3AF', fontStyle: 'italic', lineHeight: '1.5' }}>
                      Amounts reflect the exchange rate locked at quote creation.
                    </div>
                  </div>
                )}

                {/* ─ Footer ─ */}
                <div style={{ marginTop: '24px', paddingTop: '10px', borderTop: '1px solid #E5E7EB', textAlign: 'center' }}>
                  <div style={{ fontSize: '8px', color: '#D1D5DB', lineHeight: '1.5' }}>
                    Generated by Omne ERP · {quoteNumber} · Page 1 of 1
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
            Changes only affect this export — they won't modify the quote.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={onClose} style={{
              height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500, color: '#6B7280',
              backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 150ms',
            }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}>
              Cancel
            </button>
            {mode === 'download' && (
              <button onClick={handleEmail} style={{
                height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500, color: '#374151',
                backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 150ms',
                display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
              }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
                <Mail style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                Email to Customer
              </button>
            )}
            <button onClick={mode === 'print' ? handlePrint : handleDownload} style={{
              height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 600, color: '#FFFFFF',
              backgroundColor: '#3B82F6', border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms',
              display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
            }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2563EB'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#3B82F6'}>
              {mode === 'print'
                ? <><Printer style={{ width: '14px', height: '14px' }} /> Print Quote</>
                : <><Download style={{ width: '14px', height: '14px' }} /> Export Quote</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Reusable components ──

const thStyle: React.CSSProperties = {
  padding: '7px 6px',
  fontSize: '8px',
  fontWeight: 600,
  color: '#9CA3AF',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  borderBottom: '1px solid #E5E7EB',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 6px',
  fontSize: '9px',
  borderBottom: '1px solid #F3F4F6',
  verticalAlign: 'top',
};

function TotalRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ fontSize: '9px', color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: '10px', fontWeight: 500, color: color || '#1F2937', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function SettingRow({
  icon, iconBg, title, desc, checked, onChange, noBorder,
}: {
  icon: React.ReactNode; iconBg: string; title: string; desc: string;
  checked: boolean; onChange: (val: boolean) => void; noBorder?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: noBorder ? 'none' : '1px solid #F3F4F6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1', marginBottom: '4px' }}>{title}</div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.3' }}>{desc}</div>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} size="small" />
    </div>
  );
}

function NestedToggle({
  title, desc, checked, onChange, borderBottom,
}: {
  title: string; desc: string; checked: boolean; onChange: (val: boolean) => void; borderBottom?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: borderBottom ? '1px solid #F3F4F6' : 'none' }}>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 500, color: '#1F2937', lineHeight: '1', marginBottom: '1px' }}>{title}</div>
        <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.2' }}>{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} size="small" />
    </div>
  );
}