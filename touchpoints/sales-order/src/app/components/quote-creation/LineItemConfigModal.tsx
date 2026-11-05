// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { XCircle, Search, X, Package, Truck, DollarSign, Warehouse, Settings, Info, Check, ChevronDown, ChevronsDown, ChevronsUp, Calendar, CalendarDays, AlertCircle, FileText, Upload, Paperclip, Percent, TrendingUp, TrendingDown, Plus, Minus, Sparkles, Tag, BadgePercent, Pencil, Hash, Lightbulb, MoreVertical, Image as ImageIcon, FileArchive, User, Clock, Trash2, Eye, EyeOff, CornerUpLeft, RefreshCw, FileCheck, Film, Link2, Play, Images, Download, Maximize2, Layers, Zap, MapPin, Lock, Infinity as InfinityIcon, CircleSlash, CirclePlus, ExternalLink, HeartPulse, Activity, PieChart, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { AttachmentCard, RenameAttachmentDialog } from '@/app/components/shared/attachments/attachment-card';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { PricingRulesLibrary } from '@/app/components/so/PricingRulesLibrary';
import { ShipmentMethodModal, DEFAULT_SHIPMENT, describeShipment, SHIPMENT_METHOD_OPTIONS as NEW_SHIPMENT_METHOD_OPTIONS, SHIPMENT_CARRIERS as NEW_SHIPMENT_CARRIERS, type ShipmentConfig } from '@/app/components/so/ShipmentMethodModal';
import {
  CUSTOMER_PRICING_RULES,
  CUSTOMER_PRICING_RULES_BY_ID,
  evaluateRuleForLine,
  type CustomerPricingRule,
} from '@/app/components/so/pricingRulesData';
import type { PricingRulesAPI } from '@/app/components/so/usePricingRules';
import { ConfirmationModal } from '@/app/components/ConfirmationModal';
import { AdjustmentFormModal } from '@/app/components/shared/AdjustmentFormModal';
import { AttachedLinkChip } from '@/app/components/shared/AttachedLinkChip';
import {
  getLineItemAttachments,
  subscribeLineItemAttachments,
  addLineItemAttachment,
  removeLineItemAttachment,
  renameLineItemAttachment,
  type LineItemAttachment,
} from '@/app/components/so/lineItemAttachmentsStore';
import { LinkPickerPopover } from '@/app/components/shared/LinkPickerPopover';
import { getLinksForId, subscribeToLinksRepository, type ExternalLink as RepositoryLink } from '@/app/data/linksRepository';
import { EmptyPlaceholder } from '@/app/components/shared/EmptyPlaceholder';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
import { Switch } from '@/app/components/ui/switch';
import { Checkbox } from '@/app/components/ui/checkbox';
import { AttachmentUploadingCard } from '@/app/components/shared/attachments/attachment-uploading-card';
import { InactiveItemPill } from '@/app/components/shared/InactiveItemPill';
import {
  AttachmentViewToggle,
  AttachmentListHeader,
  AttachmentListRow,
  ATTACHMENT_CARD_COLUMNS,
  ATTACHMENT_CARD_THUMB,
  type AttachmentViewMode,
  type AttachmentCardSize,
} from '@/app/components/shared/attachments/attachment-view-mode';
import { useItemQuickView } from '@/app/components/shared/ItemQuickView';
import { ComingSoonBanner } from '@/app/components/shared/ComingSoonBanner';
import { LotTrackingTag } from '@/app/components/shared/LotTrackingTag';
import { ItemTypeBadge, itemTypeLabel } from '@/app/components/so/StatusBadge';
import type { AdjustmentFormData, AdjustmentAttachment } from '@/app/components/shared/AdjustmentFormModal';
import { SwitchFreightModeConfirm, splitEvenly } from '@/app/components/shared/SwitchFreightModeConfirm';
import { FreightSplitOverlay } from '@/app/components/shared/FreightSplitOverlay';
import { StockHealthWidget } from './inventory-widgets/StockHealthWidget';
import { InventoryTrendWidget } from './inventory-widgets/InventoryTrendWidget';
import { OnHandByUomWidget } from './inventory-widgets/OnHandByUomWidget';

/* Deterministic per-item demo on-hand. Hash the line item id so each
   line item picks a different but stable value when warehouse stock is
   missing — avoids every card flashing the same canonical 450 EA. */
function hashItemId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) >>> 0;
  return h;
}
function demoOnHandFor(id: string): number {
  return 240 + (hashItemId(id) % 580); // 240..819 EA
}

// Helper function to generate Item ID from item.id in xxx-xxx-xxx format
// Tracking-type glyphs ported from Physical Inventory's `ControlTypeBadge`.
// Identical SVG paths so Serialized / Non-Serialized chips read the same
// across modules (line-items table, configurator product card, etc.).
const SERIALIZED_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M2.91 12.36H1.45V3.64H2.91M4.36 12.36H3.64V3.64H4.36M7.27 12.36H5.09V3.64H7.27M8.73 12.36H8V3.64H8.73M10.91 12.36H9.45V3.64H10.91M12.36 12.36H11.64V3.64H12.36M14.55 12.36H13.09V3.64H14.55V12.36Z" fill="currentColor" />
  </svg>
);
const NON_SERIALIZED_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d="M13.89 15.15L10.67 11.93V12H9.33V10.59L8 9.26V12H7.33V8.59L6.67 7.93V12H4.67V5.93L4 5.26V12H3.33V4.59L0.74 2L1.59 1.15L4.67 4.23L6.67 6.23L7.33 6.89L8 7.56L9.33 8.9V8.89L10.67 10.23V10.23L11.33 10.9V10.89L12.44 12H12.43L14.74 14.31L13.89 15.15ZM10.67 4H9.33V7.2L10.67 8.53V4ZM8 4H7.33V5.2L8 5.87V4ZM13.33 4H11.33V9.2L13.33 11.2V4ZM14.67 12V4H14V11.87L14.13 12H14.67ZM6.67 4H6.13L6.67 4.53V4ZM1.33 12H2.67V4H1.33V12Z" fill="currentColor" />
  </svg>
);

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
    /** Line's stored UoM. Without this declared the configurator's
     *  formData init fell through to the product's primary every
     *  open, so a Box-priced row opened on EA. */
    uom?: string;
  };
  onSave: (updatedItem: any) => void;
  onDelete?: () => void;
  deleteLabel?: string;
  readOnly?: boolean;
  /** Display name of the customer this SO is for — surfaced in the
   *  Pricing Rules Library header subtitle and the Remove confirmation. */
  customerName?: string;
  /** Fires whenever a per-line pricing-rule or adjustment action constitutes
   *  a material change to the SO. Parent decides whether to prompt for a new
   *  version based on stage. The optional `onRevert` callback runs when the
   *  user discards the version prompt so the per-line mutation is undone —
   *  without it, cancelling left a phantom rule/adjustment change on the line. */
  onMaterialEvent?: (description: string, onRevert?: () => void) => void;
  /** Post-draft: library Apply/Remove/Activate/Deactivate edit the
   *  customer's rule book only — they do NOT touch this line's rules and
   *  do NOT fire onMaterialEvent. Per-line and adjustment actions still
   *  fire onMaterialEvent and trigger the version prompt because they
   *  explicitly modify the rule on the current line. */
  stageLibraryChanges?: boolean;
  /** Shared pricing-rules state from SODetail. When provided alongside
   *  `lineId`, the configurator subscribes to it so summary-modal
   *  activate/deactivate shows up here in real time, and mutations from
   *  this configurator propagate back to the summary. */
  pricingAPI?: PricingRulesAPI;
  /** The SO line id (so.lines[i].id) — needed to address per-line rule
   *  activation through `pricingAPI`. */
  lineId?: string;
  /** Shared one-time-adjustments state from SODetail. When provided
   *  alongside `lineId`, the configurator's per-line adjustments list
   *  stays in lockstep with the summary modal — add/edit/remove from
   *  either surface shows up in the other. */
  adjustmentsAPI?: import('@/app/components/so/useAdjustments').AdjustmentsAPI;
  /** Order-level freight charge. When present and `> 0`, the Override
   *  button triggers the same Partner-style split confirmation the
   *  freight breakdown modal uses; on confirm the parent seeds all
   *  siblings with the even split (via `onSeedSiblingFreightShares`)
   *  and this line lands on the same share. */
  quoteDefaultFreight?: number;
  /** Total line count including this line — used for the split math
   *  and the confirmation copy. */
  siblingLineCount?: number;
  /** True if any other line already carries a per-line freight cost. */
  anyOtherLineHasOverride?: boolean;
  /** Called when the user confirms the first per-line override. */
  onSeedSiblingFreightShares?: (sharePerLine: number) => void;
  /** Parent record id — forwarded to AdjustmentFormModal so the
   *  internal-notes field surfaces the link-picker affordance backed
   *  by the shared linksRepository. */
  docId?: string;
  /** Current user, used to attribute inline-added links. */
  currentUser?: string;
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

/* Projection of the shared customer rule book into the configurator's
   legacy rule shape. `discount` is signed (positive = discount, negative
   = premium) for backward compat with existing render/math code. Each
   rule's id matches CUSTOMER_PRICING_RULES_BY_ID so cross-modal sync (via
   pricingAPI) operates on the same id space across the configurator and
   the summary modal. */
const PRICING_RULES = CUSTOMER_PRICING_RULES.map((r): {
  id: string;
  name: string;
  discount: number;
  description: string;
  minQuantity: number;
  status: 'applied' | 'pending' | 'opportunity';
  type: 'discount' | 'premium';
  basis: 'volume' | 'value';
  tierType: 'single' | 'multiple';
  totalTiers: number;
  validFrom: string;
  validTo: string;
  hasDateLimit: boolean;
  scope: 'customer';
  isPreset: boolean;
} => {
  const t0 = r.tiers[0];
  const isFlat$ = t0.unit === '$';
  const sign = r.type === 'premium' ? -1 : 1;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    discount: isFlat$ ? sign * t0.rate : sign * t0.rate, // configurator math only uses % currently
    minQuantity: t0.minQty,
    status: 'applied',
    type: r.type,
    basis: r.tiers.some((t) => t.minQty > 1) ? 'volume' : 'value',
    tierType: r.tiers.length > 1 ? 'multiple' : 'single',
    totalTiers: r.tiers.length,
    validFrom: r.validFrom,
    validTo: r.validTo ?? '',
    hasDateLimit: r.validTo !== null,
    scope: 'customer',
    isPreset: r.source === 'template',
  };
});

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

/* UoM data routed through the central `../../data/uomSets` module so
   liquid + length items surface their real sets instead of being
   forced through the hardcoded discrete dropdown. */
import {
  UOM_SETS,
  getUomSetForProduct,
  getPrimaryUomForProduct,
  findUomById,
} from '../../data/uomSets';
const UNITS_OF_MEASURE = UOM_SETS.discrete.map((u) => ({ ...u, abbreviation: u.name }));

/* Fallback seed for the unbound case only.
 *
 * When the configurator is opened with a parent order (`docId`) it reads
 * and writes `lineItemAttachmentsStore`, which is the same store the SO
 * Detail Attachments tab uses. Opened standalone (e.g. from the product
 * picker, before the order exists) there is nothing to bind to, so it
 * falls back to this local list. */
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



