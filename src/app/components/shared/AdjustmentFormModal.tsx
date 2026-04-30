import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { ChevronDown, Check, Package, Paperclip, X, FileText, Image as ImageIcon, File, Upload, ArrowUpDown, Search } from 'lucide-react';

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export interface LineItemForSelection {
  id: string;
  description: string;
  subtotal: number;
  thumbColor?: string;
}

export interface AdjustmentFormData {
  id?: string;
  label: string;
  type: 'discount' | 'premium';
  amountType: '$' | '%';
  amount: number;
  scope: 'item' | 'quote';
  appliedTo?: string[];
  internalNotes?: string;
}

interface AdjustmentFormModalProps {
  mode: 'add' | 'edit';
  scope: 'quote' | 'item';
  initial?: AdjustmentFormData;
  lineItems?: LineItemForSelection[];
  onSave: (adj: AdjustmentFormData) => void;
  onCancel: () => void;
}

export function AdjustmentFormModal({
  mode,
  scope,
  initial,
  lineItems,
  onSave,
  onCancel,
}: AdjustmentFormModalProps) {
  // Determine if we should show the items selection panel
  const showItemsPanel = scope === 'item' && lineItems && lineItems.length > 0;

  const [type, setType] = useState<'discount' | 'premium'>(initial?.type || 'discount');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '0');
  const [amountType, setAmountType] = useState<'$' | '%'>(initial?.amountType || '%');
  const [label, setLabel] = useState(initial?.label || '');
  const [selectedItems, setSelectedItems] = useState<string[]>(
    initial?.appliedTo || (showItemsPanel && lineItems ? lineItems.map(i => i.id) : [])
  );

  // Internal notes + attachments (always visible)
  const [internalNotes, setInternalNotes] = useState(initial?.internalNotes || '');
  const [noteAttachments, setNoteAttachments] = useState<Array<{ id: string; name: string; size: string; type: string }>>([]);
  const [itemSearch, setItemSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).map(f => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: f.name,
      size: f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      type: f.name.split('.').pop()?.toLowerCase() || 'file',
    }));
    setNoteAttachments(prev => [...prev, ...newFiles]);
  };

  const removeAttachment = (id: string) => {
    setNoteAttachments(prev => prev.filter(a => a.id !== id));
  };

  const getFileIcon = (type: string) => {
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(type)) return ImageIcon;
    if (['pdf', 'doc', 'docx'].includes(type)) return FileText;
    return File;
  };

  const canSave = parseFloat(amount) > 0 && (!showItemsPanel || selectedItems.length > 0);

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      id: initial?.id,
      label: label.trim(),
      type,
      amountType,
      amount: parseFloat(amount) || 0,
      scope,
      appliedTo: scope === 'item' ? selectedItems : initial?.appliedTo,
      internalNotes,
    });
  };

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        if (prev.length <= 1) return prev; // keep at least one
        return prev.filter(id => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const toggleAll = () => {
    if (!lineItems || lineItems.length === 0) return;
    if (selectedItems.length === lineItems.length) {
      setSelectedItems([lineItems[0].id]); // keep at least one
    } else {
      setSelectedItems(lineItems.map(i => i.id));
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (canSave) handleSave();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // Color semantics: green for discount (saves money), purple for premium (adds cost)
  const isDiscount = type === 'discount';
  const accentColor = isDiscount ? '#059669' : '#7C3AED';
  const accentBg = isDiscount ? '#059669' : '#7C3AED';
  const accentBgHover = isDiscount ? '#047857' : '#6D28D9';
  const accentBgDisabled = '#E5E7EB';

  const title = mode === 'add'
    ? `Add One-Time ${isDiscount ? 'Discount' : 'Premium'}`
    : `Edit ${isDiscount ? 'Discount' : 'Premium'}`;
  const subtitle = scope === 'item'
    ? `Apply a custom ${isDiscount ? 'discount' : 'premium'} to selected line items`
    : `Apply a custom ${isDiscount ? 'discount' : 'premium'} to this quote`;

  // ── Notes & Attachments Section (shared) ──
  const notesAndAttachmentsSection = (
    <div style={{ marginTop: '16px' }}>
      <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <Paperclip style={{ width: '13px', height: '13px', color: '#9CA3AF' }} />
        Internal Notes
        <span style={{ fontSize: '11px', fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
      </label>
      <textarea
        value={internalNotes}
        onChange={(e) => setInternalNotes(e.target.value)}
        placeholder="Internal justification, approval references, pricing rationale..."
        style={{
          width: '100%', height: '72px', padding: '8px 12px',
          fontSize: '13px', color: '#1F2937',
          borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
          borderRadius: '8px', outline: 'none',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxSizing: 'border-box' as const,
          resize: 'vertical',
          lineHeight: '1.5',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.08)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
      />
      {/* Attachment area */}
      <div style={{ marginTop: '8px' }}>
        {noteAttachments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
            {noteAttachments.map(att => {
              const FIcon = getFileIcon(att.type);
              return (
                <div
                  key={att.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 8px',
                    backgroundColor: '#F9FAFB',
                    borderRadius: '6px',
                    border: '1px solid #E5E7EB',
                    transition: 'background-color 100ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                >
                  <FIcon style={{ width: '14px', height: '14px', color: '#6B7280', flexShrink: 0 }} />
                  <span style={{
                    fontSize: '12px', color: '#374151', flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {att.name}
                  </span>
                  <span style={{ fontSize: '11px', color: '#9CA3AF', flexShrink: 0 }}>
                    {att.size}
                  </span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    style={{
                      width: '20px', height: '20px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', background: 'none', cursor: 'pointer',
                      borderRadius: '4px', padding: 0,
                      transition: 'background-color 100ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEE2E2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    title="Remove attachment"
                  >
                    <X style={{ width: '12px', height: '12px', color: '#DC2626' }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            width: '100%', height: '32px',
            fontSize: '12px', fontWeight: 500, color: '#6B7280',
            borderWidth: '1px', borderStyle: 'dashed', borderColor: '#D1D5DB',
            borderRadius: '6px', cursor: 'pointer',
            backgroundColor: '#FFFFFF',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'all 150ms',
            boxSizing: 'border-box' as const,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1B6EF3'; e.currentTarget.style.color = '#1B6EF3'; e.currentTarget.style.backgroundColor = '#F0F9FF'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
        >
          <Upload style={{ width: '12px', height: '12px' }} />
          Attach files
        </button>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '4px', lineHeight: '1.4' }}>
          Attachments will also appear in the quote's Attachments tab under Item Attachments.
        </div>
      </div>
    </div>
  );

  // ── Amount toggle button (shared) ──
  const amountToggleButton = (
    <button
      onClick={() => setAmountType(amountType === '%' ? '$' : '%')}
      style={{
        width: '52px', height: '38px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
        fontSize: '13px', fontWeight: 600, color: '#6B7280',
        borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
        borderTopRightRadius: '8px', borderBottomRightRadius: '8px',
        borderTopLeftRadius: '0px', borderBottomLeftRadius: '0px',
        backgroundColor: '#F9FAFB',
        cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
        transition: 'all 100ms',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
      title={`Switch to ${amountType === '%' ? 'dollar' : 'percentage'}`}
    >
      {amountType}
      <ArrowUpDown style={{ width: '10px', height: '10px', color: '#9CA3AF' }} />
    </button>
  );

  // ── Form fields (Type, Amount, Label) ──
  const formFieldsSection = (
    <>
      {/* Type + Amount row — side by side */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        {/* Type dropdown */}
        <div style={{ width: '140px', flexShrink: 0 }}>
          <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>
            Type
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'discount' | 'premium')}
              style={{
                width: '100%', height: '38px', padding: '0 32px 0 12px',
                fontSize: '13px', fontWeight: 500,
                color: isDiscount ? '#059669' : '#7C3AED',
                borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                borderRadius: '8px', outline: 'none',
                fontFamily: 'Inter, system-ui, sans-serif',
                backgroundColor: '#FFFFFF',
                appearance: 'none', WebkitAppearance: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
            >
              <option value="discount" style={{ color: '#059669' }}>Discount</option>
              <option value="premium" style={{ color: '#7C3AED' }}>Premium</option>
            </select>
            <ChevronDown style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              width: '14px', height: '14px', color: '#9CA3AF', pointerEvents: 'none',
            }} />
          </div>
        </div>

        {/* Amount with $/% toggle */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }}>
            Amount
          </label>
          <div style={{ display: 'flex' }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="0"
              style={{
                flex: 1, minWidth: 0, height: '38px', padding: '0 12px',
                fontSize: '13px', fontWeight: 500, color: '#1F2937',
                borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                borderTopLeftRadius: '8px', borderBottomLeftRadius: '8px',
                borderTopRightRadius: '0px', borderBottomRightRadius: '0px',
                borderRightWidth: '0px',
                outline: 'none', fontFamily: 'Inter, system-ui, sans-serif',
                boxSizing: 'border-box' as const,
                MozAppearance: 'textfield' as any,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
            />
            {amountToggleButton}
          </div>
        </div>
      </div>

      {/* Label/Description */}
      <div>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          Label/Description
          <span style={{ fontSize: '11px', fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={isDiscount ? 'e.g., Returning customer credit' : 'e.g., Expedited build surcharge'}
          autoFocus
          style={{
            width: '100%', height: '38px', padding: '0 12px',
            fontSize: '13px', color: '#1F2937',
            borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
            borderRadius: '8px', outline: 'none',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
        />
      </div>
    </>
  );

  // ── Items selection panel ──
  const safeLineItems = lineItems || [];
  const searchLower = itemSearch.toLowerCase();
  const filteredItems = itemSearch
    ? safeLineItems.filter(item =>
        item.id.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      )
    : safeLineItems;

  const itemsSelectionPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
          Apply to Items
        </label>
        <button
          onClick={toggleAll}
          style={{
            fontSize: '11px', fontWeight: 500, color: '#1B6EF3',
            border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif', padding: '2px 4px',
            borderRadius: '3px', transition: 'background-color 100ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0F7FF'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {selectedItems.length === safeLineItems.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>
      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: '8px' }}>
        <Search style={{
          position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
          width: '13px', height: '13px', color: '#9CA3AF', pointerEvents: 'none',
        }} />
        <input
          type="text"
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          placeholder={`Search ${safeLineItems.length} items...`}
          style={{
            width: '100%', height: '32px', padding: '0 10px 0 30px',
            fontSize: '12px', color: '#1F2937',
            borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
            borderRadius: '6px', outline: 'none',
            fontFamily: 'Inter, system-ui, sans-serif',
            boxSizing: 'border-box' as const,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
        />
        {itemSearch && (
          <button
            onClick={() => setItemSearch('')}
            style={{
              position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
              width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'none', cursor: 'pointer', borderRadius: '3px', padding: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <X style={{ width: '11px', height: '11px', color: '#9CA3AF' }} />
          </button>
        )}
      </div>
      {/* Items list — flex-1 fills remaining height */}
      <div style={{
        borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
        borderRadius: '8px', overflow: 'hidden',
        flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin',
      }}>
        {filteredItems.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF', fontSize: '12px' }}>
            {itemSearch ? 'No items match your search' : 'No items available'}
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isSelected = selectedItems.includes(item.id);
            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#F8FBFF' : '#FFFFFF',
                  borderTopWidth: idx > 0 ? '1px' : '0', borderTopStyle: 'solid', borderTopColor: '#F3F4F6',
                  transition: 'background-color 100ms',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#FAFBFC'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF'; else e.currentTarget.style.backgroundColor = '#F8FBFF'; }}
              >
                {/* Checkbox */}
                <div style={{
                  width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                  borderWidth: isSelected ? '0' : '1.5px', borderStyle: 'solid', borderColor: '#D1D5DB',
                  backgroundColor: isSelected ? '#1B6EF3' : '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 100ms',
                }}>
                  {isSelected && <Check style={{ width: '9px', height: '9px', color: '#FFFFFF' }} strokeWidth={3} />}
                </div>
                {/* Thumbnail */}
                <div style={{
                  width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0,
                  backgroundColor: item.thumbColor || '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Package style={{ width: '11px', height: '11px', color: '#6B7280', opacity: 0.6 }} />
                </div>
                {/* ID + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', lineHeight: '1', marginBottom: '2px' }}>
                    {item.id}
                  </div>
                  <div style={{
                    fontSize: '11px', color: '#374151', lineHeight: '1.3',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.description}
                  </div>
                </div>
                <span style={{ fontSize: '10px', color: '#9CA3AF', flexShrink: 0 }}>
                  {fmtCurrency(item.subtotal)}
                </span>
              </div>
            );
          })
        )}
      </div>
      <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
        {selectedItems.length} of {safeLineItems.length} items selected
        {itemSearch && filteredItems.length !== safeLineItems.length && (
          <span> · {filteredItems.length} shown</span>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 13000, backgroundColor: 'rgba(0, 0, 0, 0.35)', backdropFilter: 'blur(1px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="bg-white flex flex-col"
        style={{
          width: showItemsPanel ? '860px' : '440px', maxWidth: '90vw', maxHeight: '90vh',
          borderRadius: '12px', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header area — no close X, just title + subtitle */}
        <div style={{ padding: '24px 24px 0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              backgroundColor: accentColor, flexShrink: 0,
            }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', lineHeight: '1.3', margin: 0 }}>
              {title}
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px', marginBottom: 0, lineHeight: '1.4' }}>
            {subtitle}
          </p>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '20px 24px 16px 24px', scrollbarWidth: 'thin' }}>
          {showItemsPanel ? (
            /* ── Two-column grid layout: fields + notes left, items right ── */
            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
              {/* Left column: form fields + notes */}
              <div style={{ minWidth: 0 }}>
                {formFieldsSection}
                {notesAndAttachmentsSection}
              </div>
              {/* Right column: items list */}
              <div style={{ minWidth: 0 }}>
                {itemsSelectionPanel}
              </div>
            </div>
          ) : (
            /* ── Single-column layout ── */
            <>
              {formFieldsSection}
              {notesAndAttachmentsSection}
            </>
          )}
        </div>

        {/* Footer — separated by border */}
        <div style={{
          padding: '12px 24px',
          borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#E5E7EB',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
          flexShrink: 0,
        }}>
          <button
            onClick={onCancel}
            style={{
              height: '36px', padding: '0 16px',
              fontSize: '13px', fontWeight: 500, color: '#374151',
              borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
              borderRadius: '8px', cursor: 'pointer',
              backgroundColor: '#FFFFFF',
              fontFamily: 'Inter, system-ui, sans-serif',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 100ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          >
            Cancel
            <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 400 }}>Esc</span>
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              height: '36px', padding: '0 16px',
              fontSize: '13px', fontWeight: 500,
              borderRadius: '8px', cursor: canSave ? 'pointer' : 'not-allowed',
              border: 'none',
              backgroundColor: canSave ? accentBg : accentBgDisabled,
              color: canSave ? '#FFFFFF' : '#9CA3AF',
              fontFamily: 'Inter, system-ui, sans-serif',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { if (canSave) e.currentTarget.style.backgroundColor = accentBgHover; }}
            onMouseLeave={(e) => { if (canSave) e.currentTarget.style.backgroundColor = accentBg; }}
          >
            {mode === 'add' ? `Add ${isDiscount ? 'Discount' : 'Premium'}` : 'Save Changes'}
            <span style={{ fontSize: '11px', opacity: 0.8 }}>&#8984;S</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}