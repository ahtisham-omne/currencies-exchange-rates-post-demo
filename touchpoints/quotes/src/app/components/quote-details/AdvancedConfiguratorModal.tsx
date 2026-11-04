// @ts-nocheck
import { useState } from 'react';
import { X, Plus, Trash2, Pencil, Percent, DollarSign, Settings2, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { AdjustmentFormModal } from '../shared/AdjustmentFormModal';
import type { AdjustmentFormData } from '../shared/AdjustmentFormModal';

interface PricingRule {
  id: string;
  name: string;
  type: 'discount' | 'premium';
  value: number;
  amountType: '%' | '$';
}

interface OneTimeAdjustment {
  id: string;
  type: 'discount' | 'premium';
  amountType: '$' | '%';
  amount: number;
  label: string;
  internalNotes?: string;
}

interface ConfiguratorItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  uom: string;
  subtotal: number;
  pricingRules: PricingRule[];
  oneTimeAdjustments: OneTimeAdjustment[];
}

interface AdvancedConfiguratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ConfiguratorItem;
  onSave: (updatedItem: ConfiguratorItem) => void;
}

const RULE_TEMPLATES = [
  { name: 'Volume Discount', type: 'discount' as const, value: 10, amountType: '%' as const },
  { name: 'Competitor Price Match', type: 'discount' as const, value: 8, amountType: '%' as const },
  { name: 'Customer Loyalty Discount', type: 'discount' as const, value: 5, amountType: '%' as const },
  { name: 'Seasonal Promotion', type: 'discount' as const, value: 15, amountType: '%' as const },
  { name: 'Premium Handling', type: 'premium' as const, value: 3, amountType: '%' as const },
  { name: 'Rush Order Surcharge', type: 'premium' as const, value: 10, amountType: '%' as const },
];

