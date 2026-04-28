import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Plus, Trash2, Pencil, DollarSign, Package } from 'lucide-react';
import { toast } from 'sonner';
import { AdjustmentFormModal } from '../shared/AdjustmentFormModal';
import type { AdjustmentFormData, LineItemForSelection } from '../shared/AdjustmentFormModal';

// ── Shared line item data with descriptions & thumbnail colors ──
const LINE_ITEMS: LineItemForSelection[] = [
  { id: '501-100-001', description: 'E-450 stripped chassis, 176" WB, 7.3L V8, DRW, 16,000 GVWR, ambulance prep package.', subtotal: 96400, thumbColor: '#DBEAFE' },
  { id: '501-100-002', description: 'Cutaway-mount modular body, 152in patient compartment, 72in headroom, KKK compliant.', subtotal: 282600, thumbColor: '#D1FAE5' },
  { id: '501-100-003', description: 'P25 Phase II mobile radio, all-band, AES 256 encryption.', subtotal: 23550, thumbColor: '#FEE2E2' },
  { id: '501-100-004', description: 'Powered stretcher, 700 lb cap, Power-LOAD compatible.', subtotal: 55500, thumbColor: '#E0E7FF' },
  { id: '501-100-005', description: '3000W pure sine inverter with 75A charger auto transfer.', subtotal: 4950, thumbColor: '#FEF3C7' },
  { id: '501-100-006', description: 'Full ambulance build labor, module integration, 500 plus hours.', subtotal: 84000, thumbColor: '#FCE7F3' },
  { id: '501-100-007', description: 'Roof-mount AC, 24000 BTU, thermostat ducted system.', subtotal: 15600, thumbColor: '#F3E8FF' },
];

interface Adjustment {
  id: string;
  label: string;
  type: 'discount' | 'premium';
  amountType: '$' | '%';
  amount: number;
  scope: 'item' | 'quote';
  appliedTo?: string[];
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

// The AdjustmentFormModal is now shared from /src/app/components/shared/AdjustmentFormModal.tsx

// ═══════════════════════════════════════════════════════════════════════════════
// Main ManageAdjustmentsModal
// ═══════════════════════════════════════════════════════════════════════════════
interface ManageAdjustmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  readOnly?: boolean;
  initialTab?: 'quote' | 'item';
}

