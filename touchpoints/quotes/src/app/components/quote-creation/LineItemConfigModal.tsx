// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XCircle, Search, X, Package, Truck, DollarSign, Warehouse, Settings, Info, Check, ChevronDown, ChevronsDown, ChevronsUp, Calendar, AlertCircle, FileText, Upload, Paperclip, Percent, TrendingUp, TrendingDown, Plus, Minus, Sparkles, Tag, BadgePercent, Pencil, Hash, Lightbulb, MoreVertical, Image as ImageIcon, FileArchive, User, Clock, Trash2, Eye, EyeOff, CornerUpLeft, RefreshCw, FileCheck, Film, Link2, Play, Images, Download, Maximize2, Layers, Zap, MapPin, CircleSlash, CirclePlus, Lock, Infinity as InfinityIcon, CalendarDays, ExternalLink, HeartPulse, Activity, PieChart, CheckCircle2 } from 'lucide-react';
import { AttachmentCard, RenameAttachmentDialog } from '@/app/components/shared/attachments/attachment-card';
import { AttachmentPreviewModal } from '@/app/components/shared/attachments/attachment-preview-modal';
import { toast } from 'sonner';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { PricingRulePresetModal } from '@/app/components/shared/PricingRulePresetModal';
import { ConfirmationModal } from '@/app/components/ConfirmationModal';
import { AdjustmentFormModal } from '@/app/components/shared/AdjustmentFormModal';
import type { AdjustmentFormData, AdjustmentAttachment } from '@/app/components/shared/AdjustmentFormModal';
import { AttachedLinkChip } from '@/app/components/shared/AttachedLinkChip';
import { LinkPickerPopover } from '@/app/components/shared/LinkPickerPopover';
import { getLinksForId, subscribeToLinksRepository, type ExternalLink as RepositoryLink } from '@/app/data/linksRepository';
import {
  getLineItemAttachments,
  subscribeLineItemAttachments,
  addLineItemAttachment,
  removeLineItemAttachment,
  renameLineItemAttachment,
  type LineItemAttachment,
} from '@/app/data/quoteStore';
import { SwitchFreightModeConfirm, splitEvenly } from '@/app/components/shared/SwitchFreightModeConfirm';
import { FreightSplitOverlay } from '@/app/components/shared/FreightSplitOverlay';
import { EmptyPlaceholder } from '@/app/components/shared/EmptyPlaceholder';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/app/components/ui/tooltip';
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
import { useItemQuickView } from '@/app/components/shared/ItemQuickView';
import { ComingSoonBanner } from '@/app/components/shared/ComingSoonBanner';
import { LotTrackingTag } from '@/app/components/shared/LotTrackingTag';
import { ItemTypeBadge, itemTypeLabel } from '@/app/components/shared/ItemTypeBadge';
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
import { ShipmentMethodModal, DEFAULT_SHIPMENT, describeShipment, SHIPMENT_CARRIERS as NEW_SHIPMENT_CARRIERS, type ShipmentConfig } from './ShipmentMethodModal';

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
    /** The line's stored UoM (name, e.g. 'EA', 'Box', 'Gallon').
     *  Without this declared, `item.uom` accessed at the formData
     *  init silently resolved to `undefined` and the configurator
     *  fell back to the product's primary — so a Box-priced row
     *  opened on EA. */
    uom?: string;
  };
  onSave: (updatedItem: any) => void;
  readOnly?: boolean;
  /** Customer name on the parent quote — forwarded to the pricing-rule preset
   *  modal so the subtitle reflects the customer–item pair. */
  customerName?: string;
  /** Fires whenever a per-line pricing-rule or adjustment action constitutes
   *  a material change to the quote (activate, deactivate, library
   *  apply/remove, adjustment add/edit/unapply/reapply, bulk-deactivate).
   *  Parent decides whether to prompt for a new version based on stage.
   *  The optional `onRevert` callback runs when the user discards the
   *  version prompt so the per-line mutation is undone — without it,
   *  cancelling left a phantom rule/adjustment change on the line. */
  onMaterialEvent?: (description: string, onRevert?: () => void) => void;
  /** Post-draft: library Apply/Remove/Activate/Deactivate edit the
   *  customer's rule book only — they do NOT touch this line's rules and
   *  do NOT fire onMaterialEvent. Per-line and adjustment actions still
   *  fire onMaterialEvent and trigger the version prompt because they
   *  explicitly modify the rule on the current line. */
  stageLibraryChanges?: boolean;
  /** Shared pricing-rules state from QuoteDetails. When provided
   *  alongside `lineId`, the configurator subscribes to it so summary-
   *  modal activate/deactivate shows up here in real time. */
  pricingAPI?: PricingRulesAPI;
  /** Quote line id — needed to address per-line activation through
   *  pricingAPI. */
  lineId?: string;
  /** Shared one-time-adjustments state from QuoteDetails. When provided
   *  alongside `lineId`, the configurator's per-line adjustments list
   *  stays in lockstep with the summary modal. */
  adjustmentsAPI?: import('../quote-details/useAdjustments').AdjustmentsAPI;
  /** Quote-level freight charge. When present and `> 0`, the Override
   *  button triggers the same Partner-style split confirmation the
   *  freight breakdown modal uses; on confirm the parent seeds all
   *  siblings with the even split (via `onSeedSiblingFreightShares`)
   *  and this line lands on the same share so the user can edit it. */
  quoteDefaultFreight?: number;
  /** Total line count including this line — used for the split math
   *  and the confirmation copy. */
  siblingLineCount?: number;
  /** True if any other line already carries a per-line freight cost.
   *  When true the configurator is already in per-line mode globally,
   *  so the Override action just sets this line's cost without prompt. */
  anyOtherLineHasOverride?: boolean;
  /** Called when the user confirms the first per-line override. Parent
   *  uses this to seed all sibling lines with the same `sharePerLine`
   *  value (computed via `splitEvenly`), so the summary total stays
   *  equal to the previous quote-level charge until the user edits. */
  onSeedSiblingFreightShares?: (sharePerLine: number) => void;
  /** Parent record id — forwarded to AdjustmentFormModal so the
   *  internal-notes field surfaces the link-picker affordance backed
   *  by the shared linksRepository. */
  docId?: string;
  /** Current user, used to attribute inline-added links. */
  currentUser?: string;
  /** Key for the shared line-item attachment registry in `quoteStore`.
   *  The quote NUMBER, not `docId` — the Quote Detail Attachments tab
   *  reads the registry by number, so writes here must use the same key
   *  or the two surfaces silently diverge. When absent (standalone use,
   *  before a quote exists) the Attachments tab falls back to a local
   *  list. */
  attachmentScopeKey?: string;
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

/* Projection of the shared customer rule book — IDs match
   CUSTOMER_PRICING_RULES_BY_ID so the configurator and the summary modal
   operate on the same id space (required for cross-modal sync via the
   shared pricingAPI). */
import { CUSTOMER_PRICING_RULES, CUSTOMER_PRICING_RULES_BY_ID, evaluateRuleForLine } from '../quote-details/pricingRulesData';
import type { PricingRulesAPI } from '../quote-details/usePricingRules';

const PRICING_RULES = CUSTOMER_PRICING_RULES.map((r) => {
  const t0 = r.tiers[0];
  const sign = r.type === 'premium' ? -1 : 1;
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    discount: sign * t0.rate,
    minQuantity: t0.minQty,
    status: 'applied' as const,
    type: r.type,
  };
});

const WAREHOUSES = [
  { id: 'all', name: 'All Facilities', location: 'Combined Inventory', stock: 750, reserved: 160, inProduction: 295, onOrder: 600 },
  { id: 'wh-001', name: 'Conversion Plant - OH', location: 'Columbus, OH', stock: 250, reserved: 50, inProduction: 100, onOrder: 200 },
  { id: 'wh-002', name: 'Assembly Center - PA', location: 'Lancaster, PA', stock: 180, reserved: 30, inProduction: 75, onOrder: 150 },
  { id: 'wh-003', name: 'South Build Facility - TX', location: 'San Antonio, TX', stock: 320, reserved: 80, inProduction: 120, onOrder: 250 },
];

const ITEM_STATES = [
  { id: 'published', label: 'Published', color: 'rgba(5, 150, 105, 0.15)', textColor: 'var(--success-foreground)' },
  { id: 'pending-approval', label: 'Pending Approval', color: '#FEF3C7', textColor: '#92400E' },
  { id: 'approved', label: 'Approved', color: 'var(--accent)', textColor: 'var(--primary)' },
  { id: 'on-hold', label: 'On Hold', color: '#FEE2E2', textColor: 'var(--destructive)' },
  { id: 'ready-to-ship', label: 'Ready to Ship', color: '#E7F3FF', textColor: '#0A4FB3' },
];

/* UoM data is now centralised in `../../data/uomSets`. The local
   `UNITS_OF_MEASURE` alias is kept as the discrete-set fallback for
   any older lookup; per-product lookups happen below via
   `getUomSetForProduct` so liquid/length items surface their real
   sets instead of being forced through the discrete dropdown. */
import {
  UOM_SETS,
  getUomSetForProduct,
  getPrimaryUomForProduct,
  findUomById,
  findSetContainingUom,
} from '../../data/uomSets';
const UNITS_OF_MEASURE = UOM_SETS.discrete.map((u) => ({ ...u, abbreviation: u.name }));

