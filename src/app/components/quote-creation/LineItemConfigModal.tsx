// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { X, Package, Truck, DollarSign, Warehouse, Settings, Info, Check, ChevronDown, Calendar, AlertCircle, FileText, Upload, Paperclip, Percent, TrendingUp, TrendingDown, Plus, Minus, Sparkles, Tag, BadgePercent, Pencil, Hash, Lightbulb, MoreVertical, Image as ImageIcon, FileArchive, User, Clock, Trash2, Eye, EyeOff, CornerUpLeft, RefreshCw, FileCheck, Film, Link2, Play, Images, Download, Maximize2, Layers, Zap, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { PricingRuleLibraryModal } from '@/app/components/quote-creation/PricingRuleLibraryModal';
import { ConfirmationModal } from '@/app/components/ConfirmationModal';
import { AdjustmentFormModal } from '@/app/components/shared/AdjustmentFormModal';
import type { AdjustmentFormData } from '@/app/components/shared/AdjustmentFormModal';

// Helper function to generate Item ID from item.id in xxx-xxx-xxx format
const generateItemId = (itemId: string): string => {
  const numericPart = itemId.replace(/\D/g, '');
  const last9 = numericPart.slice(-9).padStart(9, '0');
  return `${last9.slice(0, 3)}-${last9.slice(3, 6)}-${last9.slice(6)}`;
};

interface LineItemConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    productId: string;
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
    image?: string;
    images?: string[];
    sku?: string;
    shipmentMethod?: string;
    pricingRule?: string;
    warehouse?: string;
    leadTime?: string;
    tax?: number;
    notes?: string;
    isSerialized?: boolean;
    sourceType?: string;
    isLotControlled?: boolean;
  };
  onSave: (updatedItem: any) => void;
  readOnly?: boolean;
}

const SHIPMENT_METHODS = [
  { id: 'courier-pickup', name: 'Courier Pick Up', description: 'Carrier picks up from your facility', duration: '3-7 business days', cost: 800, productionDays: 2, shippingDays: 5, dateLabel: 'Ready to Pick Up', hasCarrier: true, hasPickupLocation: true },
  { id: 'courier-dropby', name: 'Courier Drop By', description: 'Carrier delivers to customer location', duration: '5-10 business days', cost: 1200, productionDays: 2, shippingDays: 8, dateLabel: 'Ship By', hasCarrier: true, hasPickupLocation: false },
  { id: 'customer-pickup', name: 'Customer Pick Up', description: 'Customer collects from your facility', duration: '1-2 business days', cost: 0, productionDays: 1, shippingDays: 0, dateLabel: 'Ready to Pick Up', hasCarrier: false, hasPickupLocation: true },
  { id: 'self-delivery', name: 'Self-Managed Delivery', description: 'You handle delivery logistics', duration: '3-14 business days', cost: 0, productionDays: 2, shippingDays: 10, dateLabel: 'Ship By', hasCarrier: false, hasPickupLocation: false },
];

const CARRIERS = [
  { id: 'hansen', name: 'Hansen & Adkins Auto Transport', duration: '5-8 business days', cost: 1200, rating: '4.8' },
  { id: 'united', name: 'United Road Services', duration: '7-10 business days', cost: 950, rating: '4.6' },
  { id: 'jack-cooper', name: 'Jack Cooper Transport', duration: '6-9 business days', cost: 1100, rating: '4.7' },
  { id: 'montway', name: 'Montway Auto Transport', duration: '4-7 business days', cost: 1350, rating: '4.9' },
];

const PICKUP_LOCATIONS = [
  { id: 'loc-001', name: 'Conversion Plant - OH', address: '4200 Industrial Pkwy, Columbus, OH 43228', hours: 'Mon-Fri 7AM-5PM' },
  { id: 'loc-002', name: 'Assembly Center - PA', address: '1800 Lancaster Ave, Lancaster, PA 17601', hours: 'Mon-Fri 8AM-4PM' },
  { id: 'loc-003', name: 'South Build Facility - TX', address: '9500 W Commerce St, San Antonio, TX 78227', hours: 'Mon-Sat 6AM-6PM' },
];

const SHIPMENT_PROVIDERS: Record<string, Array<{ id: string; name: string; duration: string; cost: number; location?: string }>> = {
  'courier-pickup': CARRIERS.map(c => ({ id: c.id, name: c.name, duration: c.duration, cost: c.cost })),
  'courier-dropby': CARRIERS.map(c => ({ id: c.id, name: c.name, duration: c.duration, cost: c.cost })),
  'customer-pickup': PICKUP_LOCATIONS.map(l => ({ id: l.id, name: l.name, location: l.address, duration: 'Immediate', cost: 0 })),
  'self-delivery': [{ id: 'self', name: 'Internal Logistics', duration: 'Variable', cost: 0 }],
};

const PRICING_RULES = [
  { id: 'fleet-vol', name: 'Fleet Volume Discount', discount: 4, description: '4% off for 3+ unit fleet orders', minQuantity: 3, status: 'applied', type: 'discount' },
  { id: 'gov-pricing', name: 'Government Contract Pricing', discount: 3, description: '3% municipal/state/federal contract discount', minQuantity: 0, status: 'applied', type: 'discount' },
  { id: 'state-contract', name: 'State Cooperative Bid Pricing', discount: 12, description: '12% off via state cooperative purchasing agreement', minQuantity: 0, status: 'pending', type: 'discount' },
  { id: 'multi-build', name: 'Multi-Unit Build Discount', discount: 7, description: '7% off for 3+ identical build specs', minQuantity: 3, status: 'opportunity', type: 'discount' },
  { id: 'early-payment', name: 'Early Payment Incentive', discount: 2, description: '2% off for payment within 10 days', minQuantity: 0, status: 'applied', type: 'discount' },
  { id: 'rush-build', name: 'Expedited Build Premium', discount: -15, description: '15% surcharge for rush builds under 90 days', minQuantity: 0, status: 'applied', type: 'premium' },
  { id: 'custom-config', name: 'Custom Configuration Premium', discount: -8, description: '8% premium for non-standard build specs', minQuantity: 0, status: 'pending', type: 'premium' },
];

const WAREHOUSES = [
  { id: 'all', name: 'All Facilities', location: 'Combined Inventory', stock: 750, reserved: 160, inProduction: 295, onOrder: 600 },
  { id: 'wh-001', name: 'Conversion Plant - OH', location: 'Columbus, OH', stock: 250, reserved: 50, inProduction: 100, onOrder: 200 },
  { id: 'wh-002', name: 'Assembly Center - PA', location: 'Lancaster, PA', stock: 180, reserved: 30, inProduction: 75, onOrder: 150 },
  { id: 'wh-003', name: 'South Build Facility - TX', location: 'San Antonio, TX', stock: 320, reserved: 80, inProduction: 120, onOrder: 250 },
];

const ITEM_STATES = [
  { id: 'published', label: 'Published', color: '#D1FAE5', textColor: '#065F46' },
  { id: 'pending-approval', label: 'Pending Approval', color: '#FEF3C7', textColor: '#92400E' },
  { id: 'approved', label: 'Approved', color: '#DBEAFE', textColor: '#1E40AF' },
  { id: 'on-hold', label: 'On Hold', color: '#FEE2E2', textColor: '#991B1B' },
  { id: 'ready-to-ship', label: 'Ready to Ship', color: '#E7F3FF', textColor: '#0A4FB3' },
];

const UNITS_OF_MEASURE = [
  { id: 'ea', name: 'EA', abbreviation: 'EA', fullName: 'Base unit', multiplier: 1 },
  { id: 'box', name: 'Box', abbreviation: 'Box', fullName: '12 units per box', multiplier: 12 },
  { id: 'carton', name: 'Carton', abbreviation: 'Carton', fullName: '24 units per carton', multiplier: 24 },
  { id: 'pallet', name: 'Pallet', abbreviation: 'Pallet', fullName: '480 units per pallet', multiplier: 480 },
];

const DEFAULT_ATTACHMENTS = [
  { id: 'att-1', name: 'KKK-A-1822F Compliance Checklist.pdf', type: 'pdf', size: '2.4 MB', isDefault: false, includeInPdf: true, preview: null, uploadedBy: 'Sarah Lindquist', uploadedAt: '01/28/2026' },
  { id: 'att-2', name: 'FMVSS Certification Letter.pdf', type: 'pdf', size: '856 KB', isDefault: false, includeInPdf: true, preview: null, uploadedBy: 'David Kowalski', uploadedAt: '01/25/2026' },
  { id: 'att-3', name: 'Module Build Specification.pdf', type: 'pdf', size: '1.2 MB', isDefault: false, includeInPdf: false, preview: null, uploadedBy: 'Sarah Lindquist', uploadedAt: '01/20/2026' },
  { id: 'att-4', name: 'Floor Plan Layout.png', type: 'png', size: '3.1 MB', isDefault: false, includeInPdf: true, preview: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=200&h=150&fit=crop', uploadedBy: 'Emily Rios', uploadedAt: '02/01/2026' },
  { id: 'att-5', name: 'CAD - Module Assembly.zip', type: 'zip', size: '12.5 MB', isDefault: false, includeInPdf: false, preview: null, uploadedBy: 'Michael Tran', uploadedAt: '01/30/2026' },
];

const GALLERY_MEDIA = [
  { id: 'gal-1', type: 'image' as const, name: 'Exterior - Front Quarter View', url: 'https://images.unsplash.com/photo-1761721941793-a580fbdb9c78?w=400&h=300&fit=crop', uploadedBy: 'Sarah Lindquist', uploadedAt: '02/10/2026', tags: ['exterior', 'hero'] },
  { id: 'gal-2', type: 'image' as const, name: 'Interior - Patient Module', url: 'https://images.unsplash.com/photo-1640948409019-78401475c05b?w=400&h=300&fit=crop', uploadedBy: 'Emily Rios', uploadedAt: '02/08/2026', tags: ['interior', 'module'] },
  { id: 'gal-3', type: 'image' as const, name: 'Electrical Harness Detail', url: 'https://images.unsplash.com/photo-1597766380552-36f5c673637a?w=400&h=300&fit=crop', uploadedBy: 'Michael Tran', uploadedAt: '02/05/2026', tags: ['detail', 'electrical'] },
  { id: 'gal-4', type: 'image' as const, name: 'Emergency Light Bar Assembly', url: 'https://images.unsplash.com/photo-1769869868137-8d27474d1aef?w=400&h=300&fit=crop', uploadedBy: 'David Kowalski', uploadedAt: '02/03/2026', tags: ['exterior', 'lighting'] },
  { id: 'gal-5', type: 'video' as const, name: 'Production Line Walkthrough', url: 'https://images.unsplash.com/photo-1768796370672-3931e5d1ded7?w=400&h=300&fit=crop', uploadedBy: 'Sarah Lindquist', uploadedAt: '01/28/2026', tags: ['production', 'video'], duration: '2:34' },
  { id: 'gal-6', type: 'image' as const, name: 'Chassis - Side Profile', url: 'https://images.unsplash.com/photo-1768400554801-2002b63e0591?w=400&h=300&fit=crop', uploadedBy: 'Emily Rios', uploadedAt: '01/25/2026', tags: ['chassis', 'exterior'] },
  { id: 'gal-7', type: 'video' as const, name: 'Module Fit Test Recording', url: 'https://images.unsplash.com/photo-1640948409019-78401475c05b?w=400&h=300&fit=crop', uploadedBy: 'Michael Tran', uploadedAt: '01/22/2026', tags: ['testing', 'video'], duration: '4:12' },
  { id: 'gal-8', type: 'image' as const, name: 'Build Spec Reference Photo', url: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop', uploadedBy: 'David Kowalski', uploadedAt: '01/18/2026', tags: ['reference', 'spec'] },
];

// Stock Health Meter component — soft 3D-like visual
function StockHealthMeter({ current, min, max }: { current: number; min: number; max: number }) {
  const totalRange = max * 1.25;
  const currentPct = Math.min((current / totalRange) * 100, 100);
  const minPct = (min / totalRange) * 100;
  const maxPct = (max / totalRange) * 100;
  const segmentCount = 20;

  return (
    <div className="relative" style={{ height: '72px', paddingTop: '6px' }}>
      {/* Current value floating pill */}
      <div
        className="absolute z-10 flex items-center justify-center"
        style={{
          left: `${Math.min(Math.max(currentPct, 6), 92)}%`,
          top: '0px',
          transform: 'translateX(-50%)',
        }}
      >
        <div
          className="px-2.5 py-1 text-white text-[11px]"
          style={{
            fontWeight: 600,
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
          }}
        >
          {current} EA
        </div>
        {/* Triangle pointer */}
        <div
          className="absolute"
          style={{
            bottom: '-4px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '5px solid #059669',
          }}
        />
      </div>

      {/* Bar track */}
      <div
        className="absolute left-0 right-0 overflow-hidden"
        style={{
          top: '30px',
          height: '24px',
          borderRadius: '6px',
          background: 'linear-gradient(180deg, #F3F4F6 0%, #E5E7EB 100%)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)',
        }}
      >
        {/* Filled portion with gradient */}
        <div
          className="absolute top-0 left-0 h-full transition-all"
          style={{
            width: `${currentPct}%`,
            borderRadius: '6px 0 0 6px',
            background: 'linear-gradient(180deg, #DBEAFE 0%, #BFDBFE 50%, #DBEAFE 100%)',
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -1px 1px rgba(0,0,0,0.04)',
          }}
        />
        {/* Segment lines */}
        {Array.from({ length: segmentCount - 1 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 h-full"
            style={{
              left: `${((i + 1) / segmentCount) * 100}%`,
              width: '1px',
              background: 'rgba(255,255,255,0.5)',
            }}
          />
        ))}
      </div>

      {/* Min marker triangle */}
      <div className="absolute" style={{ left: `${minPct}%`, top: '55px', transform: 'translateX(-50%)' }}>
        <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '7px solid #EF4444' }} />
      </div>
      {/* Max marker triangle */}
      <div className="absolute" style={{ left: `${maxPct}%`, top: '55px', transform: 'translateX(-50%)' }}>
        <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '7px solid #EF4444' }} />
      </div>
      {/* Min label */}
      <div className="absolute text-[9px] text-[#9CA3AF]" style={{ left: `${minPct}%`, top: '63px', transform: 'translateX(-50%)', fontWeight: 500, whiteSpace: 'nowrap' }}>
        Min. Quantity
      </div>
      {/* Max label */}
      <div className="absolute text-[9px] text-[#9CA3AF]" style={{ left: `${maxPct}%`, top: '63px', transform: 'translateX(-50%)', fontWeight: 500, whiteSpace: 'nowrap' }}>
        Max. Quantity
      </div>
    </div>
  );
}