export function ManageAdjustmentsModal({
  isOpen,
  onClose,
  readOnly = false,
  initialTab = 'quote',
}: ManageAdjustmentsModalProps) {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([
    { id: 'A001', label: 'Chassis Delivery & Prep', type: 'premium', amountType: '$', amount: 2400, scope: 'item', appliedTo: ['501-100-001'] },
    { id: 'A002', label: 'Radio Programming & Encryption', type: 'premium', amountType: '$', amount: 1350, scope: 'item', appliedTo: ['501-100-003'] },
    { id: 'A003', label: 'Expedited Build Schedule', type: 'premium', amountType: '$', amount: 4500, scope: 'quote' },
    { id: 'A004', label: 'Returning Customer Credit', type: 'discount', amountType: '$', amount: 2500, scope: 'quote' },
  ]);
  const [activeSection, setActiveSection] = useState<'quote' | 'item'>(initialTab);
  const [showAddModal, setShowAddModal] = useState<'quote' | 'item' | null>(null);
  const [editingAdj, setEditingAdj] = useState<Adjustment | null>(null);

  if (!isOpen) return null;

  const quoteLevelAdj = adjustments.filter(a => a.scope === 'quote');
  const itemLevelAdj = adjustments.filter(a => a.scope === 'item');

  const totalQuoteAdj = quoteLevelAdj.reduce((s, a) => s + (a.type === 'premium' ? a.amount : -a.amount), 0);
  const totalItemAdj = itemLevelAdj.reduce((s, a) => s + (a.type === 'premium' ? a.amount : -a.amount), 0);
  const totalAll = totalQuoteAdj + totalItemAdj;

  // Group item-level by item
  const adjByItem = (() => {
    const map = new Map<string, { item: typeof LINE_ITEMS[0]; adjustments: Adjustment[] }>();
    for (const adj of itemLevelAdj) {
      if (!adj.appliedTo) continue;
      for (const itemId of adj.appliedTo) {
        const item = LINE_ITEMS.find(i => i.id === itemId);
        if (!item) continue;
        if (!map.has(itemId)) map.set(itemId, { item, adjustments: [] });
        map.get(itemId)!.adjustments.push(adj);
      }
    }
    return Array.from(map.values());
  })();

  const handleDelete = (id: string) => {
    const adj = adjustments.find(a => a.id === id);
    setAdjustments(prev => prev.filter(a => a.id !== id));
    toast.success(`"${adj?.label}" removed`);
  };

  const handleAddSave = (data: AdjustmentFormData) => {
    const adj: Adjustment = {
      ...data,
      id: `A${Date.now()}`,
    } as Adjustment;
    setAdjustments(prev => [...prev, adj]);
    setShowAddModal(null);
    toast.success(`"${adj.label}" added`);
  };

  const handleEditSave = (data: AdjustmentFormData) => {
    if (!data.id) return;
    setAdjustments(prev => prev.map(a => a.id === data.id ? { ...a, ...data } as Adjustment : a));
    setEditingAdj(null);
    toast.success(`"${data.label}" updated`);
  };

  return ReactDOM.createPortal(
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
          padding: '14px 20px',
          borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#E5E7EB',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign style={{ width: '14px', height: '14px', color: '#6B7280' }} />
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', lineHeight: '1.3', margin: 0 }}>
                One-Time Discounts/Premiums
              </h2>
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '10px' }}>
                {adjustments.length}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '3px', lineHeight: '1.3' }}>
              {quoteLevelAdj.length} quote-level · {itemLevelAdj.length} item-level
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

        {/* Section tabs */}
        <div style={{
          display: 'flex', gap: '0', padding: '0 20px',
          borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#E5E7EB',
          flexShrink: 0,
        }}>
          {([
            { key: 'quote' as const, label: 'Quote-Level', count: quoteLevelAdj.length },
            { key: 'item' as const, label: 'Item-Level', count: itemLevelAdj.length },
          ]).map(tab => {
            const isActive = activeSection === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveSection(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '9px 16px', fontSize: '12px', fontWeight: 500,
                  color: isActive ? '#1B6EF3' : '#6B7280',
                  borderBottomWidth: '2px', borderBottomStyle: 'solid',
                  borderBottomColor: isActive ? '#1B6EF3' : 'transparent',
                  borderTopWidth: '0', borderLeftWidth: '0', borderRightWidth: '0',
                  backgroundColor: 'transparent', cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'all 150ms',
                }}
              >
                {tab.label}
                <span style={{
                  fontSize: '10px', fontWeight: 600,
                  backgroundColor: isActive ? '#EFF6FF' : '#F3F4F6',
                  color: isActive ? '#1B6EF3' : '#9CA3AF',
                  padding: '1px 5px', borderRadius: '8px',
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '12px 20px', scrollbarWidth: 'thin' }}>

          {/* ── Quote-Level ── */}
          {activeSection === 'quote' && (
            <div>
              {/* Section description */}
              <div style={{
                marginBottom: '14px', paddingLeft: '12px',
                borderLeft: '2px solid #E5E7EB',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', lineHeight: '1.5' }}>Quote-Level</span>
                <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.5' }}> — Applied to the entire quote total, regardless of individual line items. Use for overall discounts or fees.</span>
              </div>
              
              {quoteLevelAdj.length === 0 && (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '12px' }}>No quote-level adjustments yet</p>
                </div>
              )}
              {quoteLevelAdj.map((adj) => (
                <AdjustmentRow
                  key={adj.id}
                  adjustment={adj}
                  onEdit={() => setEditingAdj(adj)}
                  onDelete={() => handleDelete(adj.id)}
                  readOnly={readOnly}
                />
              ))}

              {/* Dashed add button */}
              {!readOnly && (
                <button
                  onClick={() => setShowAddModal('quote')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    width: '100%', padding: '9px 0', marginTop: '8px',
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
                  Add Quote-Level Adjustment
                </button>
              )}
            </div>
          )}

          {/* ── Item-Level ── */}
          {activeSection === 'item' && (
            <div>
              {/* Section description */}
              <div style={{
                marginBottom: '14px', paddingLeft: '12px',
                borderLeft: '2px solid #E5E7EB',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', lineHeight: '1.5' }}>Item-Level</span>
                <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.5' }}> — Applied to specific line items. Use for delivery fees, setup charges, or item-specific discounts.</span>
              </div>
              
              {adjByItem.length === 0 && (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '12px' }}>No item-level adjustments yet</p>
                </div>
              )}
              {adjByItem.map(({ item, adjustments: itemAdjs }) => (
                <div key={item.id} style={{
                  marginBottom: '10px', borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                  borderRadius: '8px', overflow: 'hidden',
                }}>
                  {/* Item header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px',
                    backgroundColor: '#F9FAFB',
                    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#E5E7EB',
                  }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0,
                      backgroundColor: item.thumbColor || '#F3F4F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Package style={{ width: '11px', height: '11px', color: '#6B7280', opacity: 0.6 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', lineHeight: '1', marginBottom: '1px' }}>
                        #{item.id}
                      </div>
                      <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                  {/* Adjustments for this item */}
                  {itemAdjs.map((adj) => (
                    <AdjustmentRow
                      key={`${item.id}-${adj.id}`}
                      adjustment={adj}
                      onEdit={() => setEditingAdj(adj)}
                      onDelete={() => handleDelete(adj.id)}
                      readOnly={readOnly}
                      compact
                    />
                  ))}
                </div>
              ))}

              {/* Dashed add button */}
              {!readOnly && (
                <button
                  onClick={() => setShowAddModal('item')}
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
                  Add Item-Level Adjustment
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#E5E7EB',
          backgroundColor: '#F9FAFB', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Quote-level</span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: totalQuoteAdj > 0 ? '#DC2626' : totalQuoteAdj < 0 ? '#059669' : '#6B7280' }}>
              {totalQuoteAdj >= 0 ? '+' : ''}{fmtCurrency(totalQuoteAdj)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Item-level</span>
            <span style={{ fontSize: '12px', fontWeight: 500, color: totalItemAdj > 0 ? '#DC2626' : totalItemAdj < 0 ? '#059669' : '#6B7280' }}>
              {totalItemAdj >= 0 ? '+' : ''}{fmtCurrency(totalItemAdj)}
            </span>
          </div>
          <div style={{ height: '1px', backgroundColor: '#E5E7EB', marginBottom: '8px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>Net Adjustment</span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: totalAll > 0 ? '#DC2626' : totalAll < 0 ? '#059669' : '#1F2937' }}>
              {totalAll >= 0 ? '+' : ''}{fmtCurrency(totalAll)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Add sub-modal ── */}
      {showAddModal && (
        <AdjustmentFormModal
          mode="add"
          scope={showAddModal}
          lineItems={showAddModal === 'item' ? LINE_ITEMS : undefined}
          onSave={handleAddSave}
          onCancel={() => setShowAddModal(null)}
        />
      )}

      {/* ── Edit sub-modal ── */}
      {editingAdj && (
        <AdjustmentFormModal
          mode="edit"
          scope={editingAdj.scope}
          initial={editingAdj}
          lineItems={editingAdj.scope === 'item' ? LINE_ITEMS : undefined}
          onSave={handleEditSave}
          onCancel={() => setEditingAdj(null)}
        />
      )}
    </div>,
    document.body
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Adjustment Row (display-only, with hover actions)
// ═══════════════════════════════════════════════════════════════════════════════
function AdjustmentRow({
  adjustment, onEdit, onDelete, readOnly, compact,
}: {
  adjustment: Adjustment;
  onEdit: () => void;
  onDelete: () => void;
  readOnly: boolean;
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isAdd = adjustment.type === 'premium';
  const pad = compact ? '6px 12px' : '8px 0';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: pad,
        borderBottomWidth: '1px', borderBottomStyle: 'dashed', borderBottomColor: '#F3F4F6',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
          backgroundColor: isAdd ? '#FECACA' : '#BBF7D0',
        }} />
        <span style={{
          fontSize: '13px', color: '#374151',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {adjustment.label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, marginLeft: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: isAdd ? '#DC2626' : '#059669' }}>
          {isAdd ? '+' : '-'}{fmtCurrency(adjustment.amount)}
        </span>
        {!readOnly && (
          <div style={{ display: 'flex', gap: '1px', marginLeft: '4px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              style={{
                width: hovered ? '22px' : '20px', 
                height: hovered ? '22px' : '20px', 
                borderRadius: '4px',
                border: 'none', 
                backgroundColor: 'transparent', 
                cursor: 'pointer',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#D1D5DB',
                transition: 'all 100ms',
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.width = '22px';
                e.currentTarget.style.height = '22px';
                e.currentTarget.style.backgroundColor = '#F3F4F6'; 
                e.currentTarget.style.color = '#1B6EF3'; 
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.width = '20px';
                e.currentTarget.style.height = '20px';
                e.currentTarget.style.backgroundColor = 'transparent'; 
                e.currentTarget.style.color = '#D1D5DB'; 
              }}
            >
              <Pencil style={{ width: hovered ? '11px' : '10px', height: hovered ? '11px' : '10px', transition: 'all 100ms' }} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{
                width: hovered ? '22px' : '20px', 
                height: hovered ? '22px' : '20px', 
                borderRadius: '4px',
                border: 'none', 
                backgroundColor: 'transparent', 
                cursor: 'pointer',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#D1D5DB',
                transition: 'all 100ms',
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.width = '22px';
                e.currentTarget.style.height = '22px';
                e.currentTarget.style.backgroundColor = '#FEF2F2'; 
                e.currentTarget.style.color = '#EF4444'; 
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.width = '20px';
                e.currentTarget.style.height = '20px';
                e.currentTarget.style.backgroundColor = 'transparent'; 
                e.currentTarget.style.color = '#D1D5DB'; 
              }}
            >
              <Trash2 style={{ width: hovered ? '11px' : '10px', height: hovered ? '11px' : '10px', transition: 'all 100ms' }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Standalone Add Quote-Level Adjustment Modal
// (opened directly from sidebar "+ Add quote-level adjustment" shortcut)
// ═══════════════════════════════════════════════════════════════════════════════
export function AddQuoteLevelAdjustmentModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <AdjustmentFormModal
      mode="add"
      scope="quote"
      onSave={(data) => {
        toast.success(`"${data.label}" added as quote-level adjustment`);
        onClose();
      }}
      onCancel={onClose}
    />
  );
}