import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Plus, Trash2, Package, ChevronDown, Copy, X, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { LineItemConfigModal } from '../quote-creation/LineItemConfigModal';
import { QuoteMoney } from '../currency/QuoteMoney';
import { BASE_CURRENCY, convertBetween, getLibraryCurrency } from '../../data/currencyLibrary';
import { ProductPickerModal } from './ProductPickerModal';
import { getCreatedQuoteLineItems, CreatedLineItem } from '../../data/quoteStore';
import { PRODUCTS } from '../../data/products';

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
}

interface UomOption {
  id: string;
  name: string;
  fullName: string;
  multiplier: number;
}

const UOM_OPTIONS: UomOption[] = [
  { id: 'ea', name: 'EA', fullName: 'Each', multiplier: 1 },
  { id: 'box', name: 'Box', fullName: 'Box (12 units)', multiplier: 12 },
  { id: 'carton', name: 'Carton', fullName: 'Carton (24 units)', multiplier: 24 },
  { id: 'pallet', name: 'Pallet', fullName: 'Pallet (480 units)', multiplier: 480 },
];

interface LineItem {
  id: string;
  productId: string;
  productName: string;
  description: string;
  image?: string;
  quantity: number;
  uom: string;
  defaultUom: string;
  unitPrice: number;
  pricingRules: PricingRule[];
  oneTimeAdjustments: OneTimeAdjustment[];
  subtotal: number;
  total: number;
}

const MOCK_LINE_ITEMS: LineItem[] = [
  {
    id: '1',
    productId: '000-100-002',
    productName: 'Ford E-450 Super Duty Stripped Chassis — Ambulance Prep Package',
    description: 'E-450 stripped chassis, 176" WB, 7.3L V8, DRW, 16,000 GVWR, ambulance prep with reinforced frame, heavy-duty alternator, and dual batteries. Includes extended-idle package and PTO-ready wiring.',
    image: '',
    quantity: 2,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 48200,
    pricingRules: [
      { id: 'fleet-vol', name: 'Fleet Volume Discount', type: 'discount', value: 4, amountType: '%' },
      { id: 'gov-pricing', name: 'Government Contract Pricing', type: 'discount', value: 3, amountType: '%' },
    ],
    oneTimeAdjustments: [
      { id: 'delivery', type: 'premium', amountType: '$', amount: 1200, label: 'Chassis Delivery & Prep Fee' },
    ],
    subtotal: 96400,
    total: 90876,
  },
  {
    id: '2',
    productId: '000-100-019',
    productName: 'Type III Ambulance Module — Standard 152" Patient Compartment',
    description: 'Cutaway-mount modular body, 152" compartment, 72" headroom, full walk-through cab access, aluminum/composite construction, KKK-A-1822F compliant.',
    image: '',
    quantity: 2,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 94200,
    pricingRules: [
      { id: 'multi-unit', name: 'Multi-Unit Build Discount', type: 'discount', value: 5, amountType: '%' },
    ],
    oneTimeAdjustments: [
      { id: 'eng', type: 'premium', amountType: '$', amount: 3500, label: 'Engineering / Custom Layout' },
    ],
    subtotal: 188400,
    total: 182480,
  },
  {
    id: '2b',
    productId: '000-100-019',
    productName: 'Type III Ambulance Module — Standard 152" Patient Compartment',
    description: 'Same module spec as line 2 but configured as bariatric-ready variant with 96" interior width option, reinforced stretcher rail, and widened rear entry door frame. Includes bariatric stretcher rail spacers.',
    image: '',
    quantity: 1,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 94200,
    pricingRules: [
      { id: 'custom-config', name: 'Custom Configuration Premium', type: 'premium', value: 8, amountType: '%' },
    ],
    oneTimeAdjustments: [],
    subtotal: 94200,
    total: 101736,
  },
  {
    id: '3',
    productId: '000-100-026',
    productName: 'Whelen Liberty II LED Lightbar 54" — Red/White Split',
    description: '54" full-size LED lightbar with 16 modules, red/white split for ambulance, integrated alley/takedown lights, programmable flash patterns, low-profile aerodynamic housing.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 3250,
    pricingRules: [
      { id: 'qty-break', name: 'Quantity Break Discount', type: 'discount', value: 6, amountType: '%' },
    ],
    oneTimeAdjustments: [],
    subtotal: 9750,
    total: 9165,
  },
  {
    id: '4',
    productId: '000-100-041',
    productName: 'Federal Signal Pathfinder Siren/PA 200W',
    description: '200-watt electronic siren with PA, wail/yelp/phaser/hi-lo tones, radio rebroadcast input, backlit controls. Includes mounting bracket and wiring harness.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 685,
    pricingRules: [],
    oneTimeAdjustments: [],
    subtotal: 2055,
    total: 2055,
  },
  {
    id: '5',
    productId: '000-100-049',
    productName: 'Motorola APX 8500 All-Band Mobile Radio',
    description: 'Multi-band P25 Phase II mobile, VHF/UHF/700/800 MHz, TDMA, AES 256 encryption, GPS, Bluetooth, OTAP ready. Includes remote head kit and antenna cables.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 7850,
    pricingRules: [
      { id: 'state-contract', name: 'State Contract Pricing', type: 'discount', value: 12, amountType: '%' },
    ],
    oneTimeAdjustments: [
      { id: 'programming', type: 'premium', amountType: '$', amount: 450, label: 'Radio Programming & Encryption' },
    ],
    subtotal: 23550,
    total: 21174,
  },
  {
    id: '6',
    productId: '000-100-059',
    productName: 'Stryker Power-PRO XT Powered Stretcher System',
    description: 'Powered hydraulic stretcher, 700 lb capacity, battery operated, auto-loading with isokinetic lowering. Power-LOAD compatible interface.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 18500,
    pricingRules: [
      { id: 'oem-rebate', name: 'OEM Manufacturer Rebate', type: 'discount', value: 3, amountType: '%' },
      { id: 'bundle', name: 'Stretcher + Mount Bundle', type: 'discount', value: 2, amountType: '%' },
    ],
    oneTimeAdjustments: [
      { id: 'training', type: 'premium', amountType: '$', amount: 800, label: 'Operator Training (per unit)' },
    ],
    subtotal: 55500,
    total: 55025,
  },
  {
    id: '7',
    productId: '000-100-061',
    productName: 'Stretcher Mount — Power-LOAD Cot Fastening System',
    description: 'Stryker Power-LOAD cot fastening system with automatic loading/unloading, floor rail integration, interlock safety, anti-tip mechanism.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 12500,
    pricingRules: [
      { id: 'bundle', name: 'Stretcher + Mount Bundle', type: 'discount', value: 2, amountType: '%' },
    ],
    oneTimeAdjustments: [],
    subtotal: 37500,
    total: 36750,
  },
  {
    id: '8',
    productId: '000-100-079',
    productName: 'Kussmaul Auto Eject Shoreline 20A',
    description: 'Automatic shoreline power inlet, auto-eject on engine start, 20A 120VAC, weatherproof, with exterior receptacle and indicator light.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 485,
    pricingRules: [],
    oneTimeAdjustments: [],
    subtotal: 1455,
    total: 1455,
  },
  {
    id: '9',
    productId: '000-100-081',
    productName: 'AIMS 3000W Pure Sine Inverter/Charger',
    description: '3000W pure sine wave inverter with 75A battery charger, auto transfer switch, remote panel, 12VDC input. Powers patient compartment 120VAC loads.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 1650,
    pricingRules: [
      { id: 'elec-bundle', name: 'Electrical Package Bundle', type: 'discount', value: 4, amountType: '%' },
    ],
    oneTimeAdjustments: [],
    subtotal: 4950,
    total: 4752,
  },
  {
    id: '10',
    productId: '000-100-093',
    productName: 'Patient Compartment A/C System — Roof Mount',
    description: 'Roof-mount A/C unit for ambulance module, 24,000 BTU, R-134a refrigerant, thermostat controlled with ducted distribution system.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 5200,
    pricingRules: [
      { id: 'hvac-pkg', name: 'HVAC Package Discount', type: 'discount', value: 3, amountType: '%' },
    ],
    oneTimeAdjustments: [],
    subtotal: 15600,
    total: 15132,
  },
  {
    id: '11',
    productId: '000-100-171',
    productName: 'Type III Ambulance Build Labor — Complete',
    description: 'Full Type III ambulance build labor on cutaway chassis, cab mod, module integration, electrical, HVAC, medical gas, graphics. 500+ labor hours.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 28000,
    pricingRules: [
      { id: 'multi-build', name: 'Multi-Unit Build Labor Discount', type: 'discount', value: 7, amountType: '%' },
    ],
    oneTimeAdjustments: [
      { id: 'overtime', type: 'premium', amountType: '$', amount: 4500, label: 'Expedited Build Schedule Premium' },
    ],
    subtotal: 84000,
    total: 82620,
  },
  {
    id: '12',
    productId: '000-100-175',
    productName: 'Final QC Inspection & Road Test',
    description: 'Comprehensive quality control inspection: 200+ checkpoint list, road test, weight certification, fluid levels, and full documentation per KKK spec.',
    image: '',
    quantity: 3,
    uom: 'EA',
    defaultUom: 'EA',
    unitPrice: 1200,
    pricingRules: [],
    oneTimeAdjustments: [],
    subtotal: 3600,
    total: 3600,
  },
];

