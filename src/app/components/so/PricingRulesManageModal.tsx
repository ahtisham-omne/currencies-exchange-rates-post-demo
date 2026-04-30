import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, Check, TrendingDown, TrendingUp, Tag, Search, ChevronDown, ChevronUp, Package, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PricingRulesLibrary } from './PricingRulesLibrary';

// ── Shared line item data with descriptions & thumbnail colors ──
const LINE_ITEMS = [
  { id: '501-100-001', description: 'E-450 stripped chassis, 176" WB, 7.3L V8, DRW, 16,000 GVWR, ambulance prep package.', qty: 2, subtotal: 96400, thumbColor: '#DBEAFE' },
  { id: '501-100-002', description: 'Cutaway-mount modular body, 152in patient compartment, 72in headroom, KKK compliant.', qty: 3, subtotal: 282600, thumbColor: '#D1FAE5' },
  { id: '501-100-003', description: 'P25 Phase II mobile radio, all-band, AES 256 encryption.', qty: 3, subtotal: 23550, thumbColor: '#FEE2E2' },
  { id: '501-100-004', description: 'Powered stretcher, 700 lb cap, Power-LOAD compatible.', qty: 3, subtotal: 55500, thumbColor: '#E0E7FF' },
  { id: '501-100-005', description: '3000W pure sine inverter with 75A charger auto transfer.', qty: 3, subtotal: 4950, thumbColor: '#FEF3C7' },
  { id: '501-100-006', description: 'Full ambulance build labor, module integration, 500 plus hours.', qty: 3, subtotal: 84000, thumbColor: '#FCE7F3' },
  { id: '501-100-007', description: 'Roof-mount AC, 24000 BTU, thermostat ducted system.', qty: 3, subtotal: 15600, thumbColor: '#F3E8FF' },
];

interface PricingRule {
  id: string;
  name: string;
  type: 'discount' | 'premium';
  value: number;
  amountType: '%' | '$';
  appliedTo: string[];
  amount: number;
  /** Applicability condition info */
  condition?: {
    type: 'volume' | 'value' | 'contract' | 'custom';
    status: 'fully_applied' | 'partial' | 'threshold_met';
    label: string;       // e.g. "Fully applied" or "3 of 5 units — needs 2 more for 7% tier"
    threshold?: string;  // e.g. "5+ units" or "$50,000 min"
  };
}

// Library rules catalog
interface LibraryRule {
  id: string;
  name: string;
  description: string;
  type: 'discount' | 'premium';
  category: string;
  adjustmentType: 'percentage' | 'fixed';
  adjustmentValue: number;
}

const LIBRARY_RULES: LibraryRule[] = [
  { id: 'fleet-volume', name: 'Fleet Volume Discount', description: 'Discount for multi-unit fleet orders', type: 'discount', category: 'volume', adjustmentType: 'percentage', adjustmentValue: 7 },
  { id: 'gov-contract', name: 'Government Contract Pricing', description: 'Municipal/state/federal contract discount', type: 'discount', category: 'custom', adjustmentType: 'percentage', adjustmentValue: 3 },
  { id: 'state-bid', name: 'State Cooperative Bid', description: 'Cooperative purchasing agreement discount', type: 'discount', category: 'value', adjustmentType: 'percentage', adjustmentValue: 12 },
  { id: 'oem-rebate', name: 'OEM Manufacturer Rebate', description: 'Pass-through rebate from equipment OEM', type: 'discount', category: 'value', adjustmentType: 'percentage', adjustmentValue: 3 },
  { id: 'rush-build', name: 'Expedited Build Premium', description: 'Surcharge for rush build schedule under 90 days', type: 'premium', category: 'custom', adjustmentType: 'percentage', adjustmentValue: 15 },
  { id: 'custom-config', name: 'Custom Configuration Premium', description: 'Premium for non-standard build specs', type: 'premium', category: 'custom', adjustmentType: 'percentage', adjustmentValue: 8 },
  { id: 'small-order', name: 'Single-Unit Surcharge', description: 'Premium for single-unit conversion orders', type: 'premium', category: 'volume', adjustmentType: 'percentage', adjustmentValue: 10 },
  { id: 'early-pay', name: 'Early Payment Incentive', description: '2% discount for payment within 10 days', type: 'discount', category: 'custom', adjustmentType: 'percentage', adjustmentValue: 2 },
];

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