/* Fallback seed for the unbound case only.
 *
 * With a parent quote (`attachmentScopeKey`) the configurator reads and
 * writes quoteStore's line-item attachment registry, the same store the
 * Quote Detail Attachments tab uses. Opened standalone (e.g. from the
 * product picker, before the quote exists) there is nothing to bind to,
 * so it falls back to this local list. */
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
  isOpen, onClose, item, onSave, readOnly, customerName, onMaterialEvent,
  stageLibraryChanges = false, pricingAPI, lineId, adjustmentsAPI,
  quoteDefaultFreight, siblingLineCount, anyOtherLineHasOverride,
  onSeedSiblingFreightShares, docId, currentUser, attachmentScopeKey,
}: LineItemConfigModalProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  // Item peek modal — opens when user taps the product thumbnail in the
  // configurator's right-panel product card.
  const { open: openItemQuickView, modal: itemQuickViewModal } = useItemQuickView();
  const [formData, setFormData] = useState({
    quantity: item.quantity,
    /* Read the line's stored UoM verbatim (lowercased so it matches
       the central uomSets ids). Falling back to the product's primary
       only when the line itself doesn't carry one — never 'ea' as a
       blind default, which silently overwrote Box/Carton/Gallon lines
       with EA every time the configurator opened. */
    uom: ((item.uom || findUomById(getPrimaryUomForProduct({ id: item.productId, name: item.name }))?.id) || 'ea').toString().toLowerCase(),
    unitPrice: item.unitPrice,
    discount: item.discount,
    shipmentMethod: item.shipmentMethod || 'courier-pickup',
    shipmentProvider: (item as any).shipmentProvider || 'hansen',
    pickupLocation: (item as any).pickupLocation || 'loc-001',
    trackingNumber: (item as any).trackingNumber || '',
    isShipmentOverride: false,
    /* New shipment model. Always merge any provided fields on top of
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
    /* Each appliedRules entry tracks isApplied so unapplied rules stay in the
       list (grayed out) rather than being removed. unappliedReason explains
       why — manual user action vs the 100% discount cap auto-unapplying. */
    /* Default to the three customer-level rules so the line item starts
       in sync with what the quote-summary shows. The broader PRICING_RULES
       list still backs the library so users can apply any of those from
       there.
       To demo the EMPTY-state on a specific line, give the line a
       pricingRule value of "none", or use an item id of "5" / ending in
       "-empty" / "-005" / "-5" (the 5th line is the reference
       empty-state row); the seed below collapses to [] for that line.
       Quote's items table seeds line ids as bare digits ("1"…"7"), so
       id === "5" catches the 5th row there; SO-style line ids look
       like "SOL-{i}-{j}" so we also accept any id ending in "-5". */
    /* When the shared pricingAPI is provided, seed appliedRules from the
       per-line activation state in the API. This is what keeps the
       configurator + summary modal aligned on open. */
    appliedRules: (() => {
      if (pricingAPI && lineId) {
        return pricingAPI.state.attached
          .filter((r) => r.appliesToItemCodes.includes((item as any).productId))
          .map((r) => ({
            ruleId: r.id,
            isApplied:
              !pricingAPI.state.deactivatedRuleIds.has(r.id) &&
              (pricingAPI.state.activatedLineIdsByRule.get(r.id)?.has(lineId) ?? false),
            unappliedReason: undefined as undefined | 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT',
          }));
      }
      return [] as Array<{ ruleId: string; isApplied: boolean; unappliedReason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT' }>;
    })(),
    /* Seed item-scope adjustments touching this line from the shared
       API so the configurator opens already in sync with the summary
       modal. The useEffect below keeps them aligned thereafter. */
    oneTimeAdjustments: ((): Array<{
      id: string;
      type: 'discount' | 'premium';
      amountType: '$' | '%';
      amount: number;
      label: string;
      internalNotes?: string;
      attachments?: AdjustmentAttachment[];
      isApplied: boolean;
      unappliedReason?: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT';
    }> => {
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
      /* No shared API (quote creation): the draft line carries its own
         adjustments from the last save, so reopening keeps them. */
      return (item as any).oneTimeAdjustments ?? [];
    })(),
    warehouse: item.warehouse || 'all',
    leadTime: item.leadTime || '5-7 days',
    tax: item.tax || 8.5,
    notes: item.notes || '',
    showNotesInPdf: false,
    state: 'published',
  });

  const [showShipmentDropdown, setShowShipmentDropdown] = useState(false);
  /* Cross-modal sync: mirror the shared pricingAPI's per-line activation
     into formData.appliedRules on every state change so summary-modal
     deactivations show up here in real time. */
  useEffect(() => {
    if (!pricingAPI || !lineId) return;
    const next = pricingAPI.state.attached
      .filter((r) => r.appliesToItemCodes.includes((item as any).productId))
      .map((r) => ({
        ruleId: r.id,
        isApplied:
          !pricingAPI.state.deactivatedRuleIds.has(r.id) &&
          (pricingAPI.state.activatedLineIdsByRule.get(r.id)?.has(lineId) ?? false),
        unappliedReason: undefined as undefined | 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT',
      }));
    setFormData((prev: any) => {
      const cur = prev.appliedRules;
      const same =
        cur.length === next.length &&
        cur.every((e: any, i: number) => e.ruleId === next[i].ruleId && e.isApplied === next[i].isApplied);
      return same ? prev : { ...prev, appliedRules: next };
    });
  }, [pricingAPI?.state, lineId, (item as any).productId]);

  /* Mirror the shared adjustmentsAPI's item-scope adjustments touching
     this line into formData.oneTimeAdjustments. Same diff-then-set
     pattern as the pricing-rule sync above. */
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
    setFormData((prev: any) => {
      const cur = prev.oneTimeAdjustments;
      const same =
        cur.length === next.length &&
        cur.every((e: any, i: number) =>
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

  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  /* Toggle that controls whether deactivated rules show up in the
     pricing rules list. Default off — deactivated rules are hidden so
     the list reads as currently-active rules first. */
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
     Bound to quoteStore's line-item attachment registry whenever the
     configurator has a parent quote (`attachmentScopeKey`). That registry
     is shared with the Quote Detail Attachments tab's Item Attachments
     folder, so a file added or deleted here shows up there and the other
     way round.

     Opened standalone (no quote yet) there is nothing to bind to, so it
     falls back to a local list seeded from DEFAULT_ATTACHMENTS. */
  const quoteKey = attachmentScopeKey;
  const attachedItemId = item.productId;
  const attachedItemLabel = item.name;
  const boundToStore = !!quoteKey;
  const attachmentUploader = currentUser || 'You';

  const [storeAtts, setStoreAtts] = useState<LineItemAttachment[]>(
    () => (boundToStore ? getLineItemAttachments(quoteKey!, attachedItemId) : []),
  );
  useEffect(() => {
    if (!boundToStore) return;
    setStoreAtts(getLineItemAttachments(quoteKey!, attachedItemId));
    return subscribeLineItemAttachments(quoteKey!, () =>
      setStoreAtts(getLineItemAttachments(quoteKey!, attachedItemId)),
    );
  }, [boundToStore, quoteKey, attachedItemId]);

  const [localAtts, setLocalAtts] = useState<LineItemAttachment[]>(() =>
    DEFAULT_ATTACHMENTS.map((a) => ({
      id: a.id, name: a.name, type: a.type, size: a.size,
      uploadedBy: a.uploadedBy, uploadedAt: a.uploadedAt,
      previewUrl: a.preview, itemId: 'local', itemLabel: 'local',
    })),
  );
  const lineAttachments = boundToStore ? storeAtts : localAtts;

  const attachFile = (att: LineItemAttachment) => {
    if (boundToStore) { addLineItemAttachment(quoteKey!, att); return; }
    setLocalAtts((prev) => [att, ...prev]);
  };
  const detachFile = (attId: string) => {
    if (boundToStore) { removeLineItemAttachment(quoteKey!, attId); return; }
    setLocalAtts((prev) => prev.filter((a) => a.id !== attId));
  };
  const renameFile = (attId: string, name: string) => {
    if (boundToStore) { renameLineItemAttachment(quoteKey!, attId, name); return; }
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
     quote" instead, so it is never shown in both places at once.
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
    const stamp = new Date().toISOString().slice(0, 10);
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
          type: item.ext,
          uploadedAt: stamp,
          previewUrl: item.previewUrl,
          itemId: attachedItemId,
          itemLabel: attachedItemLabel,
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
     so we do not pretend to: the copy is independent from this moment on,
     and later changes to the item master never reach it. */
  const addGalleryFile = (media: typeof GALLERY_MEDIA[number], opts?: { silent?: boolean }) => {
    attachFile({
      id: `att-gallery-${media.id}-${Date.now()}`,
      name: `${media.name}.${media.type === 'video' ? 'mp4' : 'jpg'}`,
      type: media.type === 'video' ? 'mp4' : 'jpg',
      size: media.type === 'video' ? '48.2 MB' : '3.8 MB',
      uploadedBy: media.uploadedBy,
      uploadedAt: media.uploadedAt,
      previewUrl: media.url,
      itemId: attachedItemId,
      itemLabel: attachedItemLabel,
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
           Quote": the master still has its own, and the card returns to
           the Item Master Gallery tab. An uploaded file exists only here,
           so that one really is a delete. */
        label: file.galleryId ? 'Remove from Quote' : 'Delete',
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

  /* Swallow Escape at the capture phase so host modals (e.g. the
     Create-Quote wizard) which also listen for Escape at window level
     don't ALSO close themselves when the user dismisses this
     configurator. Without this, pressing Esc in the configurator
     triggers the parent's slideDown fade-out animation, which leaves
     the dark backdrop briefly visible as the only thing on screen —
     reading as a "view goes black" flash before the parent unmounts. */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (typeof (e as any).stopImmediatePropagation === 'function') {
          (e as any).stopImmediatePropagation();
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedShipment = SHIPMENT_METHODS.find(m => m.id === formData.shipmentMethod);
  const selectedWarehouse = WAREHOUSES.find(w => w.id === formData.warehouse);
  /* Per-product UoM set — liquid items surface Liter/Gallon/Drum,
     length items surface Foot/Yard/Roll, discrete items keep
     EA/Box/Carton/Pallet. The hardcoded `UNITS_OF_MEASURE` discrete
     fallback only kicks in when the product isn't resolvable. */
  const productSet = getUomSetForProduct({ id: item.productId, name: item.name }).map((u) => ({ ...u, abbreviation: u.name }));
  const activeUomSet = productSet.length > 0 ? productSet : UNITS_OF_MEASURE;
  /* The line's stored UoM may not be in the product's set (e.g.
     stale "EA" on a product whose set is now liquid). Search the
     active set first; otherwise scan every set so we don't render an
     empty label. */
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
  /* Each entry now carries an isApplied flag — unapplied rules stay in the
     list (grayed out) but contribute 0 to totals. We surface the same flag
     downstream so the row can render a different state. Mirrors Sales Order
     V5's LineItemConfigModal. */
  const appliedRulesDiscounts = formData.appliedRules
    .map(entry => {
      const rule = PRICING_RULES.find(r => r.id === entry.ruleId);
      if (!rule) return { id: entry.ruleId, name: '', amount: 0, percentage: 0, isApplied: entry.isApplied, unappliedReason: entry.unappliedReason };
      const meetsThreshold = formData.quantity >= rule.minQuantity;
      // isActive = applied AND threshold met. Calculations skip rows where
      // isApplied === false (unapplied stays in list but contributes 0).
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

  /* 100% discount cap — total *applied* discount $ across pricing rules
     and one-time discounts cannot exceed the line's base subtotal.
     Premiums are excluded from this calculation. */
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

  /* Cap helpers — `wouldExceedCap` is used both when adding a new rule and
     when re-applying a previously-unapplied one. `ruleDiscountAmount` is
     the projected $ a rule would contribute given the current quantity. */
  const wouldExceedCap = (incrementalDiscountAmount: number) =>
    baseSubtotal > 0 && (totalActiveDiscountAmount + incrementalDiscountAmount) > baseSubtotal;

  const ruleDiscountAmount = (ruleId: string): number => {
    const rule = PRICING_RULES.find(r => r.id === ruleId);
    if (!rule || rule.discount <= 0) return 0;
    if (formData.quantity < rule.minQuantity) return 0;
    return baseSubtotal * rule.discount / 100;
  };

  /* Apply or re-apply a rule by id. Existing entry → flip isApplied=true and
     clear reason. New rule → push entry with isApplied=true. If applying
     a discount-type rule would exceed 100% of the line price, the entry is
     pushed/updated with isApplied=false + EXCEEDS_100_PERCENT instead. */
  const applyRuleEntry = (ruleId: string, opts: { silent?: boolean } = {}) => {
    const ruleName = PRICING_RULES.find(r => r.id === ruleId)?.name ?? ruleId;
    /* Snapshot pre-state for the revert path. We need both the local
       formData.appliedRules (which setFormData mutates) and the global
       deactivated flag (since applyRuleEntry can reactivate a globally-
       deactivated rule). */
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
    /* Cross-modal sync: propagate to the shared API. */
    if (pricingAPI && lineId && didActivate) {
      if (wasGloballyDeactivated) pricingAPI.reactivateRule(ruleId);
      pricingAPI.setRuleActiveOnLines(ruleId, [lineId], true);
    }
    /* silent=true is used by library-originated callers — library never
       triggers the version prompt, so suppress the material event. */
    if (didActivate && !opts.silent) {
      onMaterialEvent?.(
        `Activated pricing rule "${ruleName}" on line "${item.name}"`,
        () => {
          /* Revert path — undo both the cross-modal API sync and the
             local formData mutation so a discarded version prompt
             snaps the per-line rule list back to what it was. */
          if (pricingAPI && lineId) {
            pricingAPI.setRuleActiveOnLines(ruleId, [lineId], false);
            if (wasGloballyDeactivated) pricingAPI.deactivateRule(ruleId);
          }
          setFormData(prev => ({ ...prev, appliedRules: prevAppliedRules }));
        },
      );
    }
  };

  const unapplyRuleEntry = (
    ruleId: string,
    reason: 'USER_UNAPPLIED' | 'EXCEEDS_100_PERCENT' = 'USER_UNAPPLIED',
    opts: { silent?: boolean } = {},
  ) => {
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
    if (reason === 'USER_UNAPPLIED' && wasApplied && !opts.silent) {
      onMaterialEvent?.(
        `Deactivated pricing rule "${ruleName}" on line "${item.name}"`,
        () => {
          /* Revert path — re-activate the rule on this line and put
             the local formData entry back to its pre-deactivation shape. */
          if (pricingAPI && lineId) {
            pricingAPI.setRuleActiveOnLines(ruleId, [lineId], true);
          }
          setFormData(prev => ({ ...prev, appliedRules: prevAppliedRules }));
        },
      );
    }
  };

  const addAdjustment = () => {
    if (newAdjustment.amount > 0 && newAdjustment.label) {
      if (editingAdjustmentId) {
        /* Snapshot the pre-edit adjustment so a discarded version
           prompt can restore the original values. */
        const before = formData.oneTimeAdjustments.find(a => a.id === editingAdjustmentId);
        const beforeApiAdj = adjustmentsAPI?.adjustments.find(a => a.id === editingAdjustmentId);
        if (adjustmentsAPI) {
          adjustmentsAPI.updateAdjustment(editingAdjustmentId, {
            type: newAdjustment.type, amountType: newAdjustment.amountType,
            amount: newAdjustment.amount, label: newAdjustment.label,
          });
        } else {
          setFormData({
            ...formData,
            oneTimeAdjustments: formData.oneTimeAdjustments.map(adj =>
              adj.id === editingAdjustmentId ? { ...adj, ...newAdjustment, id: adj.id } : adj,
            ),
          });
        }
        onMaterialEvent?.(
          `Updated ${newAdjustment.type === 'premium' ? 'premium' : 'discount'} "${newAdjustment.label}" on line "${item.name}"`,
          () => {
            if (adjustmentsAPI && beforeApiAdj) {
              adjustmentsAPI.updateAdjustment(editingAdjustmentId, {
                label: beforeApiAdj.label,
                type: beforeApiAdj.type,
                amountType: beforeApiAdj.amountType,
                amount: beforeApiAdj.amount,
              });
            } else if (before) {
              setFormData(prev => ({
                ...prev,
                oneTimeAdjustments: prev.oneTimeAdjustments.map(adj =>
                  adj.id === editingAdjustmentId ? before : adj,
                ),
              }));
            }
          },
        );
      } else {
        const incremental =
          newAdjustment.type === 'discount'
            ? (newAdjustment.amountType === '%' ? baseSubtotal * newAdjustment.amount / 100 : newAdjustment.amount)
            : 0;
        const exceeds = wouldExceedCap(incremental);
        if (exceeds) toast.warning('Adjustment kept but unapplied — would exceed 100% of line price.');
        let createdId: string | null = null;
        let createdLocalAdj: any = null;
        if (adjustmentsAPI && lineId) {
          const created = adjustmentsAPI.addAdjustment({
            label: newAdjustment.label, type: newAdjustment.type,
            amountType: newAdjustment.amountType, amount: newAdjustment.amount,
            scope: 'item', appliedTo: [lineId],
          });
          if (exceeds) adjustmentsAPI.unapplyAdjustment(created.id, 'EXCEEDS_100_PERCENT');
          createdId = created.id;
        } else {
          createdLocalAdj = {
            ...newAdjustment,
            id: `adj-${Date.now()}`,
            isApplied: !exceeds,
            unappliedReason: exceeds ? ('EXCEEDS_100_PERCENT' as const) : undefined,
          };
          setFormData({
            ...formData,
            oneTimeAdjustments: [
              ...formData.oneTimeAdjustments,
              createdLocalAdj,
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
            } else if (createdLocalAdj) {
              setFormData(prev => ({
                ...prev,
                oneTimeAdjustments: prev.oneTimeAdjustments.filter(a => a.id !== createdLocalAdj.id),
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

  /* Re-apply an unapplied adjustment, re-checking the cap at this point. */
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
             restores the previous entry; the local formData branch
             just re-inserts the snapshot. */
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

  /* Backwards-compat: PresetModal callbacks still hand us a single ruleId
     and expect a toggle. Map that to the new entry-based helpers so the
     library flow keeps working. */
  const togglePricingRule = (ruleId: string) => {
    const existing = formData.appliedRules.find(e => e.ruleId === ruleId);
    if (existing && existing.isApplied) unapplyRuleEntry(ruleId, 'USER_UNAPPLIED');
    else applyRuleEntry(ruleId);
  };

  /* Per-row unapply confirmation. Reuses the existing ConfirmationModal. */
  /* Confirmation for removing a one-time adjustment. One-times are
     "applied / edit / remove" only (no deactivate/reactivate cycle
     like pricing rules), so the row exposes a trash icon that opens
     this prompt. */
  const [removeAdjConfirm, setRemoveAdjConfirm] = useState<{ id: string; label: string } | null>(null);

  /* Freight Override → first time only: parent provides
     `quoteDefaultFreight`, `siblingLineCount`, `anyOtherLineHasOverride`,
     and `onSeedSiblingFreightShares`. When the user clicks Override
     and the quote is still in quote-level mode (no sibling overrides
     yet), we show the same Partner-style split confirmation the
     freight breakdown modal uses, then seed every sibling with the
     even share and land this line on the same share. After that the
     user can edit this line to a different value. */
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
  // Reapply confirmation — symmetric twin of unapplyConfirm. Shown when
  // the user clicks the + icon on a manually-deactivated row to bring
  // it back without leaving the configurator.
  const [reapplyConfirm, setReapplyConfirm] = useState<
    | { kind: 'rule'; ruleId: string; name: string }
    | { kind: 'adjustment'; adjId: string; label: string }
    | null
  >(null);

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
    const colors = ['var(--primary)', '#60A5FA', 'rgba(10, 119, 255, 0.4)', 'var(--accent)'];
    const eaEquiv = Math.round(onHand * (uomDistribution[i]?.pctOfTotal || 0));
    const qty = uom.multiplier === 1 ? eaEquiv : Math.round(eaEquiv / uom.multiplier);
    const pct = onHand > 0 ? Math.round((eaEquiv / onHand) * 100) : 0;
    return { ...uom, qty, eaEquiv, pct, color: colors[i % colors.length] };
  });

  const hasAppliedRules = appliedRulesDiscounts.filter(r => r.name).length > 0;

  /* Portal the whole modal into document.body. The host (e.g. the Quote
     creation modal) wraps its content in a `transform`-animated card,
     and a CSS `transform` on an ancestor establishes a containing block
     for `position: fixed`, trapping this modal's `fixed inset-0`
     backdrop inside the host card. That caused the "view goes black on
     close" bug because the configurator backdrop sat under the host's
     backdrop in the trapped stacking context. Portaling here moves the
     subtree to <body>, where it truly anchors to the viewport. */
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 11000, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(2px)' }}
      /* Stop click propagation unconditionally so a click on this
         configurator NEVER bubbles through React tree into the host
         modal (the Quote create wizard listens for clicks on its own
         backdrop to close itself, and React keeps bubbling events
         through the component tree even when this subtree is portaled
         out of the DOM). Only a click whose `target === currentTarget`
         (i.e. the user clicked the backdrop itself, not the white
         card) counts as "close this configurator". */
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
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
        <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0" style={{ borderRadius: '6px' }}>
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
                  {readOnly ? 'View Line Item' : 'Advanced Configurator'}
                </h2>
                {readOnly && (
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)', padding: '2px 8px', borderRadius: '4px', lineHeight: '1', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>
                    View Only
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Render the actual product code (SKU) — the previous
                    `generateItemId(item.id)` hashed the line-item id
                    into a fake "000-000-NNN" string that drifted away
                    from the row's real product code (e.g., row showed
                    "000-100-171" but modal showed "000-000-008").
                    `item.productId` is the canonical SKU on every
                    line; `item.sku` is the same value on rows that
                    were seeded directly from a product. */}
                <p className="text-[11px] text-muted-foreground">{item.productId || item.sku || generateItemId(item.id)}</p>
                {/* Inactive only in the header. The product card below
                    carries Active / Inactive in full, so an active item
                    gets no second green chip up here. */}
                <InactiveItemPill code={item.productId || item.sku} size="md" noun="quote" />
                {item.isSerialized !== undefined && (
                  <ItemTypeBadge type={itemTypeLabel(item.isSerialized, item.isLotControlled)} />
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors flex-shrink-0" style={{ borderRadius: '6px' }}>
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content - Two Panel Layout */}
        <div className="flex-1 overflow-hidden flex">

          {/* ===== LEFT PANEL - Tabbed (Inventory / Attachments / Gallery) ===== */}
          <div className="overflow-hidden flex flex-col border-r border-border" style={{ minWidth: 0, width: '50%', flexShrink: 0 }}>
            {/* Left Panel Tabs */}
            <div className="flex border-b border-border flex-shrink-0 px-5 pt-1 bg-white">
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
                  className={`flex items-center justify-center gap-1.5 px-4 py-2.5 text-[12px] transition-colors border-b-2 ${leftTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-[#F0F7FF]'}`}
                  style={{ fontWeight: 500 }}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.count !== null && (
                    <span
                      className={`inline-flex items-center justify-center px-1.5 min-w-[18px] h-[18px] text-[10px] ${leftTab === tab.id ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'}`}
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
                    <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 400 }}>Data view as of 02/17/2026 2:32 PM</span>
                    <button className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors" style={{ fontWeight: 500 }}>
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
                   renders on "Included in this Quote" so it can never
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
                       levels of the same thing. Same Partners-idiom
                       control used elsewhere in this repo (muted track,
                       white raised active pill, count badge), which is
                       the same job of switching between two sets of the
                       same list. */}
                  <div className="flex items-center px-5 pt-4 pb-3 shrink-0" style={{ gap: 12 }}>
                    <div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
                      {([
                        { key: 'included' as const, label: 'Included in this Quote', count: lineAttachments.length },
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
                           quote, or the item master. */
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
                       "to this quote" on the button would be words the
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
                              Remove {selectedFromMaster.length} from Quote
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
                              type={file.type}
                              size={file.size}
                              date={file.uploadedAt || ''}
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
                                  title="Copied from the item master gallery. This copy belongs to the quote and is not affected by later changes to the gallery."
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
                                fileType: file.type,
                                fileSize: file.size,
                                uploadedDate: file.uploadedAt || '',
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
                                  title="Copied from the item master gallery. This copy belongs to the quote and is not affected by later changes to the gallery."
                                >
                                  <Images className="w-2.5 h-2.5" /> From Item Master
                                </span>
                              ) : undefined}
                              onPreview={() => toast.info(`Preview: ${file.name}`)}
                              onDownload={() => toast.info(`Downloading ${file.name}...`)}
                              onCardClick={() => toast.info(`Preview: ${file.name}`)}
                              /* Deleting here deletes the file from the
                                 quote, so it also leaves the Attachments
                                 tab's Item Attachments folder. */
                              /* A file that came from the item master reads
                                 as "Remove from Quote", not "Delete": the
                                 master still has it and the card returns to
                                 the Item Master Gallery tab. An uploaded
                                 file exists only here, so that one really is
                                 a delete. Same split the Purchase Order
                                 configurator makes with "Remove from PO". */
                              removeScopeLabel={file.galleryId ? 'Quote' : undefined}
                              onDelete={readOnly ? undefined : () => {
                                detachFile(file.id);
                                toast.success(file.galleryId
                                  ? `"${file.name}" removed from this quote`
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
                            copy is the quote's and the gallery's own file
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
          <div className="overflow-hidden flex flex-col bg-muted/60" style={{ minWidth: 0, width: '50%', flexShrink: 0 }}>
            {/* Configuration & Pricing Content - scrollable */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="p-5 space-y-5">

              {/* Product Card - scrolls with content */}
              <div className="border border-border bg-white p-4" style={{ borderRadius: '12px' }}>
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
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    {/* Header: SKU + Acquisition pill (Purchased /
                        Manufactured) + ItemTypeBadge. The duplicate
                        Acquisition/Type row below the description was
                        removed — same pills are right here and
                        repeating them was UX noise. */}
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>{item.productId || item.sku || generateItemId(item.id)}</span>
                      {/* Item-master status straight after the code, the
                          place PO's Item Detail puts it. Active or Inactive. */}
                      <InactiveItemPill code={item.productId || item.sku} size="md" showActive noun="quote" />
                      <span
                        className="inline-flex items-center border shrink-0 whitespace-nowrap"
                        style={{
                          background: item.sourceType === 'Manufactured' ? '#F0FDF4' : '#EFF6FF',
                          color: item.sourceType === 'Manufactured' ? '#15803D' : '#1D4ED8',
                          borderColor: item.sourceType === 'Manufactured' ? '#BBF7D0' : '#BFDBFE',
                          padding: '2px 8px', borderRadius: 6, fontSize: 13, fontWeight: 500, lineHeight: 'normal',
                        }}
                      >{item.sourceType || 'Purchased'}</span>
                      <ItemTypeBadge type={itemTypeLabel(item.isSerialized, item.isLotControlled)} />
                    </div>
                    {isDescriptionExpanded ? (
                      <p className="text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 400, lineHeight: '1.5' }}>
                        {item.description}{' '}
                        <button onClick={() => setIsDescriptionExpanded(false)} className="hover:opacity-80 transition-colors text-[12px] inline-flex items-center" style={{ fontWeight: 500, gap: 3, verticalAlign: 'middle', color: '#0F62D6' }}>less <ChevronsUp style={{ width: 12, height: 12 }} /></button>
                      </p>
                    ) : (
                      <p className="text-[12px] text-muted-foreground mb-1.5" style={{ fontWeight: 400, lineHeight: '1.5' }}>
                        {item.description.length > 120 ? (
                          <>{item.description.slice(0, 120)}…{' '}<button onClick={() => setIsDescriptionExpanded(true)} className="hover:opacity-80 transition-colors text-[12px] inline-flex items-center" style={{ fontWeight: 500, gap: 3, verticalAlign: 'middle', color: '#0F62D6' }}>more <ChevronsDown style={{ width: 12, height: 12 }} /></button></>
                        ) : item.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quantity, Unit & Price Per Unit Card */}
              <div className="border border-border bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ borderRadius: '12px', overflow: 'visible' }}>
                {/* Quantity / Unit Row — unified capsule matching table pattern */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <span className="text-[12px] text-muted-foreground flex items-center gap-1.5"><Layers className="w-3 h-3 text-muted-foreground" />Quantity / Unit</span>
                  <div ref={uomDropdownRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'stretch', height: '32px', borderRadius: '6px', border: `1px solid ${showUomDropdown ? 'var(--accent)' : 'var(--border)'}`, backgroundColor: '#FFFFFF', overflow: 'visible', transition: 'border-color 100ms, background-color 100ms' }}>
                    {/* LEFT — Quantity input */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                      <input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        readOnly={readOnly}
                        style={{ width: '48px', height: '100%', border: 'none', textAlign: 'center', outline: 'none', fontSize: '13px', fontWeight: 600, color: 'var(--foreground)', fontFamily: 'Inter, system-ui, sans-serif', backgroundColor: 'transparent', padding: '0 2px' }}
                        min="1"
                      />
                    </div>
                    {/* DIVIDER */}
                    <div style={{ width: '1px', backgroundColor: 'var(--border)', flexShrink: 0, alignSelf: 'stretch' }} />
                    {/* RIGHT — UoM selector */}
                    {readOnly ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 10px', backgroundColor: 'rgba(241, 245, 249, 0.5)', borderRadius: '0 5px 5px 0', fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1' }}>{selectedUom?.abbreviation || 'EA'}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        ref={uomButtonRef}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleUomDropdown(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 10px', minWidth: '36px', border: 'none', backgroundColor: showUomDropdown ? 'rgba(241, 245, 249, 0.5)' : 'transparent', cursor: 'pointer', transition: 'background-color 100ms', fontFamily: 'Inter, system-ui, sans-serif', borderRadius: '0 5px 5px 0', whiteSpace: 'nowrap' }}
                        onMouseEnter={(e) => { if (!showUomDropdown) e.currentTarget.style.backgroundColor = 'rgba(241, 245, 249, 0.5)'; }}
                        onMouseLeave={(e) => { if (!showUomDropdown) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1' }}>{selectedUom?.abbreviation || 'EA'}</span>
                        <ChevronDown style={{ width: '11px', height: '11px', color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      </button>
                    )}
                    {/* UoM dropdown */}
                    {showUomDropdown && dropdownPosition && (
                      <div className="fixed bg-white border border-border shadow-lg" style={{ borderRadius: '12px', zIndex: 12000, top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px`, minWidth: '220px', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)' }}>
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
                                  /* PPU rescale stays within the same set
                                     (a Liter and a Box never interconvert),
                                     so we look multipliers up in the same
                                     `activeUomSet` we're rendering. */
                                  const oldMult = activeUomSet.find(u => u.id === formData.uom)?.multiplier ?? 1;
                                  const newMult = uom.multiplier;
                                  const scale = newMult / oldMult;
                                  const scaledUnitPrice = Math.round((formData.unitPrice || 0) * scale * 100) / 100;
                                  setFormData({ ...formData, uom: uom.id, unitPrice: scaledUnitPrice });
                                }
                                setShowUomDropdown(false);
                              }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderTop: 'none', borderRight: 'none', borderBottom: '1px solid var(--muted)', borderLeft: 'none', backgroundColor: isActive ? 'rgba(241, 245, 249, 0.5)' : 'transparent', cursor: 'pointer', transition: 'background-color 80ms', fontFamily: 'Inter, system-ui, sans-serif' }}
                              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(241, 245, 249, 0.5)'; }}
                              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = isActive ? 'rgba(241, 245, 249, 0.5)' : 'transparent'; }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500, color: 'var(--foreground)', lineHeight: '1', textAlign: 'left' }}>{uom.name}</span>
                                  {isPrimary && (
                                    /* Partner Management "Primary" pill —
                                        surfaces the product's preferred UoM
                                        consistently with every other
                                        dropdown across the module. */
                                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '9px', fontWeight: 600, color: '#1B6EF3', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '1px 5px', borderRadius: '3px', lineHeight: '1', textTransform: 'uppercase' as const, letterSpacing: '0.2px' }}>Primary</span>
                                  )}
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1', textAlign: 'left' }}>{uom.fullName}</span>
                              </div>
                              {isActive && (
                                <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                  <span className="text-[12px] text-muted-foreground flex items-center gap-1.5"><DollarSign className="w-3 h-3 text-muted-foreground" />Price Per Unit</span>
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
                      className={`w-24 h-7 px-2 text-[13px] text-foreground text-right border border-border focus:outline-none ${readOnly ? 'bg-muted/50 cursor-default' : 'bg-white focus:ring-1 focus:ring-primary'}`}
                      style={{ borderRadius: '6px', fontWeight: 500 }}
                    />
                    <span className="text-[11px] text-muted-foreground">per {selectedUom?.abbreviation}</span>
                  </div>
                </div>
              </div>

              {/* Pricing Rules Section — hidden entirely in read-only when
                  there are no rules applied to this line (no rules to view
                  and no action to take). */}
              {(hasAppliedRules || !readOnly) && (
              <div className="border border-border bg-white rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {hasAppliedRules ? (
                  <div>
                    {/* Header — Partner ContentCard chrome (icon chip
                        in accent circle + 13px/600 title). */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-muted">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                          <BadgePercent className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          Pricing Rules
                        </span>
                        {activeRulesCount > 0 && (
                          /* Matches the Partner CarrierShippingCard
                             Active pill (px-1.5 py-[2px] rounded-md
                             text-[10px] border, fontWeight 500). */
                          <span
                            className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap"
                            style={{
                              fontWeight: 500,
                              color: '#065F46',
                              backgroundColor: '#ECFDF5',
                              borderColor: '#A7F3D0',
                            }}
                          >
                            {activeRulesCount} active
                          </span>
                        )}
                        {/* (i) tooltip — explains what pricing rules are
                            and how they differ from one-time adjustments
                            (which are ad-hoc, single-quote/order edits). */}
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
                          <span className={`text-[13px] ${totalRulesDiscount > 0 ? 'text-success' : 'text-[#7C3AED]'}`} style={{ fontWeight: 600 }}>
                            {totalRulesDiscount > 0 ? '-' : '+'}{formatCurrency(Math.abs(totalRulesDiscount))}
                          </span>
                        )}
                        {!readOnly && hasAppliedRules && (
                          /* Master toggle — flips every rule on this
                             line. ON = at least one rule is active.
                             Turning OFF goes through the existing
                             confirmation; turning back ON reactivates
                             every deactivated rule in one shot (no
                             confirm — not destructive). */
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
                    {/* Rule bars — only fully-active rules render. Disabled
                        and unapplied rules are filtered out entirely; the
                        previous "Show disabled rules" toggle has been
                        removed per product direction. */}
                    {/* Show fully-active rules AND user-deactivated rules
                        (so they can be reactivated from here). Auto-unapplied
                        and inactive rules stay hidden. */}
                    {appliedRulesDiscounts.filter(rule => rule.name && (
                      (rule.isApplied && rule.isActive) ||
                      (!rule.isApplied && rule.unappliedReason === 'USER_UNAPPLIED')
                    )).map((rule, index) => {
                      const isPremium = rule.percentage < 0;
                      const isUnapplied = !rule.isApplied;
                      /* "Disabled" treatment — both Unapplied (manually) and Not Applied
                       * (threshold not met) render with a soft gray neutral; the pill
                       * (Unapplied vs Not Applied) is the only visual differentiator. */
                      const isDisabled = isUnapplied || !rule.isActive;
                      const leftBorderColor = isDisabled ? '#E5E7EB' : (isPremium ? '#7C3AED' : '#10B981');
                      const iconColor = isDisabled ? 'text-[#9CA3AF]' : (isPremium ? 'text-[#7C3AED]' : 'text-[#10B981]');
                      const percentageColor = iconColor;
                      const amountColor = iconColor;
                      // Derive Volume vs Value + tier count from minQuantity.
                      // Real basis/tier data flows from the preset once wired.
                      const isVolume = (rule.minQuantity ?? 0) > 0;
                      const tierLabel = isVolume ? `T1 of ${Math.max(2, Math.min(3, Math.ceil((rule.minQuantity ?? 0) / 2)))}` : null;
                      const filteredRules = appliedRulesDiscounts.filter(r => r.name && (
                        (r.isApplied && r.isActive) ||
                        (!r.isApplied && r.unappliedReason === 'USER_UNAPPLIED')
                      ));
                      const isLast = index === filteredRules.length - 1;
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
                            // Soft hairline divider — Sales Order's exact token, lighter
                            // than `--border` which read as a hard line.
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
                                <span className={`text-[12px] ${isDisabled ? 'text-[#9CA3AF]' : 'text-[#1F2937]'}`} style={{ fontWeight: 500, textDecoration: isDisabled ? 'line-through' : undefined }}>
                                  {rule.name}
                                </span>
                                {isUnapplied ? (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]" style={{ borderRadius: '3px', fontWeight: 500 }}>
                                    Deactivated
                                  </span>
                                ) : !rule.isActive && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]" style={{ borderRadius: '3px', fontWeight: 500 }}>
                                    Inactive
                                  </span>
                                )}
                              </div>
                              {/* Inline reason text — only on deactivated rows */}
                              {isUnapplied && rule.unappliedReason === 'EXCEEDS_100_PERCENT' && (
                                <div className="text-[10px] text-[#B45309] mt-0.5" style={{ fontWeight: 500 }}>
                                  Exceeds 100% of item price — deactivated automatically
                                </div>
                              )}
                              {isUnapplied && rule.unappliedReason === 'USER_UNAPPLIED' && (
                                <div className="text-[10px] text-[#6B7280] mt-0.5" style={{ fontWeight: 400 }}>
                                  Manually deactivated — click <CirclePlus className="inline w-2.5 h-2.5 align-text-bottom" /> to re-activate
                                </div>
                              )}
                              {!isUnapplied && rule.isPending && rule.minQuantity > 0 && (
                                <div className="text-[10px] text-[#92400E] mt-0.5" style={{ fontWeight: 400 }}>
                                  Requires min. {rule.minQuantity} units
                                </div>
                              )}
                              {/* Assisting pills — muted when rule is disabled (unapplied or not-applied) */}
                              <div className={`flex items-center gap-1 flex-wrap mt-1 ${isDisabled ? 'opacity-60' : ''}`}>
                                <span className="inline-flex items-center text-[11px] text-[#475569] bg-[#F1F5F9] border border-[#CBD5E1] px-2.5 py-0.5 rounded-full" style={{ fontWeight: 500 }}>
                                  {isVolume ? 'Volume' : 'Value'}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-[#475569] bg-[#F1F5F9] border border-[#E2E8F0] px-1.5 py-0.5 rounded-md" style={{ fontWeight: 500 }}>
                                  <InfinityIcon className="w-2.5 h-2.5" /> No expiry
                                </span>
                                {tierLabel && (
                                  <span className="inline-flex items-center text-[10px] text-[#475569] bg-[#F1F5F9] border border-[#E2E8F0] px-1.5 py-0.5 rounded-md tabular-nums" style={{ fontWeight: 500 }}>
                                    {tierLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 mt-[2px]">
                            <div className="text-right flex items-baseline justify-end gap-2" style={{ minWidth: 130 }}>
                              <span className={`text-[12px] ${percentageColor}`} style={{ fontWeight: 600, textDecoration: isDisabled ? 'line-through' : undefined }}>
                                {isPremium ? '+' : '-'}{Math.abs(rule.percentage)}%
                              </span>
                              <span className={`text-[11px] ${amountColor}`} style={{ fontWeight: 500, opacity: 0.8, textDecoration: isDisabled ? 'line-through' : undefined }}>
                                {isPremium ? '+' : '-'}{rule.isActive ? formatCurrency(Math.abs(rule.amount)) : formatCurrency(baseSubtotal * Math.abs(rule.percentage) / 100)}
                              </span>
                            </div>
                            {!readOnly && (
                              /* Partner Switch component replaces the
                                 old CircleSlash/CirclePlus buttons so
                                 the activate/deactivate affordance
                                 stays visible at all times. */
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
                        or otherwise not user-visible). Without this the
                        card collapsed to just the header + Manage link
                        with no copy explaining why. */}
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
              )}

              {/* One-Time Discounts/Premiums Section — hidden entirely in
                  read-only when there are no adjustments on this line. */}
              {(formData.oneTimeAdjustments.length > 0 || !readOnly) && (
              <div className="border border-border bg-white rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {formData.oneTimeAdjustments.length > 0 ? (
                  <div>
                    {/* Header — Partner ContentCard chrome. */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-muted">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                          <Zap className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>One-Time Discounts/Premiums</span>
                        {/* Scope pill so users can tell at-a-glance this
                            one-time affects only the current line, not
                            the whole quote. */}
                        <span
                          className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap shrink-0"
                          style={{ fontWeight: 500, color: '#475569', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
                        >
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
                            (positive) → purple. Mirrors the per-row
                            colors below + the Pricing Rules header. */}
                        <span className={`text-[13px] ${oneTimeTotal < 0 ? 'text-[#10B981]' : oneTimeTotal > 0 ? 'text-[#7C3AED]' : 'text-[#6B7280]'}`} style={{ fontWeight: 600 }}>
                          {oneTimeTotal < 0 ? '-' : '+'}{formatCurrency(Math.abs(oneTimeTotal))}
                        </span>
                        {/* Remove-all button. One-times only do
                            edit/remove (no deactivate cycle), so the
                            section's master action is a Trash that
                            wipes every entry after confirmation.
                            Sits in the same slot the master toggle
                            sits in on the Pricing Rules header so the
                            two sections feel symmetric. */}
                        {!readOnly && formData.oneTimeAdjustments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowDeleteAllAdjustmentsConfirm(true)}
                            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            aria-label="Remove all adjustments"
                            title="Remove all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Adjustment bars — Sales Order V5 pattern with grayed
                        treatment for unapplied entries (line-through, muted
                        text/icon/border, CirclePlus to re-apply, reason text). */}
                    {formData.oneTimeAdjustments.map((adj, index) => {
                      const amount = adj.amountType === '%' ? (baseSubtotal * adj.amount / 100) : adj.amount;
                      const isDiscount = adj.type === 'discount';
                      const isUnapplied = !adj.isApplied;
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
                                  <span className="text-[10px] px-1.5 py-0.5 bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]" style={{ borderRadius: '3px', fontWeight: 500 }}>
                                    Unapplied
                                  </span>
                                )}
                              </div>
                              {isUnapplied && adj.unappliedReason === 'EXCEEDS_100_PERCENT' && (
                                <div className="text-[10px] text-[#B45309] mt-0.5" style={{ fontWeight: 500 }}>
                                  Exceeds 100% of item price — unapplied automatically
                                </div>
                              )}
                              {isUnapplied && adj.unappliedReason === 'USER_UNAPPLIED' && (
                                <div className="text-[10px] text-[#6B7280] mt-0.5" style={{ fontWeight: 400 }}>
                                  Manually unapplied — click <CirclePlus className="inline w-2.5 h-2.5 align-text-bottom" /> to re-apply
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 mt-[2px]">
                            <div className="text-right flex items-baseline justify-end gap-2" style={{ minWidth: 130 }}>
                              <span className={`text-[12px] ${valueColor}`} style={{ fontWeight: 600, textDecoration: isUnapplied ? 'line-through' : undefined }}>
                                {isDiscount ? '-' : '+'}{adj.amount}{adj.amountType}
                              </span>
                              <span className={`text-[11px] ${valueColor}`} style={{ fontWeight: 500, opacity: 0.8, textDecoration: isUnapplied ? 'line-through' : undefined }}>
                                {isDiscount ? '-' : '+'}{formatCurrency(amount)}
                              </span>
                            </div>
                            {!readOnly && (
                              /* One-times use Edit + Remove (no
                                 deactivate/reactivate). Pencil
                                 opens the edit modal; trash opens
                                 the remove confirmation. The row
                                 click still opens edit too. */
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); editAdjustment(adj); }}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-primary hover:bg-[#EFF6FF] transition-colors cursor-pointer"
                                  aria-label="Edit adjustment"
                                  title="Edit"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setRemoveAdjConfirm({ id: adj.id, label: adj.label }); }}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
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
                    <span className="text-[13px] text-muted-foreground flex items-center gap-2" style={{ fontWeight: 400 }}>
                      <Zap className="w-3.5 h-3.5" />
                      One-Time Discounts/Premiums
                      {/* Scope pill — matches the populated-state header so
                          users learn the section is line-scoped before they
                          add anything. */}
                      <span
                        className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap shrink-0"
                        style={{ fontWeight: 500, color: '#475569', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
                      >
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
                      <button onClick={() => setShowAdjustmentModal(true)} className="h-7 px-2.5 flex items-center gap-1 text-[12px] text-primary border border-dashed border-primary/40 hover:bg-[#F0F9FF] hover:border-primary transition-colors" style={{ borderRadius: '6px', fontWeight: 500 }}>
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    )}
                  </div>
                )}
              </div>
              )}

              {/* Subtotal */}
              <div className="flex items-center justify-between px-1 py-1">
                <span className="text-[13px] text-foreground flex items-center gap-1.5" style={{ fontWeight: 500 }}><Tag className="w-3.5 h-3.5 text-muted-foreground" />Subtotal</span>
                <span className="text-[16px] text-foreground" style={{ fontWeight: 600 }}>{formatCurrency(baseSubtotal)}</span>
              </div>

              {/* Freight & Logistics card — Partner-style title row with
                  an Edit pencil + Reset CTA on the right makes it clear
                  the action operates on the whole card, not just the
                  first row. The rows below are read-only previews; the
                  shipment modal owns all editing. */}
              {(() => {
                const sCfg = formData.shipmentConfig;
                const sDesc = describeShipment(sCfg);
                const sCarrier = NEW_SHIPMENT_CARRIERS.find((c) => c.id === sCfg.carrierId);
                const sCarrierMethod = sCarrier?.methods.find((m) => m.id === sCfg.carrierMethodId);
                const isOverride = !!formData.isShipmentOverride;
                const hasCost = typeof sCfg.shipmentCost === 'number';
                return (
              <div className="border border-border bg-white overflow-hidden rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {/* Title bar — Partner ContentCard pattern: white
                    header, light divider, icon wrapped in an accent
                    chip, title 13px / weight 600. */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-muted">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                      <Truck className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Freight &amp; Logistics</span>
                    {isOverride ? (
                      <span className="px-1.5 py-0.5 bg-[#FEF3C7] text-[#92400E] text-[10px]" style={{ borderRadius: '3px', fontWeight: 600 }}>Line Override</span>
                    ) : (
                      <span
                        className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap shrink-0"
                        style={{ fontWeight: 500, color: '#475569', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
                      >
                        Inherits Quote Default
                      </span>
                    )}
                    {/* (i) tooltip — short explainer so users know what
                        this card covers and how the line-level override
                        differs from the quote-level default. */}
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
                        Set how this line ships, the carrier, the service level, the pickup warehouse, and any line-specific freight cost. By default the line inherits the quote-level freight setup. Override only when this line item needs different handling, such as a separate carrier, a different ship point, or a custom freight charge.
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
                        title="Revert this line's freight & logistics back to the quote default"
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
                        title="Edit this line's freight & logistics (overrides the quote default)"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Row: Freight Carrier/Method — combines method + carrier
                    when applicable. */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <span className="text-[12px] text-muted-foreground flex items-center gap-1.5"><Truck className="w-3 h-3 text-muted-foreground" />Freight Carrier/Method</span>
                  <span className="text-[13px] text-foreground text-right" style={{ fontWeight: 500 }}>
                    {sDesc.primary}
                    {sCfg.method !== 'customer-pickup' && sCarrier && sCarrierMethod && (
                      <span className="text-muted-foreground" style={{ fontWeight: 400 }}> · {sCarrier.name} · {sCarrierMethod.shortName}</span>
                    )}
                  </span>
                </div>

                {/* Row: Expected Ship By */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <span className="text-[12px] text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3 h-3 text-muted-foreground" />Expected Ship By</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>{formatDate(calculateShipDateRange().single)}</span>
                    {formData.isShipDateOverride && (
                      <span className="px-1 py-0.5 bg-accent text-primary text-[9px]" style={{ borderRadius: '3px', fontWeight: 600 }}>OVERRIDE</span>
                    )}
                  </div>
                </div>

                {/* Row: Expected Delivery — hidden for customer pickup
                    (the customer takes goods at pickup, so delivery is
                    the same as the pickup date). */}
                {sCfg.method !== 'customer-pickup' && (
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                  <span className="text-[12px] text-muted-foreground flex items-center gap-1.5"><Clock className="w-3 h-3 text-muted-foreground" />Expected Delivery</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-foreground" style={{ fontWeight: 500 }}>
                      {(() => {
                        const range = calculateDeliveryDateRange();
                        if ('single' in range) return formatDate(range.single);
                        return `${formatDate(range.min)} – ${formatDate(range.max)}`;
                      })()}
                    </span>
                    {formData.isDeliveryDateOverride && (
                      <span className="px-1 py-0.5 bg-accent text-primary text-[9px]" style={{ borderRadius: '3px', fontWeight: 600 }}>OVERRIDE</span>
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
                  <span className="text-[12px] text-muted-foreground flex items-center gap-1.5"><DollarSign className="w-3 h-3 text-muted-foreground" />Freight Charges</span>
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
                          className={`w-28 h-7 px-2 text-[13px] text-foreground text-right border border-border focus:outline-none ${readOnly ? 'bg-muted/50 cursor-default' : 'bg-white focus:ring-1 focus:ring-primary'}`}
                          style={{ borderRadius: '6px', fontWeight: 500 }}
                        />
                        <span className="inline-flex items-center px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap" style={{ fontWeight: 500, color: '#92400E', backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }}>Line</span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, shipmentConfig: { ...sCfg, shipmentCost: undefined } })}
                            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            style={{ fontWeight: 500 }}
                            title="Revert to the quote default"
                          >
                            Reset
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-[13px] text-muted-foreground tabular-nums" style={{ fontWeight: 500 }}>
                          —
                        </span>
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-md text-[10px] border whitespace-nowrap"
                          style={{ fontWeight: 500, color: '#475569', backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
                          title="This line uses the quote-level freight charge configured on the Quote summary. The quote-level charge applies to the whole quote, not to each line."
                        >
                          Quote-level
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              /* Three cases:
                                 1. Quote already in per-line mode (sibling has
                                    override): no prompt, just set this line to 0.
                                 2. Quote-level mode + parent provided split
                                    context: show the same Partner-style split
                                    confirmation the freight modal uses; on
                                    confirm seed siblings + land this line on the
                                    same even share, fire the overlay.
                                 3. Parent didn't wire split context (legacy
                                    call sites): fall back to old behavior. */
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
                            className="text-[11px] text-primary hover:underline transition-colors cursor-pointer"
                            style={{ fontWeight: 600 }}
                            title="Set a per-line freight charge that overrides the quote-level default for this line only"
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
              <div className="border border-border bg-white" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                {showNotesSection ? (
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[12px] text-muted-foreground" style={{ fontWeight: 500 }}>Item Notes & Instructions</span>
                        {formData.showNotesInPdf && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-accent text-primary" style={{ borderRadius: '3px', fontWeight: 500 }}>Visible in Quote</span>
                        )}
                      </div>
                      <button onClick={() => setShowNotesSection(false)} className="p-1 hover:bg-muted transition-colors" style={{ borderRadius: '4px' }} title="Collapse notes">
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    {/* Content */}
                    <div className="px-4 py-3">
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        readOnly={readOnly}
                        placeholder={readOnly ? 'No notes' : 'Add notes for this line item...'}
                        className={`w-full h-20 px-3 py-2 text-[13px] border border-border focus:outline-none resize-none ${readOnly ? 'bg-muted/50 cursor-default' : 'bg-white focus:ring-2 focus:ring-primary focus:border-transparent'}`}
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
                        <span className="text-[12px] text-muted-foreground">Visible in Quote</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  /* Empty state — label row with small dashed + Add button, matches One Time pattern */
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[12px] text-muted-foreground flex items-center gap-1.5" style={{ fontWeight: 400 }}><FileText className="w-3 h-3 text-muted-foreground" />Item Notes & Instructions</span>
                    {!readOnly && (
                      <button onClick={() => setShowNotesSection(true)} className="h-7 px-2.5 flex items-center gap-1 text-[12px] text-primary border border-dashed border-primary/40 hover:bg-[#F0F9FF] hover:border-primary transition-colors" style={{ borderRadius: '6px', fontWeight: 500 }}>
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>
            </div>

            {/* Fixed Total Price Footer — pinned to bottom of right panel.
                Previously this also re-listed the rule / adjustment / freight
                deltas as inline tag pills below the total. Those duplicated
                the breakdown already shown in the Pricing Rules,
                One-Time Adjustments, and Freight cards above, so they're
                dropped — the footer is now just the final Total. */}
            <div className="flex-shrink-0 border-t border-border bg-white" style={{ padding: '10px 20px 12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--foreground)' }}>Total</span>
                {(() => {
                  const lineFreight = typeof formData.shipmentConfig.shipmentCost === 'number' ? formData.shipmentConfig.shipmentCost : 0;
                  const totalWithFreight = total + lineFreight;
                  return (
                    <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.3px', lineHeight: '1.1' }}>{formatCurrency(totalWithFreight)}</span>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>


        {/* Footer */}
        <div className="border-t border-border bg-white px-6 py-3 flex items-center justify-between flex-shrink-0">
          {readOnly ? (
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onClose} className="px-4 h-8 border border-border text-[13px] text-muted-foreground hover:bg-[#F0F7FF] hover:border-border transition-colors" style={{ borderRadius: '6px', fontWeight: 500 }}>
                Close
              </button>
            </div>
          ) : (
            <div className="contents">
              <button
                onClick={() => { toast.error('Item removed from quote'); onClose(); }}
                className="px-3 h-8 flex items-center gap-1.5 border border-destructive/40 text-[13px] text-destructive hover:bg-destructive/10 transition-colors"
                style={{ borderRadius: '6px', fontWeight: 500 }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete from Quote
              </button>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="px-4 h-8 border border-border text-[13px] text-muted-foreground hover:bg-[#F0F7FF] hover:border-border transition-colors" style={{ borderRadius: '6px', fontWeight: 500 }}>
                  Discard Changes
                </button>
                <button onClick={handleSave} className="px-4 h-8 bg-success text-white text-[13px] hover:bg-[#047857] transition-colors flex items-center gap-1.5" style={{ borderRadius: '6px', fontWeight: 500 }}>
                  <Check className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pricing Rule Preset Modal — Partner Management's preset library, used
          here so that quote line-item configuration uses the same browse-and-apply
          UX as Partners → Vendor → Pricing Rules. Toggle on a card flips the
          preset's id in/out of formData.appliedRules. */}
      <PricingRulePresetModal
        isOpen={showPricingLibrary}
        onClose={() => setShowPricingLibrary(false)}
        readOnly={readOnly}
        // New library returns a richer PricingRule; we only need the id
        // here, so onApply (richer shape) is fine — call applyRuleEntry
        // with the rule id directly.
        onApply={(rule) => {
          if (stageLibraryChanges) {
            /* Post-draft: library edits the customer's rule book. Current
               line rules + totals stay intact. The next draft will inherit
               the updated customer rules. */
            toast.info(`"${rule.name}" applied to the customer rule book. Current line is unaffected — the next draft will inherit it.`);
            return;
          }
          /* Pre-draft (Draft state): library auto-applies to the current
             line, but library actions don't trigger the version prompt,
             so pass silent:true to suppress onMaterialEvent. */
          applyRuleEntry(rule.id, { silent: true });
        }}
        onRemove={(preset) => {
          if (stageLibraryChanges) {
            toast.info(`"${preset.name}" deactivated in the customer rule book. Current line is unaffected.`);
            return;
          }
          unapplyRuleEntry(preset.id, 'USER_UNAPPLIED', { silent: true });
        }}
        onReactivate={(preset) => {
          if (stageLibraryChanges) {
            toast.info(`"${preset.name}" activated in the customer rule book. Current line is unaffected.`);
            return;
          }
          applyRuleEntry(preset.id, { silent: true });
        }}
        appliedIds={new Set(formData.appliedRules.filter(e => e.isApplied).map(e => e.ruleId))}
        deactivatedIds={new Set(
          formData.appliedRules
            .filter(e => !e.isApplied && e.unappliedReason === 'USER_UNAPPLIED')
            .map(e => e.ruleId)
        )}
        /* Synthesise preset-shaped cards for every PRICING_RULES entry
           the line item knows about, so the "Applied to {customer}"
           filter has cards to show even though these rule ids don't
           exist in the static PRICING_RULE_PRESETS list. */
        extraPresets={PRICING_RULES.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.type === 'premium' ? 'premium' as const : 'discount' as const,
          basis: 'value' as const,
          tierType: 'single' as const,
          totalTiers: 1,
          description: r.description,
          tiers: [{ minValue: '—', maxValue: '—', discount: `${Math.abs(r.discount)}%` }],
          vendorsApplied: 0,
          isPreset: false,
          createdBy: 'This quote',
        }))}
        /* "Remove from Customer Pricing" — drops the rule entry entirely
           so it no longer appears on this line or in the summary. Match
           by rule name (library + host use different ids). */
        onRemoveRule={(libRule) => {
          if (stageLibraryChanges) {
            toast.info(`"${libRule.name}" removed from the customer rule book. Current line is unaffected.`);
            return;
          }
          const nm = libRule.name.toLowerCase();
          setFormData(prev => ({
            ...prev,
            appliedRules: prev.appliedRules.filter(e => {
              const r = PRICING_RULES.find(pr => pr.id === e.ruleId);
              return !(r && r.name.toLowerCase() === nm);
            }),
          }));
        }}
        customerName={customerName}
        /* Only surface rules the host quote module knows about. */
        restrictToNames={PRICING_RULES.map(r => r.name)}
        itemName={item.name}
      />

      {/* Per-row Unapply confirmation — single shared ConfirmationModal that
          handles both pricing rules and one-time adjustments. Reuses the
          same `ConfirmationModal` component used elsewhere in the app. */}
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
        variant="yellow"
        icon={<CircleSlash className="w-6 h-6 text-white" />}
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
                  /* Revert path — flip the adjustment back to applied. */
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
      />

      {/* Per-row Reapply confirmation — symmetric twin of the unapply
          modal above. Mirrors the same styling so activate / deactivate
          read as parallel actions. */}
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
        variant="blue"
        icon={<CirclePlus className="w-6 h-6 text-white" />}
        onConfirm={() => {
          if (!reapplyConfirm) return;
          if (reapplyConfirm.kind === 'rule') applyRuleEntry(reapplyConfirm.ruleId);
          else if (reapplyConfirm.kind === 'adjustment') reapplyAdjustment(reapplyConfirm.adjId);
          setReapplyConfirm(null);
        }}
        onCancel={() => setReapplyConfirm(null)}
      />

      {/* Add/Edit Adjustment Modal — uses shared AdjustmentFormModal */}
      {showAdjustmentModal && (
        <AdjustmentFormModal
          mode={editingAdjustmentId ? 'edit' : 'add'}
          scope="item"
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
              const incremental = data.type === 'discount'
                ? (data.amountType === '%' ? baseSubtotal * data.amount / 100 : data.amount)
                : 0;
              const exceeds = wouldExceedCap(incremental);
              if (exceeds) toast.warning('Adjustment kept but unapplied — would exceed 100% of line price.');
              let createdId: string | null = null;
              let createdLocalId: string | null = null;
              if (adjustmentsAPI && lineId) {
                const created = adjustmentsAPI.addAdjustment({
                  label: data.label, type: data.type, amountType: data.amountType,
                  amount: data.amount, scope: 'item', appliedTo: [lineId],
                  internalNotes: data.internalNotes,
                  attachments: data.attachments,
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
                      type: data.type, amountType: data.amountType, amount: data.amount,
                      label: data.label, id: createdLocalId,
                      internalNotes: data.internalNotes,
                      attachments: data.attachments,
                      isApplied: !exceeds,
                      unappliedReason: exceeds ? ('EXCEEDS_100_PERCENT' as const) : undefined,
                    },
                  ],
                });
              }
              onMaterialEvent?.(
                `Added ${data.type === 'premium' ? 'premium' : 'discount'} "${data.label}" on line "${item.name}"`,
                () => {
                  /* Revert path — drop the adjustment we just added. */
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

      {/* Shipment Configuration Modal — shared with the Quote
          sidebar. Replaces the previous inline modal. Per-line
          overrides flow through formData.shipmentConfig and pop
          the line-override chrome (badge + Reset to default). */}
      {showShipmentModal && (
        <ShipmentMethodModal
          isOpen
          onClose={() => setShowShipmentModal(false)}
          value={formData.shipmentConfig}
          onSave={(next) => {
            /* Mirror new model back into legacy shipmentMethod so any
               code still reading the old field (date math, table) sees
               a consistent value. */
            setFormData({
              ...formData,
              shipmentConfig: next,
              isShipmentOverride: true,
              shipmentMethod: next.method,
            });
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
        <PartnerPriceChangeModal
          newPrice={pendingPriceChange}
          onApply={(scope) => {
            setFormData({ ...formData, unitPrice: pendingPriceChange });
            setShowPriceUpdateConfirm(false);
            setPendingPriceChange(null);
            if (scope === 'quote') toast.success('Price updated for this quote only');
            else toast.success('Item master price updated — future quotes will use this price');
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

      {/* Remove single one-time adjustment. One-times are ad-hoc on
          a line (no library to re-add from), so the copy is plain
          "removed from this line. Add a new one anytime." */}
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
          deactivate; they remove. The action wipes every entry on
          this line; the user can always add new ones. */}
      <ConfirmationModal
        isOpen={showDeleteAllAdjustmentsConfirm}
        title="Remove all adjustments?"
        message={`All ${formData.oneTimeAdjustments.length} adjustments will be removed from this line. You can add new ones anytime.`}
        confirmText="Remove all"
        cancelText="Keep"
        onConfirm={() => {
          const total = formData.oneTimeAdjustments.length;
          /* Snapshot every adjustment (including its API-side fields)
             so a discarded version prompt can restore the full list. */
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
                /* Revert path — re-insert every removed adjustment by id
                   so the per-line list and the shared API are back where
                   they were before the bulk remove. */
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
          ? 'Remove this file from the quote?'
          : 'Delete this attachment?'}
        message={pendingRemoveAtt?.galleryId
          ? `"${pendingRemoveAtt?.name}" stays in the item master, so you can add it again anytime.`
          : `"${pendingRemoveAtt?.name}" will be permanently removed from the system. This action cannot be undone.`}
        confirmText={pendingRemoveAtt?.galleryId ? 'Remove from Quote' : 'Delete Attachment'}
        cancelText="Cancel"
        onConfirm={() => {
          if (!pendingRemoveAtt) return;
          const removed = pendingRemoveAtt;
          detachFile(removed.id);
          setPendingRemoveAtt(null);
          toast.success(removed.galleryId
            ? `"${removed.name}" removed from this quote`
            : `"${removed.name}" deleted`);
        }}
        onCancel={() => setPendingRemoveAtt(null)}
      />

      {/* Rename attachment dialog — opened from the Attachments-tab three-dot
          menu's "Rename" option. The trigger sets editingFileId/editingFileName. */}
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
            /* Parent seeds every other line with the even share; this
               line lands on the same value so the previous quote-level
               total stays preserved until the user edits. */
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
    </div>,
    document.body,
  );
}

/* PPU confirm modal — same chrome as ConfirmDiscardModal: colored gradient
   banner with soft glow + icon tile + badge pill on top, white body below. */
function PartnerPriceChangeModal({ newPrice, onApply, onCancel }: {
  newPrice: number;
  onApply: (scope: 'quote' | 'master') => void;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState<'quote' | 'master'>('quote');

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
          <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--foreground)', margin: 0 }}>
            Apply price change
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--muted-foreground)', margin: '8px 0 0 0', maxWidth: 360 }}>
            You're changing the unit price to <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(newPrice)}</span>. Choose where this price should apply.
          </p>

          {/* Options */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20, textAlign: 'left' }}>
            <YellowRadioCardQ
              selected={choice === 'quote'}
              onClick={() => setChoice('quote')}
              title="This quote only"
              description="Override the price for this line item. The item master stays unchanged."
            />
            <YellowRadioCardQ
              selected={choice === 'master'}
              onClick={() => setChoice('master')}
              title="Update item master"
              description="Set as the new default price for all future quotes."
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
                backgroundColor: 'var(--muted)', color: '#334155',
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

function YellowRadioCardQ({ selected, onClick, title, description, badge }: {
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
        border: `1px solid ${selected ? '#F59E0B' : 'var(--border)'}`,
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
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>{title}</span>
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
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 3, lineHeight: 1.45 }}>{description}</div>
      </div>
    </button>
  );
}

/* Small assisting-pill atom for the pricing rules summary card. Mirrors the
   Partner Management pill spec: 10.5px slate text on a very light slate bg
   with a hairline border, optional leading icon. The accent passed in lets
   the row tint pills red when the rule isn't applied. */
function RulePill({ bg, border, fg, children }: { bg: string; border: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '10.5px',
        fontWeight: 500,
        color: fg,
        backgroundColor: bg,
        border: `1px solid ${border}`,
        padding: '2px 6px',
        borderRadius: '4px',
        lineHeight: '1',
      }}
    >
      {children}
    </span>
  );
}