interface ItemRowProps {
  item: LineItem;
  index: number;
  itemNumber: string;
  parentGroupNumber: number | null;
  originalItemNumber: number | null;
  isFirstInDuplicateGroup: boolean;
  isInDuplicateGroup: boolean;
  duplicateGroupSize: number;
  isSelected: boolean;
  isHovered: boolean;
  isEditable: boolean;
  isEditMode: boolean;
  isNewlyAdded: boolean;
  editingCell: { itemId: string; field: 'quantity' | 'unitPrice' } | null;
  onHover: (id: string | null) => void;
  onToggleSelect: (id: string) => void;
  onOpenConfigurator: (item: LineItem) => void;
  onStartEdit: (itemId: string, field: 'quantity' | 'unitPrice') => void;
  onCommitEdit: (itemId: string, field: 'quantity' | 'unitPrice', value: number) => void;
  onCancelEdit: () => void;
  onUomChange: (itemId: string, newUom: string) => void;
  onDeleteRow: (itemId: string) => void;
  formatCurrency: (amount: number) => string;
  getNetAdjustmentPercent: (item: LineItem) => number | null;
  /** Customer's quote currency (passed through for the QuoteMoney cell). */
  customerCurrency?: string;
  /** Page-level view-mode toggle. Forwards directly to QuoteMoney. */
  viewMode?: 'base' | 'customer';
}

// Helper: get tracking type info for a product
function getTrackingType(productId: string): { label: string; bg: string; color: string } {
  const product = PRODUCTS.find(p => p.id === productId);
  if (product?.isSerialized) return { label: 'Serialized', bg: '#DBEAFE', color: '#1E40AF' };
  if (product?.isLotControlled) return { label: 'Lot Controlled', bg: '#E0E7FF', color: '#3730A3' };
  return { label: 'Non-Serialized', bg: '#F3F4F6', color: '#374151' };
}