// ── Compact Item Row ── thumbnail + ID + description (shared mini-table style)
function CompactItemRow({ item, checked, onToggle, showCheckbox = false, trailing }: {
  item: typeof LINE_ITEMS[0];
  checked?: boolean;
  onToggle?: () => void;
  showCheckbox?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '5px 10px',
        cursor: onToggle ? 'pointer' : 'default',
        backgroundColor: checked ? '#F8FBFF' : '#FFFFFF',
        transition: 'background-color 100ms',
      }}
    >
      {showCheckbox && (
        <div style={{
          width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
          borderWidth: checked ? '0' : '1.5px', borderStyle: 'solid', borderColor: '#D1D5DB',
          backgroundColor: checked ? '#1B6EF3' : '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {checked && <Check style={{ width: '9px', height: '9px', color: '#FFFFFF' }} strokeWidth={3} />}
        </div>
      )}
      {/* Thumbnail */}
      <div style={{
        width: '28px', height: '28px', borderRadius: '4px', flexShrink: 0,
        backgroundColor: item.thumbColor || '#F3F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Package style={{ width: '13px', height: '13px', color: '#6B7280', opacity: 0.6 }} />
      </div>
      {/* ID + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', lineHeight: '1', marginBottom: '3px', letterSpacing: '0.01em' }}>
          {item.id}
        </div>
        <div style={{
          fontSize: '11px', color: '#374151', lineHeight: '1.3',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.description}
        </div>
      </div>
      {/* Trailing content (price, etc.) */}
      {trailing}
    </div>
  );
}

interface PricingRulesManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  /** Called when rules change — provides new total discount amount and rule count */
  onRulesChange?: (totalAmount: number, ruleCount: number) => void;
}

export function PricingRulesManageModal({ isOpen, onClose, readOnly = false, onRulesChange }: PricingRulesManageModalProps) {
  const [rules, setRules] = useState<PricingRule[]>([
    {
      id: '301-500-001', name: 'Fleet Volume Discount (3+ units)', type: 'discount', value: 4, amountType: '%',
      appliedTo: ['501-100-001', '501-100-002'], amount: 15160,
      condition: { type: 'volume', status: 'partial', label: '3 of 5 units for next tier (7%)', threshold: '5+ units for 7%' },
    },
    {
      id: '301-500-002', name: 'Government Contract Pricing', type: 'discount', value: 3, amountType: '%',
      appliedTo: ['501-100-001', '501-100-002', '501-100-003', '501-100-004', '501-100-005', '501-100-006', '501-100-007'], amount: 19470,
      condition: { type: 'contract', status: 'fully_applied', label: 'Fully applied — contract verified', threshold: 'Active contract' },
    },
    {
      id: '301-500-003', name: 'Multi-Unit Build Discount', type: 'discount', value: 5, amountType: '%',
      appliedTo: ['501-100-002', '501-100-006'], amount: 18330,
      condition: { type: 'value', status: 'threshold_met', label: 'Min. order value $50,000 met', threshold: '$50,000 min order' },
    },
  ]);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [showUpdateModal, setShowUpdateModal] = useState<string | null>(null); // ruleId to update/remove
  
  // Track which items to display for each rule (includes unchecked items that were previously applied)
  const [ruleDisplayItems, setRuleDisplayItems] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    rules.forEach(rule => {
      initial[rule.id] = [...rule.appliedTo]; // Initially show only applied items
    });
    return initial;
  });

  // Notify parent when rules change
  useEffect(() => {
    if (!onRulesChange) return;
    // Calculate net impact: discounts reduce total (positive amount), premiums increase
    const totalDiscount = rules.reduce((s, r) => {
      if (r.type === 'discount') return s + r.amount;
      return s - r.amount; // premiums reduce the discount total
    }, 0);
    onRulesChange(totalDiscount, rules.length);
  }, [rules, onRulesChange]);

  if (!isOpen) return null;

  const totalImpact = rules.reduce((s, r) => s + (r.type === 'discount' ? -r.amount : r.amount), 0);
  const uniqueItemCount = new Set(rules.flatMap(r => r.appliedTo)).size;

  const handleDeleteRule = (id: string) => {
    const rule = rules.find(r => r.id === id);
    setRules(prev => prev.filter(r => r.id !== id));
    if (expandedRuleId === id) setExpandedRuleId(null);
    toast.success(`"${rule?.name}" removed`);
  };

  // Direct toggle — no "Edit Items" step needed
  const handleToggleItem = (ruleId: string, itemId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r;
      const newAppliedTo = r.appliedTo.includes(itemId)
        ? r.appliedTo.filter(i => i !== itemId)
        : [...r.appliedTo, itemId];
      if (newAppliedTo.length === 0) {
        toast.error('At least one item must remain selected');
        return r;
      }
      const applicableSubtotal = LINE_ITEMS.filter(i => newAppliedTo.includes(i.id)).reduce((s, i) => s + i.subtotal, 0);
      const newAmount = r.amountType === '%' ? Math.round(applicableSubtotal * (r.value / 100)) : r.value;
      return { ...r, appliedTo: newAppliedTo, amount: newAmount };
    }));
  };

  const handleAddFromLibrary = (lib: LibraryRule) => {
    // Derive initial condition info from library rule category
    const conditionForCategory = (cat: string): PricingRule['condition'] => {
      if (cat === 'volume') return { type: 'volume', status: 'partial', label: `Applied at current quantity — check tier thresholds`, threshold: 'Volume-based' };
      if (cat === 'value') return { type: 'value', status: 'threshold_met', label: `Applied — all items selected`, threshold: 'Value-based' };
      return { type: 'custom', status: 'fully_applied', label: 'Fully applied', threshold: 'Custom rule' };
    };

    const newRule: PricingRule = {
      id: `P${Date.now()}`,
      name: lib.name,
      type: lib.type,
      value: lib.adjustmentValue,
      amountType: lib.adjustmentType === 'percentage' ? '%' : '$',
      appliedTo: LINE_ITEMS.map(i => i.id),
      amount: 0,
      condition: conditionForCategory(lib.category),
    };
    const applicableSubtotal = LINE_ITEMS.reduce((s, i) => s + i.subtotal, 0);
    newRule.amount = newRule.amountType === '%' ? Math.round(applicableSubtotal * (newRule.value / 100)) : newRule.value;
    setRules(prev => [...prev, newRule]);
    setShowLibrary(false);
    setExpandedRuleId(newRule.id);
    toast.success(`"${lib.name}" added`);
  };

  const filteredLibrary = LIBRARY_RULES.filter(r =>
    !rules.some(existing => existing.name.toLowerCase().includes(r.name.toLowerCase())) &&
    (librarySearch === '' || r.name.toLowerCase().includes(librarySearch.toLowerCase()) || r.description.toLowerCase().includes(librarySearch.toLowerCase()))
  );

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white flex flex-col"
        style={{
          width: '560px', maxWidth: '90vw', maxHeight: '85vh',
          borderRadius: '12px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#E5E7EB',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag style={{ width: '14px', height: '14px', color: '#6B7280' }} />
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', lineHeight: '1.3', margin: 0 }}>
                Pricing Rules
              </h2>
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '10px' }}>
                {rules.length}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '3px', lineHeight: '1.3' }}>
              Item-level pricing rules · {uniqueItemCount} item{uniqueItemCount !== 1 ? 's' : ''} affected
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <X style={{ width: '16px', height: '16px', color: '#6B7280' }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '12px 20px', scrollbarWidth: 'thin' }}>
          {rules.map((rule) => {
            const isExpanded = expandedRuleId === rule.id;
            const isDiscount = rule.type === 'discount';

            return (
              <div
                key={rule.id}
                style={{
                  borderWidth: '1px', borderStyle: 'solid',
                  borderColor: isExpanded ? '#DBEAFE' : '#E5E7EB',
                  borderRadius: '8px', marginBottom: '8px',
                  backgroundColor: isExpanded ? '#FBFDFF' : '#FFFFFF',
                  transition: 'all 150ms',
                }}
              >
                {/* Rule header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', cursor: 'pointer',
                  }}
                  onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '6px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      backgroundColor: isDiscount ? '#ECFDF5' : '#FEF2F2',
                    }}>
                      {isDiscount
                        ? <TrendingDown style={{ width: '14px', height: '14px', color: '#059669' }} />
                        : <TrendingUp style={{ width: '14px', height: '14px', color: '#DC2626' }} />
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rule.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1.2', marginTop: '2px' }}>
                        {rule.appliedTo.length} item{rule.appliedTo.length !== 1 ? 's' : ''} · {rule.value}{rule.amountType}
                      </div>
                      {/* Applicability condition badge */}
                      {rule.condition && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                          marginTop: '3px', padding: '1px 6px',
                          borderRadius: '3px', fontSize: '10px', fontWeight: 500, lineHeight: '1.4',
                          backgroundColor: rule.condition.status === 'fully_applied' ? '#ECFDF5'
                            : rule.condition.status === 'threshold_met' ? '#EFF6FF'
                            : '#FFFBEB',
                          color: rule.condition.status === 'fully_applied' ? '#059669'
                            : rule.condition.status === 'threshold_met' ? '#1D4ED8'
                            : '#B45309',
                        }}>
                          {rule.condition.status === 'fully_applied'
                            ? <CheckCircle2 style={{ width: '9px', height: '9px' }} />
                            : rule.condition.status === 'threshold_met'
                              ? <CheckCircle2 style={{ width: '9px', height: '9px' }} />
                              : <AlertTriangle style={{ width: '9px', height: '9px' }} />
                          }
                          {rule.condition.label}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '13px', fontWeight: 600,
                      color: isDiscount ? '#059669' : '#DC2626',
                    }}>
                      {isDiscount ? '-' : '+'}{fmtCurrency(rule.amount)}
                    </span>
                    {isExpanded
                      ? <ChevronUp style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
                      : <ChevronDown style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
                    }
                  </div>
                </div>

                {/* Expanded: item list — always toggleable, no "Edit Items" step */}
                {isExpanded && (
                  <div style={{
                    padding: '0 12px 10px',
                    borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#F3F4F6',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0 4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Applied to Items
                      </span>
                      {!readOnly && (
                        <span style={{ fontSize: '10px', color: '#9CA3AF' }}>
                          click to toggle
                        </span>
                      )}
                    </div>

                    <div style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB', borderRadius: '6px', overflow: 'hidden' }}>
                      {/* Show items that have ever been applied to this rule (keeps unchecked items visible) */}
                      {(ruleDisplayItems[rule.id] || rule.appliedTo).map((itemId, idx) => {
                        const item = LINE_ITEMS.find(i => i.id === itemId);
                        if (!item) return null;
                        const isApplied = rule.appliedTo.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            style={{
                              borderTopWidth: idx > 0 ? '1px' : '0', borderTopStyle: 'solid', borderTopColor: '#F3F4F6',
                            }}
                          >
                            <CompactItemRow
                              item={item}
                              checked={isApplied}
                              onToggle={!readOnly ? () => handleToggleItem(rule.id, item.id) : undefined}
                              showCheckbox={!readOnly}
                              trailing={
                                <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0, minWidth: '50px', textAlign: 'right' }}>
                                  {fmtCurrency(item.subtotal)}
                                </span>
                              }
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Update/Remove action */}
                    {!readOnly && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowUpdateModal(rule.id); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            fontSize: '11px', fontWeight: 500, color: '#1B6EF3',
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                            borderRadius: '4px', fontFamily: 'Inter, system-ui, sans-serif',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EFF6FF'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          Update
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add from Library */}
          {!readOnly && (
            showLibrary ? (
              <div style={{
                borderWidth: '1px', borderStyle: 'solid', borderColor: '#DBEAFE',
                borderRadius: '8px', backgroundColor: '#F8FBFF', marginTop: '4px',
              }}>
                <div style={{ padding: '10px 12px', borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#DBEAFE' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937' }}>Add from Rule Library</span>
                    <button
                      onClick={() => setShowLibrary(false)}
                      style={{ width: '22px', height: '22px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: '#9CA3AF' }} />
                    <input
                      type="text" value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)}
                      placeholder="Search rules..."
                      autoFocus
                      style={{
                        width: '100%', height: '30px', paddingLeft: '28px', paddingRight: '10px',
                        fontSize: '12px', borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                        borderRadius: '5px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
                    />
                  </div>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                  {filteredLibrary.map((lib, idx) => {
                    const isDiscount = lib.type === 'discount';
                    return (
                      <button
                        key={lib.id}
                        onClick={() => handleAddFromLibrary(lib)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '9px 12px', border: 'none',
                          borderTopWidth: idx > 0 ? '1px' : '0', borderTopStyle: 'solid', borderTopColor: '#EFF6FF',
                          backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
                          fontFamily: 'Inter, system-ui, sans-serif', transition: 'background-color 100ms',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EFF6FF'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '5px', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          backgroundColor: isDiscount ? '#ECFDF5' : '#FEF2F2',
                        }}>
                          {isDiscount
                            ? <TrendingDown style={{ width: '12px', height: '12px', color: '#059669' }} />
                            : <TrendingUp style={{ width: '12px', height: '12px', color: '#DC2626' }} />
                          }
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 500, color: '#1F2937', lineHeight: '1.2' }}>{lib.name}</div>
                          <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1.2', marginTop: '1px' }}>{lib.description}</div>
                        </div>
                        <span style={{
                          fontSize: '12px', fontWeight: 600, flexShrink: 0,
                          color: isDiscount ? '#059669' : '#DC2626',
                        }}>
                          {isDiscount ? '-' : '+'}{lib.adjustmentValue}{lib.adjustmentType === 'percentage' ? '%' : '$'}
                        </span>
                      </button>
                    );
                  })}
                  {filteredLibrary.length === 0 && (
                    <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: '12px', color: '#9CA3AF' }}>
                      No matching rules found
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => { setShowLibrary(true); setLibrarySearch(''); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  width: '100%', padding: '9px 0', marginTop: '4px',
                  borderRadius: '6px', cursor: 'pointer',
                  borderWidth: '1.5px', borderStyle: 'dashed', borderColor: '#BFDBFE',
                  backgroundColor: '#FFFFFF',
                  fontSize: '12px', fontWeight: 500, color: '#1B6EF3',
                  lineHeight: '1', transition: 'all 150ms',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0F7FF'; e.currentTarget.style.borderColor = '#93C5FD'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
              >
                <Plus style={{ width: '13px', height: '13px' }} />
                Add Pricing Rule from Library
              </button>
            )
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#E5E7EB',
          backgroundColor: '#F9FAFB', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '12px', color: '#6B7280' }}>
            {rules.length} rule{rules.length !== 1 ? 's' : ''} · {uniqueItemCount} item{uniqueItemCount !== 1 ? 's' : ''} affected
          </span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: totalImpact < 0 ? '#059669' : totalImpact > 0 ? '#DC2626' : '#6B7280' }}>
            {totalImpact < 0 ? '-' : '+'}{fmtCurrency(Math.abs(totalImpact))}
          </span>
        </div>
      </div>

      {/* Update Confirmation Modal */}
      {showUpdateModal && (() => {
        const rule = rules.find(r => r.id === showUpdateModal);
        if (!rule) return null;
        
        return createPortal(
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 10002,
              backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(2px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setShowUpdateModal(null)}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF', borderRadius: '12px', width: '440px', maxWidth: '90vw',
                boxShadow: '0 12px 48px rgba(0, 0, 0, 0.2)', fontFamily: 'Inter, system-ui, sans-serif',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                  Update Pricing Rule
                </h3>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: '6px 0 0 0', lineHeight: '1.5' }}>
                  Apply changes to this quote only or update customer record for future quotes?
                </p>
              </div>
              
              <div style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '16px' }}>
                  <strong>{rule.name}</strong> will be updated based on your item selections.
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => {
                      // Apply to this quote only
                      toast.success('Pricing rule updated for this quote');
                      setShowUpdateModal(null);
                    }}
                    style={{
                      padding: '10px 16px', borderRadius: '6px',
                      border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
                      fontSize: '13px', fontWeight: 500, color: '#1F2937',
                      cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                      textAlign: 'left', transition: 'all 100ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>This Quote Only</div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Keep customer defaults unchanged</div>
                  </button>
                  
                  <button
                    onClick={() => {
                      // Apply to customer record
                      toast.success('Pricing rule updated in customer record for future quotes');
                      setShowUpdateModal(null);
                    }}
                    style={{
                      padding: '10px 16px', borderRadius: '6px',
                      border: '1px solid #BFDBFE', backgroundColor: '#EFF6FF',
                      fontSize: '13px', fontWeight: 500, color: '#1F2937',
                      cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                      textAlign: 'left', transition: 'all 100ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#DBEAFE'; e.currentTarget.style.borderColor = '#93C5FD'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#EFF6FF'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Update Customer Record</div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Apply to all future quotes for this customer</div>
                  </button>
                  
                  <div style={{ height: '1px', backgroundColor: '#E5E7EB', margin: '8px 0' }} />
                  
                  <button
                    onClick={() => {
                      handleDeleteRule(showUpdateModal);
                      setShowUpdateModal(null);
                    }}
                    style={{
                      padding: '10px 16px', borderRadius: '6px',
                      border: '1px solid #FEE2E2', backgroundColor: '#FEF2F2',
                      fontSize: '13px', fontWeight: 500, color: '#DC2626',
                      cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                      textAlign: 'left', transition: 'all 100ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEE2E2'; e.currentTarget.style.borderColor = '#FCA5A5'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FEF2F2'; e.currentTarget.style.borderColor = '#FEE2E2'; }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Remove Rule Completely</div>
                    <div style={{ fontSize: '12px', color: '#DC2626', opacity: 0.8 }}>Remove from this quote and customer record</div>
                  </button>
                </div>
              </div>
              
              <div style={{ padding: '12px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowUpdateModal(null)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px',
                    border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
                    fontSize: '13px', fontWeight: 500, color: '#6B7280',
                    cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>,
    document.body
  );
}