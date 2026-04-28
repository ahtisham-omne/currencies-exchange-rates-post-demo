import { useState, useRef, useCallback } from 'react';
import {
  X, FileCheck, Upload, FileText, Trash2, Plus, AlertCircle, Package,
  Calendar, Truck, ChevronDown, ChevronUp,
} from 'lucide-react';

interface ConvertToSOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { soNumber: string; customerPO: string; notes: string; files: UploadedFile[] }) => void;
  quoteNumber: string;
  customerName: string;
}

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
}

// ── Mock line items matching the Items tab ──────────────────────────
interface SOLineItem {
  id: string;
  itemNumber: string;
  name: string;
  qty: number;
  uom: string;
  unitPrice: number;
  total: number;
  shipBy: string;   // ISO date
  deliveryBy: string; // ISO date
}

const MOCK_LINE_ITEMS: SOLineItem[] = [
  { id: '1', itemNumber: '000-100-019', name: 'Type III Ambulance Module', qty: 3, uom: 'EA', unitPrice: 98500, total: 295500, shipBy: '2026-04-15', deliveryBy: '2026-05-01' },
  { id: '2', itemNumber: '000-100-002', name: 'Ford E-450 Chassis (Cutaway)', qty: 3, uom: 'EA', unitPrice: 52800, total: 158400, shipBy: '2026-03-20', deliveryBy: '2026-04-05' },
  { id: '3', itemNumber: '000-100-049', name: 'Motorola APX 8500 All-Band Radio', qty: 3, uom: 'EA', unitPrice: 8750, total: 26250, shipBy: '2026-03-10', deliveryBy: '2026-03-25' },
  { id: '4', itemNumber: '000-100-059', name: 'Stryker Power-PRO XT Stretcher', qty: 3, uom: 'EA', unitPrice: 18200, total: 54600, shipBy: '2026-03-15', deliveryBy: '2026-03-30' },
  { id: '5', itemNumber: '000-100-081', name: 'AIMS 3000W Inverter/Charger', qty: 3, uom: 'EA', unitPrice: 1450, total: 4350, shipBy: '2026-03-10', deliveryBy: '2026-03-20' },
];

function generateSONumber(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `SO-2026-${num}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCurrency(n: number): string {
  return '$' + n.toLocaleString('en-US');
}

function formatDate(d: string): string {
  const date = new Date(d + 'T00:00:00');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${m}/${day}/${date.getFullYear()}`;
}

// ── Shared inline styles ────────────────────────────────────────────
const F = 'Inter, system-ui, sans-serif';
const labelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '0.5px',
  display: 'block', marginBottom: '6px', lineHeight: '1',
};
const inputStyle: React.CSSProperties = {
  width: '100%', height: '36px', padding: '0 12px', fontSize: '13px',
  color: '#1F2937', border: '1px solid #E5E7EB', borderRadius: '8px',
  outline: 'none', backgroundColor: '#FFFFFF', fontFamily: F,
  boxSizing: 'border-box' as const, transition: 'border-color 150ms, box-shadow 150ms',
};

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#93C5FD';
  e.currentTarget.style.boxShadow = '0 0 0 2px #DBEAFE';
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#E5E7EB';
  e.currentTarget.style.boxShadow = 'none';
}