// Donut chart component
function DonutChart({ segments, total, label }: { segments: { value: number; color: string }[]; total: number; label: string }) {
  const size = 120;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulativeOffset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F3F4F6" strokeWidth={strokeWidth} />
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dashLength = pct * circumference;
          const offset = cumulativeOffset;
          cumulativeOffset += dashLength;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[14px] text-[#1F2937]" style={{ fontWeight: 600 }}>{total} EA</div>
        <div className="text-[10px] text-[#9CA3AF]">{label}</div>
      </div>
    </div>
  );
}

export function LineItemConfigModal({ isOpen, onClose, item, onSave, readOnly }: LineItemConfigModalProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [formData, setFormData] = useState({
    quantity: item.quantity,
    uom: 'ea',
    unitPrice: item.unitPrice,
    discount: item.discount,
    shipmentMethod: item.shipmentMethod || 'courier-pickup',
    shipmentProvider: (item as any).shipmentProvider || 'hansen',
    pickupLocation: (item as any).pickupLocation || 'loc-001',
    trackingNumber: (item as any).trackingNumber || '',
    isShipmentOverride: false,
    expectedShipDate: '',
    isShipDateOverride: false,
    estimatedDeliveryDate: '',
    isDeliveryDateOverride: false,
    pricingRule: item.pricingRule || 'standard',
    appliedRules: ['early-payment', 'fleet-vol', 'multi-build', 'custom-config'],
    oneTimeAdjustments: [] as Array<{ id: string; type: 'discount' | 'premium'; amountType: '$' | '%'; amount: number; label: string }>,
    warehouse: item.warehouse || 'all',
    leadTime: item.leadTime || '5-7 days',
    tax: item.tax || 8.5,
    notes: item.notes || '',
    showNotesInPdf: false,
    state: 'published',
    attachments: DEFAULT_ATTACHMENTS,
  });

  const [showShipmentDropdown, setShowShipmentDropdown] = useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [showPricingLibrary, setShowPricingLibrary] = useState(false);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [showUomDropdown, setShowUomDropdown] = useState(false);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [editingAdjustmentId, setEditingAdjustmentId] = useState<string | null>(null);
  const [showShipmentModal, setShowShipmentModal] = useState(false);

  const [showConfigTips, setShowConfigTips] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingFileName, setEditingFileName] = useState('');
  const [showPriceUpdateConfirm, setShowPriceUpdateConfirm] = useState(false);
  const [pendingPriceChange, setPendingPriceChange] = useState<number | null>(null);
  const defaultUom = 'ea'; // Default UOM for this item from item master
  const [leftTab, setLeftTab] = useState<'inventory' | 'attachments' | 'gallery' | 'activity_log'>('inventory');
  const [showNotesSection, setShowNotesSection] = useState(!!item.notes);
  const [linkedMediaIds, setLinkedMediaIds] = useState<string[]>([]);
  const [galleryFilter, setGalleryFilter] = useState<'all' | 'image' | 'video'>('all');
  const [showDeleteAllRulesConfirm, setShowDeleteAllRulesConfirm] = useState(false);
  const [showDeleteAllAdjustmentsConfirm, setShowDeleteAllAdjustmentsConfirm] = useState(false);
  const [newAdjustment, setNewAdjustment] = useState({
    type: 'discount' as 'discount' | 'premium',
    amountType: '%' as '$' | '%',
    amount: 0,
    label: '',
  });

  const uomDropdownRef = useRef<HTMLDivElement>(null);
  const uomButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  const handleToggleUomDropdown = () => {
    if (!showUomDropdown && uomButtonRef.current) {
      const rect = uomButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.right - 200,
      });
    }
    setShowUomDropdown(!showUomDropdown);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (uomDropdownRef.current && !uomDropdownRef.current.contains(event.target as Node)) {
        setShowUomDropdown(false);
      }
    };
    if (showUomDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => { document.removeEventListener('mousedown', handleClickOutside); };
    }
  }, [showUomDropdown]);

  if (!isOpen) return null;

  const selectedShipment = SHIPMENT_METHODS.find(m => m.id === formData.shipmentMethod);
  const selectedWarehouse = WAREHOUSES.find(w => w.id === formData.warehouse);
  const selectedUom = UNITS_OF_MEASURE.find(u => u.id === formData.uom);

  const parseDuration = (duration: string) => {
    const match = duration.match(/(\d+)-(\d+)/);
    if (match) return { min: parseInt(match[1]), max: parseInt(match[2]) };
    return { min: 3, max: 5 };
  };

  const calculateShipDateRange = () => {
    if (formData.isShipDateOverride && formData.expectedShipDate) return { single: formData.expectedShipDate };
    const today = new Date();
    const productionDays = selectedShipment?.productionDays || 2;
    const shipDate = new Date(today);
    shipDate.setDate(shipDate.getDate() + productionDays);
    return { single: shipDate.toISOString().split('T')[0] };
  };

  const calculateDeliveryDateRange = (): { single: string } | { min: string; max: string } => {
    if (formData.isDeliveryDateOverride && formData.estimatedDeliveryDate) return { single: formData.estimatedDeliveryDate };
    const shipDate = new Date(calculateShipDateRange().single);
    const duration = parseDuration(selectedShipment?.duration || '3-7 business days');
    const productionDays = selectedShipment?.productionDays || 2;
    const transitMin = Math.max(0, duration.min - productionDays);
    const transitMax = Math.max(0, duration.max - productionDays);
    const minDate = new Date(shipDate);
    minDate.setDate(minDate.getDate() + transitMin);
    const maxDate = new Date(shipDate);
    maxDate.setDate(maxDate.getDate() + transitMax);
    if (transitMin === transitMax) return { single: minDate.toISOString().split('T')[0] };
    return { min: minDate.toISOString().split('T')[0], max: maxDate.toISOString().split('T')[0] };
  };

  const calculateShipDate = () => {
    const range = calculateShipDateRange();
    return 'single' in range ? range.single : range.min;
  };

  const calculateDeliveryDate = () => {
    const range = calculateDeliveryDateRange();
    return 'single' in range ? range.single : range.min;
  };

  // Pricing calculations
  const baseSubtotal = formData.quantity * formData.unitPrice;
  const appliedRulesDiscounts = formData.appliedRules
    .map(ruleId => {
      const rule = PRICING_RULES.find(r => r.id === ruleId);
      if (!rule) return { id: ruleId, name: '', amount: 0, percentage: 0 };
      const isActive = formData.quantity >= rule.minQuantity;
      return {
        id: rule.id,
        name: rule.name,
        amount: isActive ? (baseSubtotal * rule.discount / 100) : 0,
        percentage: rule.discount,
        isActive,
        isPending: !isActive,
        minQuantity: rule.minQuantity,
      };
    });
  const totalRulesDiscount = appliedRulesDiscounts.reduce((sum, r) => sum + r.amount, 0);
  const activeRulesCount = appliedRulesDiscounts.filter(r => r.isActive && r.name).length;
  const pendingRulesCount = appliedRulesDiscounts.filter(r => !r.isActive && r.name).length;

  const oneTimeTotal = formData.oneTimeAdjustments.reduce((sum, adj) => {
    const amount = adj.amountType === '%' ? (baseSubtotal * adj.amount / 100) : adj.amount;
    return sum + (adj.type === 'discount' ? -amount : amount);
  }, 0);

  const afterDiscounts = baseSubtotal - totalRulesDiscount + oneTimeTotal;
  const selectedProvider = SHIPMENT_PROVIDERS[formData.shipmentMethod as keyof typeof SHIPMENT_PROVIDERS]?.find(p => p.id === formData.shipmentProvider);
  const shippingCost = selectedProvider?.cost ?? selectedShipment?.cost ?? 0;
  const total = afterDiscounts + shippingCost;

  const handleSave = () => {
    onSave({ ...item, ...formData, total });
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
  };

  const addAdjustment = () => {
    if (newAdjustment.amount > 0 && newAdjustment.label) {
      if (editingAdjustmentId) {
        setFormData({ ...formData, oneTimeAdjustments: formData.oneTimeAdjustments.map(adj => adj.id === editingAdjustmentId ? { ...newAdjustment, id: adj.id } : adj) });
      } else {
        setFormData({ ...formData, oneTimeAdjustments: [...formData.oneTimeAdjustments, { ...newAdjustment, id: `adj-${Date.now()}` }] });
      }
      setNewAdjustment({ type: 'discount', amountType: '%', amount: 0, label: '' });
      setEditingAdjustmentId(null);
      setShowAdjustmentForm(false);
      setShowAdjustmentModal(false);
    }
  };

  const editAdjustment = (adj: any) => {
    setNewAdjustment({ type: adj.type, amountType: adj.amountType, amount: adj.amount, label: adj.label });
    setEditingAdjustmentId(adj.id);
    setShowAdjustmentModal(true);
  };

  const removeAdjustment = (id: string) => {
    setFormData({ ...formData, oneTimeAdjustments: formData.oneTimeAdjustments.filter(adj => adj.id !== id) });
  };

  const togglePricingRule = (ruleId: string) => {
    const isApplied = formData.appliedRules.includes(ruleId);
    setFormData({ ...formData, appliedRules: isApplied ? formData.appliedRules.filter(id => id !== ruleId) : [...formData.appliedRules, ruleId] });
  };

  const opportunities = PRICING_RULES.filter(rule => {
    const isNotApplied = !formData.appliedRules.includes(rule.id);
    const isCloseToUnlocking = formData.quantity >= rule.minQuantity * 0.8 && formData.quantity < rule.minQuantity;
    return isNotApplied && isCloseToUnlocking && rule.minQuantity > 0;
  });

  // Inventory derived data
  const onHand = selectedWarehouse?.stock || 0;
  const reserved = selectedWarehouse?.reserved || 0;
  const inProduction = selectedWarehouse?.inProduction || 0;
  const onOrder = selectedWarehouse?.onOrder || 0;
  const available = onHand - reserved;
  const projectedAvailable = available + inProduction + onOrder;
  const quarantined = 0;
  const undergoingMovement = 0;
  const minQty = 100;
  const maxQty = Math.round(projectedAvailable * 1.1);

  // UOM breakdown for donut
  const uomDistribution = [
    { pctOfTotal: 0.55 },
    { pctOfTotal: 0.22 },
    { pctOfTotal: 0.15 },
    { pctOfTotal: 0.08 },
  ];
  const uomBreakdown = UNITS_OF_MEASURE.map((uom, i) => {
    const colors = ['#1B6EF3', '#60A5FA', '#93C5FD', '#BFDBFE'];
    const eaEquiv = Math.round(onHand * (uomDistribution[i]?.pctOfTotal || 0));
    const qty = uom.multiplier === 1 ? eaEquiv : Math.round(eaEquiv / uom.multiplier);
    const pct = onHand > 0 ? Math.round((eaEquiv / onHand) * 100) : 0;
    return { ...uom, qty, eaEquiv, pct, color: colors[i % colors.length] };
  });

  const hasAppliedRules = appliedRulesDiscounts.filter(r => r.name).length > 0;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 11000, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white flex flex-col overflow-hidden"
        style={{ width: '92vw', maxWidth: '1340px', height: '88vh', maxHeight: '92vh', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-3 border-b border-[#E5E7EB] flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded bg-[#F3F4F6] flex items-center justify-center flex-shrink-0" style={{ borderRadius: '6px' }}>
              <Settings className="w-4 h-4 text-[#6B7280]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                  {readOnly ? 'View Line Item' : 'Advanced Configurator'}
                </h2>
                {readOnly && (
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: '4px', lineHeight: '1', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                    View Only
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-[#9CA3AF]">{generateItemId(item.id)}</p>
                {item.isSerialized !== undefined && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] bg-[#F3F4F6] text-[#374151]" style={{ borderRadius: '3px', fontWeight: 500 }}>
                    {item.isSerialized ? 'Serialized' : 'Non-Serialized'}
                  </span>
                )}
                {item.isLotControlled && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] bg-[#E0E7FF] text-[#3730A3]" style={{ borderRadius: '3px', fontWeight: 500 }}>Lot-Controlled</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-[#F3F4F6] transition-colors flex-shrink-0" style={{ borderRadius: '6px' }}>
            <X className="w-4 h-4 text-[#6B7280]" />
          </button>
        </div>

        {/* Content - Two Panel Layout */}
        <div className="flex-1 overflow-hidden flex">

          {/* ===== LEFT PANEL - Tabbed (Inventory / Attachments / Gallery) ===== */}
          <div className="overflow-hidden flex flex-col border-r border-[#E5E7EB]" style={{ minWidth: 0, width: '50%', flexShrink: 0 }}>
            {/* Left Panel Tabs */}
            <div className="flex border-b border-[#E5E7EB] flex-shrink-0 px-5 pt-1 bg-white">
              {[
                { id: 'inventory' as const, icon: Warehouse, label: 'Inventory Details', count: null as number | null },
                { id: 'attachments' as const, icon: Paperclip, label: 'Attachments', count: formData.attachments.length as number | null },
                { id: 'gallery' as const, icon: Images, label: 'Gallery', count: GALLERY_MEDIA.length as number | null },
                { id: 'activity_log' as const, icon: Zap, label: 'Activity Log', count: null as number | null },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setLeftTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-[12px] transition-colors border-b-2 ${leftTab === tab.id ? 'border-[#1B6EF3] text-[#1B6EF3]' : 'border-transparent text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F9FAFB]'}`}
                  style={{ fontWeight: 500 }}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count !== null && (
                    <span
                      className={`inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] text-[10px] ${leftTab === tab.id ? 'bg-[#EFF6FF] text-[#1B6EF3]' : 'bg-[#F3F4F6] text-[#6B7280]'}`}
                      style={{ borderRadius: '4px', fontWeight: 600 }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Left Panel Tab Content */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

              {/* ===== INVENTORY DETAILS TAB ===== */}
              {leftTab === 'inventory' && (
                <div className="p-5 space-y-5">
                  {/* Data timestamp row */}
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#6B7280]" style={{ fontWeight: 400 }}>Data view as of 02/17/2026 2:32 PM</span>
                    <button className="flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#1F2937] transition-colors" style={{ fontWeight: 500 }}>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Refresh Page
                    </button>
                  </div>

                  {/* Cumulative Stock Health */}
                  <div className="border border-[#E5E7EB] bg-white p-5" style={{ borderRadius: '8px' }}>
                    <div className="flex items-center justify-between mb-5">
                      <div className="text-[13px] text-[#1F2937] flex items-center gap-2" style={{ fontWeight: 600 }}><Warehouse className="w-3.5 h-3.5 text-[#6B7280]" />Cumulative Stock Health</div>
                      {/* Warehouse / UOM selector */}
                      <div className="relative">
                        {readOnly ? (
                          <div className="h-7 px-2.5 text-[11px] border border-[#E5E7EB] bg-[#F9FAFB] flex items-center gap-1.5" style={{ borderRadius: '6px' }}>
                            <span className="text-[#1F2937]" style={{ fontWeight: 500 }}>{selectedUom?.abbreviation} (default)</span>
                          </div>
                        ) : (
                          <button onClick={() => setShowWarehouseDropdown(!showWarehouseDropdown)} className="h-7 px-2.5 text-[11px] border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-colors flex items-center gap-1.5" style={{ borderRadius: '6px' }}>
                            <span className="text-[#1F2937]" style={{ fontWeight: 500 }}>{selectedUom?.abbreviation} (default)</span>
                            <ChevronDown className="w-3 h-3 text-[#6B7280]" />
                          </button>
                        )}
                        {showWarehouseDropdown && (
                          <div className="absolute top-full right-0 mt-1 bg-white border border-[#E5E7EB] shadow-lg z-10 min-w-[200px]" style={{ borderRadius: '6px' }}>
                            {WAREHOUSES.map((warehouse) => (
                              <button key={warehouse.id} onClick={() => { setFormData({ ...formData, warehouse: warehouse.id }); setShowWarehouseDropdown(false); }} className="w-full px-3 py-2.5 text-left hover:bg-[#F9FAFB] transition-colors border-b border-[#E5E7EB] last:border-b-0">
                                <div className="text-[12px] text-[#1F2937]" style={{ fontWeight: 500 }}>{warehouse.name}</div>
                                <div className="text-[10px] text-[#9CA3AF]">{warehouse.location}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stock Health Meter */}
                    <div className="mb-6">
                      <StockHealthMeter current={onHand} min={minQty} max={maxQty} />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                      {[
                        { label: 'On Hand', value: onHand, info: true },
                        { label: 'In Production', value: inProduction, info: true },
                        { label: 'Reserved', value: reserved, info: false },
                        { label: 'On Order', value: onOrder, info: false },
                        { label: 'Quarantined', value: quarantined, info: true },
                        { label: 'Projected Available', value: projectedAvailable, info: true },
                        { label: 'Available', value: available, info: false },
                        { label: 'Undergoing Movement', value: undergoingMovement, info: false },
                      ].map((stat) => (
                        <div key={stat.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <span className="text-[12px] text-[#6B7280]">{stat.label}</span>
                            {stat.info && <Info className="w-2.5 h-2.5 text-[#D1D5DB]" />}
                          </div>
                          <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                            {stat.value.toLocaleString()} <span className="text-[10px] text-[#9CA3AF]" style={{ fontWeight: 400 }}>EA</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* On-Hand by Unit of Measure */}
                  <div className="border border-[#E5E7EB] bg-white p-5" style={{ borderRadius: '8px' }}>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="text-[13px] text-[#1F2937] mb-0.5" style={{ fontWeight: 600 }}>On-Hand by Unit of Measure</div>
                        <div className="text-[10px] text-[#9CA3AF]">Converted to Default Stocking Unit Each (EA)</div>
                      </div>
                      <div className="text-[10px] text-[#9CA3AF] flex-shrink-0" style={{ fontWeight: 400 }}>Snapshot as of Today, 2:32 PM</div>
                    </div>

                    {/* Donut chart — centered above bars */}
                    <div className="flex justify-center mb-5" style={{ paddingTop: '4px', paddingBottom: '4px' }}>
                      <div className="flex flex-col items-center gap-2.5">
                        <DonutChart
                          segments={uomBreakdown.map(u => ({ value: u.eaEquiv, color: u.color }))}
                          total={onHand}
                          label="Total On Hand"
                        />
                        {/* Inline legend */}
                        <div className="flex items-center gap-3 flex-wrap justify-center">
                          {uomBreakdown.map((uom) => (
                            <div key={uom.id} className="flex items-center gap-1">
                              <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: uom.color, borderRadius: '2px' }} />
                              <span className="text-[10px] text-[#6B7280]" style={{ fontWeight: 500 }}>{uom.abbreviation}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div style={{ borderTop: '1px solid #F3F4F6', marginBottom: '16px' }} />

                    {/* Bar breakdown — full width */}
                    <div className="space-y-3">
                      {uomBreakdown.map((uom) => (
                        <div key={uom.id}>
                          {/* Label row */}
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 flex-shrink-0" style={{ backgroundColor: uom.color, borderRadius: '2px' }} />
                              <span className="text-[11px] text-[#1F2937]" style={{ fontWeight: 600 }}>{uom.qty} {uom.abbreviation}</span>
                              <span className="text-[9px] text-[#9CA3AF]">{uom.name} ({uom.multiplier > 1 ? `${uom.multiplier} EA` : uom.abbreviation})</span>
                            </div>
                            <span className="text-[10px] text-[#6B7280] whitespace-nowrap" style={{ fontWeight: 500 }}>
                              {uom.qty}{'\u00D7'}{uom.multiplier} = {uom.eaEquiv} EA
                            </span>
                          </div>
                          {/* Bar */}
                          <div className="h-4 bg-[#F3F4F6] overflow-hidden flex items-center" style={{ borderRadius: '3px' }}>
                            <div className="h-full flex items-center px-1.5" style={{ width: `${Math.max(uom.pct, 8)}%`, backgroundColor: uom.color, borderRadius: '3px', transition: 'width 300ms ease' }}>
                              <span className="text-[9px] text-white whitespace-nowrap" style={{ fontWeight: 600 }}>{uom.pct}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

              {/* ===== ATTACHMENTS TAB ===== */}
              {leftTab === 'attachments' && (
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[11px] text-[#6B7280] uppercase tracking-wide flex items-center gap-2" style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
                      <Paperclip className="w-3.5 h-3.5" />
                      {formData.attachments.length} Attachments
                    </div>
                    {linkedMediaIds.length > 0 && (
                      <span className="text-[10px] text-[#1B6EF3]" style={{ fontWeight: 500 }}>{linkedMediaIds.length} linked from gallery</span>
                    )}
                  </div>
                  {formData.attachments.map((file) => {
                    const isEditing = editingFileId === file.id;
                    const isFromGallery = file.id.startsWith('att-gallery-');
                    return (
                      <div key={file.id} className="group relative border border-[#E5E7EB] bg-white hover:border-[#BFDBFE] hover:shadow-[0_1px_4px_rgba(59,130,246,0.08)] transition-all overflow-hidden cursor-pointer" style={{ borderRadius: '6px' }}
                        onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; toast.info(`Opening preview: ${file.name}`); }}
                        title="Click to preview"
                      >
                        <div className="flex items-stretch gap-3 pt-0 pr-3 pb-0 pl-0">
                          <div className="w-12 aspect-square flex-shrink-0 flex items-center justify-center bg-[#FAFBFC] border-r border-[#E5E7EB] relative group-hover:bg-[#EFF6FF] transition-colors">
                            {file.type === 'png' || file.type === 'jpg' || file.type === 'mp4' ? (file.preview ? <img src={file.preview} alt={file.name} className="w-full h-full object-cover" /> : file.type === 'mp4' ? <Film className="w-5 h-5 text-[#8B5CF6]" /> : <ImageIcon className="w-5 h-5 text-[#10B981]" />) : file.type === 'pdf' ? <FileText className="w-5 h-5 text-[#DC2626]" /> : file.type === 'zip' ? <FileArchive className="w-5 h-5 text-[#059669]" /> : <FileText className="w-5 h-5 text-[#6B7280]" />}
                            {isFromGallery && (<div className="absolute bottom-0 right-0 w-4 h-4 flex items-center justify-center bg-[#1B6EF3]" style={{ borderTopLeftRadius: '4px' }}><Link2 className="w-2.5 h-2.5 text-white" /></div>)}
                            {!isFromGallery && (<div className="absolute inset-0 flex items-center justify-center bg-[#1B6EF3] bg-opacity-0 group-hover:bg-opacity-10 transition-all"><Eye className="w-4 h-4 text-[#1B6EF3] opacity-0 group-hover:opacity-60 transition-opacity" /></div>)}
                          </div>
                          <div className="flex-1 min-w-0 py-2.5">
                            {isEditing ? (
                              <input type="text" value={editingFileName} onChange={(e) => setEditingFileName(e.target.value)}
                                onBlur={() => { if (editingFileName.trim()) { setFormData({ ...formData, attachments: formData.attachments.map(a => a.id === file.id ? { ...a, name: editingFileName } : a) }); } setEditingFileId(null); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') setEditingFileId(null); }}
                                autoFocus className="w-full px-2 py-1 text-[12px] border border-[#1B6EF3] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B6EF3]" style={{ borderRadius: '4px', fontWeight: 500 }} />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <div className="text-[12px] text-[#1F2937] truncate" style={{ fontWeight: 500 }}>{file.name}</div>
                                {isFromGallery && (<span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#EFF6FF] text-[#1B6EF3] text-[9px] flex-shrink-0" style={{ borderRadius: '3px', fontWeight: 500 }}><Images className="w-2.5 h-2.5" />Gallery</span>)}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              <div className="text-[10px] text-[#9CA3AF]">{file.size}</div>
                              <div className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
                              <div className="text-[10px] text-[#9CA3AF]">{file.uploadedBy}</div>
                            </div>
                          </div>
                          {!readOnly ? (
                            <div className="flex items-center gap-1 flex-shrink-0 py-2.5">
                              <button onClick={(e) => { e.stopPropagation(); toast.info(`Downloading ${file.name}...`); }} className="p-1 hover:bg-[#F3F4F6] transition-colors" style={{ borderRadius: '4px' }} title="Download"><Download className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#1B6EF3] transition-colors" /></button>
                              <button onClick={() => { setEditingFileId(file.id); setEditingFileName(file.name); }} className="p-1 hover:bg-[#F3F4F6] transition-colors" style={{ borderRadius: '4px' }} title="Rename"><Pencil className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#1B6EF3] transition-colors" /></button>
                              <button onClick={() => { setFormData({ ...formData, attachments: formData.attachments.map(a => a.id === file.id ? { ...a, includeInPdf: !a.includeInPdf } : a) }); }} className="p-1 hover:bg-[#F3F4F6] transition-colors" style={{ borderRadius: '4px' }} title={file.includeInPdf ? "Visible in Quote" : "Hidden from Quote"}>
                                {file.includeInPdf ? <Eye className="w-3.5 h-3.5 text-[#1B6EF3]" /> : <EyeOff className="w-3.5 h-3.5 text-[#D1D5DB]" />}
                              </button>
                              {!file.isDefault && (<button onClick={() => { setFormData({ ...formData, attachments: formData.attachments.filter(a => a.id !== file.id) }); }} className="p-1 hover:bg-[#FEF2F2] transition-colors border border-transparent hover:border-[#FCA5A5]" style={{ borderRadius: '4px' }} title="Delete"><Trash2 className="w-3.5 h-3.5 text-[#EF4444]" /></button>)}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-shrink-0 py-2.5">
                              <button onClick={(e) => { e.stopPropagation(); toast.info(`Downloading ${file.name}...`); }} className="p-1 hover:bg-[#F3F4F6] transition-colors" style={{ borderRadius: '4px' }} title="Download"><Download className="w-3.5 h-3.5 text-[#9CA3AF]" /></button>
                              {file.includeInPdf ? <span className="p-1" title="Visible in Quote"><Eye className="w-3.5 h-3.5 text-[#1B6EF3]" /></span> : <span className="p-1" title="Hidden from Quote"><EyeOff className="w-3.5 h-3.5 text-[#D1D5DB]" /></span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!readOnly && (
                    <button onClick={() => { const newFile = { id: `att-${Date.now()}`, name: `Document-${formData.attachments.length + 1}.pdf`, type: 'pdf', size: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 9)}MB`, isDefault: false, includeInPdf: true, preview: null, uploadedBy: 'You', uploadedAt: '02/17/2026' }; setFormData({ ...formData, attachments: [...formData.attachments, newFile] }); }}
                      className="w-full h-8 flex items-center justify-center gap-2 border border-dashed border-[#D1D5DB] text-[12px] text-[#6B7280] hover:border-[#1B6EF3] hover:text-[#1B6EF3] hover:bg-[#F0F9FF] transition-colors" style={{ borderRadius: '6px', fontWeight: 500 }}
                    ><Upload className="w-3.5 h-3.5" />Upload Additional Files</button>
                  )}
                </div>
              )}

              {/* ===== GALLERY TAB ===== */}
              {leftTab === 'gallery' && (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(['all', 'image', 'video'] as const).map((filter) => (
                        <button key={filter} onClick={() => setGalleryFilter(filter)}
                          className={`h-7 px-3 flex items-center gap-1.5 text-[12px] transition-colors ${galleryFilter === filter ? 'bg-[#E7F3FF] text-[#1B6EF3]' : 'bg-white text-[#6B7280] hover:bg-[#F9FAFB]'}`}
                          style={{ borderRadius: '6px', fontWeight: 500, borderWidth: '1px', borderStyle: 'solid', borderColor: galleryFilter === filter ? '#1B6EF3' : '#E5E7EB' }}
                        >
                          {filter === 'all' ? <Images className="w-3 h-3" /> : filter === 'image' ? <ImageIcon className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                          {filter === 'all' ? 'All' : filter === 'image' ? 'Photos' : 'Videos'}
                          <span className="text-[10px]" style={{ opacity: 0.7 }}>{filter === 'all' ? GALLERY_MEDIA.length : GALLERY_MEDIA.filter(m => m.type === filter).length}</span>
                        </button>
                      ))}
                    </div>
                    {!readOnly && (<button onClick={() => toast.info('Upload media dialog — coming soon')} className="h-7 px-3 flex items-center gap-1.5 text-[12px] text-[#1B6EF3] hover:bg-[#F0F9FF] transition-colors" style={{ borderRadius: '6px', fontWeight: 500, borderWidth: '1px', borderStyle: 'dashed', borderColor: '#93C5FD' }}><Upload className="w-3 h-3" />Upload</button>)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {GALLERY_MEDIA.filter(m => galleryFilter === 'all' || m.type === galleryFilter).map((media) => {
                      const isLinked = linkedMediaIds.includes(media.id);
                      return (
                        <div key={media.id} className="group relative border border-[#E5E7EB] bg-white overflow-hidden hover:border-[#BFDBFE] hover:shadow-[0_2px_8px_rgba(59,130,246,0.1)] transition-all cursor-pointer" style={{ borderRadius: '8px' }} onClick={() => toast.info(`Preview: ${media.name}`)}>
                          <div className="relative aspect-[4/3] bg-[#F3F4F6] overflow-hidden">
                            <img src={media.url} alt={media.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" style={{ transitionDuration: '300ms' }} />
                            {media.type === 'video' && (<div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20"><div className="w-8 h-8 rounded-full bg-white bg-opacity-90 flex items-center justify-center shadow-sm"><Play className="w-4 h-4 text-[#1F2937]" style={{ marginLeft: '2px' }} /></div>{media.duration && (<span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black bg-opacity-70 text-white text-[10px]" style={{ borderRadius: '3px', fontWeight: 500 }}>{media.duration}</span>)}</div>)}
                            {isLinked && (<div className="absolute top-2 left-2 px-1.5 py-0.5 bg-[#1B6EF3] text-white text-[9px] flex items-center gap-1" style={{ borderRadius: '3px', fontWeight: 600 }}><Link2 className="w-2.5 h-2.5" />Linked</div>)}
                            <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black bg-opacity-50 text-white text-[9px]" style={{ borderRadius: '3px', fontWeight: 500 }}>{media.type === 'video' ? 'VIDEO' : 'PHOTO'}</div>
                            <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1.5 py-2 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" style={{ transitionDuration: '200ms' }}>
                              <button onClick={(e) => { e.stopPropagation(); toast.info(`Full preview: ${media.name}`); }} className="w-7 h-7 flex items-center justify-center bg-white/90 hover:bg-white text-[#1F2937] transition-colors shadow-sm" style={{ borderRadius: '6px' }} title="Full screen preview"><Maximize2 className="w-3.5 h-3.5" /></button>
                              {!readOnly && (<button onClick={(e) => { e.stopPropagation(); if (isLinked) { setLinkedMediaIds(prev => prev.filter(id => id !== media.id)); setFormData(prev => ({ ...prev, attachments: prev.attachments.filter(a => a.id !== `att-gallery-${media.id}`) })); toast.info(`Unlinked "${media.name}" from attachments`); } else { setLinkedMediaIds(prev => [...prev, media.id]); const newAtt = { id: `att-gallery-${media.id}`, name: `${media.name}.${media.type === 'video' ? 'mp4' : 'jpg'}`, type: media.type === 'video' ? 'mp4' : 'jpg', size: media.type === 'video' ? '48.2 MB' : '3.8 MB', isDefault: false, includeInPdf: media.type === 'image', preview: media.type === 'image' ? media.url : null, uploadedBy: media.uploadedBy, uploadedAt: media.uploadedAt }; setFormData(prev => ({ ...prev, attachments: [...prev.attachments, newAtt] })); toast.success(`Linked "${media.name}" as attachment`); } }} className={`w-7 h-7 flex items-center justify-center transition-colors shadow-sm ${isLinked ? 'bg-[#1B6EF3] hover:bg-[#0D5ED7] text-white' : 'bg-white/90 hover:bg-white text-[#1F2937]'}`} style={{ borderRadius: '6px' }} title={isLinked ? 'Unlink from attachments' : 'Link as attachment'}><Link2 className="w-3.5 h-3.5" /></button>)}
                            </div>
                          </div>
                          <div className="p-2.5">
                            <div className="text-[11px] text-[#1F2937] truncate" style={{ fontWeight: 500 }}>{media.name}</div>
                            <div className="flex items-center gap-1.5 mt-1"><User className="w-2.5 h-2.5 text-[#D1D5DB] flex-shrink-0" /><span className="text-[10px] text-[#9CA3AF] truncate">{media.uploadedBy}</span><div className="w-0.5 h-0.5 rounded-full bg-[#D1D5DB] flex-shrink-0" /><span className="text-[10px] text-[#9CA3AF] flex-shrink-0">{media.uploadedAt}</span></div>
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">{media.tags.map(tag => (<span key={tag} className="text-[9px] text-[#6B7280] px-1.5 py-0.5 bg-[#F3F4F6]" style={{ borderRadius: '3px', fontWeight: 500 }}>{tag}</span>))}</div>
                            {isLinked && (<div className="flex items-center gap-1 mt-2 text-[10px] text-[#1B6EF3]" style={{ fontWeight: 500 }}><Link2 className="w-2.5 h-2.5" />Linked as attachment</div>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ===== ACTIVITY LOG TAB (Coming Soon) ===== */}
              {leftTab === 'activity_log' && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  minHeight: '340px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
                  }}>
                    <Clock style={{ width: '22px', height: '22px', color: '#9CA3AF' }} />
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', margin: '0 0 6px 0', lineHeight: '1.2' }}>
                    Activity Log
                  </h3>
                  <p style={{ fontSize: '13px', fontWeight: 400, color: '#9CA3AF', margin: 0, lineHeight: '1.4', textAlign: 'center' as const, maxWidth: '280px' }}>
                    Item-level change history, pricing adjustments, and configuration edits will appear here.
                  </p>
                </div>
              )}

            </div>
          </div>

          {/* ===== RIGHT PANEL - Configuration & Pricing ===== */}
          <div className="overflow-hidden flex flex-col bg-[#F7F8F9]" style={{ minWidth: 0, width: '50%', flexShrink: 0 }}>
            {/* Configuration & Pricing Content - scrollable */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="p-5 space-y-5">

              {/* Product Card - scrolls with content */}
              <div className="border border-[#E5E7EB] bg-white p-4" style={{ borderRadius: '8px' }}>
                <div className="flex gap-3">
                  <div className="relative flex-shrink-0">
                    {item.images && item.images.length > 0 ? (
                      <ImageWithFallback src={item.images[0]} alt={item.name} className="w-[72px] h-[72px] object-cover" style={{ borderRadius: '6px' }} />
                    ) : (
                      <div className="w-[72px] h-[72px] bg-[#F3F4F6] flex items-center justify-center" style={{ borderRadius: '6px' }}>
                        <Package className="w-6 h-6 text-[#9CA3AF]" />
                      </div>
                    )}
                    <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 bg-[#1B6EF3] text-white text-[9px]" style={{ borderRadius: '3px', fontWeight: 600 }}>
                      {item.sourceType === 'Manufactured' ? 'Build' : 'Parts'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[14px] text-[#1F2937]" style={{ fontWeight: 600 }}>{generateItemId(item.id)}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] bg-[#D1FAE5] text-[#065F46]" style={{ borderRadius: '3px', fontWeight: 500 }}>Purchased</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] bg-[#F3F4F6] text-[#374151]" style={{ borderRadius: '3px', fontWeight: 500 }}>Non-Serialized</span>
                      {item.isLotControlled && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] bg-[#E0E7FF] text-[#3730A3]" style={{ borderRadius: '3px', fontWeight: 500 }}>Lot-Controlled</span>
                      )}
                    </div>
                    {isDescriptionExpanded ? (
                      <p className="text-[12px] text-[#6B7280] mb-1.5" style={{ fontWeight: 400, lineHeight: '1.5' }}>
                        {item.description}{' '}
                        <button onClick={() => setIsDescriptionExpanded(false)} className="text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors inline text-[12px]" style={{ fontWeight: 500 }}>see less</button>
                      </p>
                    ) : (
                      <p className="text-[12px] text-[#6B7280] mb-1.5" style={{ fontWeight: 400, lineHeight: '1.5' }}>
                        {item.description.length > 120 ? (
                          <>{item.description.slice(0, 120)}...{' '}<button onClick={() => setIsDescriptionExpanded(true)} className="text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors inline text-[12px]" style={{ fontWeight: 500 }}>see more</button></>
                        ) : item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.isSerialized !== undefined && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] bg-[#F3F4F6] text-[#374151]" style={{ borderRadius: '4px', fontWeight: 500 }}>
                          {item.isSerialized ? 'Serialized' : 'Non-Serialized'}
                        </span>
                      )}
                      {item.sourceType && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] ${item.sourceType === 'Purchased' ? 'bg-[#DBEAFE] text-[#1E40AF]' : 'bg-[#E7E5E4] text-[#57534E]'}`} style={{ borderRadius: '4px', fontWeight: 500 }}>
                          {item.sourceType === 'Purchased' && <Sparkles className="w-2.5 h-2.5" />}
                          {item.sourceType}
                        </span>
                      )}
                      {item.isLotControlled && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] bg-[#E0E7FF] text-[#3730A3]" style={{ borderRadius: '4px', fontWeight: 500 }}>Lot-Controlled</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quantity, Unit & Price Per Unit Card */}
              <div className="border border-[#E5E7EB] bg-white" style={{ borderRadius: '8px', overflow: 'visible' }}>
                {/* Quantity / Unit Row — unified capsule matching table pattern */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB]">
                  <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5"><Layers className="w-3 h-3 text-[#9CA3AF]" />Quantity / Unit</span>
                  <div ref={uomDropdownRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch', height: '30px', borderRadius: '6px', border: `1px solid ${showUomDropdown ? '#BFDBFE' : '#D1D5DB'}`, backgroundColor: '#FFFFFF', overflow: 'visible', transition: 'border-color 100ms, background-color 100ms' }}>
                    {/* LEFT — Quantity input */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                      <input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        readOnly={readOnly}
                        style={{ width: '48px', height: '100%', border: 'none', textAlign: 'center', outline: 'none', fontSize: '13px', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: 'transparent', padding: '0 2px' }}
                        min="1"
                      />
                    </div>
                    {/* DIVIDER */}
                    <div style={{ width: '1px', backgroundColor: '#E5E7EB', flexShrink: 0, alignSelf: 'stretch' }} />
                    {/* RIGHT — UoM selector */}
                    {readOnly ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 10px', backgroundColor: '#F9FAFB', borderRadius: '0 5px 5px 0', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', lineHeight: '1' }}>{selectedUom?.abbreviation || 'EA'}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        ref={uomButtonRef}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleUomDropdown(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 10px', minWidth: '36px', border: 'none', backgroundColor: showUomDropdown ? '#F9FAFB' : 'transparent', cursor: 'pointer', transition: 'background-color 100ms', fontFamily: 'Inter, system-ui, sans-serif', borderRadius: '0 5px 5px 0', whiteSpace: 'nowrap' }}
                        onMouseEnter={(e) => { if (!showUomDropdown) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={(e) => { if (!showUomDropdown) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', lineHeight: '1' }}>{selectedUom?.abbreviation || 'EA'}</span>
                        <ChevronDown style={{ width: '11px', height: '11px', color: '#9CA3AF', flexShrink: 0 }} />
                      </button>
                    )}
                    {/* UoM dropdown */}
                    {showUomDropdown && dropdownPosition && (
                      <div className="fixed bg-white border border-[#E5E7EB] shadow-lg" style={{ borderRadius: '8px', zIndex: 12000, top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px`, minWidth: '220px', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)' }}>
                        {UNITS_OF_MEASURE.map((uom) => {
                          const isActive = formData.uom === uom.id;
                          const isDefault = uom.id === defaultUom;
                          return (
                            <button
                              type="button"
                              key={uom.id}
                              onClick={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                if (uom.id !== formData.uom) {
                                  setFormData({ ...formData, uom: uom.id });
                                }
                                setShowUomDropdown(false);
                              }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderTop: 'none', borderRight: 'none', borderBottom: '1px solid #F3F4F6', borderLeft: 'none', backgroundColor: isActive ? '#F9FAFB' : 'transparent', cursor: 'pointer', transition: 'background-color 80ms', fontFamily: 'Inter, system-ui, sans-serif' }}
                              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? '#F9FAFB' : 'transparent'; }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500, color: '#1F2937', lineHeight: '1', textAlign: 'left' }}>{uom.name}</span>
                                  {isDefault && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '9px', fontWeight: 600, color: '#1E40AF', backgroundColor: '#DBEAFE', padding: '2px 4px', borderRadius: '3px', lineHeight: '1', textTransform: 'uppercase' as const, letterSpacing: '0.3px' }}>DEFAULT</span>
                                  )}
                                </div>
                                <span style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1', textAlign: 'left' }}>{uom.fullName}</span>
                              </div>
                              {isActive && (
                                <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#1B6EF3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {/* Price Per Unit Row */}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5"><DollarSign className="w-3 h-3 text-[#9CA3AF]" />Price Per Unit</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(formData.unitPrice)}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                        const value = parseFloat(cleaned) || 0;
                        if (value !== formData.unitPrice) { setPendingPriceChange(value); setShowPriceUpdateConfirm(true); }
                      }}
                      readOnly={readOnly}
                      className={`w-24 h-7 px-2 text-[13px] text-[#1F2937] text-right border border-[#E5E7EB] focus:outline-none ${readOnly ? 'bg-[#F9FAFB] cursor-default' : 'bg-white focus:ring-1 focus:ring-[#1B6EF3]'}`}
                      style={{ borderRadius: '6px', fontWeight: 500 }}
                    />
                    <span className="text-[11px] text-[#9CA3AF]">per {selectedUom?.abbreviation}</span>
                  </div>
                </div>
              </div>

              {/* Pricing Rules Section */}
              <div className="border border-[#E5E7EB] bg-white" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                {hasAppliedRules ? (
                  <div>
                    {/* Header with total */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB]">
                      <div className="flex items-center gap-2">
                        <BadgePercent className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>
                          Pricing Rules
                        </span>
                        {activeRulesCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#D1FAE5] text-[#065F46]" style={{ borderRadius: '3px', fontWeight: 500 }}>{activeRulesCount} active</span>
                        )}
                        {pendingRulesCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#FEE2E2] text-[#991B1B]" style={{ borderRadius: '3px', fontWeight: 500 }}>{pendingRulesCount} not applied</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {totalRulesDiscount !== 0 && (
                          <span className={`text-[13px] ${totalRulesDiscount > 0 ? 'text-[#10B981]' : 'text-[#7C3AED]'}`} style={{ fontWeight: 600 }}>
                            {totalRulesDiscount > 0 ? '-' : '+'}{formatCurrency(Math.abs(totalRulesDiscount))}
                          </span>
                        )}
                        {!readOnly && hasAppliedRules && (
                          <button onClick={() => setShowDeleteAllRulesConfirm(true)} className="p-1 hover:bg-[#FEF2F2] transition-colors" style={{ borderRadius: '4px' }} title="Remove all rules">
                            <X className="w-3.5 h-3.5 text-[#EF4444]" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Rule bars */}
                    {appliedRulesDiscounts.filter(rule => rule.name).map((rule, index) => {
                      const isPremium = rule.percentage < 0;
                      const leftBorderColor = rule.isActive ? (isPremium ? '#7C3AED' : '#10B981') : '#EF4444';
                      const iconColor = rule.isActive ? (isPremium ? 'text-[#7C3AED]' : 'text-[#10B981]') : 'text-[#EF4444]';
                      const percentageColor = rule.isActive ? (isPremium ? 'text-[#7C3AED]' : 'text-[#10B981]') : 'text-[#EF4444]';
                      const amountColor = rule.isActive ? (isPremium ? 'text-[#7C3AED]' : 'text-[#10B981]') : 'text-[#EF4444]';
                      const filteredRules = appliedRulesDiscounts.filter(r => r.name);
                      const isLast = index === filteredRules.length - 1;
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between pr-3 group transition-colors"
                          style={{
                            paddingLeft: '12px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                            borderLeftWidth: '3px',
                            borderLeftStyle: 'solid',
                            borderLeftColor: leftBorderColor,
                            borderBottomWidth: isLast ? '0px' : '1px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: '#F3F4F6',
                            background: '#FFFFFF',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <BadgePercent className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-[12px] ${rule.isActive ? 'text-[#1F2937]' : 'text-[#991B1B]'}`} style={{ fontWeight: 500 }}>{rule.name}</span>
                                {!rule.isActive && <span className="text-[10px] px-1.5 py-0.5 bg-[#FEE2E2] text-[#991B1B]" style={{ borderRadius: '3px', fontWeight: 500 }}>Not Applied</span>}
                              </div>
                              {rule.isPending && rule.minQuantity > 0 && (
                                <div className="text-[10px] text-[#B91C1C]" style={{ fontWeight: 400 }}>Requires min. {rule.minQuantity} units</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right flex items-baseline gap-2">
                              <span className={`text-[12px] ${percentageColor}`} style={{ fontWeight: 600 }}>{isPremium ? '+' : '-'}{Math.abs(rule.percentage)}%</span>
                              <span className={`text-[11px] ${amountColor}`} style={{ fontWeight: 500, opacity: 0.8 }}>{isPremium ? '+' : '-'}{rule.isActive ? formatCurrency(Math.abs(rule.amount)) : formatCurrency(baseSubtotal * Math.abs(rule.percentage) / 100)}</span>
                            </div>
                            {!readOnly && (
                              <button onClick={() => { setFormData(prev => ({ ...prev, appliedRules: prev.appliedRules.filter(id => id !== rule.id) })); }} className="w-5 h-5 flex items-center justify-center hover:bg-[#FEF2F2] transition-colors opacity-0 group-hover:opacity-100" style={{ flexShrink: 0, borderRadius: '4px' }} title="Remove rule">
                                <X className="w-3 h-3 text-[#EF4444]" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Add more rules button inside card */}
                    {!readOnly && (
                      <div className="px-3 py-2 border-t border-[#E5E7EB]">
                        <button onClick={() => setShowPricingLibrary(true)} className="flex items-center gap-1.5 text-[12px] text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors" style={{ fontWeight: 500 }}>
                          <Plus className="w-3 h-3" />
                          Add/Modify Rules
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Empty state — label row with small dashed + Add button */
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[13px] text-[#6B7280] flex items-center gap-2" style={{ fontWeight: 400 }}><BadgePercent className="w-3.5 h-3.5" />Pricing Rules</span>
                    {!readOnly && (
                      <button onClick={() => setShowPricingLibrary(true)} className="h-7 px-2.5 flex items-center gap-1 text-[12px] text-[#1B6EF3] border border-dashed border-[#93C5FD] hover:bg-[#F0F9FF] hover:border-[#1B6EF3] transition-colors" style={{ borderRadius: '5px', fontWeight: 500 }}>
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* One-Time Discounts/Premiums Section */}
              <div className="border border-[#E5E7EB] bg-white" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                {formData.oneTimeAdjustments.length > 0 ? (
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB]">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>One-Time Discounts/Premiums</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-[#D1FAE5] text-[#065F46]" style={{ borderRadius: '3px', fontWeight: 500 }}>{formData.oneTimeAdjustments.length} active</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] ${oneTimeTotal < 0 ? 'text-[#10B981]' : oneTimeTotal > 0 ? 'text-[#1B6EF3]' : 'text-[#6B7280]'}`} style={{ fontWeight: 600 }}>
                          {oneTimeTotal < 0 ? '-' : '+'}{formatCurrency(Math.abs(oneTimeTotal))}
                        </span>
                        {!readOnly && formData.oneTimeAdjustments.length > 0 && (
                          <button onClick={() => setShowDeleteAllAdjustmentsConfirm(true)} className="p-1 hover:bg-[#FEF2F2] transition-colors" style={{ borderRadius: '4px' }} title="Remove all adjustments">
                            <X className="w-3.5 h-3.5 text-[#EF4444]" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Adjustment bars */}
                    {formData.oneTimeAdjustments.map((adj, index) => {
                      const amount = adj.amountType === '%' ? (baseSubtotal * adj.amount / 100) : adj.amount;
                      const isDiscount = adj.type === 'discount';
                      const leftBorderColor = isDiscount ? '#10B981' : '#7C3AED';
                      const isLast = index === formData.oneTimeAdjustments.length - 1;
                      return (
                        <div
                          key={adj.id}
                          className="flex items-center justify-between pr-3 group transition-colors cursor-pointer"
                          style={{
                            paddingLeft: '12px',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                            borderLeftWidth: '3px',
                            borderLeftStyle: 'solid',
                            borderLeftColor: leftBorderColor,
                            borderBottomWidth: isLast ? '0px' : '1px',
                            borderBottomStyle: 'solid',
                            borderBottomColor: '#F3F4F6',
                            background: '#FFFFFF',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; }}
                          onClick={() => !readOnly && editAdjustment(adj)}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {isDiscount ? <TrendingDown className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0" /> : <TrendingUp className="w-3.5 h-3.5 text-[#7C3AED] flex-shrink-0" />}
                            <span className="text-[12px] text-[#1F2937]" style={{ fontWeight: 500 }}>{adj.label}</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right flex items-baseline gap-2">
                              <span className={`text-[12px] ${isDiscount ? 'text-[#10B981]' : 'text-[#7C3AED]'}`} style={{ fontWeight: 600 }}>{isDiscount ? '-' : '+'}{adj.amount}{adj.amountType}</span>
                              <span className={`text-[11px] ${isDiscount ? 'text-[#10B981]' : 'text-[#7C3AED]'}`} style={{ fontWeight: 500, opacity: 0.8 }}>{isDiscount ? '-' : '+'}{formatCurrency(amount)}</span>
                            </div>
                            {!readOnly && (
                              <div className="flex items-center gap-0.5">
                                <Pencil className="w-3 h-3 text-[#9CA3AF] group-hover:text-[#1B6EF3] transition-colors flex-shrink-0" />
                                <button onClick={(e) => { e.stopPropagation(); removeAdjustment(adj.id); }} className="w-5 h-5 flex items-center justify-center hover:bg-[#FEF2F2] transition-colors opacity-0 group-hover:opacity-100" style={{ borderRadius: '4px' }} title="Remove"><X className="w-3 h-3 text-[#EF4444]" /></button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Add more adjustments link inside card */}
                    {!readOnly && (
                      <div className="px-3 py-2 border-t border-[#E5E7EB]">
                        <button onClick={() => setShowAdjustmentModal(true)} className="flex items-center gap-1.5 text-[12px] text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors" style={{ fontWeight: 500 }}>
                          <Plus className="w-3 h-3" />
                          Add Adjustment
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Empty state — label row with small dashed + Add button */
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[13px] text-[#6B7280] flex items-center gap-2" style={{ fontWeight: 400 }}><Zap className="w-3.5 h-3.5" />One-Time Discounts/Premiums</span>
                    {!readOnly && (
                      <button onClick={() => setShowAdjustmentModal(true)} className="h-7 px-2.5 flex items-center gap-1 text-[12px] text-[#1B6EF3] border border-dashed border-[#93C5FD] hover:bg-[#F0F9FF] hover:border-[#1B6EF3] transition-colors" style={{ borderRadius: '5px', fontWeight: 500 }}>
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Subtotal */}
              <div className="flex items-center justify-between px-1 py-1">
                <span className="text-[13px] text-[#1F2937] flex items-center gap-1.5" style={{ fontWeight: 500 }}><Tag className="w-3.5 h-3.5 text-[#6B7280]" />Subtotal</span>
                <span className="text-[16px] text-[#1F2937]" style={{ fontWeight: 600 }}>{formatCurrency(baseSubtotal)}</span>
              </div>

              {/* Shipment & Delivery Card */}
              <div className="border border-[#E5E7EB] bg-white" style={{ borderRadius: '8px' }}>
                {/* Row: Shipment method */}
                <div className="group/shiprow flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors cursor-pointer" onClick={() => !readOnly && setShowShipmentModal(true)}>
                  <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5"><Truck className="w-3 h-3 text-[#9CA3AF]" />Shipment Method</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>
                      {selectedShipment?.name}
                    </span>
                    {!formData.isShipmentOverride && (
                      <span className="px-1.5 py-0.5 bg-[#DBEAFE] text-[#1E40AF] text-[10px]" style={{ borderRadius: '3px', fontWeight: 500 }}>Default</span>
                    )}
                    {!readOnly && (
                      <Pencil className="w-3 h-3 text-[#9CA3AF] group-hover/shiprow:text-[#1B6EF3] transition-colors flex-shrink-0" />
                    )}
                  </div>
                </div>
                {/* Row: Shipping Carrier */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB]">
                  <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5"><Package className="w-3 h-3 text-[#9CA3AF]" />Shipping Carrier</span>
                  <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>
                    {SHIPMENT_PROVIDERS[formData.shipmentMethod as keyof typeof SHIPMENT_PROVIDERS]?.find(p => p.id === formData.shipmentProvider)?.name || '—'}
                  </span>
                </div>
                {/* Row: Expected Ship By */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors">
                  <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5"><Calendar className="w-3 h-3 text-[#9CA3AF]" />Expected Ship By</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[13px] text-[#1F2937]"
                      style={{ fontWeight: 500 }}
                    >
                      {formatDate(calculateShipDateRange().single)}
                    </span>
                    {formData.isShipDateOverride && (
                      <span className="px-1 py-0.5 bg-[#EFF6FF] text-[#1B6EF3] text-[9px]" style={{ borderRadius: '3px', fontWeight: 600 }}>OVERRIDE</span>
                    )}
                  </div>
                </div>
                {/* Row: Expected Delivery */}
                <div className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F9FAFB] transition-colors">
                  <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5"><Clock className="w-3 h-3 text-[#9CA3AF]" />Expected Delivery</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[13px] text-[#1F2937]"
                      style={{ fontWeight: 500 }}
                    >
                      {(() => {
                        const range = calculateDeliveryDateRange();
                        if ('single' in range) return formatDate(range.single);
                        return `${formatDate(range.min)} – ${formatDate(range.max)}`;
                      })()}
                    </span>
                    {formData.isDeliveryDateOverride && (
                      <span className="px-1 py-0.5 bg-[#EFF6FF] text-[#1B6EF3] text-[9px]" style={{ borderRadius: '3px', fontWeight: 600 }}>OVERRIDE</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes Section — matches One-Time Discounts/Premiums card style */}
              <div className="border border-[#E5E7EB] bg-white" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                {showNotesSection ? (
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB]">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-[#9CA3AF]" />
                        <span className="text-[12px] text-[#6B7280]" style={{ fontWeight: 500 }}>Item Notes & Instructions</span>
                        {formData.showNotesInPdf && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#DBEAFE] text-[#1E40AF]" style={{ borderRadius: '3px', fontWeight: 500 }}>Visible in Quote</span>
                        )}
                      </div>
                      <button onClick={() => setShowNotesSection(false)} className="p-1 hover:bg-[#F3F4F6] transition-colors" style={{ borderRadius: '4px' }} title="Collapse notes">
                        <X className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      </button>
                    </div>
                    {/* Content */}
                    <div className="px-4 py-3">
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        readOnly={readOnly}
                        placeholder={readOnly ? 'No notes' : 'Add notes for this line item...'}
                        className={`w-full h-20 px-3 py-2 text-[13px] border border-[#E5E7EB] focus:outline-none resize-none ${readOnly ? 'bg-[#F9FAFB] cursor-default' : 'bg-white focus:ring-2 focus:ring-[#1B6EF3] focus:border-transparent'}`}
                        style={{ borderRadius: '6px' }}
                      />
                      <label className={`flex items-center gap-2 mt-2 ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
                        <input type="checkbox" checked={formData.showNotesInPdf} onChange={(e) => setFormData({ ...formData, showNotesInPdf: e.target.checked })} disabled={readOnly} className="w-3.5 h-3.5" />
                        <span className="text-[12px] text-[#6B7280]">Visible in Quote</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  /* Empty state — label row with small dashed + Add button, matches One Time pattern */
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5" style={{ fontWeight: 400 }}><FileText className="w-3 h-3 text-[#9CA3AF]" />Item Notes & Instructions</span>
                    {!readOnly && (
                      <button onClick={() => setShowNotesSection(true)} className="h-7 px-2.5 flex items-center gap-1 text-[12px] text-[#1B6EF3] border border-dashed border-[#93C5FD] hover:bg-[#F0F9FF] hover:border-[#1B6EF3] transition-colors" style={{ borderRadius: '5px', fontWeight: 500 }}>
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>
            </div>

            {/* Fixed Total Price Footer — pinned to bottom of right panel */}
            <div className="flex-shrink-0 border-t border-[#E5E7EB] bg-white" style={{ padding: '10px 20px 12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>Total</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: '#1F2937', letterSpacing: '-0.3px', lineHeight: '1.1' }}>{formatCurrency(total)}</span>
                  {(totalRulesDiscount !== 0 || oneTimeTotal !== 0 || shippingCost > 0) && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {[
                        ...(totalRulesDiscount !== 0 ? [`Rules ${totalRulesDiscount > 0 ? '-' : '+'}${formatCurrency(Math.abs(totalRulesDiscount))}`] : []),
                        ...(oneTimeTotal !== 0 ? [`Adj. ${oneTimeTotal > 0 ? '+' : '-'}${formatCurrency(Math.abs(oneTimeTotal))}`] : []),
                        ...(shippingCost > 0 ? [`Shipping +${formatCurrency(shippingCost)}`] : []),
                      ].map((tag, i, arr) => (
                        <span key={i} style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                          {tag}{i < arr.length - 1 && <span style={{ margin: '0 5px', color: '#D1D5DB' }}>·</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Footer */}
        <div className="border-t border-[#E5E7EB] bg-white px-6 py-3 flex items-center justify-between flex-shrink-0">
          {readOnly ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onClose} className="px-4 h-8 border border-[#E5E7EB] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-colors" style={{ borderRadius: '6px', fontWeight: 500 }}>
                Close
              </button>
            </div>
          ) : (
            <div className="contents">
              <button
                onClick={() => { toast.error('Item removed from quote'); onClose(); }}
                className="px-3 h-8 flex items-center gap-1.5 border border-[#FCA5A5] text-[13px] text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                style={{ borderRadius: '6px', fontWeight: 500 }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete from Quote
              </button>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="px-4 h-8 border border-[#E5E7EB] text-[13px] text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] transition-colors" style={{ borderRadius: '6px', fontWeight: 500 }}>
                  Discard Changes
                </button>
                <button onClick={handleSave} className="px-4 h-8 bg-[#059669] text-white text-[13px] hover:bg-[#047857] transition-colors flex items-center gap-1.5" style={{ borderRadius: '6px', fontWeight: 500 }}>
                  <Check className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pricing Rules Library Modal */}
      <PricingRuleLibraryModal
        isOpen={showPricingLibrary}
        onClose={() => setShowPricingLibrary(false)}
        appliedRules={formData.appliedRules}
        onToggleRule={togglePricingRule}
        currentQuantity={formData.quantity}
      />

      {/* Add/Edit Adjustment Modal — uses shared AdjustmentFormModal */}
      {showAdjustmentModal && (
        <AdjustmentFormModal
          mode={editingAdjustmentId ? 'edit' : 'add'}
          scope="item"
          initial={editingAdjustmentId ? (() => {
            const adj = formData.oneTimeAdjustments.find(a => a.id === editingAdjustmentId);
            return adj ? { id: adj.id, label: adj.label, type: adj.type, amountType: adj.amountType, amount: adj.amount, scope: 'item' as const, internalNotes: (adj as any).internalNotes } : undefined;
          })() : undefined}
          onSave={(data: AdjustmentFormData) => {
            if (editingAdjustmentId) {
              setFormData({ ...formData, oneTimeAdjustments: formData.oneTimeAdjustments.map(adj => adj.id === editingAdjustmentId ? { ...adj, type: data.type, amountType: data.amountType, amount: data.amount, label: data.label, internalNotes: data.internalNotes } : adj) });
            } else {
              setFormData({ ...formData, oneTimeAdjustments: [...formData.oneTimeAdjustments, { type: data.type, amountType: data.amountType, amount: data.amount, label: data.label, id: `adj-${Date.now()}`, internalNotes: data.internalNotes }] });
            }
            setEditingAdjustmentId(null);
            setShowAdjustmentModal(false);
            setNewAdjustment({ type: 'discount', amountType: '%', amount: 0, label: '' });
          }}
          onCancel={() => { setShowAdjustmentModal(false); setEditingAdjustmentId(null); setNewAdjustment({ type: 'discount', amountType: '%', amount: 0, label: '' }); }}
        />
      )}

      {/* Shipment Configuration Modal */}
      {showShipmentModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[60]" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }} onClick={() => { setShowShipmentModal(false); setShowShipmentDropdown(false); setShowProviderDropdown(false); }}>
          <div className="bg-white w-full" style={{ borderRadius: '12px', maxWidth: '640px', maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 pt-5 pb-4" style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#E5E7EB' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[14px] text-[#1F2937] mb-0.5" style={{ fontWeight: 600, lineHeight: 1.3 }}>Configure Shipment</h2>
                  <p className="text-[12px] text-[#6B7280]" style={{ lineHeight: 1.4 }}>Choose how this item will be shipped or picked up</p>
                </div>
                <button onClick={() => { setShowShipmentModal(false); setShowShipmentDropdown(false); setShowProviderDropdown(false); }} className="w-8 h-8 flex items-center justify-center hover:bg-[#F3F4F6] transition-colors" style={{ borderRadius: '6px' }}>
                  <X className="w-4 h-4 text-[#6B7280]" />
                </button>
              </div>
            </div>

            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: 'thin' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Step 1: Shipment Method Selection — 2×2 radio cards */}
                <div>
                  <label className="block text-[11px] text-[#6B7280] mb-2" style={{ fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Shipment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SHIPMENT_METHODS.map((method) => {
                      const isSelected = formData.shipmentMethod === method.id;
                      const MethodIcon = method.hasCarrier && method.hasPickupLocation
                        ? Truck
                        : method.hasCarrier
                        ? Truck
                        : method.hasPickupLocation
                        ? MapPin
                        : Package;
                      return (
                        <button
                          key={method.id}
                          onClick={() => {
                            const defaultCarrier = method.hasCarrier ? CARRIERS[0].id : formData.shipmentProvider;
                            const defaultLocation = method.hasPickupLocation ? PICKUP_LOCATIONS[0].id : formData.pickupLocation;
                            setFormData({
                              ...formData,
                              shipmentMethod: method.id,
                              shipmentProvider: defaultCarrier,
                              pickupLocation: defaultLocation,
                              trackingNumber: method.id === 'self-delivery' ? formData.trackingNumber : '',
                              isShipmentOverride: true,
                              isShipDateOverride: false,
                              isDeliveryDateOverride: false,
                              expectedShipDate: '',
                              estimatedDeliveryDate: '',
                            });
                            setShowShipmentDropdown(false);
                            setShowProviderDropdown(false);
                          }}
                          className="text-left p-3 transition-all"
                          style={{
                            borderRadius: '8px',
                            borderWidth: isSelected ? '2px' : '1px',
                            borderStyle: 'solid',
                            borderColor: isSelected ? '#1B6EF3' : '#E5E7EB',
                            backgroundColor: isSelected ? '#F0F7FF' : '#FFFFFF',
                            cursor: 'pointer',
                          }}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className="flex-shrink-0 flex items-center justify-center mt-0.5"
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                backgroundColor: isSelected ? '#DBEAFE' : '#F3F4F6',
                              }}
                            >
                              <MethodIcon className="w-3.5 h-3.5" style={{ color: isSelected ? '#1B6EF3' : '#6B7280' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] text-[#1F2937] mb-0.5" style={{ fontWeight: 500, lineHeight: 1.3 }}>{method.name}</div>
                              <div className="text-[11px] text-[#9CA3AF]" style={{ lineHeight: 1.3 }}>{method.description}</div>
                            </div>
                          </div>
                          {/* Method metadata */}
                          <div className="flex items-center gap-3 mt-2 ml-[38px]">
                            <span className="text-[10px] text-[#9CA3AF]">{method.duration}</span>
                            {method.cost > 0 && (
                              <span className="text-[10px] text-[#6B7280]" style={{ fontWeight: 500 }}>from ${method.cost.toLocaleString()}</span>
                            )}
                            {method.cost === 0 && (
                              <span className="text-[10px] text-[#059669]" style={{ fontWeight: 500 }}>No shipping cost</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: '#F3F4F6' }} />

                {/* Step 2: Method-specific fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label className="block text-[11px] text-[#6B7280]" style={{ fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Details</label>

                  {/* Carrier Selection — for courier-pickup and courier-dropby */}
                  {selectedShipment?.hasCarrier && (
                    <div>
                      <label className="block text-[11px] text-[#6B7280] mb-1.5" style={{ fontWeight: 500 }}>Carrier</label>
                      <div className="relative">
                        <button
                          onClick={() => { setShowProviderDropdown(!showProviderDropdown); setShowShipmentDropdown(false); }}
                          className="w-full h-9 px-3 text-[13px] border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] transition-colors flex items-center justify-between"
                          style={{ borderRadius: '6px' }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Truck className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" />
                            <span className="text-[#1F2937] truncate" style={{ fontWeight: 500 }}>
                              {CARRIERS.find(c => c.id === formData.shipmentProvider)?.name || 'Select carrier'}
                            </span>
                          </div>
                          <ChevronDown className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                        </button>
                        {showProviderDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E5E7EB] shadow-lg z-10" style={{ borderRadius: '6px' }}>
                            {CARRIERS.map((carrier) => (
                              <button
                                key={carrier.id}
                                onClick={() => { setFormData({ ...formData, shipmentProvider: carrier.id }); setShowProviderDropdown(false); }}
                                className="w-full px-3 py-2.5 text-left hover:bg-[#F9FAFB] transition-colors flex items-center justify-between"
                                style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: '#F3F4F6' }}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>{carrier.name}</span>
                                    {formData.shipmentProvider === carrier.id && <Check className="w-3.5 h-3.5 text-[#1B6EF3] flex-shrink-0" />}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] text-[#9CA3AF]">{carrier.duration}</span>
                                    <span className="text-[11px] text-[#9CA3AF]">·</span>
                                    <span className="text-[11px] text-[#6B7280]" style={{ fontWeight: 500 }}>${carrier.cost.toLocaleString()}</span>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Pickup Location Selection — for courier-pickup and customer-pickup */}
                  {selectedShipment?.hasPickupLocation && (
                    <div>
                      <label className="block text-[11px] text-[#6B7280] mb-1.5" style={{ fontWeight: 500 }}>Pick-up Location</label>
                      <div className="space-y-1.5">
                        {PICKUP_LOCATIONS.map((loc) => {
                          const isSelected = formData.pickupLocation === loc.id;
                          return (
                            <button
                              key={loc.id}
                              onClick={() => setFormData({ ...formData, pickupLocation: loc.id })}
                              className="w-full text-left px-3 py-2 flex items-center gap-3 transition-colors"
                              style={{
                                borderRadius: '6px',
                                borderWidth: isSelected ? '2px' : '1px',
                                borderStyle: 'solid',
                                borderColor: isSelected ? '#1B6EF3' : '#E5E7EB',
                                backgroundColor: isSelected ? '#F0F7FF' : '#FFFFFF',
                              }}
                            >
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isSelected ? '#1B6EF3' : '#9CA3AF' }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>{loc.name}</div>
                                <div className="text-[11px] text-[#9CA3AF]">{loc.address} · {loc.hours}</div>
                              </div>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#1B6EF3] flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tracking Number — for self-delivery */}
                  {formData.shipmentMethod === 'self-delivery' && (
                    <div>
                      <label className="block text-[11px] text-[#6B7280] mb-1.5" style={{ fontWeight: 500 }}>Tracking Number <span className="text-[#9CA3AF]">(optional)</span></label>
                      <input
                        type="text"
                        value={formData.trackingNumber}
                        onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                        placeholder="e.g., VGD-2026-00142-SH"
                        className="w-full h-9 px-3 text-[13px] border border-[#E5E7EB] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B6EF3] placeholder:text-[#C4C9D0]"
                        style={{ borderRadius: '6px', fontFamily: 'monospace' }}
                      />
                      <div className="text-[10px] text-[#9CA3AF] mt-1">You can also add or update this after sending the quote</div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ height: '1px', backgroundColor: '#F3F4F6' }} />

                {/* Step 3: Dates */}
                <div>
                  <label className="block text-[11px] text-[#6B7280] mb-2" style={{ fontWeight: 500, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Dates</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center justify-between text-[11px] text-[#6B7280] mb-1.5" style={{ fontWeight: 500 }}>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{selectedShipment?.dateLabel || 'Ship By'}</span>
                        {formData.isShipDateOverride && <span className="text-[#1B6EF3] text-[9px]" style={{ fontWeight: 600 }}>OVERRIDE</span>}
                      </label>
                      {formData.isShipDateOverride ? (
                        <div className="flex gap-1.5">
                          <input type="date" value={calculateShipDate()} onChange={(e) => setFormData({ ...formData, expectedShipDate: e.target.value, isShipDateOverride: true, isDeliveryDateOverride: false, estimatedDeliveryDate: '' })} className="flex-1 h-9 px-3 text-[13px] border border-[#E5E7EB] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B6EF3]" style={{ borderRadius: '6px' }} />
                          <button onClick={() => setFormData({ ...formData, expectedShipDate: '', isShipDateOverride: false, isDeliveryDateOverride: false, estimatedDeliveryDate: '' })} className="h-9 px-2 text-[11px] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors flex items-center" style={{ borderRadius: '6px', fontWeight: 500 }}>
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-full h-9 px-3 text-[13px] border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between" style={{ borderRadius: '6px' }}>
                          <span className="text-[#6B7280]">{formatDate(calculateShipDateRange().single)}</span>
                          <button onClick={() => setFormData({ ...formData, expectedShipDate: calculateShipDate(), isShipDateOverride: true, isDeliveryDateOverride: false, estimatedDeliveryDate: '' })} className="text-[11px] text-[#1B6EF3] hover:text-[#0D5ED7]" style={{ fontWeight: 500 }}>Edit</button>
                        </div>
                      )}
                      <div className="text-[10px] text-[#9CA3AF] mt-1">{selectedShipment?.productionDays}d production · {selectedShipment?.duration}</div>
                    </div>
                    <div>
                      <label className="flex items-center justify-between text-[11px] text-[#6B7280] mb-1.5" style={{ fontWeight: 500 }}>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Estimated Delivery</span>
                        {formData.isDeliveryDateOverride && <span className="text-[#1B6EF3] text-[9px]" style={{ fontWeight: 600 }}>OVERRIDE</span>}
                      </label>
                      {formData.isDeliveryDateOverride ? (
                        <div className="flex gap-1.5">
                          <input type="date" value={calculateDeliveryDate()} onChange={(e) => setFormData({ ...formData, estimatedDeliveryDate: e.target.value, isDeliveryDateOverride: true })} className="flex-1 h-9 px-3 text-[13px] border border-[#E5E7EB] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B6EF3]" style={{ borderRadius: '6px' }} />
                          <button onClick={() => setFormData({ ...formData, estimatedDeliveryDate: '', isDeliveryDateOverride: false })} className="h-9 px-2 text-[11px] text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors flex items-center" style={{ borderRadius: '6px', fontWeight: 500 }}>
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-full h-9 px-3 text-[13px] border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between" style={{ borderRadius: '6px' }}>
                          <span className="text-[#6B7280]">{(() => { const range = calculateDeliveryDateRange(); if ('single' in range) return formatDate(range.single); return `${formatDate(range.min)} – ${formatDate(range.max)}`; })()}</span>
                          <button onClick={() => setFormData({ ...formData, estimatedDeliveryDate: calculateDeliveryDate(), isDeliveryDateOverride: true })} className="text-[11px] text-[#1B6EF3] hover:text-[#0D5ED7]" style={{ fontWeight: 500 }}>Pin Date</button>
                        </div>
                      )}
                      <div className="text-[10px] text-[#9CA3AF] mt-1">
                        {selectedShipment?.shippingDays === 0 ? 'Same day as pickup' : `${selectedShipment?.dateLabel || 'Ship date'} + ${selectedShipment?.duration}`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cost Summary */}
                {(selectedShipment?.cost ?? 0) > 0 && (
                  <div className="flex items-center justify-between px-3 py-2.5 bg-[#F9FAFB]" style={{ borderRadius: '6px' }}>
                    <span className="text-[12px] text-[#6B7280]">Estimated shipping cost</span>
                    <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                      {selectedShipment?.hasCarrier
                        ? `$${(CARRIERS.find(c => c.id === formData.shipmentProvider)?.cost || 0).toLocaleString()}`
                        : `$${selectedShipment?.cost.toLocaleString()}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex gap-2" style={{ borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#E5E7EB' }}>
              <button onClick={() => { setShowShipmentModal(false); setShowShipmentDropdown(false); setShowProviderDropdown(false); }} className="flex-1 h-8 text-[13px] border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] transition-colors" style={{ borderRadius: '6px', fontWeight: 500 }}>Cancel</button>
              <button onClick={() => { setShowShipmentModal(false); setShowShipmentDropdown(false); setShowProviderDropdown(false); }} className="flex-1 h-8 text-[13px] bg-[#1B6EF3] text-white hover:bg-[#0D5ED7] transition-colors" style={{ borderRadius: '6px', fontWeight: 500 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Price Update Scope Modal — "This Quote Only" vs "Update Item Master" */}
      {showPriceUpdateConfirm && pendingPriceChange !== null && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)' }}
          onClick={() => { setShowPriceUpdateConfirm(false); setPendingPriceChange(null); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setShowPriceUpdateConfirm(false); setPendingPriceChange(null); }
          }}
        >
          <div className="bg-white shadow-2xl" style={{ borderRadius: '12px', width: '460px', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#1B6EF3' }}>
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-[#1F2937] mb-1" style={{ fontSize: '16px', fontWeight: 600, lineHeight: '1.3' }}>Apply Price Change</h3>
            <p className="text-[#6B7280] mb-1" style={{ fontSize: '13px', lineHeight: '1.5' }}>
              You're changing the unit price to <span style={{ fontWeight: 600, color: '#1F2937' }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(pendingPriceChange)}</span>.
            </p>
            <p className="text-[#9CA3AF] mb-5" style={{ fontSize: '12px', lineHeight: '1.5' }}>
              Should this change apply only to this quote, or update the item master price for all future quotes?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => { setFormData({ ...formData, unitPrice: pendingPriceChange }); setShowPriceUpdateConfirm(false); setPendingPriceChange(null); toast.success('Price updated for this quote only'); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 120ms', textAlign: 'left' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#BFDBFE'; e.currentTarget.style.backgroundColor = '#F8FBFF'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText style={{ width: '15px', height: '15px', color: '#6B7280' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1.3' }}>This Quote Only</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1.4', marginTop: '1px' }}>Override price for this line item. Item master stays unchanged.</div>
                </div>
              </button>
              <button
                onClick={() => { setFormData({ ...formData, unitPrice: pendingPriceChange }); setShowPriceUpdateConfirm(false); setPendingPriceChange(null); toast.success('Item master price updated — future quotes will use this price'); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', transition: 'all 120ms', textAlign: 'left' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FDE68A'; e.currentTarget.style.backgroundColor = '#FFFDF7'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <RefreshCw style={{ width: '15px', height: '15px', color: '#D97706' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1.3' }}>Update Item Master</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1.4', marginTop: '1px' }}>Set as the new default price for all future quotes.</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '9px', fontWeight: 600, color: '#D97706', backgroundColor: '#FEF3C7', padding: '2px 5px', borderRadius: '3px', lineHeight: '1', textTransform: 'uppercase' as const, letterSpacing: '0.3px', flexShrink: 0, whiteSpace: 'nowrap' }}>GLOBAL</span>
              </button>
            </div>
            <button
              onClick={() => { setShowPriceUpdateConfirm(false); setPendingPriceChange(null); }}
              style={{ width: '100%', marginTop: '12px', height: '32px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: '#9CA3AF', fontFamily: 'Inter, system-ui, sans-serif', transition: 'color 120ms' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#6B7280'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}



      {/* Delete All Pricing Rules Confirmation */}
      <ConfirmationModal
        isOpen={showDeleteAllRulesConfirm}
        title="Remove All Pricing Rules"
        message={`This will remove all ${appliedRulesDiscounts.filter(r => r.name).length} pricing rules from this line item. The subtotal will revert to the base price. You can re-add rules later from the Pricing Rules Library.`}
        confirmText="Remove All"
        cancelText="Keep Rules"
        onConfirm={() => { setFormData({ ...formData, appliedRules: [] }); setShowDeleteAllRulesConfirm(false); toast.info('All pricing rules removed'); }}
        onCancel={() => setShowDeleteAllRulesConfirm(false)}
        variant="red"
        icon={<X className="w-6 h-6 text-white" />}
      />

      {/* Delete All Adjustments Confirmation */}
      <ConfirmationModal
        isOpen={showDeleteAllAdjustmentsConfirm}
        title="Remove All Adjustments"
        message={`This will remove all ${formData.oneTimeAdjustments.length} one-time adjustments from this line item. You can re-add them individually later.`}
        confirmText="Remove All"
        cancelText="Keep Adjustments"
        onConfirm={() => { setFormData({ ...formData, oneTimeAdjustments: [] }); setShowDeleteAllAdjustmentsConfirm(false); toast.info('All adjustments removed'); }}
        onCancel={() => setShowDeleteAllAdjustmentsConfirm(false)}
        variant="red"
        icon={<X className="w-6 h-6 text-white" />}
      />
    </div>
  );
}