export function LineItemConfigModal({
  isOpen, onClose, item, onSave, onDelete, deleteLabel, readOnly, customerName,
  onMaterialEvent, stageLibraryChanges = false, pricingAPI, lineId, adjustmentsAPI,
  quoteDefaultFreight, siblingLineCount, anyOtherLineHasOverride,
  onSeedSiblingFreightShares, docId, currentUser,
}: LineItemConfigModalProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  // Item peek modal — opens when user taps the product thumbnail in the
  // configurator's right-panel product card.
  const { open: openItemQuickView, modal: itemQuickViewModal } = useItemQuickView();
  const [formData, setFormData] = useState({
    quantity: item.quantity,
    /* Read the line's stored UoM verbatim (lowercased to match the
       central uomSets ids). Falling back to the product's primary
       only when the line doesn't carry one — never 'ea' as a blind
       default which silently overwrote Box/Carton/Gallon lines. */
    uom: ((item.uom || findUomById(getPrimaryUomForProduct({ id: item.productId, name: item.name }))?.id) || 'ea').toString().toLowerCase(),
    unitPrice: item.unitPrice,
    discount: item.discount,
    shipmentMethod: item.shipmentMethod || 'courier-pickup',
    shipmentProvider: (item as any).shipmentProvider || 'hansen',
    pickupLocation: (item as any).pickupLocation || 'loc-001',
    trackingNumber: (item as any).trackingNumber || '',
    isShipmentOverride: false,
    /* New shipment model — always merge any provided fields on top of
       DEFAULT_SHIPMENT so we never end up with a partial config (e.g.
       just { shipmentCost } from a parent freight-map seed) — the
       ShipmentMethodModal needs `method`, dates, carrier, etc. to
       render without crashing on `method.dateLabel`. */
    shipmentConfig: { ...DEFAULT_SHIPMENT, ...((item as any).shipmentConfig as Partial<ShipmentConfig> | undefined) },
    expectedShipDate: '',
    isShipDateOverride: false,
    estimatedDeliveryDate: '',
    isDeliveryDateOverride: false,
    pricingRule: item.pricingRule || 'standard',
    /* Seeded applied rules — used so users can see the populated rules
       list out of the box. To demo the EMPTY-state on a specific line,
       give the line a pricingRule value of "none", or use an item id
       ending in "-empty" / "-005" / "-4" (SO's lines use zero-indexed
       ids like "SOL-{i}-{j}", so "-4" matches the 5th line — chosen as
       the reference empty-state row). */
    /* Seed appliedRules from the shared pricingAPI when available — only
       rules whose `appliesToItemCodes` covers THIS line are surfaced, and
       their isApplied flag reflects the API's per-line activation state.
       This is what makes summary↔configurator stay in lockstep on open. */
    appliedRules: (() => {
      if (pricingAPI && lineId) {
        return pricingAPI.state.attached
          .filter((r) => r.appliesToItemCodes.includes(item.productId))
          .map((r) => ({
            ruleId: r.id,
            isApplied:
              !pricingAPI.state.deactivatedRuleIds.has(r.id) &&
              (pricingAPI.state.activatedLineIdsByRule.get(r.id)?.has(lineId) ?? false),
            unappliedReason: undefined as undefined | 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT',
          }));
      }
      /* Legacy fallback for callers without the shared API. */
      return (item.pricingRule === 'none'
        || item.id?.endsWith('-empty')
        || item.id?.endsWith('-005')
        || item.id?.endsWith('-4'))
        ? [] as Array<{ ruleId: string; isApplied: boolean; unappliedReason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT' }>
        : [];
    })(),
    /* Seed item-scope adjustments from the shared adjustmentsAPI so the
       configurator opens already in sync with the summary modal. The
       useEffect below keeps them in lockstep on every API update. */
    oneTimeAdjustments: (() => {
      if (adjustmentsAPI && lineId) {
        return adjustmentsAPI.adjustments
          .filter((a) => a.scope === 'item' && a.appliedTo?.includes(lineId))
          .map((a) => ({
            id: a.id,
            type: a.type,
            amountType: a.amountType,
            amount: a.amount,
            label: a.label,
            isApplied: a.isApplied,
            unappliedReason: a.unappliedReason,
            internalNotes: a.internalNotes,
            attachments: a.attachments,
          }));
      }
      return [] as Array<{ id: string; type: 'discount' | 'premium'; amountType: '$' | '%'; amount: number; label: string; isApplied: boolean; unappliedReason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT'; internalNotes?: string; attachments?: AdjustmentAttachment[] }>;
    })(),
    warehouse: item.warehouse || 'all',
    leadTime: item.leadTime || '5-7 days',
    tax: item.tax || 8.5,
    notes: item.notes || '',
    showNotesInPdf: false,
    state: 'published',
  });

  /* When the shared pricing API is provided, mirror its per-line rule
     activation into formData.appliedRules on every state change. This is
     what propagates a summary-modal Deactivate over into the configurator
     in real time. The diff check on the produced array prevents needless
     setState. */
  useEffect(() => {
    if (!pricingAPI || !lineId) return;
    const next = pricingAPI.state.attached
      .filter((r) => r.appliesToItemCodes.includes(item.productId))
      .map((r) => ({
        ruleId: r.id,
        isApplied:
          !pricingAPI.state.deactivatedRuleIds.has(r.id) &&
          (pricingAPI.state.activatedLineIdsByRule.get(r.id)?.has(lineId) ?? false),
        unappliedReason: undefined as undefined | 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT',
      }));
    setFormData((prev) => {
      const cur = prev.appliedRules;
      const same =
        cur.length === next.length &&
        cur.every((e, i) => e.ruleId === next[i].ruleId && e.isApplied === next[i].isApplied);
      return same ? prev : { ...prev, appliedRules: next };
    });
  }, [pricingAPI?.state, lineId, item.productId]);

  /* Mirror the shared adjustmentsAPI's item-scope adjustments touching
     this line into formData.oneTimeAdjustments on every API change.
     Diff-then-set avoids re-render loops. */
  useEffect(() => {
    if (!adjustmentsAPI || !lineId) return;
    const next = adjustmentsAPI.adjustments
      .filter((a) => a.scope === 'item' && a.appliedTo?.includes(lineId))
      .map((a) => ({
        id: a.id,
        type: a.type,
        amountType: a.amountType,
        amount: a.amount,
        label: a.label,
        isApplied: a.isApplied,
        unappliedReason: a.unappliedReason,
        internalNotes: a.internalNotes,
        attachments: a.attachments,
      }));
    setFormData((prev) => {
      const cur = prev.oneTimeAdjustments;
      const same =
        cur.length === next.length &&
        cur.every((e, i) =>
          e.id === next[i].id &&
          e.isApplied === next[i].isApplied &&
          e.amount === next[i].amount &&
          e.amountType === next[i].amountType &&
          e.type === next[i].type &&
          e.label === next[i].label &&
          e.internalNotes === next[i].internalNotes &&
          e.attachments === next[i].attachments,
        );
      return same ? prev : { ...prev, oneTimeAdjustments: next };
    });
  }, [adjustmentsAPI?.adjustments, lineId]);

  const [showShipmentDropdown, setShowShipmentDropdown] = useState(false);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  /* Toggle controlling whether deactivated rules appear in the pricing
     rules list. Default off — deactivated rules are hidden. */
  // Disabled/unapplied rule rows + the Show-disabled-rules toggle were
  // removed per product direction. Only fully-active rules render now.
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
  const [leftTab, setLeftTab] = useState<'inventory' | 'attachments' | 'activity_log'>('inventory');
  const [showNotesSection, setShowNotesSection] = useState(!!item.notes);
  /* External links attached to the Item Notes body. Ids point at the
     shared linksRepository entries scoped to the parent record. */
  const [itemNoteLinkIds, setItemNoteLinkIds] = useState<string[]>((item as any).notesLinks || []);
  const [showItemNoteLinkPicker, setShowItemNoteLinkPicker] = useState(false);
  const [itemNoteLinkPickerAnchor, setItemNoteLinkPickerAnchor] = useState<HTMLButtonElement | null>(null);
  const [itemNoteLinksRepoVersion, setItemNoteLinksRepoVersion] = useState(0);
  useEffect(() => subscribeToLinksRepository(() => setItemNoteLinksRepoVersion((v) => v + 1)), []);
  void itemNoteLinksRepoVersion;
  const itemNoteRepoLinks: RepositoryLink[] = docId ? getLinksForId(docId) : [];
  const itemNoteAttachedLinks: RepositoryLink[] = itemNoteLinkIds
    .map((id) => itemNoteRepoLinks.find((l) => l.id === id))
    .filter((l): l is RepositoryLink => Boolean(l));
  /* ── Line-item attachments ─────────────────────────────────────────
     Bound to `lineItemAttachmentsStore` whenever the configurator has a
     parent order (`docId`) and a line (`lineId`). That store is shared
     with the SO Detail Attachments tab's Item Attachments folder, so a
     file added or deleted here shows up there and the other way round.

     Opened standalone (no parent order yet) there is nothing to bind to,
     so it falls back to a local list seeded from DEFAULT_ATTACHMENTS. */
  const orderKey = docId;
  const attachedLineId = lineId ?? item.id;
  const boundToStore = !!(orderKey && attachedLineId);
  const attachmentUploader = currentUser || 'You';

  const [storeAtts, setStoreAtts] = useState<LineItemAttachment[]>(
    () => (boundToStore ? getLineItemAttachments(orderKey!, attachedLineId) : []),
  );
  useEffect(() => {
    if (!boundToStore) return;
    setStoreAtts(getLineItemAttachments(orderKey!, attachedLineId));
    return subscribeLineItemAttachments(orderKey!, () =>
      setStoreAtts(getLineItemAttachments(orderKey!, attachedLineId)),
    );
  }, [boundToStore, orderKey, attachedLineId]);

  const [localAtts, setLocalAtts] = useState<LineItemAttachment[]>(() =>
    DEFAULT_ATTACHMENTS.map((a) => ({
      id: a.id, name: a.name, size: a.size, uploadedBy: a.uploadedBy,
      date: a.uploadedAt, fileKind: a.type as LineItemAttachment['fileKind'],
      previewUrl: a.preview, lineItemId: 'local',
    })),
  );
  const lineAttachments = boundToStore ? storeAtts : localAtts;

  const attachFile = (att: LineItemAttachment) => {
    if (boundToStore) { addLineItemAttachment(orderKey!, att); return; }
    setLocalAtts((prev) => [att, ...prev]);
  };
  const detachFile = (attId: string) => {
    if (boundToStore) { removeLineItemAttachment(orderKey!, attId); return; }
    setLocalAtts((prev) => prev.filter((a) => a.id !== attId));
  };
  const renameFile = (attId: string, name: string) => {
    if (boundToStore) { renameLineItemAttachment(orderKey!, attId, name); return; }
    setLocalAtts((prev) => prev.map((a) => (a.id === attId ? { ...a, name } : a)));
  };

  /* Which gallery entries already have a copy on this line item.
     Provenance only: the copy is a normal independent file from the
     moment it is added. */
  const copiedGalleryIds = lineAttachments
    .map((a) => a.galleryId)
    .filter((g): g is string => !!g);

  /* The two sub-tabs partition the item master's gallery, matching the
     Purchase Order configurator: once a file has been added to this line
     item it leaves the gallery view and lives in "Included in this
     order" instead, so it is never shown in both places at once.
     Deleting the copy puts it back in the gallery. */
  const availableGalleryMedia = GALLERY_MEDIA.filter((m) => !copiedGalleryIds.includes(m.id));

  /* Sub-tab inside the single Attachments tab, plus its search. Tabs sit
     above the search row so the search always reads as scoped to the tab
     under it. */
  const [attSubTab, setAttSubTab] = useState<'included' | 'gallery'>('included');
  /* Bulk selection, scoped to the active sub-tab. The two tabs take
     opposite actions (add from the gallery / remove from the line item),
     so a selection is cleared when the tab changes rather than carried
     across where its action would no longer make sense. */
  const [attSelected, setAttSelected] = useState<Set<string>>(new Set());
  const switchAttSubTab = (tab: 'included' | 'gallery') => {
    setAttSubTab(tab);
    setAttSelected(new Set());
  };
  const toggleAttSelected = (id: string) => {
    setAttSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearAttSelection = () => setAttSelected(new Set());
  /* Bulk remove is confirmed first, like every other destructive action
     in these modules. Single-file delete already routes through the
     AttachmentCard's own confirm dialog, so going straight through on a
     bulk remove would have made the larger action the easier one. */
  /* Which bulk action is being confirmed. Uploaded files are deleted and
     item master files are only removed from the line, so a mixed
     selection gets one action per kind, never one combined dialog. */
  const [showBulkRemoveConfirm, setShowBulkRemoveConfirm] = useState<false | 'delete' | 'remove'>(false);
  const [attSearch, setAttSearch] = useState('');
  /* Condensed / Comfort / Card, the same three views the record's own
     Attachments tab and the Purchase Order configurator offer, from the
     same `AttachmentViewToggle`. Card is the default here because this
     panel is mostly image and drawing files, where a thumbnail is the
     fastest way to recognise one; the list views are for scanning a long
     folder by name or date. The choice is shared across both sub-tabs, so
     switching tabs does not silently change how the files are drawn. */
  const [attViewMode, setAttViewMode] = useState<AttachmentViewMode>('card');
  const [attCardSize, setAttCardSize] = useState<AttachmentCardSize>('small');
  const attFileInputRef = useRef<HTMLInputElement | null>(null);

  const matchesAttSearch = (name: string, uploadedBy: string) => {
    const q = attSearch.trim().toLowerCase();
    if (!q) return true;
    return name.toLowerCase().includes(q) || uploadedBy.toLowerCase().includes(q);
  };
  const visibleLineAttachments = lineAttachments.filter((a) => matchesAttSearch(a.name, a.uploadedBy));
  const visibleGalleryMedia = availableGalleryMedia.filter((m) => matchesAttSearch(m.name, m.uploadedBy));

  /* In-flight uploads live here, NOT in the shared store: a half-sent
     file has no business showing up on the detail page's Item
     Attachments folder. Each one commits to the store only when its
     progress reaches 100. */
  const [uploadingFiles, setUploadingFiles] = useState<Array<{
    id: string; name: string; size: string; ext: string; progress: number;
  }>>([]);
  const cancelledUploads = useRef<Set<string>>(new Set());

  const handleAttachmentUpload = (files: FileList | null) => {
    if (!files || !files.length) return;
    const stamp = (() => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; })();
    const staged = Array.from(files).map((f, i) => {
      const ext = (f.name.split('.').pop() || 'pdf').toLowerCase();
      return {
        id: `att-${Date.now()}-${i}`,
        name: f.name,
        size: f.size >= 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`,
        ext,
        progress: 0,
        previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
      };
    });
    setUploadingFiles((prev) => [...staged.map(({ previewUrl: _p, ...rest }) => rest), ...prev]);

    /* Progress cadence copied from the Purchase Order module: a random
       1200-2400ms total, ticked every 120ms, so the ring animates at the
       same speed there and here. */
    staged.forEach((item) => {
      const total = 1200 + Math.random() * 1200;
      const start = Date.now();
      const tick = () => {
        if (cancelledUploads.current.has(item.id)) {
          cancelledUploads.current.delete(item.id);
          return;
        }
        const elapsed = Date.now() - start;
        const pct = Math.min(100, Math.round((elapsed / total) * 100));
        setUploadingFiles((prev) => prev.map((u) => (u.id === item.id ? { ...u, progress: pct } : u)));
        if (pct < 100) {
          setTimeout(tick, 120);
          return;
        }
        /* Done: hand the record to the store and drop the placeholder. */
        const known = ['pdf', 'xlsx', 'doc', 'cfg', 'png', 'jpg', 'csv', 'sheet', 'mp3', 'mp4', 'dxf', 'stl', 'dwg'];
        void known;
        attachFile({
          id: item.id,
          name: item.name,
          size: item.size,
          uploadedBy: attachmentUploader,
          fileKind: (['pdf','xlsx','doc','cfg','png','jpg','csv','sheet','mp3','mp4','dxf','stl','dwg'].includes(item.ext) ? item.ext : 'pdf') as LineItemAttachment['fileKind'],
          date: stamp,
          previewUrl: item.previewUrl,
          lineItemId: attachedLineId,
        });
        setUploadingFiles((prev) => prev.filter((u) => u.id !== item.id));
        toast.success(`"${item.name}" attached to this line item`);
      };
      setTimeout(tick, 120);
    });
  };

  const cancelUpload = (id: string) => {
    cancelledUploads.current.add(id);
    setUploadingFiles((prev) => prev.filter((u) => u.id !== id));
  };

  /* Adding a gallery file COPIES it onto the line as an ordinary
     attachment. We cannot keep a live link to the item master's gallery,
     so we do not pretend to: the copy is independent from this moment
     on, and later changes to the item master never reach it. */
  const addGalleryFile = (media: typeof GALLERY_MEDIA[number], opts?: { silent?: boolean }) => {
    attachFile({
      id: `att-gallery-${media.id}-${Date.now()}`,
      name: `${media.name}.${media.type === 'video' ? 'mp4' : 'jpg'}`,
      size: media.type === 'video' ? '48.2 MB' : '3.8 MB',
      uploadedBy: media.uploadedBy,
      date: media.uploadedAt,
      fileKind: media.type === 'video' ? 'mp4' : 'jpg',
      previewUrl: media.url,
      lineItemId: attachedLineId,
      galleryId: media.id,
    });
    if (!opts?.silent) toast.success(`"${media.name}" added as an attachment on this line item`);
  };
  /* Visible ids in the active tab, for the select-all affordance. */
  const attVisibleIds = attSubTab === 'included'
    ? visibleLineAttachments.map((a) => a.id)
    : visibleGalleryMedia.map((m) => m.id);
  const attAllVisibleSelected = attVisibleIds.length > 0 && attVisibleIds.every((id) => attSelected.has(id));
  const selectAllVisible = () => setAttSelected(new Set(attVisibleIds));

  const bulkAddSelectedGalleryFiles = () => {
    const picked = GALLERY_MEDIA.filter((m) => attSelected.has(m.id));
    picked.forEach((m) => addGalleryFile(m, { silent: true }));
    clearAttSelection();
    toast.success(`${picked.length} file${picked.length === 1 ? '' : 's'} added as attachments on this line item`);
  };

  /* A single file removed from a list row is confirmed the same way the
     card's own delete is, rather than going straight through because the
     row happens to have no dialog of its own. */
  const [pendingRemoveAtt, setPendingRemoveAtt] = useState<LineItemAttachment | null>(null);

  /* The card builds Preview / Download / Delete internally and takes the
     rest through `extraMenuItems`. A list row has no such internals, so
     the whole menu is built here and both views are handed the same
     actions in the same order. */
  const lineAttachmentMenuItems = (file: LineItemAttachment) => [
    {
      label: 'Preview',
      icon: <Eye size={13} style={{ color: 'var(--text-secondary)' }} />,
      onClick: () => toast.info(`Preview: ${file.name}`),
    },
    {
      label: 'Download',
      icon: <Download size={13} style={{ color: 'var(--text-secondary)' }} />,
      onClick: () => toast.info(`Downloading ${file.name}...`),
    },
    ...(readOnly ? [] : [
      /* No Rename on attachments. Item master files get a short Preview /
         Download / Remove menu with no separator; uploads keep the
         separator above Delete. */
      {
        /* A file that came from the item master reads as "Remove from
           Order": the master still has its own, and the card returns to
           the Item Master Gallery tab. An uploaded file exists only here,
           so that one really is a delete. */
        label: file.galleryId ? 'Remove from Order' : 'Delete',
        icon: <Trash2 size={13} style={{ color: 'var(--destructive)' }} />,
        danger: true,
        dividerBefore: !file.galleryId,
        onClick: () => setPendingRemoveAtt(file),
      },
    ]),
  ];

  const selectedUploaded = lineAttachments.filter((a) => attSelected.has(a.id) && !a.galleryId);
  const selectedFromMaster = lineAttachments.filter((a) => attSelected.has(a.id) && !!a.galleryId);
  const bulkRemoveSelectedAttachments = (kind: 'delete' | 'remove') => {
    const picked = kind === 'delete' ? selectedUploaded : selectedFromMaster;
    picked.forEach((a) => detachFile(a.id));
    setAttSelected((prev) => {
      const next = new Set(prev);
      picked.forEach((a) => next.delete(a.id));
      return next;
    });
    setShowBulkRemoveConfirm(false);
    const n = picked.length;
    toast.success(kind === 'delete'
      ? `${n} attachment${n === 1 ? '' : 's'} deleted`
      : `${n} file${n === 1 ? '' : 's'} removed from this line item`);
  };

  /* No removeGalleryFile: a card only appears in the gallery view while
     it has NO copy on this line item, so there is nothing to remove from
     there. Removal happens on the Included tab, which puts the card back
     in the gallery.
     */
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
  /* Per-product UoM set — liquid items surface Liter/Gallon/Drum,
     length items surface Foot/Yard/Roll, discrete items keep
     EA/Box/Carton/Pallet. */
  const productSet = getUomSetForProduct({ id: item.productId, name: item.name }).map((u) => ({ ...u, abbreviation: u.name }));
  const activeUomSet = productSet.length > 0 ? productSet : UNITS_OF_MEASURE;
  const selectedUom = activeUomSet.find(u => u.id === formData.uom)
    || activeUomSet.find(u => u.name.toLowerCase() === formData.uom)
    || findUomById(formData.uom)
    || activeUomSet[0];
  const productPrimaryUomId = getPrimaryUomForProduct({ id: item.productId, name: item.name });

  const parseDuration = (duration: string) => {
    const match = duration.match(/(\d+)-(\d+)/);
    if (match) return { min: parseInt(match[1]), max: parseInt(match[2]) };
    return { min: 3, max: 5 };
  };

  const calculateShipDateRange = () => {
    // Line-level explicit override (rare).
    if (formData.isShipDateOverride && formData.expectedShipDate) return { single: formData.expectedShipDate };
    // Shipment modal's Pick Up / Ship Date. For pickup methods the Pick Up
    // Date IS this line's Ship By, so it flows straight through here.
    const fromShipment = formData.shipmentConfig?.expectedShipDate;
    if (fromShipment) return { single: fromShipment };
    const today = new Date();
    const productionDays = selectedShipment?.productionDays || 2;
    const shipDate = new Date(today);
    shipDate.setDate(shipDate.getDate() + productionDays);
    return { single: shipDate.toISOString().split('T')[0] };
  };

  const calculateDeliveryDateRange = (): { single: string } | { min: string; max: string } => {
    if (formData.isDeliveryDateOverride && formData.estimatedDeliveryDate) return { single: formData.estimatedDeliveryDate };
    // Estimated Delivery pinned via the shipment modal.
    const sc = formData.shipmentConfig;
    if (sc?.estimatedDeliveryDate) {
      if (sc.estimatedDeliveryDateEnd && sc.estimatedDeliveryDateEnd !== sc.estimatedDeliveryDate) {
        return { min: sc.estimatedDeliveryDate, max: sc.estimatedDeliveryDateEnd };
      }
      return { single: sc.estimatedDeliveryDate };
    }
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
    .map(entry => {
      const rule = PRICING_RULES.find(r => r.id === entry.ruleId);
      if (!rule) return { id: entry.ruleId, name: '', amount: 0, percentage: 0, isApplied: entry.isApplied, unappliedReason: entry.unappliedReason };
      // Active = applied AND meets min quantity threshold. Calculations skip rules
      // where isApplied === false (unapplied stays in list but contributes 0).
      const meetsThreshold = formData.quantity >= rule.minQuantity;
      const isActive = entry.isApplied && meetsThreshold;
      return {
        id: rule.id,
        name: rule.name,
        amount: isActive ? (baseSubtotal * rule.discount / 100) : 0,
        percentage: rule.discount,
        isActive,
        isPending: entry.isApplied && !meetsThreshold,
        isApplied: entry.isApplied,
        unappliedReason: entry.unappliedReason,
        minQuantity: rule.minQuantity,
        basis: rule.basis,
        tierType: rule.tierType,
        totalTiers: rule.totalTiers,
        validFrom: rule.validFrom,
        validTo: rule.validTo,
        hasDateLimit: rule.hasDateLimit,
        scope: rule.scope,
        isPreset: rule.isPreset,
      };
    });
  const totalRulesDiscount = appliedRulesDiscounts.reduce((sum, r) => sum + r.amount, 0);
  const activeRulesCount = appliedRulesDiscounts.filter(r => r.isActive && r.name).length;
  const pendingRulesCount = appliedRulesDiscounts.filter(r => r.isApplied && !r.isActive && r.name).length;

  // Skip unapplied adjustments from totals; they stay in the list grayed out.
  const oneTimeTotal = formData.oneTimeAdjustments
    .filter(adj => adj.isApplied)
    .reduce((sum, adj) => {
      const amount = adj.amountType === '%' ? (baseSubtotal * adj.amount / 100) : adj.amount;
      return sum + (adj.type === 'discount' ? -amount : amount);
    }, 0);

  // Total active discount amount across pricing rules + one-time discounts
  // (premiums excluded). Used to enforce the 100%-of-line-price cap.
  const totalActiveDiscountAmount =
    appliedRulesDiscounts
      .filter(r => r.isActive && r.percentage > 0)
      .reduce((s, r) => s + r.amount, 0)
    + formData.oneTimeAdjustments
      .filter(adj => adj.isApplied && adj.type === 'discount')
      .reduce((s, adj) => s + (adj.amountType === '%' ? (baseSubtotal * adj.amount / 100) : adj.amount), 0);
  const discountCapHit = baseSubtotal > 0 && totalActiveDiscountAmount >= baseSubtotal;

  const afterDiscounts = baseSubtotal - totalRulesDiscount + oneTimeTotal;
  const selectedProvider = SHIPMENT_PROVIDERS[formData.shipmentMethod as keyof typeof SHIPMENT_PROVIDERS]?.find(p => p.id === formData.shipmentProvider);
  // Shipping fee intentionally excluded from total — spec is not finalised yet.
  const shippingCost = 0;
  const total = afterDiscounts;

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
        /* Snapshot the pre-edit adjustment so a discarded version
           prompt can restore the original values. */
        const editingId = editingAdjustmentId;
        const before = formData.oneTimeAdjustments.find(a => a.id === editingId);
        const beforeApiAdj = adjustmentsAPI?.adjustments.find(a => a.id === editingId);
        /* Edit path — when adjustmentsAPI is provided the edit goes
           through it (single source of truth); the local formData updates
           via the sync useEffect on the next render. */
        if (adjustmentsAPI) {
          adjustmentsAPI.updateAdjustment(editingId, {
            type: newAdjustment.type,
            amountType: newAdjustment.amountType,
            amount: newAdjustment.amount,
            label: newAdjustment.label,
          });
        } else {
          setFormData({
            ...formData,
            oneTimeAdjustments: formData.oneTimeAdjustments.map(adj =>
              adj.id === editingId ? { ...adj, ...newAdjustment, id: adj.id } : adj,
            ),
          });
        }
        onMaterialEvent?.(
          `Updated ${newAdjustment.type === 'premium' ? 'premium' : 'discount'} "${newAdjustment.label}" on line "${item.name}"`,
          () => {
            if (adjustmentsAPI && beforeApiAdj) {
              adjustmentsAPI.updateAdjustment(editingId, {
                label: beforeApiAdj.label,
                type: beforeApiAdj.type,
                amountType: beforeApiAdj.amountType,
                amount: beforeApiAdj.amount,
                internalNotes: (beforeApiAdj as any).internalNotes,
                attachments: (beforeApiAdj as any).attachments,
              });
            } else if (before) {
              setFormData(prev => ({
                ...prev,
                oneTimeAdjustments: prev.oneTimeAdjustments.map(adj =>
                  adj.id === editingId ? before : adj,
                ),
              }));
            }
          },
        );
      } else {
        // Cap check on add: if a new discount would push total past 100% of
        // line price, mark it auto-unapplied with EXCEEDS_100_PERCENT.
        const incremental =
          newAdjustment.type === 'discount'
            ? (newAdjustment.amountType === '%' ? baseSubtotal * newAdjustment.amount / 100 : newAdjustment.amount)
            : 0;
        const exceeds = wouldExceedCap(incremental);
        if (exceeds) toast.warning('Adjustment kept but unapplied — would exceed 100% of line price.');
        let createdId: string | null = null;
        let createdLocalId: string | null = null;
        if (adjustmentsAPI && lineId) {
          /* Push the new adjustment into the shared API as item-scope on
             this line. The sync useEffect mirrors it back into formData. */
          const created = adjustmentsAPI.addAdjustment({
            label: newAdjustment.label,
            type: newAdjustment.type,
            amountType: newAdjustment.amountType,
            amount: newAdjustment.amount,
            scope: 'item',
            appliedTo: [lineId],
          });
          if (exceeds) adjustmentsAPI.unapplyAdjustment(created.id, 'EXCEEDS_100_PERCENT');
          createdId = created.id;
        } else {
          createdLocalId = `adj-${Date.now()}`;
          setFormData({
            ...formData,
            oneTimeAdjustments: [
              ...formData.oneTimeAdjustments,
              {
                ...newAdjustment,
                id: createdLocalId,
                isApplied: !exceeds,
                unappliedReason: exceeds ? ('EXCEEDS_100_PERCENT' as const) : undefined,
              },
            ],
          });
        }
        onMaterialEvent?.(
          `Added ${newAdjustment.type === 'premium' ? 'premium' : 'discount'} "${newAdjustment.label}" on line "${item.name}"`,
          () => {
            /* Revert path — drop the just-added adjustment from
               wherever it landed (shared API or local formData). */
            if (adjustmentsAPI && createdId) {
              adjustmentsAPI.removeAdjustment(createdId);
            } else if (createdLocalId) {
              setFormData(prev => ({
                ...prev,
                oneTimeAdjustments: prev.oneTimeAdjustments.filter(a => a.id !== createdLocalId),
              }));
            }
          },
        );
      }
      setNewAdjustment({ type: 'discount', amountType: '%', amount: 0, label: '' });
      setEditingAdjustmentId(null);
      setShowAdjustmentForm(false);
      setShowAdjustmentModal(false);
    }
  };

  const reapplyAdjustment = (id: string) => {
    const target = formData.oneTimeAdjustments.find(a => a.id === id);
    if (!target) return;
    const incremental = target.type === 'discount'
      ? (target.amountType === '%' ? baseSubtotal * target.amount / 100 : target.amount)
      : 0;
    if (wouldExceedCap(incremental)) {
      toast.warning('Cannot re-apply — would exceed 100% of line price.');
      if (adjustmentsAPI) adjustmentsAPI.unapplyAdjustment(id, 'EXCEEDS_100_PERCENT');
      else setFormData(prev => ({
        ...prev,
        oneTimeAdjustments: prev.oneTimeAdjustments.map(a => a.id === id ? { ...a, isApplied: false, unappliedReason: 'EXCEEDS_100_PERCENT' as const } : a),
      }));
      return;
    }
    if (adjustmentsAPI) adjustmentsAPI.reapplyAdjustment(id);
    else setFormData(prev => ({
      ...prev,
      oneTimeAdjustments: prev.oneTimeAdjustments.map(a => a.id === id ? { ...a, isApplied: true, unappliedReason: undefined } : a),
    }));
    onMaterialEvent?.(
      `Reapplied ${target.type === 'premium' ? 'premium' : 'discount'} "${target.label}" on line "${item.name}"`,
      () => {
        /* Revert path — flip the adjustment back to unapplied. */
        if (adjustmentsAPI) {
          adjustmentsAPI.unapplyAdjustment(id, 'USER_UNAPPLIED');
        } else {
          setFormData(prev => ({
            ...prev,
            oneTimeAdjustments: prev.oneTimeAdjustments.map(a =>
              a.id === id ? { ...a, isApplied: false, unappliedReason: 'USER_UNAPPLIED' as const } : a,
            ),
          }));
        }
      },
    );
  };

  const editAdjustment = (adj: any) => {
    setNewAdjustment({ type: adj.type, amountType: adj.amountType, amount: adj.amount, label: adj.label });
    setEditingAdjustmentId(adj.id);
    setShowAdjustmentModal(true);
  };

  const removeAdjustment = (id: string) => {
    const target = formData.oneTimeAdjustments.find(adj => adj.id === id);
    const apiTarget = adjustmentsAPI?.adjustments.find(a => a.id === id);
    if (adjustmentsAPI) adjustmentsAPI.removeAdjustment(id);
    else setFormData({ ...formData, oneTimeAdjustments: formData.oneTimeAdjustments.filter(adj => adj.id !== id) });
    if (target) {
      onMaterialEvent?.(
        `Removed ${target.type === 'premium' ? 'premium' : 'discount'} "${target.label}" on line "${item.name}"`,
        () => {
          /* Revert path — re-insert the removed adjustment. The
             shared API keys off `id`, so re-adding with the same id
             restores the previous entry. */
          if (adjustmentsAPI && apiTarget) {
            adjustmentsAPI.addAdjustment({
              id: apiTarget.id,
              label: apiTarget.label,
              type: apiTarget.type,
              amountType: apiTarget.amountType,
              amount: apiTarget.amount,
              scope: apiTarget.scope,
              appliedTo: apiTarget.appliedTo,
              internalNotes: (apiTarget as any).internalNotes,
              attachments: (apiTarget as any).attachments,
            });
          } else if (target) {
            setFormData(prev => ({
              ...prev,
              oneTimeAdjustments: [...prev.oneTimeAdjustments, target],
            }));
          }
        },
      );
    }
  };

  // ── Unapply / Reapply confirmation state ──
  // Tracks the rule/adjustment the user wants to unapply, so we can show
  // ConfirmationModal before flipping isApplied → false. The reapply twin
  // confirms the opposite transition (false → true) when a user clicks
  // the Activate icon on a grayed-out user-deactivated row.
  /* Confirmation for removing a one-time adjustment. One-times are
     "applied / edit / remove" only (no deactivate cycle). */
  const [removeAdjConfirm, setRemoveAdjConfirm] = useState<{ id: string; label: string } | null>(null);

  /* Freight Override → first time only: parent provides
     `quoteDefaultFreight`, `siblingLineCount`, `anyOtherLineHasOverride`,
     and `onSeedSiblingFreightShares`. When the user clicks Override
     and the order is still in order-level mode (no sibling overrides
     yet), we show the same Partner-style split confirmation the
     freight breakdown modal uses, then seed every sibling with the
     even share and land this line on the same share. */
  const [freightSplitPrompt, setFreightSplitPrompt] = useState<null | {
    share: number;
    previewBase: number;
    previewRemainderCount: number;
  }>(null);
  const [freightSplitOverlayState, setFreightSplitOverlayState] = useState<null | { total: number; lineCount: number }>(null);

  const [unapplyConfirm, setUnapplyConfirm] = useState<
    | { kind: 'rule'; ruleId: string; name: string }
    | { kind: 'adjustment'; adjId: string; label: string }
    | null
  >(null);
  const [reapplyConfirm, setReapplyConfirm] = useState<
    | { kind: 'rule'; ruleId: string; name: string }
    | { kind: 'adjustment'; adjId: string; label: string }
    | null
  >(null);

  // Compute whether a given pricing rule, if applied/re-applied, would push
  // the line's total discount above 100% of base. Used to auto-unapply with
  // EXCEEDS_100_PERCENT and to disable the add affordance.
  const wouldExceedCap = (incrementalDiscountAmount: number) =>
    baseSubtotal > 0 && (totalActiveDiscountAmount + incrementalDiscountAmount) > baseSubtotal;

  const ruleDiscountAmount = (ruleId: string): number => {
    const rule = PRICING_RULES.find(r => r.id === ruleId);
    if (!rule || rule.discount <= 0) return 0;
    if (formData.quantity < rule.minQuantity) return 0;
    return baseSubtotal * rule.discount / 100;
  };

  // Apply or re-apply a rule by id. Existing entry → flip isApplied=true and
  // clear reason. New rule → push entry with isApplied=true. If applying it
  // would exceed the 100% cap (discount type only), auto-unapply with reason.
  const applyRuleEntry = (ruleId: string) => {
    const ruleName = PRICING_RULES.find(r => r.id === ruleId)?.name ?? ruleId;
    /* Snapshot pre-state so a discarded version prompt can restore
       both the local formData and the global deactivated flag. */
    const prevAppliedRules = formData.appliedRules;
    const wasGloballyDeactivated = !!(pricingAPI && pricingAPI.state.deactivatedRuleIds.has(ruleId));
    let didActivate = false;
    setFormData(prev => {
      const idx = prev.appliedRules.findIndex(e => e.ruleId === ruleId);
      const incremental = ruleDiscountAmount(ruleId);
      const exceeds = wouldExceedCap(incremental);
      const next = [...prev.appliedRules];
      const entry = {
        ruleId,
        isApplied: !exceeds,
        unappliedReason: exceeds ? ('EXCEEDS_100_PERCENT' as const) : undefined,
      };
      const prevEntry = idx >= 0 ? prev.appliedRules[idx] : undefined;
      didActivate = !exceeds && (!prevEntry || !prevEntry.isApplied);
      if (idx >= 0) next[idx] = entry;
      else next.push(entry);
      if (exceeds) toast.warning(`Rule kept but unapplied — would exceed 100% of line price.`);
      return { ...prev, appliedRules: next };
    });
    /* Cross-modal sync: propagate the activation to the shared API so
       the summary modal + SO subtotal reflect this immediately. */
    if (pricingAPI && lineId && didActivate) {
      if (wasGloballyDeactivated) pricingAPI.reactivateRule(ruleId);
      pricingAPI.setRuleActiveOnLines(ruleId, [lineId], true);
    }
    if (didActivate) {
      onMaterialEvent?.(
        `Activated pricing rule "${ruleName}" on line "${item.name}"`,
        () => {
          /* Revert path — undo both the API sync and the local
             formData mutation. */
          if (pricingAPI && lineId) {
            pricingAPI.setRuleActiveOnLines(ruleId, [lineId], false);
            if (wasGloballyDeactivated) pricingAPI.deactivateRule(ruleId);
          }
          setFormData(prev => ({ ...prev, appliedRules: prevAppliedRules }));
        },
      );
    }
  };

  const unapplyRuleEntry = (ruleId: string, reason: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT' = 'USER_UNAPPLIED') => {
    const ruleName = PRICING_RULES.find(r => r.id === ruleId)?.name ?? ruleId;
    const wasApplied = formData.appliedRules.find(e => e.ruleId === ruleId)?.isApplied;
    const prevAppliedRules = formData.appliedRules;
    setFormData(prev => ({
      ...prev,
      appliedRules: prev.appliedRules.map(e =>
        e.ruleId === ruleId ? { ...e, isApplied: false, unappliedReason: reason } : e,
      ),
    }));
    /* Cross-modal sync. */
    if (pricingAPI && lineId && reason === 'USER_UNAPPLIED' && wasApplied) {
      pricingAPI.setRuleActiveOnLines(ruleId, [lineId], false);
    }
    if (reason === 'USER_UNAPPLIED' && wasApplied) {
      onMaterialEvent?.(
        `Deactivated pricing rule "${ruleName}" on line "${item.name}"`,
        () => {
          if (pricingAPI && lineId) {
            pricingAPI.setRuleActiveOnLines(ruleId, [lineId], true);
          }
          setFormData(prev => ({ ...prev, appliedRules: prevAppliedRules }));
        },
      );
    }
  };

  // Old toggle kept for the library callback path; treats added IDs as "apply"
  // (with cap check) and removed IDs as "unapply" (preserves entry in list).
  const togglePricingRule = (ruleId: string) => {
    const existing = formData.appliedRules.find(e => e.ruleId === ruleId);
    if (existing && existing.isApplied) unapplyRuleEntry(ruleId, 'USER_UNAPPLIED');
    else applyRuleEntry(ruleId);
  };

  const opportunities = PRICING_RULES.filter(rule => {
    const entry = formData.appliedRules.find(e => e.ruleId === rule.id);
    const isNotApplied = !entry || !entry.isApplied;
    const isCloseToUnlocking = formData.quantity >= rule.minQuantity * 0.8 && formData.quantity < rule.minQuantity;
    return isNotApplied && isCloseToUnlocking && rule.minQuantity > 0;
  });

  // Inventory derived data.
  //
  // `selectedWarehouse?.stock` is a warehouse-level total, so falling
  // back to it would make every line item show the same number. Until
  // real per-item stock counts are wired in, drive `onHand` from a
  // hash of the line-item id so each item gets its own demo number.
  const onHand = demoOnHandFor(item.id);
  const reserved = (selectedWarehouse?.reserved ?? 0) > 0
    ? selectedWarehouse!.reserved
    : Math.max(1, Math.round(onHand * 0.12));
  const inProduction = (selectedWarehouse?.inProduction ?? 0) > 0
    ? selectedWarehouse!.inProduction
    : Math.max(1, Math.round(onHand * 0.06));
  const onOrder = (selectedWarehouse?.onOrder ?? 0) > 0
    ? selectedWarehouse!.onOrder
    : Math.max(1, Math.round(onHand * 0.35));
  const available = Math.max(0, onHand - reserved);
  const projectedAvailable = available + inProduction + onOrder;
  const quarantined = Math.max(1, Math.round(onHand * 0.015));
  const undergoingMovement = 0;
  const minQty = 100;
  const maxQty = Math.max(minQty * 2, Math.round(projectedAvailable * 1.1));

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
        /* Fixed height, not max-height. With only a cap the shell sized
           itself to whichever tab was open, so switching from Inventory
           Details (tall widgets) to Attachments or Activity Log resized
           the whole modal and shifted the footer under the cursor. Both
           panels already scroll internally, so pinning the shell costs
           nothing and keeps every tab the same size. */
        style={{ width: '92vw', maxWidth: '1340px', height: '90vh', maxHeight: '90vh', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-3 border-b border-[#E5E7EB] flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded bg-[#F3F4F6] flex items-center justify-center flex-shrink-0" style={{ borderRadius: '6px' }}>
              <Pencil className="w-4 h-4 text-[#6B7280]" />
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
                {/* Render the actual product code instead of hashing
                    the line-item id into a fake sequential "000-000-NNN"
                    that drifted from the row's real SKU. */}
                <p className="text-[11px] text-[#9CA3AF]">{item.productId || item.sku || generateItemId(item.id)}</p>
                {/* Inactive only in the header. The product card below
                    carries Active / Inactive in full. */}
                <InactiveItemPill code={item.productId || item.sku} size="md" />
                {item.isSerialized !== undefined && (
                  <ItemTypeBadge type={itemTypeLabel(item.isSerialized, item.isLotControlled)} />
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
                /* One Attachments tab. The old separate "Item Gallery"
                   tab is now a sub-tab inside it, because both are the
                   same job: getting a file onto this line item. */
                { id: 'attachments' as const, icon: Paperclip, label: 'Attachments', count: lineAttachments.length as number | null },
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

                  {/* Stock Health + Inventory Trend + On-Hand by UOM —
                      three Physical Inventory widgets ported verbatim. Each
                      widget is wrapped in the same card chrome the rest of
                      the inventory tab uses. */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, alignItems: 'start' }}>
                    <div className="group/widget border border-[#E5E7EB] bg-white transition-all duration-200 ease-out hover:border-[#90C2FF]" style={{ borderRadius: 12, padding: 16, minHeight: 380 }}>
                      <StockHealthWidget
                        onHand={onHand}
                        minQty={minQty}
                        maxQty={maxQty}
                        available={available}
                        reserved={reserved}
                        onOrder={onOrder}
                        quarantined={quarantined}
                        inProduction={inProduction}
                        projectedAvailable={projectedAvailable}
                      />
                    </div>
                    <div className="group/widget border border-[#E5E7EB] bg-white transition-all duration-200 ease-out hover:border-[#90C2FF]" style={{ borderRadius: 12, padding: 16, minHeight: 380 }}>
                      <InventoryTrendWidget onHand={onHand} />
                    </div>
                    <div className="group/widget border border-[#E5E7EB] bg-white transition-all duration-200 ease-out hover:border-[#90C2FF]" style={{ borderRadius: 12, padding: 16, minHeight: 380 }}>
                      <OnHandByUomWidget
                        data={uomBreakdown.map((u) => ({
                          unit: u.multiplier === 1 ? `Each (${u.abbreviation})` : `${u.name} (${u.multiplier} EA)`,
                          qty: u.qty,
                          converted: u.eaEquiv,
                          color: u.color,
                        }))}
                      />
                    </div>
                  </div>

                </div>
              )}

              {/* ===== ATTACHMENTS TAB ===== */}
              {/* ===== ATTACHMENTS TAB =====
                   One tab, two sub-tabs. Structure, top to bottom:
                     1. sub-tabs   (which set of files am I looking at)
                     2. search + Upload  (acts on the set chosen above)
                     3. card grid
                   Tabs sit above the search row so the search always
                   reads as scoped to the tab under it, and Upload only
                   renders on "Included in this Order" so it can never
                   look like a way to add files to the item master. */}
              {leftTab === 'attachments' && (
                <div className="flex flex-col">
                  {/* A selection takes over the whole header rather than
                      swapping one cluster inside it, which is what the
                      Purchase Order configurator does. While files are
                      picked, the sub-tab toggle, Upload, the search and
                      the view selector all step aside for one bar: the
                      only things worth doing mid-selection are acting on
                      the selection or leaving it. The bar keeps the row's
                      padding and bottom rule, so nothing below it moves
                      as it comes and goes. */}
                  {attSelected.size === 0 ? (
                  <>
                  {/* ── 1. Sub-tab toggle (left) + Upload (right) ──
                       Position: the toggle is top-LEFT, the action is
                       top-RIGHT. The toggle chooses which set of files
                       the whole panel shows, so it belongs first in
                       reading order, ahead of the search that filters
                       that set and the grid that renders it. Partners
                       does the same: content-set controls lead and the
                       right edge carries the action (its Attachments tab
                       puts Upload there). Pairing the toggle with Upload
                       on one row also stops the toggle sitting alone on a
                       row of its own.
                       A segmented toggle, not a second underline tab
                       strip: an underline strip directly below the
                       modal's own underline tabs reads as two competing
                       levels of the same thing. Same control the
                       Shipments tab uses for "By Shipments / By Line
                       Items" (Partners idiom: muted track, white raised
                       active pill, count badge), which is the same job
                       of switching between two sets of the same list. */}
                  <div className="flex items-center px-5 pt-4 pb-3 shrink-0" style={{ gap: 12 }}>
                    <div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
                      {([
                        { key: 'included' as const, label: 'Included in this Order', count: lineAttachments.length },
                        { key: 'gallery' as const, label: 'Item Master Gallery', count: availableGalleryMedia.length },
                      ]).map((opt) => {
                        const active = attSubTab === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => switchAttSubTab(opt.key)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] transition-all cursor-pointer ${
                              active
                                ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-foreground'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                            style={{ fontWeight: active ? 600 : 500 }}
                          >
                            {opt.label}
                            <span
                              className={`text-[10px] rounded-full px-1.5 py-px min-w-[16px] text-center ${
                                active ? 'bg-accent text-primary' : 'bg-border text-slate-500'
                              }`}
                              style={{ fontWeight: 600 }}
                            >
                              {opt.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Upload lives only on the Included tab. On the
                        gallery tab there is nothing to upload to: those
                        files belong to the item master, and offering
                        Upload there would imply otherwise. */}
                    {attSubTab === 'included' && !readOnly && (
                      <>
                        <button
                          onClick={() => attFileInputRef.current?.click()}
                          className="ml-auto inline-flex items-center justify-center h-9 gap-1.5 px-3.5 rounded-lg bg-primary text-white shadow-sm hover:bg-primary/90 transition-colors cursor-pointer text-[13px] shrink-0"
                          style={{ fontWeight: 500 }}
                        >
                          <Upload className="w-4 h-4" />
                          Upload
                        </button>
                        <input
                          ref={attFileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => { handleAttachmentUpload(e.target.files); e.target.value = ''; }}
                        />
                      </>
                    )}
                  </div>

                  {/* ── 2. Toolbar: search + right-hand cluster ──
                       Bulk actions follow Partners' member-table toolbar
                       (CreatePartnerGroupModal's `bulkRemoveMode` /
                       `onBulkSetPrimary` cluster), which is how Partners
                       does bulk actions in its listings and pickers:

                         · the search stays put; only the right-hand
                           cluster swaps in, so the row never disappears
                           under the user
                         · the count is a neutral phrase with just the
                           NUMBER bolded, not a coloured phrase
                         · actions are soft tone-tinted pills with a
                           border (h-8, 11.5px, 12px icon), never solid
                           filled buttons
                         · destructive actions sit left of the cluster and
                           the additive one last, matching Partners'
                           anchored ordering

                       Labels name the object ("Remove 2 files"), the way
                       Partners' do ("Unlink 3 partners"), rather than
                       repeating the destination: every control in this
                       panel already acts on this one line item, so "to /
                       from this line item" was words the row could not
                       afford. Select all drops its total for the same
                       reason, the tab badge already carries it.

                       Partners puts select-all in a table header
                       checkbox; a card grid has no header row, so that
                       checkbox moves into this cluster. */}
                  {/* flex-wrap is the floor, not the plan: the cluster is
                      narrow enough to sit beside the search on every real
                      viewport, but on a very narrow one the row drops to a
                      second line instead of overlapping. */}
                  <div className="flex items-center flex-wrap px-5 pb-3 border-b border-muted shrink-0" style={{ gap: 12, rowGap: 8 }}>
                    {/* Upload moved up to the toggle row so this row has
                        the width for the scoped placeholder. minWidth
                        stops the input collapsing to an ellipsis when the
                        bulk cluster appears beside it. */}
                    <div className="relative flex-1" style={{ maxWidth: 340, minWidth: 130 }}>
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
                      <input
                        type="text"
                        /* Name the actual scope on each side. A bare
                           "Search attachments" left the reader to guess
                           whether it searched this line, the whole
                           order, or the item master. */
                        placeholder={attSubTab === 'gallery' ? 'Search item master attachments...' : "Search this line item's attachments..."}
                        value={attSearch}
                        onChange={(e) => setAttSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-8 rounded-lg border border-border bg-white text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-colors"
                      />
                      {attSearch && (
                        <button
                          onClick={() => setAttSearch('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* No file count here. The sub-tab badge above already
                        carries it for both sets, and a second number on
                        the row beneath it only invited the reader to
                        check whether the two agreed.

                        The view selector stays on this row rather than
                        moving up beside Upload: it describes the list
                        under it, where Upload adds to it. */}
                    <div className="ml-auto flex items-center shrink-0">
                      <AttachmentViewToggle
                        size="md"
                        value={attViewMode}
                        onChange={setAttViewMode}
                        cardSize={attCardSize}
                        onCardSizeChange={setAttCardSize}
                      />
                    </div>
                  </div>
                  </>
                  ) : (
                    /* ── Selection bar, in place of the header ──
                       Reading order is the order the actions are needed:
                       widen or narrow the selection, see how many it
                       holds, act on it. Clearing is the way out, so it
                       sits at the far end of the row rather than inside
                       that run. The divider is what keeps the count from
                       reading as another button.

                       Labels name the files, not the destination
                       ("Remove 2 files"): every control in this panel
                       already acts on this one line item, so repeating
                       "to this order" on the button would be words the
                       row cannot afford. */
                    <div className="flex items-center flex-wrap px-5 pt-4 pb-3 border-b border-muted shrink-0" style={{ gap: 10, rowGap: 8 }}>
                      {/* Acts on what the search currently shows, not on
                          the whole folder, so a filtered select-all
                          cannot pick up files the reader cannot see. */}
                      <button
                        type="button"
                        onClick={() => (attAllVisibleSelected ? clearAttSelection() : selectAllVisible())}
                        className="inline-flex items-center h-8 px-2.5 rounded-lg border border-border bg-white text-slate-600 text-[11.5px] hover:bg-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
                        style={{ fontWeight: 500 }}
                      >
                        {attAllVisibleSelected ? 'Unselect all' : 'Select all'}
                      </button>
                      <span className="text-[11.5px] tabular-nums text-primary shrink-0" style={{ fontWeight: 500 }}>
                        {attSelected.size} selected
                      </span>
                      <span className="h-4 w-px bg-border shrink-0" aria-hidden />
                      {attSubTab === 'gallery' ? (
                        <button
                          type="button"
                          onClick={bulkAddSelectedGalleryFiles}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-blue-100 bg-accent text-primary text-[11.5px] hover:bg-blue-100 transition-colors cursor-pointer shrink-0"
                          style={{ fontWeight: 600 }}
                        >
                          <Plus className="w-3 h-3" />
                          Add {attSelected.size} file{attSelected.size === 1 ? '' : 's'}
                        </button>
                      ) : (
                        <>
                          {selectedFromMaster.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowBulkRemoveConfirm('remove')}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-[11.5px] hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer shrink-0"
                              style={{ fontWeight: 600 }}
                            >
                              <XCircle className="w-3 h-3" />
                              Remove {selectedFromMaster.length} from Order
                            </button>
                          )}
                          {selectedUploaded.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowBulkRemoveConfirm('delete')}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-[11.5px] hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer shrink-0"
                              style={{ fontWeight: 600 }}
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete {selectedUploaded.length}
                            </button>
                          )}
                        </>
                      )}
                      {/* Ghost, not a button: leaving the selection is a
                          way out of this bar, not one of its actions. */}
                      <button
                        type="button"
                        onClick={clearAttSelection}
                        className="ml-auto inline-flex items-center gap-1.5 h-8 px-1.5 rounded-md text-slate-500 text-[11.5px] hover:text-foreground transition-colors cursor-pointer shrink-0"
                        style={{ fontWeight: 500 }}
                      >
                        <X className="w-3.5 h-3.5" />
                        Clear selection
                      </button>
                    </div>
                  )}


                  {/* ── 3. Card grid ── */}
                  <div className="p-5">
                    {attSubTab === 'included' ? (
                      visibleLineAttachments.length === 0 && uploadingFiles.length === 0 ? (
                        <EmptyPlaceholder
                          block
                          icon={Paperclip}
                          title={attSearch ? 'No matching attachments' : 'No attachments on this line item'}
                          description={
                            attSearch
                              ? 'Try a different search term.'
                              : 'Upload a file, or add one from the item master.'
                          }
                        />
                      ) : attViewMode !== 'card' ? (
                        /* ── List views (Condensed / Comfort) ──
                           The same files as one row each, with the size,
                           date and uploader that a card only shows on its
                           face in the largest size. Rows carry the same
                           three-dot actions the card does, built from the
                           same array, so switching view never changes what
                           a file can do. */
                        <div className="rounded-lg border border-border overflow-hidden">
                          <AttachmentListHeader selectable={!readOnly} />
                          {uploadingFiles.map((u) => (
                            <div
                              key={u.id}
                              className="flex items-center"
                              style={{
                                padding: attViewMode === 'condensed' ? '7px 12px' : '12px 12px',
                                borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)',
                                gap: 10,
                              }}
                            >
                              {!readOnly && <span className="shrink-0" style={{ width: 26 }} />}
                              <span className="truncate text-[13px] text-muted-foreground" style={{ flex: 1, minWidth: 0 }}>
                                {u.name}
                              </span>
                              <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground" style={{ width: 74 }}>
                                {u.progress}%
                              </span>
                              <div className="shrink-0 rounded-full bg-muted overflow-hidden" style={{ width: 90, height: 4 }}>
                                <div className="h-full bg-primary transition-all" style={{ width: `${u.progress}%` }} />
                              </div>
                            </div>
                          ))}
                          {visibleLineAttachments.map((file) => (
                            <AttachmentListRow
                              key={file.id}
                              density={attViewMode === 'condensed' ? 'condensed' : 'comfort'}
                              name={file.name}
                              /* SO's `LineItemAttachment` names these
                                 `fileKind` and `date`, the same fields the
                                 card is handed just above. */
                              type={file.fileKind}
                              size={file.size}
                              date={file.date || ''}
                              uploadedBy={file.uploadedBy || 'You'}
                              previewUrl={file.previewUrl ?? null}
                              onClick={() => toast.info(`Preview: ${file.name}`)}
                              selection={readOnly ? undefined : {
                                checked: attSelected.has(file.id),
                                onToggle: () => toggleAttSelected(file.id),
                                node: (
                                  <Checkbox
                                    checked={attSelected.has(file.id)}
                                    onCheckedChange={() => toggleAttSelected(file.id)}
                                    aria-label={`Select ${file.name}`}
                                  />
                                ),
                              }}
                              pills={file.galleryId ? (
                                <span
                                  className="inline-flex items-center shrink-0"
                                  style={{ padding: '1px 6px', borderRadius: 9999, background: 'var(--accent)', border: '1px solid var(--primary-200)', color: 'var(--accent-foreground)', fontWeight: 500, fontSize: 9, gap: 3, whiteSpace: 'nowrap' }}
                                  title="Copied from the item master gallery. This copy belongs to the order and is not affected by later changes to the gallery."
                                >
                                  <Images className="w-2.5 h-2.5" /> From Item Master
                                </span>
                              ) : undefined}
                              menuItems={lineAttachmentMenuItems(file)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: ATTACHMENT_CARD_COLUMNS[attCardSize], gap: 12 }}>
                          {/* In-flight uploads lead the grid, so a new file
                              appears where the user will look for it. */}
                          {uploadingFiles.map((u) => (
                            <AttachmentUploadingCard
                              key={u.id}
                              fileName={u.name}
                              fileSize={u.size}
                              ext={u.ext}
                              progress={u.progress}
                              onCancel={() => cancelUpload(u.id)}
                              thumbHeight={ATTACHMENT_CARD_THUMB[attCardSize]}
                            />
                          ))}
                          {visibleLineAttachments.map((file) => (
                            <AttachmentCard
                              key={file.id}
                              compact
                              /* Thumbnail grows with the chosen card size,
                                 as it does in PO. Without this the columns
                                 widened at Large while every image stayed
                                 short, which read as a layout bug. */
                              thumbHeight={ATTACHMENT_CARD_THUMB[attCardSize]}
                              selection={readOnly ? undefined : {
                                checked: attSelected.has(file.id),
                                onToggle: () => toggleAttSelected(file.id),
                              }}
                              att={{
                                fileName: file.name,
                                fileType: file.fileKind,
                                fileSize: file.size,
                                uploadedDate: file.date || '',
                                uploadedTime: '',
                                uploadedBy: file.uploadedBy || 'You',
                                previewUrl: file.previewUrl ?? null,
                              }}
                              /* Provenance pill only. The copy is a normal
                                 independent file, so the tooltip says so
                                 rather than implying a live link. */
                              pills={file.galleryId ? (
                                <span
                                  className="inline-flex items-center"
                                  style={{ padding: '1px 6px', borderRadius: 9999, background: 'var(--accent)', border: '1px solid var(--primary-200)', color: 'var(--accent-foreground)', fontWeight: 500, fontSize: 9, gap: 3, whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}
                                  title="Copied from the item master gallery. This copy belongs to the order and is not affected by later changes to the gallery."
                                >
                                  <Images className="w-2.5 h-2.5" /> From Item Master
                                </span>
                              ) : undefined}
                              onPreview={() => toast.info(`Preview: ${file.name}`)}
                              onDownload={() => toast.info(`Downloading ${file.name}...`)}
                              onCardClick={() => toast.info(`Preview: ${file.name}`)}
                              /* Deleting here deletes the file from the
                                 order, so it also leaves the Attachments
                                 tab's Item Attachments folder. */
                              /* A file that came from the item master reads
                                 as "Remove from Order", not "Delete": the
                                 master still has it and the card returns to
                                 the Item Master Gallery tab. An uploaded
                                 file exists only here, so that one really is
                                 a delete. Same split the Purchase Order
                                 configurator makes with "Remove from PO". */
                              removeScopeLabel={file.galleryId ? 'Order' : undefined}
                              onDelete={readOnly ? undefined : () => {
                                detachFile(file.id);
                                toast.success(file.galleryId
                                  ? `"${file.name}" removed from this order`
                                  : `"${file.name}" deleted`);
                              }}
                              /* No Rename on attachments. Item master files:
                                 Preview, Download and Remove with no
                                 separator; uploads keep it above Delete. */
                              deleteDivider={!file.galleryId}
                            />
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        {/* No standing notice above the gallery. What the
                            add does is already said where it is done: the
                            menu item reads "Copy to this line item", the
                            copy arrives with a "From Item Master" pill,
                            and that pill's tooltip spells out that the
                            copy is the order's and the gallery's own file
                            is not affected. A banner repeating it on
                            every visit was a permanent cost for a
                            one-time explanation. */}
                        {visibleGalleryMedia.length === 0 ? (
                          <EmptyPlaceholder
                            block
                            icon={Images}
                            title={
                              attSearch
                                ? 'No matching files'
                                : availableGalleryMedia.length === 0 && GALLERY_MEDIA.length > 0
                                  ? 'Every item master file is already attached'
                                  : 'No files in the item master gallery'
                            }
                            description={
                              attSearch
                                ? 'Try a different search term.'
                                : availableGalleryMedia.length === 0 && GALLERY_MEDIA.length > 0
                                  ? 'All of them are on this line item already.'
                                  : 'This item has no gallery files to add.'
                            }
                          />
                        ) : attViewMode !== 'card' ? (
                          <div className="rounded-lg border border-border overflow-hidden">
                            <AttachmentListHeader selectable={!readOnly} />
                            {visibleGalleryMedia.map((media) => (
                              <AttachmentListRow
                                key={media.id}
                                density={attViewMode === 'condensed' ? 'condensed' : 'comfort'}
                                name={media.name}
                                type={media.type === 'video' ? 'mp4' : 'jpg'}
                                date={media.uploadedAt}
                                uploadedBy={media.uploadedBy}
                                previewUrl={media.url}
                                onClick={() => toast.info(`Preview: ${media.name}`)}
                                selection={readOnly ? undefined : {
                                  checked: attSelected.has(media.id),
                                  onToggle: () => toggleAttSelected(media.id),
                                  node: (
                                    <Checkbox
                                      checked={attSelected.has(media.id)}
                                      onCheckedChange={() => toggleAttSelected(media.id)}
                                      aria-label={`Select ${media.name}`}
                                    />
                                  ),
                                }}
                                menuItems={[
                                  {
                                    label: 'Preview',
                                    icon: <Eye size={13} style={{ color: 'var(--text-secondary)' }} />,
                                    onClick: () => toast.info(`Preview: ${media.name}`),
                                  },
                                  {
                                    label: 'Download',
                                    icon: <Download size={13} style={{ color: 'var(--text-secondary)' }} />,
                                    onClick: () => toast.info(`Downloading ${media.name}...`),
                                  },
                                  ...(readOnly ? [] : [{
                                    label: 'Copy to this line item',
                                    icon: <Plus size={13} style={{ color: 'var(--text-secondary)' }} />,
                                    onClick: () => addGalleryFile(media),
                                    dividerBefore: true,
                                  }]),
                                ]}
                              />
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: ATTACHMENT_CARD_COLUMNS[attCardSize], gap: 12 }}>
                            {visibleGalleryMedia.map((media) => (
                                <AttachmentCard
                                  key={media.id}
                                  compact
                                  thumbHeight={ATTACHMENT_CARD_THUMB[attCardSize]}
                                  selection={readOnly ? undefined : {
                                    checked: attSelected.has(media.id),
                                    onToggle: () => toggleAttSelected(media.id),
                                  }}
                                  att={{
                                    fileName: media.name,
                                    fileType: media.type === 'video' ? 'mp4' : 'jpg',
                                    fileSize: '',
                                    uploadedDate: media.uploadedAt,
                                    uploadedTime: '',
                                    uploadedBy: media.uploadedBy,
                                    previewUrl: media.url,
                                  }}
                                  /* No "Added" pill: an added file leaves this
                                     view entirely, so a card here is always
                                     un-added and the pill could never show. */
                                  onPreview={() => toast.info(`Preview: ${media.name}`)}
                                  onDownload={() => toast.info(`Downloading ${media.name}...`)}
                                  onCardClick={() => toast.info(`Preview: ${media.name}`)}
                                  extraMenuItems={readOnly ? undefined : [
                                    { label: 'Copy to this line item', icon: <Plus size={13} style={{ color: 'var(--text-secondary)' }} />, onClick: () => addGalleryFile(media), dividerBefore: true },
                                  ]}
                                />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}


              {leftTab === 'activity_log' && (
                <div style={{ padding: 16 }}>
                  <ComingSoonBanner
                    title="Activity log"
                    message="Item-level change history, pricing adjustments, and configuration edits will appear here."
                  />
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
              <div className="border border-[#E5E7EB] bg-white p-4" style={{ borderRadius: '12px' }}>
                <div className="flex gap-3">
                  {/* Thumbnail — clicking opens the ItemQuickView peek
                      (matches the line-items table behavior). The Parts/Build
                      pill that previously overlapped the thumbnail has been
                      removed per design parity request. */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openItemQuickView({
                        code: item.productId || item.sku || generateItemId(item.id),
                        description: item.description,
                        images: item.images,
                        statusLabel: item.sourceType,
                        primaryTag: item.isLotControlled
                          ? (item.isSerialized ? 'Lot Serialized' : 'Lot Non-Serialized')
                          : (item.isSerialized ? 'Serialized' : 'Non-Serialized'),
                        material: item.sourceType,
                        uom: 'EA',
                      });
                    }}
                    aria-label={`Preview ${item.name}`}
                    className="relative flex-shrink-0 cursor-pointer transition-all"
                    style={{
                      width: 72, height: 72, padding: 0,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(27, 110, 243, 0.45)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(27, 110, 243, 0.10)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {item.images && item.images.length > 0 ? (
                      <ImageWithFallback src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#F3F4F6] flex items-center justify-center">
                        <Package className="w-6 h-6 text-[#9CA3AF]" />
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[14px] text-[#1F2937]" style={{ fontWeight: 600 }}>{item.productId || item.sku || generateItemId(item.id)}</span>
                      {/* Item-master status straight after the code, where
                          PO's Item Detail puts it. Active or Inactive. */}
                      <InactiveItemPill code={item.productId || item.sku} size="md" showActive />
                      {/* Purchased / Manufactured pill — Physical Inventory
                          AcquisitionBadge chrome (rounded-md, 13px / weight 500). */}
                      <span
                        className="inline-flex items-center border shrink-0 whitespace-nowrap"
                        style={{
                          background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE',
                          padding: '2px 8px', borderRadius: 6, fontSize: 13, fontWeight: 500, lineHeight: 'normal',
                        }}
                      >Purchased</span>
                      <ItemTypeBadge type={itemTypeLabel(item.isSerialized, item.isLotControlled)} />
                    </div>
                    {isDescriptionExpanded ? (
                      <p className="text-[12px] text-[#6B7280] mb-1.5" style={{ fontWeight: 400, lineHeight: '1.5' }}>
                        {item.description}{' '}
                        <button onClick={() => setIsDescriptionExpanded(false)} className="hover:opacity-80 transition-colors text-[12px] inline-flex items-center" style={{ fontWeight: 500, gap: 3, verticalAlign: 'middle', color: '#0F62D6' }}>less <ChevronsUp style={{ width: 12, height: 12 }} /></button>
                      </p>
                    ) : (
                      <p className="text-[12px] text-[#6B7280] mb-1.5" style={{ fontWeight: 400, lineHeight: '1.5' }}>
                        {item.description.length > 120 ? (
                          <>{item.description.slice(0, 120)}…{' '}<button onClick={() => setIsDescriptionExpanded(true)} className="hover:opacity-80 transition-colors text-[12px] inline-flex items-center" style={{ fontWeight: 500, gap: 3, verticalAlign: 'middle', color: '#0F62D6' }}>more <ChevronsDown style={{ width: 12, height: 12 }} /></button></>
                        ) : item.description}
                      </p>
                    )}
                    {/* Pill row removed — the same Purchased/Serialized
                        pills are already rendered up by the SKU in the
                        header row above. Re-rendering them under the
                        description was the duplicate the user flagged. */}
                  </div>
                </div>
              </div>

              {/* Quantity, Unit & Price Per Unit Card */}
              <div className="border border-[#E5E7EB] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ borderRadius: '12px', overflow: 'visible' }}>
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
                      <div className="fixed bg-white border border-[#E5E7EB] shadow-lg" style={{ borderRadius: '12px', zIndex: 12000, top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px`, minWidth: '220px', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)' }}>
                        {activeUomSet.map((uom) => {
                          const isActive = formData.uom === uom.id;
                          const isPrimary = uom.id === productPrimaryUomId;
                          return (
                            <button
                              type="button"
                              key={uom.id}
                              onClick={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                if (uom.id !== formData.uom) {
                                  const oldMult = activeUomSet.find(u => u.id === formData.uom)?.multiplier ?? 1;
                                  const newMult = uom.multiplier;
                                  const scale = newMult / oldMult;
                                  const scaledUnitPrice = Math.round((formData.unitPrice || 0) * scale * 100) / 100;
                                  setFormData({ ...formData, uom: uom.id, unitPrice: scaledUnitPrice });
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
                                  {isPrimary && (
                                    /* Partner Management "Primary" pill —
                                        surfaces the product's preferred UoM
                                        consistently across every dropdown. */
                                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '9px', fontWeight: 600, color: '#1B6EF3', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1px 5px', borderRadius: '3px', lineHeight: '1', textTransform: 'uppercase' as const, letterSpacing: '0.2px' }}>Primary</span>
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
              <div className="border border-[#E5E7EB] bg-white" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                {hasAppliedRules ? (
                  <div>
                    {/* Header — Partner ContentCard chrome (icon
                        chip in accent circle + 13px/600 title). */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#EEF2F6]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                          <BadgePercent className="w-3.5 h-3.5 text-[#1B6EF3]" />
                        </div>
                        <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>
                          Pricing Rules
                        </span>
                        {activeRulesCount > 0 && (
                          <span className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap" style={{ fontWeight: 500, color: '#065F46', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>{activeRulesCount} active</span>
                        )}
                        {/* (i) tooltip — explains what pricing rules are
                            and how they differ from one-time adjustments
                            (which are ad-hoc, single-order edits). */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="About pricing rules"
                              className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-help shrink-0"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start" className="max-w-[320px] text-[11.5px] leading-[1.55] z-[12700]">
                            Pricing rules are reusable conditional rules defined on the customer record. The system applies them to a line item automatically whenever the line meets the rule&apos;s conditions, such as a quantity tier, item category, or contract term, so the same discount or premium is consistent across every quote and sales order for that customer.
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-2">
                        {totalRulesDiscount !== 0 && (
                          <span className={`text-[13px] ${totalRulesDiscount > 0 ? 'text-[#10B981]' : 'text-[#7C3AED]'}`} style={{ fontWeight: 600 }}>
                            {totalRulesDiscount > 0 ? '-' : '+'}{formatCurrency(Math.abs(totalRulesDiscount))}
                          </span>
                        )}
                        {!readOnly && hasAppliedRules && (
                          /* Master toggle — flips every rule on this
                             line. ON = at least one is active. Off
                             goes through the existing confirmation;
                             on reapplies every deactivated rule. */
                          <Switch
                            checked={activeRulesCount > 0}
                            onCheckedChange={(on) => {
                              if (!on) {
                                setShowDeleteAllRulesConfirm(true);
                              } else {
                                /* Snapshot pre-toggle state so a discarded
                                   version prompt can restore the per-line
                                   rule list verbatim. */
                                const prevAppliedRules = formData.appliedRules;
                                setFormData(prev => ({
                                  ...prev,
                                  appliedRules: prev.appliedRules.map(e => ({ ...e, isApplied: true, unappliedReason: undefined })),
                                }));
                                toast.success('All pricing rules reactivated');
                                onMaterialEvent?.(
                                  `Reactivated all pricing rules on line "${item.name}"`,
                                  () => setFormData(prev => ({ ...prev, appliedRules: prevAppliedRules })),
                                );
                              }
                            }}
                            aria-label={activeRulesCount > 0 ? 'Deactivate all rules' : 'Reactivate all rules'}
                            title={activeRulesCount > 0 ? 'Deactivate all rules' : 'Reactivate all rules'}
                          />
                        )}
                      </div>
                    </div>
                    {/* Rule bars — show fully-active rules AND rules the
                        user has manually deactivated (so they can reactivate
                        from here). Rules that auto-unapplied (EXCEEDS_100_PERCENT)
                        or never met their threshold (!isActive) stay hidden. */}
                    {appliedRulesDiscounts.filter(rule => rule.name && (
                      (rule.isApplied && rule.isActive) ||
                      (!rule.isApplied && rule.unappliedReason === 'USER_UNAPPLIED')
                    )).map((rule, index) => {
                      const isPremium = rule.percentage < 0;
                      const isUnapplied = !rule.isApplied;
                      /* "Disabled" treatment — both Unapplied and Not Applied
                       * render with a soft gray neutral; the pill differentiates them. */
                      const isDisabled = isUnapplied || !rule.isActive;
                      // Grayed-out treatment for unapplied rules: muted text/icon/borders.
                      // Pending (threshold not met) keeps its red affordance to nudge user.
                      const leftBorderColor = isDisabled ? '#E5E7EB' : (isPremium ? '#7C3AED' : '#10B981');
                      const iconColor = isDisabled ? 'text-[#9CA3AF]' : (isPremium ? 'text-[#7C3AED]' : 'text-[#10B981]');
                      const percentageColor = iconColor;
                      const amountColor = iconColor;
                      const filteredRules = appliedRulesDiscounts.filter(r => r.name && (
                        (r.isApplied && r.isActive) ||
                        (!r.isApplied && r.unappliedReason === 'USER_UNAPPLIED')
                      ));
                      const isLast = index === filteredRules.length - 1;

                      // Validity calc
                      const validToDate = rule.validTo ? new Date(rule.validTo) : null;
                      const today = new Date();
                      const daysUntilExpiry = validToDate && !isNaN(validToDate.getTime())
                        ? Math.floor((validToDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                        : null;
                      const isExpiringSoon = rule.hasDateLimit && daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
                      const isExpired = rule.hasDateLimit && daysUntilExpiry !== null && daysUntilExpiry < 0;

                      // Active tier (1-indexed) — for multi-tier volume rules, find which tier the quantity falls into.
                      // Simple heuristic: linear distribution across totalTiers based on minQuantity.
                      const activeTier = rule.tierType === 'multiple' && rule.totalTiers > 1
                        ? Math.min(rule.totalTiers, Math.max(1, Math.floor(formData.quantity / Math.max(1, rule.minQuantity || 1))))
                        : null;

                      return (
                        <div
                          key={index}
                          className="flex items-start justify-between pr-4 group transition-colors"
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
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            {isPremium
                              ? <TrendingUp className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0 mt-[2px]`} />
                              : <TrendingDown className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0 mt-[2px]`} />}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[12px] ${isDisabled ? 'text-[#9CA3AF]' : 'text-[#1F2937]'}`} style={{ fontWeight: 500, textDecoration: isDisabled ? 'line-through' : undefined }}>{rule.name}</span>
                                {isUnapplied ? (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]" style={{ borderRadius: '3px', fontWeight: 500 }}>Deactivated</span>
                                ) : !rule.isActive && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]" style={{ borderRadius: '3px', fontWeight: 500 }}>Inactive</span>
                                )}
                                {/* Lock/Sparkles glyphs intentionally removed — not in design system. */}
                              </div>
                              {isUnapplied && rule.unappliedReason === 'EXCEEDS_100_PERCENT' && (
                                <div className="text-[10px] text-[#B45309] mt-0.5" style={{ fontWeight: 500 }}>Exceeds 100% of item price — deactivated automatically</div>
                              )}
                              {isUnapplied && rule.unappliedReason === 'USER_UNAPPLIED' && (
                                <div className="text-[10px] text-[#6B7280] mt-0.5" style={{ fontWeight: 400 }}>Manually deactivated — click <CirclePlus className="inline w-2.5 h-2.5 align-text-bottom" /> to re-activate</div>
                              )}
                              {!isUnapplied && rule.isPending && rule.minQuantity > 0 && (
                                <div className="text-[10px] text-[#92400E] mt-0.5" style={{ fontWeight: 400 }}>Requires min. {rule.minQuantity} units</div>
                              )}
                              {/* Metadata chip line — Partner v7 short
                                  metadata-pill style (lifted from
                                  PartnerGroupDetailModal's "partners linked"
                                  pill so the chrome is canonical across
                                  modules). Shape: `inline-flex items-center
                                  gap-1 px-2 py-0.5 rounded-full text-[10.5px]
                                  bg-slate-50 text-slate-600 border
                                  border-border, fontWeight: 500`. Each pill
                                  leads with a small slate icon so the
                                  treatment matches the Quote
                                  AdvancedConfiguratorModal exactly. */}
                              <div className={`flex items-center gap-1 flex-wrap mt-1 ${isDisabled ? 'opacity-60' : ''}`}>
                                {rule.basis && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] bg-slate-50 text-slate-600 border border-border"
                                    style={{ fontWeight: 500 }}
                                  >
                                    {rule.basis === 'volume'
                                      ? <Layers style={{ width: 10, height: 10, color: '#94A3B8' }} />
                                      : <DollarSign style={{ width: 10, height: 10, color: '#94A3B8' }} />}
                                    {rule.basis === 'volume' ? 'Volume' : 'Value'}
                                  </span>
                                )}
                                {rule.hasDateLimit ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] border"
                                    style={{
                                      fontWeight: 500,
                                      color: isUnapplied ? '#9CA3AF' : isExpired ? '#B91C1C' : isExpiringSoon ? '#B45309' : '#475569',
                                      backgroundColor: isUnapplied ? '#F3F4F6' : isExpired ? '#FEE2E2' : isExpiringSoon ? '#FEF3C7' : '#F8FAFC',
                                      borderColor: isUnapplied ? '#E5E7EB' : isExpired ? '#FECACA' : isExpiringSoon ? '#FDE68A' : 'var(--border)',
                                    }}
                                    title={`Valid ${rule.validFrom} – ${rule.validTo}`}
                                  >
                                    <CalendarDays style={{ width: 10, height: 10, color: '#94A3B8' }} />
                                    {isExpired ? `Expired ${rule.validTo}` : isExpiringSoon ? `Expires in ${daysUntilExpiry}d` : `Until ${rule.validTo}`}
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] bg-slate-50 text-slate-600 border border-border"
                                    style={{ fontWeight: 500 }}
                                  >
                                    <InfinityIcon style={{ width: 11, height: 11, color: '#94A3B8' }} />
                                    No expiry
                                  </span>
                                )}
                                {rule.tierType === 'multiple' && rule.totalTiers > 1 && activeTier !== null && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] bg-slate-50 text-slate-600 border border-border tabular-nums"
                                    style={{ fontWeight: 500 }}
                                  >
                                    <Layers style={{ width: 10, height: 10, color: '#94A3B8' }} />
                                    T{activeTier} of {rule.totalTiers}
                                  </span>
                                )}
                                {rule.scope === 'order' && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] bg-slate-50 text-slate-600 border border-border"
                                    style={{ fontWeight: 500 }}
                                  >
                                    <User style={{ width: 10, height: 10, color: '#94A3B8' }} />
                                    This order only
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 mt-[2px]">
                            <div className="text-right flex items-baseline justify-end gap-2" style={{ minWidth: 130 }}>
                              <span className={`text-[12px] ${percentageColor}`} style={{ fontWeight: 600, textDecoration: isDisabled ? 'line-through' : undefined }}>{isPremium ? '+' : '-'}{Math.abs(rule.percentage)}%</span>
                              <span className={`text-[11px] ${amountColor}`} style={{ fontWeight: 500, opacity: 0.8, textDecoration: isDisabled ? 'line-through' : undefined }}>{isPremium ? '+' : '-'}{rule.isActive ? formatCurrency(Math.abs(rule.amount)) : formatCurrency(baseSubtotal * Math.abs(rule.percentage) / 100)}</span>
                            </div>
                            {!readOnly && (
                              /* Partner Switch component replaces the
                                 old CircleSlash/CirclePlus buttons so
                                 the affordance is always visible. */
                              <Switch
                                checked={!isUnapplied}
                                onCheckedChange={(on) => {
                                  if (on) setReapplyConfirm({ kind: 'rule', ruleId: rule.id, name: rule.name });
                                  else setUnapplyConfirm({ kind: 'rule', ruleId: rule.id, name: rule.name });
                                }}
                                aria-label={isUnapplied ? 'Reactivate rule' : 'Deactivate rule'}
                                title={isUnapplied ? 'Reactivate rule' : 'Deactivate rule'}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Inline empty state — fires when the card header
                        shows (rules are attached to the line) but every
                        row was filtered out (auto-unapplied, inactive,
                        or otherwise not user-visible). */}
                    {appliedRulesDiscounts.filter(rule => rule.name && (
                      (rule.isApplied && rule.isActive) ||
                      (!rule.isApplied && rule.unappliedReason === 'USER_UNAPPLIED')
                    )).length === 0 && (
                      <div className="flex flex-col items-center text-center px-6" style={{ paddingTop: 18, paddingBottom: 18 }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F1F5F9' }}>
                          <BadgePercent className="w-4 h-4" style={{ color: '#94A3B8' }} />
                        </div>
                        <div className="text-[12.5px] mt-2" style={{ fontWeight: 600, color: '#1F2937' }}>
                          No pricing rules apply to this line
                        </div>
                        <div className="text-[11.5px] mt-1" style={{ color: '#6B7280', maxWidth: 320, lineHeight: 1.5 }}>
                          The customer&apos;s pricing rules do not currently match this item or its quantity. Open the library to attach a different rule.
                        </div>
                      </div>
                    )}
                    {/* Manage Customer Pricing Rules — Partner-style inline link */}
                    {!readOnly && (
                      <div className="px-3 py-2 border-t border-[#E5E7EB]">
                        <button
                          type="button"
                          onClick={() => setShowPricingLibrary(true)}
                          className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:text-[#0862D0] hover:underline underline-offset-2 cursor-pointer transition-colors"
                          style={{ fontWeight: 500 }}
                          title={discountCapHit ? 'Discount cap reached. Only premium rules will apply; new discount rules will be auto-unapplied.' : undefined}
                        >
                          <Tag className="w-3.5 h-3.5" />
                          Manage Pricing Rules for this Customer
                          {discountCapHit && <span className="text-[10px] text-[#B45309] ml-1">(discount cap reached)</span>}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center px-6 py-8">
                    <EmptyPlaceholder
                      icon={Tag}
                      title="No pricing rules on this line yet"
                      description="Apply a rule from the customer's library, or leave this item at standard pricing."
                      actionLabel={!readOnly ? 'Manage Customer Pricing Rules' : undefined}
                      onAction={!readOnly ? () => setShowPricingLibrary(true) : undefined}
                      compact
                      borderless
                    />
                  </div>
                )}
              </div>

              {/* One-Time Discounts/Premiums Section */}
              <div className="border border-[#E5E7EB] bg-white" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                {formData.oneTimeAdjustments.length > 0 ? (
                  <div>
                    {/* Header — Partner ContentCard chrome. */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#EEF2F6]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                          <Zap className="w-3.5 h-3.5 text-[#1B6EF3]" />
                        </div>
                        <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>One-Time Discounts/Premiums</span>
                        {/* Scope pill so users can tell at-a-glance this
                            one-time affects only the current line, not
                            the whole order. */}
                        <span className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap shrink-0" style={{ fontWeight: 500, color: '#475569', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}>
                          Item-Level
                        </span>
                        {/* (i) tooltip — explains that these are ad-hoc,
                            single-line adjustments, distinct from the
                            customer-wide pricing rules above. */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="About item-level one-time discounts and premiums"
                              className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-help shrink-0"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            align="start"
                            collisionPadding={12}
                            avoidCollisions
                            className="max-w-[320px] text-[11.5px] leading-[1.55] z-[12700]"
                          >
                            One-time item-level discounts and premiums apply to this line item only. Use them for per-line adjustments.
                          </TooltipContent>
                        </Tooltip>
                        {/* Count badge dropped per UX direction — the
                            list itself surfaces the count visually, and
                            the Item-Level scope pill already does the
                            heavy lifting in the header. */}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Discount net (negative) → green; premium net
                            (positive) → purple. Mirrors per-row colors
                            + the Pricing Rules header. */}
                        <span className={`text-[13px] ${oneTimeTotal < 0 ? 'text-[#10B981]' : oneTimeTotal > 0 ? 'text-[#7C3AED]' : 'text-[#6B7280]'}`} style={{ fontWeight: 600 }}>
                          {oneTimeTotal < 0 ? '-' : '+'}{formatCurrency(Math.abs(oneTimeTotal))}
                        </span>
                        {/* Remove-all button. One-times only do
                            edit/remove (no deactivate cycle), so
                            the section's master action is a Trash
                            that wipes every entry after confirm.
                            Sits in the same slot the master toggle
                            sits in on the Pricing Rules header. */}
                        {!readOnly && formData.oneTimeAdjustments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowDeleteAllAdjustmentsConfirm(true)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            aria-label="Remove all adjustments"
                            title="Remove all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Adjustment bars */}
                    {formData.oneTimeAdjustments.map((adj, index) => {
                      const amount = adj.amountType === '%' ? (baseSubtotal * adj.amount / 100) : adj.amount;
                      const isDiscount = adj.type === 'discount';
                      const isUnapplied = !adj.isApplied;
                      // Grayed-out treatment when unapplied — muted left border, icon, text, amount.
                      const leftBorderColor = isUnapplied ? '#E5E7EB' : (isDiscount ? '#10B981' : '#7C3AED');
                      const iconColor = isUnapplied ? 'text-[#9CA3AF]' : (isDiscount ? 'text-[#10B981]' : 'text-[#7C3AED]');
                      const valueColor = isUnapplied ? 'text-[#9CA3AF]' : (isDiscount ? 'text-[#10B981]' : 'text-[#7C3AED]');
                      const isLast = index === formData.oneTimeAdjustments.length - 1;
                      return (
                        <div
                          key={adj.id}
                          className="flex items-start justify-between pr-4 group transition-colors cursor-pointer"
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
                          onClick={() => !readOnly && !isUnapplied && editAdjustment(adj)}
                        >
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            {isDiscount
                              ? <TrendingDown className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0 mt-[2px]`} />
                              : <TrendingUp className={`w-3.5 h-3.5 ${iconColor} flex-shrink-0 mt-[2px]`} />}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[12px] ${isUnapplied ? 'text-[#9CA3AF]' : 'text-[#1F2937]'}`} style={{ fontWeight: 500 }}>{adj.label}</span>
                                {isUnapplied && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]" style={{ borderRadius: '3px', fontWeight: 500 }}>Deactivated</span>
                                )}
                              </div>
                              {isUnapplied && adj.unappliedReason === 'EXCEEDS_100_PERCENT' && (
                                <div className="text-[10px] text-[#B45309] mt-0.5" style={{ fontWeight: 500 }}>Exceeds 100% of item price — deactivated automatically</div>
                              )}
                              {isUnapplied && adj.unappliedReason === 'USER_UNAPPLIED' && (
                                <div className="text-[10px] text-[#6B7280] mt-0.5" style={{ fontWeight: 400 }}>Manually deactivated — click <CirclePlus className="inline w-2.5 h-2.5 align-text-bottom" /> to re-activate</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 mt-[2px]">
                            <div className="text-right flex items-baseline justify-end gap-2" style={{ minWidth: 130 }}>
                              <span className={`text-[12px] ${valueColor}`} style={{ fontWeight: 600, textDecoration: isUnapplied ? 'line-through' : undefined }}>{isDiscount ? '-' : '+'}{adj.amount}{adj.amountType}</span>
                              <span className={`text-[11px] ${valueColor}`} style={{ fontWeight: 500, opacity: 0.8, textDecoration: isUnapplied ? 'line-through' : undefined }}>{isDiscount ? '-' : '+'}{formatCurrency(amount)}</span>
                            </div>
                            {!readOnly && (
                              /* One-times use Edit + Remove (no
                                 deactivate cycle). Pencil opens
                                 edit; trash opens remove confirm. */
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); editAdjustment(adj); }}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-[#1B6EF3] hover:bg-[#EFF6FF] transition-colors cursor-pointer"
                                  aria-label="Edit adjustment"
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setRemoveAdjConfirm({ id: adj.id, label: adj.label }); }}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-[#9CA3AF] hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                  aria-label="Remove adjustment"
                                  title="Remove"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Add more adjustments link inside card */}
                    {!readOnly && (
                      <div className="px-3 py-2 border-t border-[#E5E7EB]">
                        <button
                          onClick={() => setShowAdjustmentModal(true)}
                          className="flex items-center gap-1.5 text-[12px] text-[#1B6EF3] hover:text-[#0D5ED7] transition-colors"
                          style={{ fontWeight: 500 }}
                          title={discountCapHit ? 'Discount cap reached — only premium adjustments will apply. New discounts will be auto-unapplied.' : undefined}
                        >
                          <Plus className="w-3 h-3" />
                          Add One-Time Discount/Premium
                          {discountCapHit && <span className="text-[10px] text-[#B45309] ml-1">(discount cap reached)</span>}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Compact empty state — adding a one-time premium/discount
                     is optional, so the section collapses to a label + dashed
                     Add button instead of a full placeholder card. */
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[13px] text-[#6B7280] flex items-center gap-2" style={{ fontWeight: 400 }}>
                      <Zap className="w-3.5 h-3.5" />
                      One-Time Discounts/Premiums
                      {/* Scope pill — matches the populated-state header so
                          users learn the section is line-scoped before they
                          add anything. */}
                      <span className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap shrink-0" style={{ fontWeight: 500, color: '#475569', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}>
                        Item-Level
                      </span>
                      {/* (i) tooltip — mirrors the populated-state header so
                          the explainer is reachable even before the user
                          adds anything. */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label="About item-level one-time discounts and premiums"
                            className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-help shrink-0"
                          >
                            <Info className="w-3.5 h-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="start"
                          collisionPadding={12}
                          avoidCollisions
                          className="max-w-[320px] text-[11.5px] leading-[1.55] z-[12700]"
                        >
                          One-time item-level discounts and premiums apply to this line item only. Use them for per-line adjustments.
                        </TooltipContent>
                      </Tooltip>
                    </span>
                    {!readOnly && (
                      <button
                        onClick={() => setShowAdjustmentModal(true)}
                        className="h-7 px-2.5 flex items-center gap-1 text-[12px] text-[#1B6EF3] border border-dashed border-[#93C5FD] hover:bg-[#F0F9FF] hover:border-[#1B6EF3] transition-colors"
                        style={{ borderRadius: '5px', fontWeight: 500 }}
                        title={discountCapHit ? 'Discount cap reached — only premium adjustments will apply.' : undefined}
                      >
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

              {/* Freight & Logistics card — Partner-style title row with
                  Edit pencil + Reset CTA on the right makes the action's
                  scope clear (the whole card, not just one row). Rows
                  below are read-only previews; the shipment modal owns
                  all editing. */}
              {(() => {
                const sCfg = formData.shipmentConfig;
                const sDesc = describeShipment(sCfg);
                const sCarrier = NEW_SHIPMENT_CARRIERS.find((c) => c.id === sCfg.carrierId);
                const sCarrierMethod = sCarrier?.methods.find((m) => m.id === sCfg.carrierMethodId);
                const isOverride = !!formData.isShipmentOverride;
                const hasCost = typeof sCfg.shipmentCost === 'number';
                return (
              <div className="border border-[#E5E7EB] bg-white overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {/* Title bar — Partner ContentCard pattern: white
                    header, light divider, icon wrapped in an accent
                    chip, title 13px / weight 600. */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#EEF2F6]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                      <Truck className="w-3.5 h-3.5 text-[#1B6EF3]" />
                    </div>
                    <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 600 }}>Freight &amp; Logistics</span>
                    {isOverride ? (
                      <span className="px-1.5 py-0.5 bg-[#FEF3C7] text-[#92400E] text-[10px]" style={{ borderRadius: '3px', fontWeight: 600 }}>Line Override</span>
                    ) : (
                      <span
                        className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap shrink-0"
                        style={{ fontWeight: 500, color: '#475569', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
                      >
                        Inherits Order Default
                      </span>
                    )}
                    {/* (i) tooltip — short explainer so users know what
                        this card covers and how the line-level override
                        differs from the order-level default. */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="About Freight and Logistics"
                          className="inline-flex items-center justify-center w-4 h-4 text-slate-400 hover:text-primary transition-colors cursor-help shrink-0"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        align="start"
                        collisionPadding={12}
                        avoidCollisions
                        className="max-w-[320px] text-[11.5px] leading-[1.55] z-[12700]"
                      >
                        Set how this line ships, the carrier, the service level, the pickup warehouse, and any line-specific freight cost. By default the line inherits the order-level freight setup. Override only when this line item needs different handling, such as a separate carrier, a different ship point, or a custom freight charge.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!readOnly && isOverride && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, shipmentConfig: DEFAULT_SHIPMENT, isShipmentOverride: false })}
                        className="h-7 px-2 inline-flex items-center gap-1 rounded-md transition-colors cursor-pointer"
                        style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontSize: 11, fontWeight: 600 }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                        title="Revert this line's freight & logistics back to the SO default"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reset to default
                      </button>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => setShowShipmentModal(true)}
                        className="h-7 px-2 inline-flex items-center gap-1 rounded-md transition-colors cursor-pointer"
                        style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#0F172A', fontSize: 11, fontWeight: 600 }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                        title="Edit this line's freight & logistics (overrides the SO default)"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Row: Freight Carrier/Method — combines method + carrier
                    when applicable. */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB]">
                  <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5"><Truck className="w-3 h-3 text-[#9CA3AF]" />Freight Carrier/Method</span>
                  <span className="text-[13px] text-[#1F2937] text-right" style={{ fontWeight: 500 }}>
                    {sDesc.primary}
                    {sCfg.method !== 'customer-pickup' && sCarrier && sCarrierMethod && (
                      <span className="text-[#6B7280]" style={{ fontWeight: 400 }}> · {sCarrier.name} · {sCarrierMethod.shortName}</span>
                    )}
                  </span>
                </div>
                {/* Row: Expected Ship By */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB]">
                  <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5"><Calendar className="w-3 h-3 text-[#9CA3AF]" />Expected Ship By</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>{formatDate(calculateShipDateRange().single)}</span>
                    {formData.isShipDateOverride && (
                      <span className="px-1 py-0.5 bg-[#EFF6FF] text-[#1B6EF3] text-[9px]" style={{ borderRadius: '3px', fontWeight: 600 }}>OVERRIDE</span>
                    )}
                  </div>
                </div>
                {/* Row: Expected Delivery */}
                {/* Row: Expected Delivery — hidden for customer pickup
                    (the customer takes the goods at pickup, so the
                    delivery is the same as the pickup date). */}
                {sCfg.method !== 'customer-pickup' && (
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E5E7EB]">
                  <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5"><Clock className="w-3 h-3 text-[#9CA3AF]" />Expected Delivery</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#1F2937]" style={{ fontWeight: 500 }}>
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
                )}

                {/* Row: Freight Charges — pinned for later. Feature is
                    paused per product so the row is intentionally not
                    rendered; the saved value still flows through
                    `shipmentConfig.shipmentCost`, so re-enabling is just
                    a matter of un-commenting the `&& false` below. */}
                {false && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[12px] text-[#6B7280] flex items-center gap-1.5"><DollarSign className="w-3 h-3 text-[#9CA3AF]" />Freight Charges</span>
                  {sCfg.method === 'customer-pickup' ? (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap"
                      style={{ fontWeight: 500, color: '#475569', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
                      title="No freight is billed when the customer picks up at our facility."
                    >
                      Not applicable · customer pickup
                    </span>
                  ) : (
                  <div className="flex items-center gap-2">
                    {hasCost ? (
                      <>
                        <input
                          type="text"
                          readOnly={readOnly}
                          value={new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(sCfg.shipmentCost!)}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                            const next = Math.max(0, parseFloat(cleaned) || 0);
                            setFormData({
                              ...formData,
                              shipmentConfig: { ...sCfg, shipmentCost: next },
                              isShipmentOverride: true,
                            });
                          }}
                          className={`w-28 h-7 px-2 text-[13px] text-[#1F2937] text-right border border-[#E5E7EB] focus:outline-none ${readOnly ? 'bg-[#F9FAFB] cursor-default' : 'bg-white focus:ring-1 focus:ring-[#1B6EF3]'}`}
                          style={{ borderRadius: '6px', fontWeight: 500 }}
                        />
                        <span className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap" style={{ fontWeight: 500, color: '#92400E', backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }}>Line</span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, shipmentConfig: { ...sCfg, shipmentCost: undefined } })}
                            className="text-[11px] text-[#6B7280] hover:text-[#1F2937] transition-colors cursor-pointer"
                            style={{ fontWeight: 500 }}
                            title="Revert to the order default"
                          >
                            Reset
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-[13px] text-[#6B7280] tabular-nums" style={{ fontWeight: 500 }}>
                          —
                        </span>
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap"
                          style={{ fontWeight: 500, color: '#475569', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
                          title="This line uses the order-level freight charge configured on the SO summary. The order-level charge applies to the whole order, not to each line."
                        >
                          Order-level
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              /* Same three cases as Quote: prompt only when
                                 parent has wired the split context AND this
                                 is the first override. */
                              const shouldPrompt =
                                anyOtherLineHasOverride === false &&
                                typeof quoteDefaultFreight === 'number' && quoteDefaultFreight > 0 &&
                                typeof siblingLineCount === 'number' && siblingLineCount > 1 &&
                                typeof onSeedSiblingFreightShares === 'function';
                              if (!shouldPrompt) {
                                setFormData({ ...formData, shipmentConfig: { ...sCfg, shipmentCost: 0 }, isShipmentOverride: true });
                                return;
                              }
                              const split = splitEvenly(quoteDefaultFreight!, siblingLineCount!);
                              const base = split[0] ?? 0;
                              const remainder = split.filter((v) => v !== base).length;
                              setFreightSplitPrompt({ share: base, previewBase: base, previewRemainderCount: remainder });
                            }}
                            className="text-[11px] text-[#1B6EF3] hover:underline transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                            title="Set a per-line freight charge that overrides the order-level default for this line only"
                          >
                            Override
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  )}
                </div>
                )}
              </div>
              );
              })()}

              {/* Notes Section — matches One-Time Discounts/Premiums card style */}
              <div className="border border-[#E5E7EB] bg-white" style={{ borderRadius: '12px', overflow: 'hidden' }}>
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
                      {/* Attach-link affordance disabled — chip render +
                          picker code preserved as a commented block so
                          we can reintroduce the per-note attach flow
                          later.
                          {docId && (
                            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                              {itemNoteAttachedLinks.map((link) => (
                                <AttachedLinkChip
                                  key={link.id}
                                  link={link}
                                  onRemove={readOnly ? undefined : () => setItemNoteLinkIds((prev) => prev.filter((id) => id !== link.id))}
                                />
                              ))}
                              {!readOnly && (
                                <>
                                  <button
                                    ref={setItemNoteLinkPickerAnchor}
                                    type="button"
                                    onClick={() => setShowItemNoteLinkPicker((v) => !v)}
                                    className="inline-flex items-center gap-1 rounded-full hover:bg-slate-50 transition-colors"
                                    style={{ padding: '2px 10px', border: '1px dashed var(--border)', background: 'var(--card)',
                                      color: 'var(--muted-foreground)', fontSize: 11.5, fontWeight: 500, cursor: 'pointer' }}
                                  >
                                    <Link2 style={{ width: 11, height: 11 }} />
                                    Attach a link
                                  </button>
                                  {showItemNoteLinkPicker && (
                                    <LinkPickerPopover
                                      anchor={itemNoteLinkPickerAnchor}
                                      docId={docId}
                                      attachedIds={itemNoteLinkIds}
                                      currentUser={currentUser || 'Sarah Chen'}
                                      onPick={(link) => {
                                        setItemNoteLinkIds((prev) => (prev.includes(link.id) ? prev : [...prev, link.id]));
                                        setShowItemNoteLinkPicker(false);
                                      }}
                                      onClose={() => setShowItemNoteLinkPicker(false)}
                                    />
                                  )}
                                </>
                              )}
                            </div>
                          )}
                      */}
                      <label className={`flex items-center gap-2 mt-4 ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}>
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
                  {/* Freight cost added to the total when present so
                      the line's price-out matches the order summary's
                      grand-total math. */}
                  {(() => {
                    const lineFreight = typeof formData.shipmentConfig.shipmentCost === 'number' ? formData.shipmentConfig.shipmentCost : 0;
                    const totalWithFreight = total + lineFreight;
                    return (
                      <>
                        <span style={{ fontSize: '20px', fontWeight: 700, color: '#1F2937', letterSpacing: '-0.3px', lineHeight: '1.1' }}>{formatCurrency(totalWithFreight)}</span>
                        {(totalRulesDiscount !== 0 || oneTimeTotal !== 0 || lineFreight !== 0) && (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {[
                              ...(totalRulesDiscount !== 0 ? [`Rules ${totalRulesDiscount > 0 ? '-' : '+'}${formatCurrency(Math.abs(totalRulesDiscount))}`] : []),
                              ...(oneTimeTotal !== 0 ? [`Adj. ${oneTimeTotal > 0 ? '+' : '-'}${formatCurrency(Math.abs(oneTimeTotal))}`] : []),
                              ...(lineFreight !== 0 ? [`Freight +${formatCurrency(lineFreight)}`] : []),
                            ].map((tag, i, arr) => (
                              <span key={i} style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                                {tag}{i < arr.length - 1 && <span style={{ margin: '0 5px', color: '#D1D5DB' }}>·</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
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
                onClick={() => { if (onDelete) { onDelete(); } else { toast.error('Item removed from quote'); onClose(); } }}
                className="px-3 h-8 flex items-center gap-1.5 border border-[#FCA5A5] text-[13px] text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                style={{ borderRadius: '6px', fontWeight: 500 }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteLabel || 'Delete from Quote'}
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

      {/* Pricing Rules Library Modal — Partner Management preset/templates pattern.
          The new library applies one rule at a time via its detail modal's
          Apply CTA (the legacy multi-select array form was retired when the
          library was ported to the Partner-style tab body). The callback
          merges the chosen rule into formData.appliedRules with cap-aware
          isApplied handling. */}
      <PricingRulesLibrary
        isOpen={showPricingLibrary}
        readOnly={readOnly}
        appliedRuleIds={formData.appliedRules.filter(e => e.isApplied).map(e => e.ruleId)}
        onClose={() => setShowPricingLibrary(false)}
        onApply={(libRule) => {
          if (stageLibraryChanges) {
            /* Post-draft: library edits the customer's rule book. The
               current line's rules + totals stay intact. The next draft
               will inherit the updated customer rules. */
            toast.info(`"${libRule.name}" applied to the customer rule book. Current line is unaffected — the next draft will inherit it.`);
            return;
          }
          setFormData(prev => {
            const existing = prev.appliedRules.find(e => e.ruleId === libRule.id);
            // Already in list — flip isApplied=true (reactivates manually
            // unapplied or auto-disabled entries) without disturbing other entries.
            if (existing) {
              return {
                ...prev,
                appliedRules: prev.appliedRules.map(e =>
                  e.ruleId === libRule.id ? { ...e, isApplied: true, unappliedReason: undefined } : e,
                ),
              };
            }
            // New rule — cap-aware apply.
            const fullRule = PRICING_RULES.find(pr => pr.id === libRule.id);
            const incremental = fullRule && fullRule.discount > 0 && formData.quantity >= fullRule.minQuantity
              ? baseSubtotal * fullRule.discount / 100
              : 0;
            const exceeds = baseSubtotal > 0 && (totalActiveDiscountAmount + incremental) > baseSubtotal;
            return {
              ...prev,
              appliedRules: [
                ...prev.appliedRules,
                {
                  ruleId: libRule.id,
                  isApplied: !exceeds,
                  unappliedReason: exceeds ? ('EXCEEDS_100_PERCENT' as const) : undefined,
                },
              ],
            };
          });
        }}
        /* Library kebab actions — keep host state in sync so deactivating
           a rule in the library also greys it out in the line item rule list
           and removes its contribution from the summary carousel + totals.
           The library's seeded ids (pr-1, pr-2, …) don't match the host's
           appliedRules ids (fleet-vol, gov-pricing, …), so we match by
           rule name (case-insensitive) — same approach the Quote Manage
           modal uses for legacy preset bridging. */
        onDeactivateRule={(libRule) => {
          if (stageLibraryChanges) {
            toast.info(`"${libRule.name}" deactivated in the customer rule book. Current line is unaffected.`);
            return;
          }
          const nm = libRule.name.toLowerCase();
          setFormData(prev => {
            const next = prev.appliedRules.map(e => {
              const r = PRICING_RULES.find(pr => pr.id === e.ruleId);
              if (r && r.name.toLowerCase() === nm) {
                return { ...e, isApplied: false, unappliedReason: 'USER_UNAPPLIED' as const };
              }
              return e;
            });
            return { ...prev, appliedRules: next };
          });
        }}
        onActivateRule={(libRule) => {
          if (stageLibraryChanges) {
            toast.info(`"${libRule.name}" activated in the customer rule book. Current line is unaffected.`);
            return;
          }
          const nm = libRule.name.toLowerCase();
          setFormData(prev => ({
            ...prev,
            appliedRules: prev.appliedRules.map(e => {
              const r = PRICING_RULES.find(pr => pr.id === e.ruleId);
              if (r && r.name.toLowerCase() === nm) {
                return { ...e, isApplied: true, unappliedReason: undefined };
              }
              return e;
            }),
          }));
        }}
        onRemoveRule={(libRule) => {
          if (stageLibraryChanges) {
            toast.info(`"${libRule.name}" removed from the customer rule book. Current line is unaffected.`);
            return;
          }
          /* Drop the matching entry regardless of conditions — Remove is a
             stronger action than Deactivate per product spec. */
          const nm = libRule.name.toLowerCase();
          setFormData(prev => ({
            ...prev,
            appliedRules: prev.appliedRules.filter(e => {
              const r = PRICING_RULES.find(pr => pr.id === e.ruleId);
              return !(r && r.name.toLowerCase() === nm);
            }),
          }));
        }}
        customerName={customerName || "Customer"}
        /* Project the SHARED customer rule book into the library's PricingRule
           shape so both library mounts (configurator + summary) show the
           same set of rules for the same customer at the same time. */
        customRules={(pricingAPI?.state.attached ?? []).map((r) => {
          const t0 = r.tiers[0];
          return {
            id: r.id,
            ruleNo: r.id,
            name: r.name,
            category: r.type,
            basis: r.tiers.some((t) => t.minQty > 1) ? 'volume' as const : 'value' as const,
            tierType: r.tiers.length > 1 ? 'multiple' as const : 'single' as const,
            totalTiers: r.tiers.length,
            description: r.description,
            aboutText: '',
            status: pricingAPI?.state.deactivatedRuleIds.has(r.id) ? 'Inactive' as const : 'Active' as const,
            scope: 'customer' as const,
            validFrom: r.validFrom,
            validTo: r.validTo ?? '',
            hasDateLimit: r.validTo !== null,
            durationDays: 365,
            itemCount: r.appliesToItemCodes.length,
            categoryCount: 0,
            partnerCount: r.customers.length,
            tiers: r.tiers.map((t) => ({
              minQty: String(t.minQty),
              maxQty: t.maxQty === null ? '∞' : String(t.maxQty),
              discount: `${t.rate}${t.unit}`,
            })),
            createdBy: 'System',
            createdDate: r.validFrom,
            isPreset: r.source === 'template',
            items: [],
            categories: [],
            partners: [],
          };
        })}
        /* Only surface rules the host module actually knows about
           (avoids Partner-mock orphans showing in the configurator). */
        restrictToNames={(pricingAPI?.state.attached ?? []).map(r => r.name)}
        itemName={item.name}
        currentQuantity={formData.quantity}
        currentValue={baseSubtotal}
      />

      {/* Add/Edit Adjustment Modal — uses shared AdjustmentFormModal */}
      {showAdjustmentModal && (
        <AdjustmentFormModal
          mode={editingAdjustmentId ? 'edit' : 'add'}
          scope="item"
          recordLabel="order"
          docId={docId}
          currentUser={currentUser}
          initial={editingAdjustmentId ? (() => {
            const adj = formData.oneTimeAdjustments.find(a => a.id === editingAdjustmentId);
            return adj ? { id: adj.id, label: adj.label, type: adj.type, amountType: adj.amountType, amount: adj.amount, scope: 'item' as const, internalNotes: (adj as any).internalNotes, attachments: (adj as any).attachments, internalNoteLinks: (adj as any).internalNoteLinks } : undefined;
          })() : undefined}
          onSave={(data: AdjustmentFormData) => {
            if (editingAdjustmentId) {
              const editingId = editingAdjustmentId;
              const before = formData.oneTimeAdjustments.find(a => a.id === editingId);
              const beforeApiAdj = adjustmentsAPI?.adjustments.find(a => a.id === editingId);
              if (adjustmentsAPI) {
                adjustmentsAPI.updateAdjustment(editingId, {
                  type: data.type, amountType: data.amountType, amount: data.amount,
                  label: data.label, internalNotes: data.internalNotes, attachments: data.attachments,
                });
              } else {
                setFormData({ ...formData, oneTimeAdjustments: formData.oneTimeAdjustments.map(adj => adj.id === editingId ? { ...adj, type: data.type, amountType: data.amountType, amount: data.amount, label: data.label, internalNotes: data.internalNotes, attachments: data.attachments } : adj) });
              }
              onMaterialEvent?.(
                `Updated ${data.type === 'premium' ? 'premium' : 'discount'} "${data.label}" on line "${item.name}"`,
                () => {
                  if (adjustmentsAPI && beforeApiAdj) {
                    adjustmentsAPI.updateAdjustment(editingId, {
                      label: beforeApiAdj.label,
                      type: beforeApiAdj.type,
                      amountType: beforeApiAdj.amountType,
                      amount: beforeApiAdj.amount,
                      internalNotes: (beforeApiAdj as any).internalNotes,
                      attachments: (beforeApiAdj as any).attachments,
                    });
                  } else if (before) {
                    setFormData(prev => ({
                      ...prev,
                      oneTimeAdjustments: prev.oneTimeAdjustments.map(adj =>
                        adj.id === editingId ? before : adj,
                      ),
                    }));
                  }
                },
              );
            } else {
              let createdId: string | null = null;
              let createdLocalId: string | null = null;
              if (adjustmentsAPI && lineId) {
                const created = adjustmentsAPI.addAdjustment({
                  label: data.label, type: data.type, amountType: data.amountType,
                  amount: data.amount, scope: 'item', appliedTo: [lineId],
                  internalNotes: data.internalNotes,
                  attachments: data.attachments,
                });
                createdId = created.id;
              } else {
                createdLocalId = `adj-${Date.now()}`;
                setFormData({ ...formData, oneTimeAdjustments: [...formData.oneTimeAdjustments, { type: data.type, amountType: data.amountType, amount: data.amount, label: data.label, id: createdLocalId, internalNotes: data.internalNotes, attachments: data.attachments }] });
              }
              onMaterialEvent?.(
                `Added ${data.type === 'premium' ? 'premium' : 'discount'} "${data.label}" on line "${item.name}"`,
                () => {
                  if (adjustmentsAPI && createdId) {
                    adjustmentsAPI.removeAdjustment(createdId);
                  } else if (createdLocalId) {
                    setFormData(prev => ({
                      ...prev,
                      oneTimeAdjustments: prev.oneTimeAdjustments.filter(a => a.id !== createdLocalId),
                    }));
                  }
                },
              );
            }
            setEditingAdjustmentId(null);
            setShowAdjustmentModal(false);
            setNewAdjustment({ type: 'discount', amountType: '%', amount: 0, label: '' });
          }}
          onCancel={() => { setShowAdjustmentModal(false); setEditingAdjustmentId(null); setNewAdjustment({ type: 'discount', amountType: '%', amount: 0, label: '' }); }}
        />
      )}

      {/* Shipment Configuration Modal — shared with the SO sidebar.
          Replaces the previous inline modal. Per-line overrides flow
          through formData.shipmentConfig and pop the line-override
          chrome (badge + Reset to default). */}
      {showShipmentModal && (
        <ShipmentMethodModal
          isOpen
          onClose={() => setShowShipmentModal(false)}
          value={formData.shipmentConfig}
          onSave={(next) => {
            /* Mirror new model back into legacy shipmentMethod so any
               code still reading the old field (date math, table) sees
               a consistent value. */
            const prevShipmentConfig = formData.shipmentConfig;
            const prevIsOverride = formData.isShipmentOverride;
            const prevMethod = formData.shipmentMethod;
            setFormData({
              ...formData,
              shipmentConfig: next,
              isShipmentOverride: true,
              shipmentMethod: next.method,
            });
            onMaterialEvent?.(
              `Updated shipment method on line "${item.name}"`,
              () => setFormData(prev => ({
                ...prev,
                shipmentConfig: prevShipmentConfig,
                isShipmentOverride: prevIsOverride,
                shipmentMethod: prevMethod,
              })),
            );
          }}
          scopeLabel={item.name}
          isLineOverride
          /* Thread the line's productId into the picker so each
             warehouse card shows the right "units on hand" for
             this item. */
          inventoryItemCodes={item.productId ? [item.productId] : undefined}
          onResetToDefault={() => {
            setFormData({ ...formData, shipmentConfig: DEFAULT_SHIPMENT, isShipmentOverride: false });
            setShowShipmentModal(false);
          }}
        />
      )}

      {/* Price Update Scope Modal — Partner yellow chrome with blue radios */}
      {showPriceUpdateConfirm && pendingPriceChange !== null && (
        <PartnerPriceChangeModalSO
          newPrice={pendingPriceChange}
          onApply={(scope) => {
            setFormData({ ...formData, unitPrice: pendingPriceChange });
            setShowPriceUpdateConfirm(false);
            setPendingPriceChange(null);
            if (scope === 'order') toast.success('Price updated for this order only');
            else toast.success('Item master price updated — future orders will use this price');
          }}
          onCancel={() => { setShowPriceUpdateConfirm(false); setPendingPriceChange(null); }}
        />
      )}



      {/* Deactivate All Pricing Rules Confirmation — scoped to currently
          visible & active rules only. Rules whose threshold isn't met
          (isApplied but !isActive) are hidden from the list, so they
          aren't part of "all" from the user's perspective. Already-
          deactivated rules are also left untouched. */}
      {(() => {
        const visibleActiveIds = appliedRulesDiscounts
          .filter(r => r.name && r.isApplied && r.isActive)
          .map(r => r.id);
        const visibleActiveCount = visibleActiveIds.length;
        return (
          <ConfirmationModal
            isOpen={showDeleteAllRulesConfirm}
            title="Deactivate all pricing rules?"
            message={`All ${visibleActiveCount} pricing rule${visibleActiveCount !== 1 ? 's' : ''} will be deactivated. You can reactivate them any time.`}
            confirmText="Deactivate all"
            cancelText="Keep active"
            onConfirm={() => {
              const idSet = new Set(visibleActiveIds);
              /* Snapshot pre-state so a discarded version prompt can
                 restore every rule's applied flag exactly. */
              const prevAppliedRules = formData.appliedRules;
              setFormData(prev => ({
                ...prev,
                appliedRules: prev.appliedRules.map(e =>
                  idSet.has(e.ruleId)
                    ? { ...e, isApplied: false, unappliedReason: 'USER_UNAPPLIED' as const }
                    : e,
                ),
              }));
              setShowDeleteAllRulesConfirm(false);
              toast.info(
                visibleActiveCount === 1
                  ? '1 pricing rule deactivated'
                  : `${visibleActiveCount} pricing rules deactivated`,
              );
              if (visibleActiveCount > 0) {
                onMaterialEvent?.(
                  `Deactivated ${visibleActiveCount} pricing rule${visibleActiveCount !== 1 ? 's' : ''} on line "${item.name}"`,
                  () => setFormData(prev => ({ ...prev, appliedRules: prevAppliedRules })),
                );
              }
            }}
            onCancel={() => setShowDeleteAllRulesConfirm(false)}
            variant="yellow"
            icon={<CircleSlash className="w-6 h-6 text-white" />}
          />
        );
      })()}

      {/* Per-rule / per-adjustment Unapply Confirmation */}
      <ConfirmationModal
        isOpen={!!unapplyConfirm}
        title={
          unapplyConfirm?.kind === 'rule'
            ? 'Deactivate this pricing rule?'
            : unapplyConfirm?.kind === 'adjustment'
              ? 'Deactivate this adjustment?'
              : 'Deactivate?'
        }
        message={
          unapplyConfirm?.kind === 'rule'
            ? `"${unapplyConfirm.name}" will be deactivated. You can reactivate it any time.`
            : unapplyConfirm?.kind === 'adjustment'
              ? `"${unapplyConfirm.label}" will be deactivated. You can reactivate it any time.`
              : ''
        }
        confirmText="Deactivate"
        cancelText="Keep active"
        onConfirm={() => {
          if (!unapplyConfirm) return;
          if (unapplyConfirm.kind === 'rule') unapplyRuleEntry(unapplyConfirm.ruleId, 'USER_UNAPPLIED');
          else if (unapplyConfirm.kind === 'adjustment') {
            const adjId = unapplyConfirm.adjId;
            const target = formData.oneTimeAdjustments.find(a => a.id === adjId);
            if (adjustmentsAPI) {
              adjustmentsAPI.unapplyAdjustment(adjId, 'USER_UNAPPLIED');
            } else {
              setFormData(prev => ({
                ...prev,
                oneTimeAdjustments: prev.oneTimeAdjustments.map(adj =>
                  adj.id === adjId ? { ...adj, isApplied: false, unappliedReason: 'USER_UNAPPLIED' as const } : adj,
                ),
              }));
            }
            if (target?.isApplied) {
              onMaterialEvent?.(
                `Unapplied ${target.type === 'premium' ? 'premium' : 'discount'} "${target.label}" on line "${item.name}"`,
                () => {
                  if (adjustmentsAPI) {
                    adjustmentsAPI.reapplyAdjustment(adjId);
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      oneTimeAdjustments: prev.oneTimeAdjustments.map(adj =>
                        adj.id === adjId ? { ...adj, isApplied: true, unappliedReason: undefined } : adj,
                      ),
                    }));
                  }
                },
              );
            }
          }
          setUnapplyConfirm(null);
        }}
        onCancel={() => setUnapplyConfirm(null)}
        variant="yellow"
        icon={<CircleSlash className="w-6 h-6 text-white" />}
      />

      {/* Per-rule / per-adjustment Reapply Confirmation —
          Symmetric twin of the unapply flow above. Shown when the user
          clicks the + icon on a manually-deactivated row to reactivate
          it without leaving the configurator. */}
      <ConfirmationModal
        isOpen={!!reapplyConfirm}
        title={
          reapplyConfirm?.kind === 'rule'
            ? 'Reactivate this pricing rule?'
            : reapplyConfirm?.kind === 'adjustment'
              ? 'Reactivate this adjustment?'
              : 'Reactivate?'
        }
        message={
          reapplyConfirm?.kind === 'rule'
            ? `"${reapplyConfirm.name}" will be reactivated and applied to this line item.`
            : reapplyConfirm?.kind === 'adjustment'
              ? `"${reapplyConfirm.label}" will be reactivated and applied to this line item.`
              : ''
        }
        confirmText="Reactivate"
        cancelText="Keep deactivated"
        onConfirm={() => {
          if (!reapplyConfirm) return;
          if (reapplyConfirm.kind === 'rule') applyRuleEntry(reapplyConfirm.ruleId);
          else if (reapplyConfirm.kind === 'adjustment') reapplyAdjustment(reapplyConfirm.adjId);
          setReapplyConfirm(null);
        }}
        onCancel={() => setReapplyConfirm(null)}
        variant="blue"
        icon={<CirclePlus className="w-6 h-6 text-white" />}
      />

      {/* Remove single one-time adjustment. One-times are ad-hoc
          on a line (no library to re-add from), so the copy is
          plain "removed from this line. Add a new one anytime." */}
      {removeAdjConfirm && (
        <ConfirmationModal
          isOpen
          title="Remove this adjustment?"
          message={`"${removeAdjConfirm.label}" will be removed from this line. You can add a new one anytime.`}
          confirmText="Remove"
          cancelText="Keep"
          onConfirm={() => {
            removeAdjustment(removeAdjConfirm.id);
            toast.success(`"${removeAdjConfirm.label}" removed`);
            setRemoveAdjConfirm(null);
          }}
          onCancel={() => setRemoveAdjConfirm(null)}
          variant="red"
          icon={<Trash2 className="w-6 h-6 text-white" />}
        />
      )}

      {/* Remove All Adjustments Confirmation. One-times do not
          deactivate; they remove. Wipes every entry on this line;
          the user can always add new ones. */}
      <ConfirmationModal
        isOpen={showDeleteAllAdjustmentsConfirm}
        title="Remove all adjustments?"
        message={`All ${formData.oneTimeAdjustments.length} adjustments will be removed from this line. You can add new ones anytime.`}
        confirmText="Remove all"
        cancelText="Keep"
        onConfirm={() => {
          const total = formData.oneTimeAdjustments.length;
          /* Snapshot every adjustment (and its API-side fields) so a
             discarded version prompt can restore the full list. */
          const localSnapshot = formData.oneTimeAdjustments;
          const apiSnapshot = adjustmentsAPI
            ? localSnapshot
                .map(adj => adjustmentsAPI.adjustments.find(a => a.id === adj.id))
                .filter((a): a is NonNullable<typeof a> => !!a)
            : [];
          if (adjustmentsAPI) {
            for (const adj of formData.oneTimeAdjustments) {
              adjustmentsAPI.removeAdjustment(adj.id);
            }
          } else {
            setFormData(prev => ({ ...prev, oneTimeAdjustments: [] }));
          }
          setShowDeleteAllAdjustmentsConfirm(false);
          toast.success(total === 1 ? '1 adjustment removed' : `${total} adjustments removed`);
          if (total > 0) {
            onMaterialEvent?.(
              `Removed ${total} adjustment${total !== 1 ? 's' : ''} on line "${item.name}"`,
              () => {
                if (adjustmentsAPI) {
                  for (const a of apiSnapshot) {
                    adjustmentsAPI.addAdjustment({
                      id: a.id,
                      label: a.label,
                      type: a.type,
                      amountType: a.amountType,
                      amount: a.amount,
                      scope: a.scope,
                      appliedTo: a.appliedTo,
                      internalNotes: (a as any).internalNotes,
                      attachments: (a as any).attachments,
                    });
                  }
                } else {
                  setFormData(prev => ({ ...prev, oneTimeAdjustments: localSnapshot }));
                }
              },
            );
          }
        }}
        onCancel={() => setShowDeleteAllAdjustmentsConfirm(false)}
        variant="red"
        icon={<Trash2 className="w-6 h-6 text-white" />}
      />

      {/* Bulk-remove confirmation. Uses the shared ConfirmationModal, the
          same Partner-derived centered-icon dialog the AttachmentCard's
          single-file delete uses, so removing five files is confirmed the
          same way as removing one. Red variant, Trash icon, count in both
          the title and the CTA, matching how Partners phrases its bulk
          unlink confirm. */}
      <ConfirmationModal
        isOpen={!!showBulkRemoveConfirm}
        variant="red"
        icon={showBulkRemoveConfirm === 'remove' ? <XCircle className="w-6 h-6 text-white" /> : <Trash2 className="w-6 h-6 text-white" />}
        title={(() => {
          const n = showBulkRemoveConfirm === 'remove' ? selectedFromMaster.length : selectedUploaded.length;
          return showBulkRemoveConfirm === 'remove'
            ? (n === 1 ? 'Remove this file from the line item?' : `Remove ${n} files from this line item?`)
            : (n === 1 ? 'Delete this attachment?' : `Delete ${n} attachments?`);
        })()}
        message={showBulkRemoveConfirm === 'remove'
          ? (selectedFromMaster.length === 1
            ? 'It stays in the item master, so you can add it again anytime.'
            : 'They stay in the item master, so you can add them again anytime.')
          : `${selectedUploaded.length === 1 ? 'This file' : 'These files'} will be permanently removed from the system. This action cannot be undone.`}
        confirmText={(() => {
          const n = showBulkRemoveConfirm === 'remove' ? selectedFromMaster.length : selectedUploaded.length;
          return showBulkRemoveConfirm === 'remove'
            ? (n === 1 ? 'Remove file' : `Remove ${n} files`)
            : (n === 1 ? 'Delete attachment' : `Delete ${n} attachments`);
        })()}
        cancelText="Cancel"
        onConfirm={() => { if (showBulkRemoveConfirm) bulkRemoveSelectedAttachments(showBulkRemoveConfirm); }}
        onCancel={() => setShowBulkRemoveConfirm(false)}
      />

      {/* Single-file remove, opened from a list row's three-dot menu. The
          card view has its own confirm dialog inside `AttachmentCard`; a
          row has none, and letting the row delete straight through would
          have made the list view the riskier place to work. Same dialog,
          same phrasing, split on where the file came from. */}
      <ConfirmationModal
        isOpen={!!pendingRemoveAtt}
        variant="red"
        icon={<Trash2 className="w-6 h-6 text-white" />}
        title={pendingRemoveAtt?.galleryId
          ? 'Remove this file from the order?'
          : 'Delete this attachment?'}
        message={pendingRemoveAtt?.galleryId
          ? `"${pendingRemoveAtt?.name}" stays in the item master, so you can add it again anytime.`
          : `"${pendingRemoveAtt?.name}" will be permanently removed from the system. This action cannot be undone.`}
        confirmText={pendingRemoveAtt?.galleryId ? 'Remove from Order' : 'Delete Attachment'}
        cancelText="Cancel"
        onConfirm={() => {
          if (!pendingRemoveAtt) return;
          const removed = pendingRemoveAtt;
          detachFile(removed.id);
          setPendingRemoveAtt(null);
          toast.success(removed.galleryId
            ? `"${removed.name}" removed from this order`
            : `"${removed.name}" deleted`);
        }}
        onCancel={() => setPendingRemoveAtt(null)}
      />

      {/* Rename attachment dialog — opened from the Attachments-tab three-dot
          menu's "Rename" option. */}
      {editingFileId && (
        <RenameAttachmentDialog
          currentName={editingFileName}
          onCancel={() => setEditingFileId(null)}
          onConfirm={(newName) => {
            renameFile(editingFileId, newName);
            setEditingFileId(null);
            toast.success('File renamed');
          }}
        />
      )}
      {/* Item peek modal — opens from the product card thumbnail. */}
      {itemQuickViewModal}

      {/* First per-line freight override: same confirmation the freight
          breakdown modal uses, plus the recalculation overlay. */}
      {freightSplitPrompt && typeof quoteDefaultFreight === 'number' && typeof siblingLineCount === 'number' && (
        <SwitchFreightModeConfirm
          target="per-line"
          defaultCost={quoteDefaultFreight}
          perLineSum={0}
          lineCount={siblingLineCount}
          previewBase={freightSplitPrompt.previewBase}
          previewRemainderCount={freightSplitPrompt.previewRemainderCount}
          triggeringLineLabel={item.name}
          onCancel={() => setFreightSplitPrompt(null)}
          onConfirm={() => {
            const share = freightSplitPrompt.share;
            onSeedSiblingFreightShares?.(share);
            setFormData((prev) => ({
              ...prev,
              shipmentConfig: { ...prev.shipmentConfig, shipmentCost: share },
              isShipmentOverride: true,
            }));
            setFreightSplitOverlayState({ total: quoteDefaultFreight, lineCount: siblingLineCount });
            setFreightSplitPrompt(null);
          }}
        />
      )}
      {freightSplitOverlayState && (
        <FreightSplitOverlay
          show
          direction="split"
          total={freightSplitOverlayState.total}
          lineCount={freightSplitOverlayState.lineCount}
          onComplete={() => setFreightSplitOverlayState(null)}
        />
      )}
    </div>
  );
}

/* PPU confirm modal — same chrome as ConfirmDiscardModal: colored gradient
   banner with soft glow + icon tile + badge pill on top, white body below. */
function PartnerPriceChangeModalSO({ newPrice, onApply, onCancel }: {
  newPrice: number;
  onApply: (scope: 'order' | 'master') => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState<'order' | 'master'>('order');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onApply(choice);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [choice, onApply, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', padding: 24 }}
      onClick={onCancel}
    >
      <div
        style={{
          borderRadius: 16, width: 480, maxWidth: '100%',
          overflow: 'hidden',
          boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)',
          backgroundColor: '#FFFFFF',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Colored glow header */}
        <div
          className="relative flex flex-col items-center"
          style={{
            paddingTop: 40, paddingBottom: 24,
            background: 'linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)',
          }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{ width: 180, height: 80, borderRadius: '50%', filter: 'blur(50px)', opacity: 0.25, backgroundColor: '#F59E0B' }}
          />
          <div
            className="relative flex items-center justify-center"
            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#FEF3C7' }}
          >
            <DollarSign style={{ width: 32, height: 32, color: '#B45309' }} />
          </div>
          <span
            style={{
              marginTop: 16, padding: '4px 12px', borderRadius: 999,
              fontSize: 11, fontWeight: 600, lineHeight: 1,
              backgroundColor: '#FFFBEB', color: '#92400E',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}
          >
            Price change
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center text-center" style={{ padding: '0 28px 28px' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: '#0F172A', margin: 0 }}>
            Apply price change
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: '#64748B', margin: '8px 0 0 0', maxWidth: 360 }}>
            You're changing the unit price to <span style={{ fontWeight: 600, color: '#0F172A' }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(newPrice)}</span>. Choose where this price should apply.
          </p>

          {/* Options */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20, textAlign: 'left' }}>
            <YellowRadioCardSO
              selected={choice === 'order'}
              onClick={() => setChoice('order')}
              title="This order only"
              description="Override the price for this line item. The item master stays unchanged."
            />
            <YellowRadioCardSO
              selected={choice === 'master'}
              onClick={() => setChoice('master')}
              title="Update item master"
              description="Set as the new default price for all future orders."
              badge="GLOBAL"
            />
          </div>

          {/* Actions — stacked, matching ConfirmDiscardModal */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
            <button
              onClick={() => onApply(choice)}
              className="w-full"
              style={{
                height: 44, fontSize: 14, fontWeight: 600,
                backgroundColor: '#0A77FF', color: '#FFFFFF',
                border: 'none', borderRadius: 12, cursor: 'pointer',
                transition: 'background-color 120ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0A77FF'; }}
            >
              Apply change
            </button>
            <button
              onClick={onCancel}
              className="w-full"
              style={{
                height: 44, fontSize: 14, fontWeight: 500,
                backgroundColor: '#F1F5F9', color: '#334155',
                border: 'none', borderRadius: 12, cursor: 'pointer',
                transition: 'opacity 120ms',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function YellowRadioCardSO({ selected, onClick, title, description, badge }: {
  selected: boolean; onClick: () => void; title: string; description: string; badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        width: '100%', padding: '12px 14px', textAlign: 'left',
        backgroundColor: selected ? '#FFFBEB' : '#FFFFFF',
        border: `1px solid ${selected ? '#F59E0B' : '#E5E7EB'}`,
        borderRadius: 10, cursor: 'pointer',
        transition: 'all 120ms',
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: selected ? '0 0 0 3px rgba(245,158,11,0.12)' : 'none',
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 18, height: 18, marginTop: 2,
          borderRadius: '50%',
          border: `2px solid ${selected ? '#0A77FF' : '#94A3B8'}`,
          backgroundColor: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 120ms',
        }}
      >
        {selected && (
          <span style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#0A77FF' }} />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>{title}</span>
          {badge && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: '#B45309', backgroundColor: '#FEF3C7',
              border: '1px solid #FDE68A',
              padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
            }}>
              {badge}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 3, lineHeight: 1.45 }}>{description}</div>
      </div>
    </button>
  );
}