function ItemRow({
  item,
  index,
  itemNumber,
  parentGroupNumber,
  originalItemNumber,
  isFirstInDuplicateGroup,
  isInDuplicateGroup,
  duplicateGroupSize,
  isSelected,
  isHovered,
  isEditable,
  isEditMode,
  isNewlyAdded,
  editingCell,
  onHover,
  onToggleSelect,
  onOpenConfigurator,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onUomChange,
  onDeleteRow,
  formatCurrency,
  getNetAdjustmentPercent,
  customerCurrency,
  viewMode,
}: ItemRowProps) {
  const ref = useRef<HTMLTableRowElement>(null);
  const uomDropdownRef = useRef<HTMLDivElement>(null);
  const adjPct = getNetAdjustmentPercent(item);
  const isEditingQty = editingCell?.itemId === item.id && editingCell?.field === 'quantity';
  const isEditingPrice = editingCell?.itemId === item.id && editingCell?.field === 'unitPrice';
  const [showUomDropdown, setShowUomDropdown] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);
  const [isDescClamped, setIsDescClamped] = useState(false);

  // Edit affordances only show when the global edit mode toggle is on
  const showEditAffordance = isEditMode;

  // Detect if description text overflows (needs clamping)
  // useLayoutEffect so we measure before paint; temporarily remove
  // the -webkit-line-clamp so scrollHeight reflects full content.
  useLayoutEffect(() => {
    const el = descRef.current;
    if (!el) return;
    // Save originals
    const origMaxH = el.style.maxHeight;
    const origDisplay = el.style.display;
    const origClamp = el.style.webkitLineClamp;
    const origOrient = el.style.getPropertyValue('-webkit-box-orient');
    // Remove clamp
    el.style.maxHeight = 'none';
    el.style.display = 'block';
    el.style.webkitLineClamp = 'unset';
    el.style.setProperty('-webkit-box-orient', 'unset');
    const naturalHeight = el.scrollHeight;
    // Restore
    el.style.maxHeight = origMaxH;
    el.style.display = origDisplay;
    el.style.webkitLineClamp = origClamp;
    el.style.setProperty('-webkit-box-orient', origOrient);
    setIsDescClamped(naturalHeight > 38); // 36px threshold + small tolerance
  }, [item.description]);

  // Close UoM dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (uomDropdownRef.current && !uomDropdownRef.current.contains(event.target as Node)) {
        setShowUomDropdown(false);
      }
    };
    if (showUomDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUomDropdown]);

  const rowBg = isNewlyAdded ? undefined : isSelected ? '#F0F5FF' : isHovered ? '#FAFBFC' : '#FFFFFF';

  // Scroll into view when newly added
  useEffect(() => {
    if (isNewlyAdded && ref.current) {
      // Small delay to let the DOM settle after state update
      const timer = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isNewlyAdded]);

  const handleKeyDown = (e: React.KeyboardEvent, field: 'quantity' | 'unitPrice') => {
    if (e.key === 'Enter') {
      const value = parseFloat((e.target as HTMLInputElement).value);
      if (!isNaN(value) && value > 0) {
        onCommitEdit(item.id, field, value);
      } else {
        onCancelEdit();
      }
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>, field: 'quantity' | 'unitPrice') => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      onCommitEdit(item.id, field, value);
    } else {
      onCancelEdit();
    }
  };

  const handleDescriptionToggle = () => {
    setDescExpanded(prev => !prev);
  };

  return (
    <motion.tr
      ref={ref}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, overflow: 'hidden' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => {
        // Open configurator — view-only mode if not in edit mode
        onOpenConfigurator(item);
      }}
      className={isNewlyAdded ? 'newly-added-row' : undefined}
      style={{
        borderTop: isInDuplicateGroup && !isFirstInDuplicateGroup ? '1px dashed #E5E7EB' : '1px solid #E5E7EB',
        backgroundColor: isNewlyAdded ? undefined : rowBg,
        transition: isNewlyAdded ? undefined : 'background-color 120ms ease',
        cursor: 'pointer',
        boxShadow: isNewlyAdded ? 'inset 3px 0 0 #3B82F6' : undefined,
      }}
    >
      {/* Checkbox */}
      <td
        style={{
          padding: isEditMode ? '0 0 0 4px' : '0',
          width: isEditMode ? undefined : '0px',
          verticalAlign: 'top',
          borderLeft: isSelected
            ? '3px solid #3B82F6'
            : '3px solid transparent',
        }}
      >
        {isEditable && isEditMode && (
          <div
            onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginTop: '8px',
            }}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '3px',
                border: isSelected
                  ? 'none'
                  : `1.5px solid ${isHovered ? '#9CA3AF' : '#D1D5DB'}`,
                backgroundColor: isSelected ? '#3B82F6' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 120ms, background-color 120ms',
                flexShrink: 0,
              }}
            >
              {isSelected && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4.2 7.5L8 2.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
        )}
      </td>

      {/* Item Number — plain text */}
      <td style={{ padding: '12px 0 0', textAlign: 'center', verticalAlign: 'top' }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 500,
          color: '#9CA3AF',
          lineHeight: '1',
        }}>
          {itemNumber}
        </span>
      </td>

      {/* Product — SKU + type pill + description format */}
      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          {/* Square rounded thumbnail */}
          {item.image ? (
            <img
              src={item.image}
              alt={item.productName}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '8px',
                objectFit: 'cover',
                flexShrink: 0,
                border: '1px solid #E5E7EB',
              }}
            />
          ) : (
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '8px',
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Package style={{ width: '24px', height: '24px', color: '#D1D5DB' }} />
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* Row 1: SKU + Type pill + variant tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
                {item.productId}
              </span>
              {(() => {
                const tracking = getTrackingType(item.productId);
                return (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    fontSize: '11px', fontWeight: 600, color: tracking.color,
                    backgroundColor: tracking.bg, padding: '2px 6px', borderRadius: '3px', lineHeight: '1',
                    whiteSpace: 'nowrap',
                  }}>
                    {tracking.label}
                  </span>
                );
              })()}
              {isInDuplicateGroup && !isFirstInDuplicateGroup && originalItemNumber != null && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  fontSize: '11px', fontWeight: 500, color: '#8B5CF6',
                  backgroundColor: 'transparent', border: '1px dashed #C4B5FD',
                  padding: '1px 6px 1px 4px', borderRadius: '4px', lineHeight: '1',
                  whiteSpace: 'nowrap',
                }}>
                  <Layers style={{ width: '10px', height: '10px', flexShrink: 0 }} />
                  Duplicate of #{originalItemNumber}
                </span>
              )}
            </div>
            {/* Row 2: Description with more/less */}
            <div style={{ position: 'relative' }}>
              <div
                ref={descRef}
                style={{
                  fontSize: '12px',
                  color: '#6B7280',
                  lineHeight: '1.5',
                  maxHeight: descExpanded ? 'none' : '36px',
                  overflow: 'hidden',
                  transition: 'max-height 200ms ease',
                  display: descExpanded ? 'block' : '-webkit-box',
                  WebkitLineClamp: descExpanded ? 'unset' : 2,
                  WebkitBoxOrient: descExpanded ? undefined : ('vertical' as any),
                  textOverflow: 'ellipsis',
                }}
              >
                {item.description}
              </div>
              {isDescClamped && !descExpanded && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleDescriptionToggle(); }}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#3B82F6',
                    cursor: 'pointer',
                    lineHeight: '1',
                    userSelect: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '4px 6px',
                    margin: '-4px -6px',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.backgroundColor = '#F0F5FF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  more <ChevronDown style={{ width: '11px', height: '11px' }} />
                </span>
              )}
              {isDescClamped && descExpanded && (
                <span
                  onClick={(e) => { e.stopPropagation(); handleDescriptionToggle(); }}
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#3B82F6',
                    cursor: 'pointer',
                    lineHeight: '1',
                    userSelect: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '4px 6px',
                    margin: '-4px -6px',
                    borderRadius: '4px',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#2563EB'; e.currentTarget.style.backgroundColor = '#F0F5FF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  less <ChevronDown style={{ width: '11px', height: '11px', transform: 'rotate(180deg)' }} />
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Qty / UOM - Unified capsule */}
      <td onClick={(e) => e.stopPropagation()} style={{ padding: '0 12px', textAlign: 'center', verticalAlign: 'middle' }}>
        <div
          ref={uomDropdownRef}
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'stretch',
            height: '30px',
            borderRadius: '6px',
            border: `1px solid ${isEditingQty ? '#3B82F6' : showUomDropdown ? '#BFDBFE' : showEditAffordance ? '#D1D5DB' : 'transparent'}`,
            backgroundColor: isEditingQty || showUomDropdown || showEditAffordance ? '#FFFFFF' : 'transparent',
            overflow: 'visible',
            transition: 'border-color 100ms, background-color 100ms',
            boxShadow: isEditingQty ? '0 0 0 2px rgba(59, 130, 246, 0.10)' : 'none',
          }}
        >
            {/* LEFT — Quantity input/display */}
            {isEditingQty ? (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                <input
                  type="number"
                  defaultValue={item.quantity}
                  min={1}
                  autoFocus
                  onKeyDown={(e) => handleKeyDown(e, 'quantity')}
                  onBlur={(e) => handleBlur(e, 'quantity')}
                  style={{
                    width: '64px',
                    height: '100%',
                    border: 'none',
                    textAlign: 'center',
                    outline: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1F2937',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    backgroundColor: 'transparent',
                    padding: '0 2px',
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => isEditable && isEditMode && onStartEdit(item.id, 'quantity')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 10px',
                  minWidth: '40px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: showEditAffordance ? 'text' : 'default',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                title={showEditAffordance ? 'Click to edit quantity' : undefined}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1', whiteSpace: 'nowrap' }}>
                  {item.quantity.toLocaleString()}
                </span>
              </button>
            )}

            {/* DIVIDER */}
            {isEditingQty || showUomDropdown || showEditAffordance ? (
              <div style={{ width: '1px', backgroundColor: '#E5E7EB', flexShrink: 0, alignSelf: 'stretch' }} />
            ) : (
              <span style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '30px', flexShrink: 0, userSelect: 'none', padding: '0 2px' }}>/</span>
            )}

            {/* RIGHT — UoM selector */}
            <button
              onClick={(e) => {
                if (!isEditable || !isEditMode) return;
                e.stopPropagation();
                setShowUomDropdown(!showUomDropdown);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '0 8px',
                minWidth: '36px',
                border: 'none',
                backgroundColor: showUomDropdown ? '#F9FAFB' : 'transparent',
                cursor: showEditAffordance ? 'pointer' : 'default',
                transition: 'background-color 100ms',
                fontFamily: 'Inter, system-ui, sans-serif',
                borderRadius: '0 5px 5px 0',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (showEditAffordance && !showUomDropdown) e.currentTarget.style.backgroundColor = '#F9FAFB';
              }}
              onMouseLeave={(e) => {
                if (!showUomDropdown) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', lineHeight: '1' }}>
                {item.uom}
              </span>
              {showEditAffordance && (
                <ChevronDown style={{ width: '11px', height: '11px', color: '#9CA3AF', flexShrink: 0 }} />
              )}
            </button>

            {/* UoM dropdown */}
            {showUomDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                  zIndex: 50,
                  minWidth: '200px',
                  overflow: 'hidden',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                {UOM_OPTIONS.map((option) => {
                  const isActive = item.uom === option.name;
                  const isDefault = option.name === item.defaultUom;
                  return (
                    <button
                      key={option.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUomChange(item.id, option.name);
                        setShowUomDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderTop: 'none',
                        borderRight: 'none',
                        borderBottom: '1px solid #F3F4F6',
                        borderLeft: 'none',
                        backgroundColor: isActive ? '#F9FAFB' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 80ms',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = '#F9FAFB';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500, color: '#1F2937', lineHeight: '1', textAlign: 'left' }}>
                            {option.name}
                          </span>
                          {isDefault && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                fontSize: '9px',
                                fontWeight: 600,
                                color: '#6B7280',
                                backgroundColor: '#F3F4F6',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                lineHeight: '1',
                                textTransform: 'uppercase' as const,
                                letterSpacing: '0.3px',
                              }}
                            >
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1', textAlign: 'left' }}>
                          {option.fullName}
                        </span>
                      </div>
                      {isActive && (
                        <div style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          backgroundColor: '#1B6EF3',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
        </div>
      </td>

      {/* PPU (Price Per Unit) */}
      <td onClick={(e) => e.stopPropagation()} style={{ padding: '0 12px', textAlign: 'left', verticalAlign: 'middle' }}>
        <div style={{ position: 'relative', display: 'inline-block', width: '110px' }}>
          {/* Price input/display — centered in row */}
          {isEditingPrice ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                width: '100%',
                height: '30px',
                padding: '0 8px',
                gap: '1px',
                borderRadius: '6px',
                border: '1px solid #3B82F6',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.10)',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1', flexShrink: 0 }}>{getLibraryCurrency(BASE_CURRENCY)?.symbol ?? BASE_CURRENCY}</span>
              <input
                type="number"
                defaultValue={item.unitPrice}
                min={0}
                step={0.01}
                autoFocus
                onKeyDown={(e) => handleKeyDown(e, 'unitPrice')}
                onBlur={(e) => handleBlur(e, 'unitPrice')}
                style={{
                  width: '90px',
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#1F2937',
                  padding: '0 2px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  backgroundColor: 'transparent',
                }}
              />
            </div>
          ) : showEditAffordance ? (
            <button
              onClick={() => isEditable && isEditMode && onStartEdit(item.id, 'unitPrice')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1px',
                width: '100%',
                height: '30px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#FFFFFF',
                cursor: 'text',
                transition: 'all 100ms',
                fontFamily: 'Inter, system-ui, sans-serif',
                boxSizing: 'border-box',
              }}
              title="Click to edit price"
            >
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1' }}>
                {(() => {
                  const cur = (customerCurrency || BASE_CURRENCY).toUpperCase();
                  const showCustomer = cur !== BASE_CURRENCY && viewMode === 'customer';
                  const displayCur = showCustomer ? cur : BASE_CURRENCY;
                  const sym = getLibraryCurrency(displayCur)?.symbol ?? displayCur;
                  const value = showCustomer ? convertBetween(item.unitPrice, BASE_CURRENCY, cur) : item.unitPrice;
                  return `${sym} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                })()}
              </span>
            </button>
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '1px',
                width: '100%',
                fontFamily: 'Inter, system-ui, sans-serif',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1' }}>
                <QuoteMoney
                  valuePKR={item.unitPrice}
                  customerCurrency={customerCurrency}
                  view={viewMode}
                />
              </span>
            </div>
          )}
          
          {/* Unit label below PPU — absolutely positioned so it doesn't affect row centering */}
          <span style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            marginTop: '2px',
            fontSize: '10px', fontWeight: 400, color: '#9CA3AF', lineHeight: '1',
            userSelect: 'none', whiteSpace: 'nowrap',
          }}>
            {UOM_OPTIONS.find(u => u.name === item.uom)?.fullName || item.uom}
          </span>
        </div>
      </td>

      {/* Total */}
      <td style={{ padding: '0 12px', textAlign: 'right', verticalAlign: 'middle' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1F2937', lineHeight: '1' }}>
          <QuoteMoney
            valuePKR={item.total}
            customerCurrency={customerCurrency}
            view={viewMode}
          />
        </span>
      </td>

      {/* Row delete action — only in edit mode */}
      <td
        style={{
          padding: isEditMode ? '0 4px 0 0' : '0',
          width: isEditMode ? undefined : '0px',
          verticalAlign: 'middle',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        {isEditable && isEditMode && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeleteRow(item.id); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: '1px solid transparent',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 120ms',
              padding: '0',
              color: '#C4C9D1',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FEF2F2';
              e.currentTarget.style.borderColor = '#FECACA';
              e.currentTarget.style.color = '#DC2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.color = '#C4C9D1';
            }}
            title="Remove line item"
          >
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        )}
      </td>
    </motion.tr>
  );
}

interface ItemsTabTableCleanProps {
  quoteStatus?: string;
  quoteId?: string;
  readOnly?: boolean;
  /** Customer's quote currency (ISO 4217). Drives the Advanced Configurator's price hover and pricing-rule conversion display. Defaults to base when omitted. */
  customerCurrency?: string;
  /** Page-level Base ↔ Customer view toggle. When `customer`, PPU and Total cells render in customer currency with PKR hover. */
  viewMode?: 'base' | 'customer';
  /** Called when a material line-item change occurs (add/delete/modify/qty/uom/pricing) */
  onMaterialChange?: (fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string) => void;
}

function ItemsTable({ quoteStatus, quoteId, readOnly, customerCurrency, viewMode, onMaterialChange }: ItemsTabTableCleanProps) {
  // Check if there are created line items for this quote
  const createdItems = quoteId ? getCreatedQuoteLineItems(quoteId) : undefined;
  
  const initialItems: LineItem[] = createdItems && createdItems.length > 0
    ? createdItems.map((ci, idx) => ({
        id: ci.id || String(idx + 1),
        productId: ci.productId,
        productName: ci.name,
        description: ci.description,
        image: ci.image,
        quantity: ci.quantity,
        uom: 'EA',
        defaultUom: 'EA',
        unitPrice: ci.unitPrice,
        pricingRules: [],
        oneTimeAdjustments: [],
        subtotal: ci.quantity * ci.unitPrice,
        total: ci.total || ci.quantity * ci.unitPrice,
      }))
    : MOCK_LINE_ITEMS;
    
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: 'quantity' | 'unitPrice' } | null>(null);
  const [configuratorItem, setConfiguratorItem] = useState<LineItem | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Track newly added item IDs for highlight micro-animation
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());
  const newlyAddedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editable in draft, sent, and confirmed states — not in converted/cancelled/archived/expired
  const isEditable = (quoteStatus === 'draft' || quoteStatus === 'sent' || quoteStatus === 'confirmed') && !readOnly;
  const isEditMode = isEditable;

  // Clear selection and editing state when leaving draft mode
  useEffect(() => {
    if (!isEditable) {
      setSelectedRows(new Set());
      setEditingCell(null);
    }
  }, [isEditable]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: amount % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const toggleRowSelection = (itemId: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedRows(newSelected);
  };

  const toggleAllRows = () => {
    if (selectedRows.size === items.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(items.map(i => i.id)));
    }
  };

  const getNetAdjustmentPercent = (item: LineItem): number | null => {
    let totalDiscountPercent = 0;
    let totalPremiumPercent = 0;

    item.pricingRules.forEach(rule => {
      if (rule.amountType === '%') {
        if (rule.type === 'discount') totalDiscountPercent += rule.value;
        else totalPremiumPercent += rule.value;
      }
    });

    item.oneTimeAdjustments.forEach(adj => {
      if (adj.amountType === '%') {
        if (adj.type === 'discount') totalDiscountPercent += adj.amount;
        else totalPremiumPercent += adj.amount;
      } else {
        if (item.subtotal > 0) {
          const pct = (adj.amount / item.subtotal) * 100;
          if (adj.type === 'discount') totalDiscountPercent += pct;
          else totalPremiumPercent += pct;
        }
      }
    });

    const net = totalPremiumPercent - totalDiscountPercent;
    if (net === 0 && totalDiscountPercent === 0 && totalPremiumPercent === 0) return null;
    return Math.round(net * 10) / 10;
  };

  const handleDeleteSelected = () => {
    const count = selectedRows.size;
    setItems(items.filter(item => !selectedRows.has(item.id)));
    setSelectedRows(new Set());
    onMaterialChange?.('line_item_delete', `Removed ${count} line item${count > 1 ? 's' : ''}`, `${count} items`, '0 items');
  };

  const handleDeleteRow = (itemId: string) => {
    const deleted = items.find(i => i.id === itemId);
    setItems(prev => prev.filter(item => item.id !== itemId));
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    onMaterialChange?.('line_item_delete', `Removed ${deleted?.productName || 'line item'}`);
  };

  const handleDuplicateSelected = () => {
    const newItems: LineItem[] = [];
    const addedIds: string[] = [];
    const { numbers: dupItemNumbers } = getItemMeta();
    items.forEach(item => {
      newItems.push(item);
      if (selectedRows.has(item.id)) {
        const newId = `${item.id}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        newItems.push({
          ...item,
          id: newId,
        });
        addedIds.push(newId);
        const itemNum = dupItemNumbers[item.id] || '?';
        toast.custom((id) => (
          <div
            onClick={() => toast.dismiss(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', borderRadius: '8px',
              backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
              fontFamily: 'Inter, system-ui, sans-serif',
              width: '320px', cursor: 'pointer',
            }}
          >
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px',
              backgroundColor: '#F3E8FF', border: '1px solid #DDD6FE',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Layers style={{ width: '14px', height: '14px', color: '#7C3AED' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', lineHeight: 1.2 }}>
                Duplicate of Item #{itemNum} added
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.productName}
              </div>
            </div>
          </div>
        ), { position: 'top-right', duration: 3000 });
      }
    });
    setItems(newItems);
    setSelectedRows(new Set());
    // Highlight newly added items
    if (addedIds.length > 0) {
      setNewlyAddedIds(new Set(addedIds));
      if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
      newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 2000);
    }
    const count = newItems.length - items.length;
    if (count > 0) onMaterialChange?.('line_item_add', `Duplicated ${count} line item${count > 1 ? 's' : ''}`);
  };

  const recalcItem = (item: LineItem): LineItem => {
    const subtotal = item.quantity * item.unitPrice;
    let discounts = 0;
    let premiums = 0;

    item.pricingRules.forEach(rule => {
      const impact = rule.amountType === '%' ? (subtotal * rule.value) / 100 : rule.value;
      if (rule.type === 'discount') discounts += impact;
      else premiums += impact;
    });

    item.oneTimeAdjustments.forEach(adj => {
      const impact = adj.amountType === '%' ? (subtotal * adj.amount) / 100 : adj.amount;
      if (adj.type === 'discount') discounts += impact;
      else premiums += impact;
    });

    return { ...item, subtotal, total: subtotal - discounts + premiums };
  };

  const handleStartEdit = (itemId: string, field: 'quantity' | 'unitPrice') => {
    setEditingCell({ itemId, field });
  };

  const handleCommitEdit = (itemId: string, field: 'quantity' | 'unitPrice', value: number) => {
    const oldItem = items.find(i => i.id === itemId);
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== itemId) return item;
        const updated = { ...item, [field]: field === 'quantity' ? Math.round(value) : value };
        return recalcItem(updated);
      })
    );
    setEditingCell(null);
    if (oldItem) {
      const fieldKey = field === 'quantity' ? 'quantity' : 'unit_price';
      const label = field === 'quantity' ? `Quantity · ${oldItem.productName}` : `Unit Price · ${oldItem.productName}`;
      onMaterialChange?.(fieldKey, label, String(oldItem[field]), String(value));
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
  };

  const handleConfiguratorSave = (updatedItem: LineItem) => {
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== updatedItem.id) return item;
        return recalcItem(updatedItem);
      })
    );
    onMaterialChange?.('line_item_modify', `Modified ${updatedItem.productName}`);
  };

  const handleAddProducts = (products: { product: any; quantity: number }[]) => {
    const addedIds: string[] = [];
    const current = [...items];
    const duplicateNames: string[] = [];

    for (const { product, quantity } of products) {
      const subtotal = quantity * product.unitPrice;
      const newId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${product.id}`;
      const newItem: LineItem = {
        id: newId,
        productId: product.id,
        productName: product.name,
        description: product.description,
        image: product.images?.[0],
        quantity,
        uom: 'EA',
        defaultUom: 'EA',
        unitPrice: product.unitPrice,
        pricingRules: [],
        oneTimeAdjustments: [],
        subtotal,
        total: subtotal,
      };
      addedIds.push(newId);
      const lastIndex = current.map(i => i.productId).lastIndexOf(product.id);
      if (lastIndex !== -1) {
        const existingItem = current.find(i => i.productId === product.id);
        duplicateNames.push(existingItem?.productName || product.name);
        current.splice(lastIndex + 1, 0, newItem);
      } else {
        current.push(newItem);
      }
    }

    setItems(current);

    // Show duplicate toasts (outside state updater)
    for (const name of duplicateNames) {
      toast.custom((tid) => (
        <div
          onClick={() => toast.dismiss(tid)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', borderRadius: '8px',
            backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
            fontFamily: 'Inter, system-ui, sans-serif',
            width: '320px', cursor: 'pointer',
          }}
        >
          <div style={{
            width: '28px', height: '28px', borderRadius: '6px',
            backgroundColor: '#F3E8FF', border: '1px solid #DDD6FE',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Layers style={{ width: '14px', height: '14px', color: '#7C3AED' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', lineHeight: 1.2 }}>
              Duplicate of {name} added
            </div>
            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px', lineHeight: 1.3 }}>
              Item already exists — added as a separate line
            </div>
          </div>
        </div>
      ), { position: 'top-right', duration: 3000 });
    }

    // Highlight newly added items
    if (addedIds.length > 0) {
      setNewlyAddedIds(new Set(addedIds));
      if (newlyAddedTimerRef.current) clearTimeout(newlyAddedTimerRef.current);
      newlyAddedTimerRef.current = setTimeout(() => setNewlyAddedIds(new Set()), 2000);
    }
    const names = products.map(p => p.product.name).join(', ');
    onMaterialChange?.('line_item_add', `Added ${products.length} item${products.length > 1 ? 's' : ''}: ${names}`);
  };

  const handleUomChange = (itemId: string, newUom: string) => {
    const oldItem = items.find(i => i.id === itemId);
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== itemId) return item;
        const updated = { ...item, uom: newUom };
        return recalcItem(updated);
      })
    );
    onMaterialChange?.('uom', `UOM · ${oldItem?.productName || 'Item'}`, oldItem?.uom, newUom);
  };

  // Sequential numbering (1, 2, 3, 4…) — no sub-numbering for duplicates
  // Also computes originalItemNumber for "Duplicate of #N" labels
  const getItemMeta = () => {
    const numbers: { [itemId: string]: string } = {};
    const parentGroupNumbers: { [itemId: string]: number | null } = {};
    const originalItemNumbers: { [itemId: string]: number | null } = {};

    // Track the first occurrence line number for each productId
    const firstOccurrence: { [productId: string]: number } = {};

    items.forEach((item, index) => {
      const lineNum = index + 1;
      numbers[item.id] = `${lineNum}`;

      if (!(item.productId in firstOccurrence)) {
        // This is the original item
        firstOccurrence[item.productId] = lineNum;
        parentGroupNumbers[item.id] = null;
        originalItemNumbers[item.id] = null;
      } else {
        // This is a duplicate
        parentGroupNumbers[item.id] = firstOccurrence[item.productId];
        originalItemNumbers[item.id] = firstOccurrence[item.productId];
      }
    });
    return { numbers, parentGroupNumbers, originalItemNumbers };
  };

  const { numbers: itemNumbers, parentGroupNumbers, originalItemNumbers } = getItemMeta();

  // Count unique products for display
  const uniqueProductCount = new Set(items.map(i => i.productId)).size;

  return (
    <>
      {/* CSS keyframes for newly-added row highlight */}
      <style>{`
        @keyframes newRowHighlight {
          0% { background-color: #DBEAFE; }
          40% { background-color: #EFF6FF; }
          100% { background-color: #FFFFFF; }
        }
        .newly-added-row {
          animation: newRowHighlight 2s ease-out forwards;
        }
      `}</style>
      {/* Sticky Toolbar — outside overflow:hidden so sticky works */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          backgroundColor: '#FFFFFF',
          borderRadius: '10px 10px 0 0',
          borderTop: isEditMode ? '1.5px solid #93B4F8' : '1px solid #E5E7EB',
          borderRight: isEditMode ? '1.5px solid #93B4F8' : '1px solid #E5E7EB',
          borderBottom: '1px solid #E5E7EB',
          borderLeft: isEditMode ? '1.5px solid #93B4F8' : '1px solid #E5E7EB',
          boxShadow: isEditMode
            ? '0 0 0 3px rgba(59,130,246,0.06), 0 2px 8px rgba(0,0,0,0.03)'
            : '0 2px 8px rgba(0,0,0,0.02)',
          transition: 'border-color 200ms, box-shadow 200ms',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827', lineHeight: '1' }}>
            Line Items
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Bulk actions when items are selected */}
          {isEditable && selectedRows.size > 0 ? (
            <>
              <span style={{
                fontSize: '12px',
                fontWeight: 500,
                color: '#9CA3AF',
                lineHeight: '1',
                whiteSpace: 'nowrap',
              }}>
                {selectedRows.size} selected
              </span>
              <button
                onClick={handleDuplicateSelected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#FFFFFF',
                  color: '#374151',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  lineHeight: '1',
                  transition: 'all 150ms',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
              >
                <Copy style={{ width: '12px', height: '12px' }} />
                Duplicate
              </button>
              <button
                onClick={handleDeleteSelected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  height: '30px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #FCA5A5',
                  backgroundColor: '#FFFFFF',
                  color: '#DC2626',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  lineHeight: '1',
                  transition: 'all 150ms',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                <Trash2 style={{ width: '12px', height: '12px' }} />
                Delete
              </button>
              <div style={{ width: '1px', height: '18px', backgroundColor: '#E5E7EB', flexShrink: 0 }} />
              <button
                onClick={() => setSelectedRows(new Set())}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                title="Clear selection"
              >
                <X style={{ width: '13px', height: '13px', color: '#6B7280' }} />
              </button>
            </>
          ) : isEditable ? (
            <button
              onClick={() => setShowProductPicker(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                height: '30px',
                padding: '0 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#1B6EF3',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                lineHeight: '1',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B6EF3'; }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
              Add Line Item
            </button>
          ) : null}
        </div>
      </div>

      {/* Table body container */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '0 0 10px 10px',
          borderTop: 'none',
          borderRight: isEditMode ? '1.5px solid #93B4F8' : '1px solid #E5E7EB',
          borderBottom: isEditMode ? '1.5px solid #93B4F8' : '1px solid #E5E7EB',
          borderLeft: isEditMode ? '1.5px solid #93B4F8' : '1px solid #E5E7EB',
          overflow: 'hidden',
          boxShadow: isEditMode ? '0 0 0 3px rgba(59,130,246,0.06)' : 'none',
          transition: 'border-color 200ms, box-shadow 200ms',
        }}
      >
        {/* Table */}
        {items.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 40px',
              minHeight: '400px',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Package style={{ width: '28px', height: '28px', color: '#9CA3AF' }} />
            </div>
            <h3
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#1F2937',
                lineHeight: '1',
                margin: '0 0 6px 0',
              }}
            >
              No line items yet
            </h3>
            <p
              style={{
                fontSize: '13px',
                color: '#6B7280',
                lineHeight: '1.4',
                margin: '0 0 20px 0',
                textAlign: 'center',
                maxWidth: '280px',
              }}
            >
              Add products from the catalog to start building this quote.
            </p>
            {isEditable && (
              <button
                onClick={() => setShowProductPicker(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '32px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#FFFFFF',
                  color: '#374151',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  lineHeight: '1',
                  transition: 'all 150ms',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
              >
                <Plus style={{ width: '14px', height: '14px' }} />
                Add Items
              </button>
            )}
          </div>
        ) : (
        <div style={{ overflowX: 'auto', scrollbarWidth: 'thin' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '640px' }}>
            <colgroup>
              <col style={{ width: isEditMode ? '36px' : '0px' }} />
              <col style={{ width: '44px' }} />
              <col />
              <col style={{ width: '170px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: isEditMode ? '36px' : '0px' }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: '#F7F8F9', height: '32px' }}>
                <th style={{ padding: isEditMode ? '0 0 0 4px' : '0', width: isEditMode ? undefined : '0px', textAlign: 'left', verticalAlign: 'middle' }}>
                  {isEditable && isEditMode && (
                    <div
                      onClick={toggleAllRows}
                      style={{
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        borderRadius: '4px',
                      }}
                    >
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '3px',
                          border: selectedRows.size > 0 ? 'none' : '1.5px solid #D1D5DB',
                          backgroundColor: selectedRows.size > 0 ? '#3B82F6' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'border-color 120ms, background-color 120ms',
                          flexShrink: 0,
                        }}
                      >
                        {selectedRows.size > 0 && selectedRows.size === items.length && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4.2 7.5L8 2.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {selectedRows.size > 0 && selectedRows.size < items.length && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2.5 5H7.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}
                </th>
                <th style={{ padding: '0 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>
                    #
                  </span>
                </th>
                <th style={{ padding: '0 12px', textAlign: 'left', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>
                    PRODUCT
                  </span>
                </th>
                <th style={{ padding: '0 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', whiteSpace: 'nowrap' }}>
                    QTY / UOM
                  </span>
                </th>
                <th style={{ padding: '0 12px', textAlign: 'left', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', whiteSpace: 'nowrap' }}>
                    PPU
                  </span>
                </th>
                <th style={{ padding: '0 12px', textAlign: 'right', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>
                    TOTAL
                  </span>
                </th>
                <th style={{ padding: 0, width: isEditMode ? undefined : '0px' }} />
              </tr>
            </thead>
            <tbody>
            <AnimatePresence initial={false}>
              {items.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={index}
                  itemNumber={itemNumbers[item.id]}
                  parentGroupNumber={parentGroupNumbers[item.id]}
                  originalItemNumber={originalItemNumbers[item.id]}
                  isFirstInDuplicateGroup={(() => {
                    const sameProductItems = items.filter(i => i.productId === item.productId);
                    return sameProductItems.length > 1 && sameProductItems[0].id === item.id;
                  })()}
                  isInDuplicateGroup={items.filter(i => i.productId === item.productId).length > 1}
                  duplicateGroupSize={items.filter(i => i.productId === item.productId).length}
                  isSelected={selectedRows.has(item.id)}
                  isHovered={hoveredRow === item.id}
                  isEditable={isEditable}
                  isEditMode={isEditMode}
                  isNewlyAdded={newlyAddedIds.has(item.id)}
                  editingCell={editingCell}
                  onHover={setHoveredRow}
                  onToggleSelect={toggleRowSelection}
                  onOpenConfigurator={setConfiguratorItem}
                  onStartEdit={handleStartEdit}
                  onCommitEdit={handleCommitEdit}
                  onCancelEdit={handleCancelEdit}
                  onUomChange={handleUomChange}
                  onDeleteRow={handleDeleteRow}
                  formatCurrency={formatCurrency}
                  getNetAdjustmentPercent={getNetAdjustmentPercent}
                  customerCurrency={customerCurrency}
                  viewMode={viewMode}
                />
              ))}
            </AnimatePresence>
            </tbody>
          </table>
        </div>
        )}

      </div>

      {/* Advanced Configurator Modal */}
      {configuratorItem && (
        <LineItemConfigModal
          isOpen={true}
          onClose={() => setConfiguratorItem(null)}
          customerCurrency={customerCurrency}
          item={{
            id: configuratorItem.id,
            productId: configuratorItem.productId,
            name: configuratorItem.productName,
            description: configuratorItem.description,
            quantity: configuratorItem.quantity,
            unitPrice: configuratorItem.unitPrice,
            discount: 0,
            total: configuratorItem.total,
            image: configuratorItem.image,
          }}
          onSave={(updatedItem: any) => {
            handleConfiguratorSave({
              ...configuratorItem,
              quantity: updatedItem.quantity ?? configuratorItem.quantity,
              unitPrice: updatedItem.unitPrice ?? configuratorItem.unitPrice,
            });
            setConfiguratorItem(null);
          }}
          readOnly={!isEditable}
        />
      )}

      {/* Product Picker Modal */}
      <ProductPickerModal
        isOpen={showProductPicker}
        onClose={() => setShowProductPicker(false)}
        onAddProducts={handleAddProducts}
        existingProductIds={items.map(i => i.productId)}
        existingItems={items.map(i => ({ productId: i.productId, quantity: i.quantity, productName: i.productName }))}
        customerCurrency={customerCurrency}
      />


    </>
  );
}

export function ItemsTabTableClean({ quoteStatus, quoteId, readOnly, customerCurrency, viewMode, onMaterialChange }: ItemsTabTableCleanProps) {
  return (
    <ItemsTable quoteStatus={quoteStatus} quoteId={quoteId} readOnly={readOnly} customerCurrency={customerCurrency} viewMode={viewMode} onMaterialChange={onMaterialChange} />
  );
}