// ── Section header ──────────────────────────────────────────────────
function SectionLabel({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
      <div style={{ width: '20px', height: '20px', borderRadius: '5px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: '11px', height: '11px', color: '#6B7280' }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', lineHeight: '1' }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
export function ConvertToSOModal({ isOpen, onClose, onConfirm, quoteNumber, customerName }: ConvertToSOModalProps) {
  const [soNumber] = useState(generateSONumber);
  const [customerPO, setCustomerPO] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Line items with editable dates
  const [lineItems, setLineItems] = useState<SOLineItem[]>(MOCK_LINE_ITEMS);
  const [showLineItems, setShowLineItems] = useState(true);
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'shipBy' | 'deliveryBy' } | null>(null);

  // Order-level dates (default to latest per-line dates)
  const latestShip = lineItems.reduce((a, b) => (a > b.shipBy ? a : b.shipBy), lineItems[0]?.shipBy || '');
  const latestDelivery = lineItems.reduce((a, b) => (a > b.deliveryBy ? a : b.deliveryBy), lineItems[0]?.deliveryBy || '');
  const [orderShipBy, setOrderShipBy] = useState(latestShip);
  const [orderDeliveryBy, setOrderDeliveryBy] = useState(latestDelivery);

  const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
  const tax = Math.round(subtotal * 0.0825);
  const grandTotal = subtotal + tax;

  const updateLineDate = (id: string, field: 'shipBy' | 'deliveryBy', value: string) => {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li));
    setEditingCell(null);
  };

  // File handlers
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    const newFiles: UploadedFile[] = dropped.map(f => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name, size: formatFileSize(f.size),
      type: f.type || 'application/octet-stream',
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    const newFiles: UploadedFile[] = selected.map(f => ({
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name, size: formatFileSize(f.size),
      type: f.type || 'application/octet-stream',
    }));
    setFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleConvert = () => {
    onConfirm({ soNumber, customerPO: customerPO.trim(), notes: notes.trim(), files });
  };

  if (!isOpen) return null;

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (['pdf'].includes(ext)) return { bg: '#FEE2E2', color: '#DC2626' };
    if (['doc', 'docx'].includes(ext)) return { bg: '#DBEAFE', color: '#2563EB' };
    if (['xls', 'xlsx', 'csv'].includes(ext)) return { bg: '#D1FAE5', color: '#059669' };
    if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return { bg: '#FEF3C7', color: '#D97706' };
    return { bg: '#F3F4F6', color: '#6B7280' };
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px', width: '720px', maxWidth: '95vw',
          maxHeight: '92vh',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)', fontFamily: F,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileCheck style={{ width: '16px', height: '16px', color: '#047857' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', lineHeight: '1', margin: 0, marginBottom: '5px' }}>
                Convert to Sales Order
              </h2>
              <p style={{ fontSize: '11px', color: '#6B7280', margin: 0, lineHeight: '1' }}>
                {quoteNumber} &middot; {customerName}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F3F4F6'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            <X style={{ width: '16px', height: '16px', color: '#6B7280' }} />
          </button>
        </div>

        {/* ── Body (scrollable) ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Section 1: Order Reference ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* SO Number */}
            <div>
              <label style={labelStyle}>Sales Order Number</label>
              <div style={{
                height: '36px', display: 'flex', alignItems: 'center', padding: '0 12px',
                backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px',
                fontSize: '14px', fontWeight: 600, color: '#1F2937', gap: '8px',
              }}>
                <FileCheck style={{ width: '14px', height: '14px', color: '#047857', flexShrink: 0 }} />
                {soNumber}
                <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 500, color: '#9CA3AF', backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: '4px', lineHeight: '1' }}>
                  Auto-assigned
                </span>
              </div>
            </div>
            {/* Customer PO */}
            <div>
              <label style={labelStyle}>
                Customer PO Number <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: '0', color: '#9CA3AF' }}>(optional)</span>
              </label>
              <input type="text" value={customerPO} onChange={e => setCustomerPO(e.target.value)}
                placeholder="e.g., PO-2026-78542" style={inputStyle}
                onFocus={focusBorder} onBlur={blurBorder} />
            </div>
          </div>

          {/* ── Section 2: Order-Level Dates ── */}
          <div style={{ padding: '14px 16px', backgroundColor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
            <SectionLabel icon={Calendar} label="Fulfillment Schedule" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ ...labelStyle, fontSize: '10px' }}>Ship By Date</label>
                <input type="date" value={orderShipBy} onChange={e => setOrderShipBy(e.target.value)}
                  style={{ ...inputStyle, height: '34px', cursor: 'pointer' }}
                  onFocus={focusBorder} onBlur={blurBorder} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: '10px' }}>Expected Delivery</label>
                <input type="date" value={orderDeliveryBy} onChange={e => setOrderDeliveryBy(e.target.value)}
                  style={{ ...inputStyle, height: '34px', cursor: 'pointer' }}
                  onFocus={focusBorder} onBlur={blurBorder} />
              </div>
            </div>
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '8px 0 0', lineHeight: '1.4' }}>
              These are order-level defaults. Override per line item below if needed.
            </p>
          </div>

          {/* ── Section 3: Line Items Verification ── */}
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Toggle header */}
            <button
              onClick={() => setShowLineItems(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', backgroundColor: '#F7F8F9', border: 'none',
                cursor: 'pointer', fontFamily: F,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package style={{ width: '13px', height: '13px', color: '#6B7280' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                  Line Items ({lineItems.length})
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 600, color: '#047857', backgroundColor: '#D1FAE5',
                  padding: '2px 8px', borderRadius: '4px', lineHeight: '1',
                }}>
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Verify dates</span>
                {showLineItems
                  ? <ChevronUp style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
                  : <ChevronDown style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />}
              </div>
            </button>

            {showLineItems && (
              <div style={{ overflowX: 'auto' }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '100px 1fr 44px 44px 90px 110px 110px',
                  gap: '0', padding: '0 16px',
                  backgroundColor: '#F7F8F9', borderTop: '1px solid #E5E7EB',
                  height: '32px', alignItems: 'center',
                }}>
                  {['Item #', 'Description', 'Qty', 'UOM', 'Line Total', 'Ship By', 'Delivery By'].map((h, i) => (
                    <span key={h} style={{
                      fontSize: '10px', fontWeight: 600, color: '#6B7280',
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      textAlign: i >= 4 ? 'right' : 'left',
                      paddingRight: i >= 5 ? '6px' : '0',
                    }}>{h}</span>
                  ))}
                </div>

                {/* Rows */}
                {lineItems.map((li) => (
                  <div
                    key={li.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr 44px 44px 90px 110px 110px',
                      gap: '0', padding: '0 16px',
                      height: '40px', alignItems: 'center',
                      borderTop: '1px solid #F3F4F6',
                      transition: 'background-color 150ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFBFC'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#1B6EF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {li.itemNumber}
                    </span>
                    <span style={{ fontSize: '12px', color: '#1F2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                      {li.name}
                    </span>
                    <span style={{ fontSize: '12px', color: '#1F2937', textAlign: 'left' }}>{li.qty}</span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF', textAlign: 'left' }}>{li.uom}</span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#1F2937', textAlign: 'right' }}>
                      {formatCurrency(li.total)}
                    </span>

                    {/* Ship By — inline editable */}
                    {editingCell?.id === li.id && editingCell.field === 'shipBy' ? (
                      <input
                        type="date" value={li.shipBy} autoFocus
                        onChange={e => updateLineDate(li.id, 'shipBy', e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        style={{
                          fontSize: '11px', color: '#1F2937', border: '1px solid #93C5FD',
                          borderRadius: '4px', padding: '2px 4px', height: '26px',
                          outline: 'none', fontFamily: F, width: '100%',
                          boxShadow: '0 0 0 2px #DBEAFE', backgroundColor: '#FFFFFF',
                          textAlign: 'right',
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingCell({ id: li.id, field: 'shipBy' })}
                        style={{
                          fontSize: '11px', color: '#374151', border: '1px solid transparent',
                          borderRadius: '4px', padding: '2px 6px', height: '26px',
                          cursor: 'pointer', fontFamily: F, textAlign: 'right',
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px',
                          backgroundColor: 'transparent', transition: 'all 120ms', width: '100%',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <Truck style={{ width: '10px', height: '10px', color: '#9CA3AF', flexShrink: 0 }} />
                        {formatDate(li.shipBy)}
                      </button>
                    )}

                    {/* Delivery By — inline editable */}
                    {editingCell?.id === li.id && editingCell.field === 'deliveryBy' ? (
                      <input
                        type="date" value={li.deliveryBy} autoFocus
                        onChange={e => updateLineDate(li.id, 'deliveryBy', e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        style={{
                          fontSize: '11px', color: '#1F2937', border: '1px solid #93C5FD',
                          borderRadius: '4px', padding: '2px 4px', height: '26px',
                          outline: 'none', fontFamily: F, width: '100%',
                          boxShadow: '0 0 0 2px #DBEAFE', backgroundColor: '#FFFFFF',
                          textAlign: 'right',
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingCell({ id: li.id, field: 'deliveryBy' })}
                        style={{
                          fontSize: '11px', color: '#374151', border: '1px solid transparent',
                          borderRadius: '4px', padding: '2px 6px', height: '26px',
                          cursor: 'pointer', fontFamily: F, textAlign: 'right',
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px',
                          backgroundColor: 'transparent', transition: 'all 120ms', width: '100%',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <Calendar style={{ width: '10px', height: '10px', color: '#9CA3AF', flexShrink: 0 }} />
                        {formatDate(li.deliveryBy)}
                      </button>
                    )}
                  </div>
                ))}

                {/* Totals row */}
                <div style={{
                  display: 'flex', justifyContent: 'flex-end',
                  padding: '10px 16px', borderTop: '1px solid #E5E7EB',
                  backgroundColor: '#FAFBFC', gap: '24px',
                }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', lineHeight: '1', marginBottom: '5px' }}>Subtotal</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937' }}>{formatCurrency(subtotal)}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', lineHeight: '1', marginBottom: '5px' }}>Tax (8.25%)</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937' }}>{formatCurrency(tax)}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#9CA3AF', display: 'block', lineHeight: '1', marginBottom: '5px' }}>Total</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#047857' }}>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 4: Documents ── */}
          <div>
            <label style={labelStyle}>
              Supporting Documents <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: '0', color: '#9CA3AF' }}>(optional)</span>
            </label>
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 8px', lineHeight: '1.4' }}>
              Upload signed quotes, purchase orders, or any related agreements.
            </p>

            {/* Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragOver ? '#3B82F6' : '#E5E7EB'}`,
                borderRadius: '10px', padding: '16px', textAlign: 'center',
                cursor: 'pointer', backgroundColor: isDragOver ? '#EFF6FF' : '#FAFBFC',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={e => { if (!isDragOver) { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.backgroundColor = '#F9FAFB'; } }}
              onMouseLeave={e => { if (!isDragOver) { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FAFBFC'; } }}
            >
              <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                backgroundColor: isDragOver ? '#DBEAFE' : '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 6px', transition: 'background-color 200ms',
              }}>
                <Upload style={{ width: '14px', height: '14px', color: isDragOver ? '#3B82F6' : '#9CA3AF' }} />
              </div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#374151', lineHeight: '1', marginBottom: '4px' }}>
                {isDragOver ? 'Drop files here' : 'Drag documents here'}
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1' }}>
                or <span style={{ color: '#3B82F6', fontWeight: 500, cursor: 'pointer' }}>Browse Files</span>
              </div>
            </div>

            {/* Uploaded files */}
            {files.length > 0 && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {files.map(f => {
                  const iconStyle = getFileIcon(f.name);
                  return (
                    <div key={f.id} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '7px 10px', backgroundColor: '#F9FAFB', borderRadius: '8px',
                      border: '1px solid #F3F4F6', transition: 'border-color 150ms',
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#E5E7EB'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#F3F4F6'}
                    >
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '6px',
                        backgroundColor: iconStyle.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <FileText style={{ width: '12px', height: '12px', color: iconStyle.color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: '#1F2937', lineHeight: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1', marginTop: '2px' }}>{f.size}</div>
                      </div>
                      <button onClick={(ev) => { ev.stopPropagation(); removeFile(f.id); }}
                        style={{ width: '24px', height: '24px', borderRadius: '5px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background-color 100ms' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 style={{ width: '12px', height: '12px', color: '#DC2626' }} />
                      </button>
                    </div>
                  );
                })}
                <button onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    padding: '6px', borderRadius: '6px', border: '1px dashed #E5E7EB',
                    backgroundColor: 'transparent', cursor: 'pointer', fontSize: '11px',
                    fontWeight: 500, color: '#6B7280', transition: 'all 150ms', fontFamily: F,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.color = '#3B82F6'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280'; }}
                >
                  <Plus style={{ width: '11px', height: '11px' }} />
                  Add more files
                </button>
              </div>
            )}
          </div>

          {/* ── Section 5: Notes ── */}
          <div>
            <label style={labelStyle}>
              Notes <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: '0', color: '#9CA3AF' }}>(optional)</span>
            </label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder='e.g., "Verbal confirmation via phone call with John Smith on 02/05/2026"'
              rows={2}
              style={{
                width: '100%', fontSize: '13px', color: '#1F2937',
                border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px',
                outline: 'none', resize: 'none', fontFamily: F,
                lineHeight: '1.5', boxSizing: 'border-box', transition: 'border-color 150ms, box-shadow 150ms',
                backgroundColor: '#FFFFFF',
              }}
              onFocus={focusBorder as any} onBlur={blurBorder as any}
            />
          </div>

          {/* Info callout */}
          <div style={{
            paddingLeft: '12px',
            borderLeft: '2px solid #E5E7EB',
          }}>
            <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.5' }}>
              Converting will create Sales Order <span style={{ fontWeight: 600, color: '#374151' }}>{soNumber}</span> and lock this quote from further edits.
              All {lineItems.length} line items ({formatCurrency(grandTotal)} incl. tax) will carry over to the new order.
            </span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #E5E7EB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', color: '#6B7280' }}>
            <span style={{ fontWeight: 500, color: '#1F2937' }}>{lineItems.length} items</span> &middot; {formatCurrency(grandTotal)} total
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={onClose} style={{
              height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500, color: '#6B7280',
              backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer',
              fontFamily: F, lineHeight: '1', transition: 'all 150ms',
            }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F9FAFB'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FFFFFF'}>
              Cancel
            </button>
            <button onClick={handleConvert} style={{
              height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 600, color: '#FFFFFF',
              backgroundColor: '#047857', border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontFamily: F, lineHeight: '1', transition: 'background-color 150ms',
              display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
            }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#065F46'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#047857'}>
              <FileCheck style={{ width: '14px', height: '14px' }} />
              Convert to Sales Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}