// ── Adjustment Row Card (read-only display with hover actions) ──
function AdjustmentRowCard({ adj, impact, formatCurrency, onEdit, onDelete }: {
  adj: OneTimeAdjustment;
  impact: number;
  formatCurrency: (n: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isDeduct = adj.type === 'discount';
  const hasNotes = adj.internalNotes && adj.internalNotes.trim().length > 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: '6px',
        border: '1px solid #E5E7EB',
        backgroundColor: hovered ? '#F9FAFB' : '#FFFFFF',
        transition: 'background-color 150ms',
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
      }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: isDeduct ? '#DC2626' : '#059669',
            backgroundColor: isDeduct ? '#FEF2F2' : '#ECFDF5',
            padding: '3px 6px',
            borderRadius: '4px',
            lineHeight: '1',
            flexShrink: 0,
          }}
        >
          {isDeduct ? 'DSC' : 'ADD'}
        </span>
        <span style={{
          flex: 1,
          fontSize: '13px',
          color: '#1F2937',
          fontWeight: 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}>
          {adj.label}
        </span>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: isDeduct ? '#DC2626' : '#059669',
          minWidth: '60px',
          textAlign: 'right',
          lineHeight: '1',
          flexShrink: 0,
        }}>
          {isDeduct ? '-' : '+'}{formatCurrency(impact)}
        </span>
        {/* Hover actions */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0,
          opacity: hovered ? 1 : 0,
          transition: 'opacity 100ms',
        }}>
          <button
            onClick={onEdit}
            style={{
              width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#9CA3AF',
              borderRadius: '4px', transition: 'color 100ms, background-color 100ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Pencil style={{ width: '12px', height: '12px' }} />
          </button>
          <button
            onClick={onDelete}
            style={{
              width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#D1D5DB',
              borderRadius: '4px', transition: 'color 100ms, background-color 100ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#D1D5DB'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Trash2 style={{ width: '12px', height: '12px' }} />
          </button>
        </div>
      </div>
      {/* Internal notes shown inline below the main row */}
      {hasNotes && (
        <div style={{
          padding: '0 12px 7px 12px',
          marginTop: '-2px',
        }}>
          <div style={{
            fontSize: '11px',
            color: '#6B7280',
            fontStyle: 'italic',
            lineHeight: '1.4',
            paddingLeft: '34px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {adj.internalNotes}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdvancedConfiguratorModal({ isOpen, onClose, item, onSave }: AdvancedConfiguratorModalProps) {
  const [rules, setRules] = useState<PricingRule[]>(item.pricingRules);
  const [adjustments, setAdjustments] = useState<OneTimeAdjustment[]>(item.oneTimeAdjustments);
  const [showRuleDropdown, setShowRuleDropdown] = useState(false);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<OneTimeAdjustment | null>(null);

  if (!isOpen) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: amount % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const calcRuleImpact = (rule: PricingRule): number => {
    if (rule.amountType === '%') {
      return (item.subtotal * rule.value) / 100;
    }
    return rule.value;
  };

  const calcAdjImpact = (adj: OneTimeAdjustment): number => {
    if (adj.amountType === '%') {
      return (item.subtotal * adj.amount) / 100;
    }
    return adj.amount;
  };

  const totalDiscounts = rules
    .filter(r => r.type === 'discount')
    .reduce((sum, r) => sum + calcRuleImpact(r), 0)
    + adjustments
      .filter(a => a.type === 'discount')
      .reduce((sum, a) => sum + calcAdjImpact(a), 0);

  const totalPremiums = rules
    .filter(r => r.type === 'premium')
    .reduce((sum, r) => sum + calcRuleImpact(r), 0)
    + adjustments
      .filter(a => a.type === 'premium')
      .reduce((sum, a) => sum + calcAdjImpact(a), 0);

  const finalTotal = item.subtotal - totalDiscounts + totalPremiums;

  const addRule = (template: typeof RULE_TEMPLATES[0]) => {
    const newRule: PricingRule = {
      id: `rule-${Date.now()}`,
      name: template.name,
      type: template.type,
      value: template.value,
      amountType: template.amountType,
    };
    setRules([...rules, newRule]);
    setShowRuleDropdown(false);
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, field: keyof PricingRule, value: any) => {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addAdjustment = () => {
    setShowAdjustmentForm(true);
  };

  const removeAdjustment = (id: string) => {
    setAdjustments(adjustments.filter(a => a.id !== id));
  };

  const updateAdjustment = (id: string, field: keyof OneTimeAdjustment, value: any) => {
    setAdjustments(adjustments.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const handleSave = () => {
    onSave({
      ...item,
      pricingRules: rules,
      oneTimeAdjustments: adjustments,
      total: finalTotal,
    });
    onClose();
  };

  const handleAdjustmentFormSave = (formData: AdjustmentFormData) => {
    if (editingAdjustment) {
      // Edit mode
      setAdjustments(adjustments.map(a => a.id === editingAdjustment.id ? {
        ...a,
        label: formData.label,
        type: formData.type,
        amountType: formData.amountType,
        amount: formData.amount,
        internalNotes: formData.internalNotes,
      } : a));
      setEditingAdjustment(null);
      toast.success(`\"${formData.label}\" updated`);
    } else {
      // Add mode
      const newAdj: OneTimeAdjustment = {
        id: `adj-${Date.now()}`,
        type: formData.type,
        amountType: formData.amountType,
        amount: formData.amount,
        label: formData.label,
        internalNotes: formData.internalNotes,
      };
      setAdjustments([...adjustments, newAdj]);
      setShowAdjustmentForm(false);
      toast.success(`\"${formData.label}\" added`);
    }
  };

  const openEditAdjustment = (adj: OneTimeAdjustment) => {
    setEditingAdjustment(adj);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '600px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.16)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings2 style={{ width: '16px', height: '16px', color: '#3B82F6' }} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#1F2937', lineHeight: '1.2' }}>
                Advanced Configurator
              </div>
              <div style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 400, lineHeight: '1', marginTop: '3px' }}>
                {item.productId} &middot; {item.productName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: '#9CA3AF',
              transition: 'background-color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Base Info */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '16px',
              padding: '14px 16px',
              backgroundColor: '#F9FAFB',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', marginBottom: '6px' }}>
                QTY x PRICE
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
                {item.quantity} x {formatCurrency(item.unitPrice)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', marginBottom: '6px' }}>
                SUBTOTAL
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
                {formatCurrency(item.subtotal)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', marginBottom: '6px' }}>
                NET TOTAL
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#1F2937', lineHeight: '1' }}>
                {formatCurrency(finalTotal)}
              </div>
            </div>
          </div>

          {/* Pricing Rules */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>
                  PRICING RULES
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#9CA3AF',
                    backgroundColor: '#F3F4F6',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    lineHeight: '1',
                  }}
                >
                  {rules.length}
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowRuleDropdown(!showRuleDropdown)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    height: '26px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#6B7280',
                    cursor: 'pointer',
                    lineHeight: '1',
                  }}
                >
                  <Plus style={{ width: '12px', height: '12px' }} />
                  Add Rule
                </button>
                {showRuleDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '4px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E5E7EB',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      zIndex: 10,
                      minWidth: '220px',
                      overflow: 'hidden',
                    }}
                  >
                    {RULE_TEMPLATES.map((tmpl, i) => (
                      <button
                        key={i}
                        onClick={() => addRule(tmpl)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: '#1F2937',
                          transition: 'background-color 100ms',
                          borderBottom: i < RULE_TEMPLATES.length - 1 ? '1px solid #F3F4F6' : 'none',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span style={{ fontWeight: 400 }}>{tmpl.name}</span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: tmpl.type === 'discount' ? '#DC2626' : '#059669',
                            backgroundColor: tmpl.type === 'discount' ? '#FEF2F2' : '#ECFDF5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            lineHeight: '1',
                          }}
                        >
                          {tmpl.type === 'discount' ? '-' : '+'}{tmpl.value}%
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {rules.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px dashed #D1D5DB',
                  textAlign: 'center',
                  color: '#9CA3AF',
                  fontSize: '13px',
                  fontWeight: 400,
                }}
              >
                No pricing rules applied
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #E5E7EB',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: rule.type === 'discount' ? '#DC2626' : '#059669',
                        backgroundColor: rule.type === 'discount' ? '#FEF2F2' : '#ECFDF5',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        lineHeight: '1',
                        flexShrink: 0,
                      }}
                    >
                      {rule.type === 'discount' ? 'DSC' : 'PRM'}
                    </span>
                    <input
                      value={rule.name}
                      onChange={(e) => updateRule(rule.id, 'name', e.target.value)}
                      style={{
                        flex: 1,
                        fontSize: '13px',
                        color: '#1F2937',
                        fontWeight: 400,
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        minWidth: 0,
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <input
                        type="number"
                        value={rule.value}
                        onChange={(e) => updateRule(rule.id, 'value', parseFloat(e.target.value) || 0)}
                        style={{
                          width: '52px',
                          height: '26px',
                          borderRadius: '4px',
                          border: '1px solid #E5E7EB',
                          textAlign: 'center',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#1F2937',
                          outline: 'none',
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}
                      />
                      <button
                        onClick={() => updateRule(rule.id, 'amountType', rule.amountType === '%' ? '$' : '%')}
                        style={{
                          width: '36px',
                          height: '26px',
                          borderRadius: '4px',
                          border: '1px solid #E5E7EB',
                          backgroundColor: '#F9FAFB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '1px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          color: '#6B7280',
                          fontWeight: 600,
                          transition: 'background-color 100ms',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        title={`Switch to ${rule.amountType === '%' ? 'dollar' : 'percentage'}`}
                      >
                        {rule.amountType === '%' ? <Percent style={{ width: '11px', height: '11px' }} /> : <DollarSign style={{ width: '11px', height: '11px' }} />}
                        <ArrowUpDown style={{ width: '8px', height: '8px', color: '#9CA3AF' }} />
                      </button>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: rule.type === 'discount' ? '#DC2626' : '#059669', minWidth: '60px', textAlign: 'right', lineHeight: '1' }}>
                      {rule.type === 'discount' ? '-' : '+'}{formatCurrency(calcRuleImpact(rule))}
                    </span>
                    <button
                      onClick={() => removeRule(rule.id)}
                      style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        color: '#D1D5DB',
                        borderRadius: '4px',
                        flexShrink: 0,
                        transition: 'color 100ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#D1D5DB'; }}
                    >
                      <Trash2 style={{ width: '13px', height: '13px' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* One-Time Adjustments */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>
                  ONE-TIME ADJUSTMENTS
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#9CA3AF',
                    backgroundColor: '#F3F4F6',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    lineHeight: '1',
                  }}
                >
                  {adjustments.length}
                </span>
              </div>
              <button
                onClick={() => addAdjustment()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '26px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#6B7280',
                  cursor: 'pointer',
                  lineHeight: '1',
                }}
              >
                <Plus style={{ width: '12px', height: '12px' }} />
                Add Adjustment
              </button>
            </div>

            {adjustments.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px dashed #D1D5DB',
                  textAlign: 'center',
                  color: '#9CA3AF',
                  fontSize: '13px',
                  fontWeight: 400,
                }}
              >
                No adjustments applied
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {adjustments.map((adj) => (
                  <AdjustmentRowCard
                    key={adj.id}
                    adj={adj}
                    impact={calcAdjImpact(adj)}
                    formatCurrency={formatCurrency}
                    onEdit={() => openEditAdjustment(adj)}
                    onDelete={() => removeAdjustment(adj.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Impact Summary */}
          <div
            style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', marginBottom: '12px' }}>
              IMPACT SUMMARY
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 400, lineHeight: '1' }}>Subtotal</span>
                <span style={{ fontSize: '13px', color: '#1F2937', fontWeight: 600, lineHeight: '1' }}>{formatCurrency(item.subtotal)}</span>
              </div>
              {totalDiscounts > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 400, lineHeight: '1' }}>Discounts</span>
                  <span style={{ fontSize: '13px', color: '#DC2626', fontWeight: 600, lineHeight: '1' }}>-{formatCurrency(totalDiscounts)}</span>
                </div>
              )}
              {totalPremiums > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 400, lineHeight: '1' }}>Premiums</span>
                  <span style={{ fontSize: '13px', color: '#059669', fontWeight: 600, lineHeight: '1' }}>+{formatCurrency(totalPremiums)}</span>
                </div>
              )}
              <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '2px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: '#1F2937', fontWeight: 500, lineHeight: '1' }}>Net Total</span>
                <span style={{ fontSize: '16px', color: '#1F2937', fontWeight: 700, lineHeight: '1' }}>{formatCurrency(finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '16px 24px',
            borderTop: '1px solid #E5E7EB',
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: '32px',
              padding: '0 16px',
              borderRadius: '6px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 500,
              color: '#6B7280',
              cursor: 'pointer',
              lineHeight: '1',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              height: '32px',
              padding: '0 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#3B82F6',
              fontSize: '13px',
              fontWeight: 500,
              color: '#FFFFFF',
              cursor: 'pointer',
              lineHeight: '1',
              transition: 'background-color 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#2563EB'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#3B82F6'; }}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Adjustment Form Modal */}
      {showAdjustmentForm && (
        <AdjustmentFormModal
          mode="add"
          scope="item"
          onSave={(data) => {
            handleAdjustmentFormSave(data);
          }}
          onCancel={() => setShowAdjustmentForm(false)}
        />
      )}

      {editingAdjustment && (
        <AdjustmentFormModal
          mode="edit"
          scope="item"
          initial={{
            id: editingAdjustment.id,
            label: editingAdjustment.label,
            type: editingAdjustment.type,
            amountType: editingAdjustment.amountType,
            amount: editingAdjustment.amount,
            scope: 'item',
            internalNotes: editingAdjustment.internalNotes,
          }}
          onSave={(data) => {
            handleAdjustmentFormSave(data);
          }}
          onCancel={() => setEditingAdjustment(null)}
        />
      )}
    </div>
  );
}