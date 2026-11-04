import { useState, useMemo, useEffect, useRef } from 'react';
import { highlightText } from '@/app/components/InvoiceDataTable';
import { localTodayIso, addDaysIso } from '@/app/lib/dueBucket';
import { normalizeVendor, normalizeInvoiceNumber } from '@/app/components/invoice-import/importEngine';
import { MoneyInput, formatMoneyText } from '@/app/components/payments/MoneyInput';
import { createPortal } from 'react-dom';
import { 
  X,
  ShoppingCart,
  Upload,
  Maximize2,
  Minimize2,
  Info,
  Calendar,
  FileText,
  Paperclip,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  ReceiptText,
  Package,
  Wallet,
  Plus,
  AlertTriangle,
  AlertCircle,
  Clock,
  ExternalLink,
  RotateCcw,
  Truck,
  DollarSign,
  Lock,
  Edit3,
  Trash2,
  Search,
  SendHorizontal,
  Users,
  Building2,
  Settings2,
  MapPin,
  Phone,
  Layers,
  Hash,
  ZoomIn,
  ChevronLeft,
  Star,
  Receipt,
  SquareSplitHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag,
  Zap,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { ExpandableTextarea } from '@/app/components/ExpandableTextarea';
import { PAYMENT_TERM_PRESETS, findPresetByLabel, findPresetById, daysForPreset, resolvePaymentTerm, triggerKindFor, TRIGGER_EVENT_COPY, SPLIT_TERM_SLICES } from '@/app/data/paymentTermPresets';
import type { PaymentTermCategory, PaymentTermPreset, SplitSlice } from '@/app/data/paymentTermPresets';
import { addRuntimeTerm, findRuntimeTerm, useRuntimeTerms } from '@/app/data/customTermsStore';
import { CreatePaymentTermModal } from '@/app/components/CreatePaymentTermModal';
import { useSystemSettings } from '@/app/hooks/useSystemSettings';
import { isClosedPeriod } from '@/app/lib/runMath';
import { FilterPills } from '@/app/components/vendors/FilterPills';
import { PaymentTermCard } from '@/app/components/vendors/PaymentTermCard';
import { SearchableUserPicker, NotifyToggleCard } from '@/app/components/vendors/SearchableUserPicker';
import { SYSTEM_USERS } from '@/app/data/systemUsers';
import { SubmittedFlagCard, EXCEPTION_TYPE_OPTIONS, exceptionTypeValuesFromReason, exceptionOptionsFor } from '@/app/components/SubmittedFlagCard';
import { GLAccountConfigModal } from '@/app/components/GLAccountConfigModal';
import { CarrierCard } from '@/app/components/CarrierCard';
import {
  GL_ACCOUNTS,
  groupGLAccounts,
  DEFAULT_FREIGHT_GL_ACCOUNT,
  DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT,
  AP_ACCOUNTS,
  VENDOR_AP_MAPPING,
  ADVANCES_ACCOUNT,
  PREPAYMENT_ASSET_ACCOUNTS,
} from '@/app/data/glAccounts';
import { getCarriersForVendor, CARRIER_CATALOGUE, findCarrierById, CARRIER_MODE_LABEL, type CarrierMode } from '@/app/data/vendorCarriers';
import { Checkbox } from '@/app/components/ui/checkbox';
import { ScrollArea } from "@/app/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Switch } from '@/app/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/app/components/ui/hover-card";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/app/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/app/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/app/components/ui/tooltip";

/** Open a receiving document on the Receiving screen in a new tab
 *  (9/3/26): the trigger-date picker's document pills deep-link via
 *  /receiving?grn=… which lands searched + expanded on that record. */
const openReceivingTab = (grnNumber: string) =>
  window.open(`/receiving?grn=${encodeURIComponent(grnNumber)}`, '_blank', 'noopener');
import {
  AlertDialog,
  AlertDialogContent as _AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
const AlertDialogContent = _AlertDialogContent as unknown as React.FC<any>;
import {
  Dialog,
  DialogContent,
} from "@/app/components/ui/dialog";
import { SelectedPOData, VendorSelectionModalNested } from '@/app/components/VendorSelectionModalNested';
import { StandaloneVendorData } from '@/app/components/StandaloneVendorSelectionModal';
import { mockVendors, applyInvoiceToVendorDocs, releaseInvoiceFromVendorDocs, billedLineRefsFromSaved, LineItem as MockLineItem, VendorPO } from '@/app/data/mockVendors';
import { getVendorDefaultExpenseAccount, setVendorDefaultExpenseAccount } from '@/app/lib/vendorDefaults';
import { toast } from 'sonner';
import { Invoice, mockInvoices, nextSystemInvoiceNumber, type InvoiceCharges, type SavedInvoiceLineItem } from '@/app/data/mockInvoices';
import { partnerVendorUrl } from '@/app/data/mockVendors';
import { buildInvoiceGl } from '@/app/lib/glPosting';
import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, moneyPrefix, rateSentence } from '@/app/currency/money';
import { DEFAULT_RATE_TYPE, RATE_TYPE_LABEL, rateOn, toBase, type RateType } from '@/app/currency/rates';
import { baseGlEntries, glInBase } from '@/app/currency/glFx';
import { InvoiceCurrencyField, InvoiceExchangeRateField } from '@/app/components/currency/InvoiceCurrencyFields';
import { CurrencyFlag } from '@/app/components/currency/CurrencyChip';

import { ImageWithFallback } from './figma/ImageWithFallback';
import { PaymentTermDetailsModal } from '@/app/components/PaymentTermDetailsModal';
import { SegmentedCountPill } from '@/app/components/SegmentedCountPill';
import { TableEmptyRow, TableEmptyState, resolveTableEmptyKind } from '@/app/components/ui/table-empty-state';
import { findSearchSuggestion } from '@/app/utils/searchSuggestion';

interface CreateInvoiceScreenProps {
  onClose: () => void;
  /** Step back to the previous screen (item picker / vendor select).
   *  Distinct from onClose, which dismisses the whole flow. */
  onGoBack?: () => void;
  invoiceType?: 'draft' | 'receiving' | 'po' | 'standalone' | 'pre-invoice' | 'inventory' | null;
  selectedPOsData?: SelectedPOData[];
  /** Which creation flow the user entered (9/4/26 Eli review, D-01): the
   *  Pre-Invoice flow ALWAYS creates a pre-invoice and the Inventory flow
   *  ALWAYS creates a receiving invoice — pre vs post is an assertion of
   *  the flow, not an inference from the selected POs. When absent (legacy
   *  callers, exception resubmit), the old every-PO-unreceived inference
   *  still decides. */
  flowKind?: 'pre' | 'post' | null;
  standaloneVendor?: StandaloneVendorData | null;
  /** Live app invoices (GPT QC16, 9/30): the duplicate vendor-number
   *  check must see SESSION-created records too, not just the seeds —
   *  two manual submits with the same vendor + number both saved. */
  liveInvoices?: Invoice[];
  onInvoicesCreated?: (invoices: Invoice[]) => void;
  /** Edit-and-resubmit mode — the rejected invoice being fixed. Prefills
   *  the form, shows the rejection banner, and swaps the title + CTA to
   *  Resubmit (feedback 7/15/26). */
  resubmitInvoice?: Invoice | null;
  /** Rejection reason surfaced in the banner strip. */
  resubmitReason?: string;
  /** Mixed-terms gate resolution (8/31/26): the term the user picked in
   *  the pre-create alert. Seeds the invoice term AND aligns every PO's
   *  override so the screen opens with ONE term and no conflict. */
  initialPaymentTerm?: string;
  /** Gate's "choose from templates" route: the screen mounts with the
   *  Browse Payment Terms modal already open — its Apply aligns every
   *  PO, resolving the mixed state. */
  openTermsPickerOnMount?: boolean;
  /** All-blocked selection (BA 9/28: e.g. all-NET POs in the pre flow)
   *  routes straight here instead of through the gate modal — the picker
   *  wears one amber strip explaining why it opened, replacing what used
   *  to be two consecutive dialogs saying the same thing. */
  termsPickerNotice?: 'kind-conflict';
  /** Reconciliation context (Eli, 8/31/26): paid prepayments keyed by
   *  PO. Selected POs' prepayments apply as a totals line, reduce the
   *  payable, and close their pre-invoices on submit. */
  prepaidPOContext?: Record<string, { preInvoiceNumber: string; amount: number }>;
  /** 'ap' = vendor invoice (Dr expense/inventory, Cr A/P); 'ar' =
   *  customer invoice (Dr A/R, Cr revenue). Flips the GL preview
   *  in the submit confirmation (7/20/26). */
  ledger?: 'ap' | 'ar';
  /** Resubmit/resolve recordation (9/5/26 review): the confirm modal
   *  captures notes + documents + notify like the detail page's Resolve
   *  modal; this hands them to the host so they ride the resolve/submit
   *  actionHistory entry. */
  onResubmitRecordation?: (payload: { notes: string; attachments?: string[]; notifyIds?: string[] }) => void;
}

interface LineItem {
  id: string;
  sku: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  invoiceQty: number;
  remainingQty: number;
  uom: string;
  unitPrice: number;
  lineTotal: number;
  poNumber: string;
  grnNumbers: string[];
  grnDate?: string;
  isPreInvoice: boolean;
  glAccount: string;
  /** The unit price as it came off the PO, before any edit — drives the
   *  price-change indicator and its click-to-revert (review 7/9/26). */
  originalUnitPrice: number;
  // Pre-resolved default GL account so a row can be reverted back to
  // the system suggestion after the user overrode it.
  defaultGlAccount: string;
}

// The accrual/variance split for a received line (BA 9/28): the receiving
// only ever accrued the received quantity, so the accrual transfer is
// capped there — quantity billed past the receipt rides varianceAmount and
// debits 5205 Purchase Qty Variance in glPosting instead of over-relieving
// 2100. remainingQty is the receipt balance still open to this invoice.
const accrualSplit = (i: { isPreInvoice?: boolean; grnDate?: string; invoiceQty: number; remainingQty: number; unitPrice: number; originalUnitPrice?: number }) => {
  if (i.isPreInvoice || !i.grnDate) return { accrualAmount: 0, varianceAmount: 0 };
  const price = i.originalUnitPrice ?? i.unitPrice;
  const covered = Math.min(i.invoiceQty, Math.max(0, i.remainingQty));
  return {
    accrualAmount: Math.round(covered * price * 100) / 100,
    varianceAmount: Math.round(Math.max(0, i.invoiceQty - Math.max(0, i.remainingQty)) * price * 100) / 100,
  };
};

// GL_ACCOUNTS catalogue lives in @/app/data/glAccounts so both the inline
// GLAccountPicker and the new GLAccountConfigModal share one source.

// AP_ACCOUNTS + VENDOR_AP_MAPPING now live in @/app/data/glAccounts so the
// Record Payment A/P GL configuration shares the exact same catalogue + default.

// Exception reasons — an invoice can carry more than one at a time, so the
// Type control is a multi-select (checkboxes). The catalogue lives with
// the shared SubmittedFlagCard so the detail page parses the recorded
// reason into the exact same labels.

// Per-item image picker — pixel-parity with the VendorSelectionModalNested
// selection step so the line-item images in this screen render the SAME
// photo the user picked on the previous screen. Stable string hash → one
// of N pre-vetted Unsplash photos.
const ITEM_IMAGES = [
  'photo-1772209049802-cd0e0ff1a5d3',
  'photo-1713575882582-8938739db351',
  'photo-1737223450913-2af6885945e1',
  'photo-1759159091728-e2c87b9d9315',
  'photo-1661069387900-54d5843b704d',
  'photo-1758873263527-ca53b938fbd4',
  'photo-1672689933227-2ce1249c46a9',
  'photo-1767340078306-89630b12d81c',
  'photo-1769355104335-acef3aa4c9b6',
  'photo-1758857087505-957823893209',
];
function imageForSku(sku: string) {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = sku.charCodeAt(i) + ((h << 5) - h);
  const photo = ITEM_IMAGES[Math.abs(h) % ITEM_IMAGES.length];
  return `https://images.unsplash.com/${photo}?w=160&h=160&fit=crop&auto=format&q=80`;
}
// Larger photo set for the ItemQuickView modal carousel — identical
// recipe to the selection-modal preview so the same item number shows the same
// carousel sequence on both screens.
const ITEM_PHOTOS_LARGE = ITEM_IMAGES.map(p => `https://images.unsplash.com/${p}?w=600&h=400&fit=crop&auto=format&q=80`);
function photosForSku(sku: string) {
  let h = 0;
  for (let i = 0; i < sku.length; i++) h = sku.charCodeAt(i) + ((h << 5) - h);
  const base = Math.abs(h);
  const count = (base % 2) + 2;
  return Array.from({ length: count }, (_, i) => ITEM_PHOTOS_LARGE[(base + i) % ITEM_PHOTOS_LARGE.length]);
}
const ITEM_UOMS_QV = ['EA', 'ft', 'PK', 'RL', 'kg', 'lb', 'BX', 'SET'];
function formatCurrency(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}
function mockItemDataFull(sku: string, fallbackDesc?: string) {
  const meta = itemMetaFor(sku);
  const h = hashStr(sku);
  return {
    ...meta,
    uom: ITEM_UOMS_QV[h % ITEM_UOMS_QV.length],
    unitPrice: ((hashStr(sku + 'p') % 500) + 10) + 0.99,
    leadTime: (hashStr(sku + 'l') % 14) + 3,
    desc: longDescriptionFor(sku, fallbackDesc || ''),
  };
}

// ─── Per-item item metadata + long description + preview components.
//      Ported verbatim from VendorSelectionModalNested so the item number link,
//      image hover-card, and description "more / Show less" toggle on
//      this screen match the selection step pixel-for-pixel. ───
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
const ITEM_CATEGORIES = ['Raw Material', 'Component', 'Assembly', 'Consumable', 'Finished Good'];
const ITEM_INVENTORY_CONTROLS = ['Serialized', 'Non-Serialized'] as const;
const ITEM_ACQUISITIONS = ['Purchase', 'Manufacturing'] as const;
const ITEM_SHORT_DESCS = [
  'Industrial-grade component, batch-tracked, ready for production.',
  'Mill-certified raw material, ASTM-compliant.',
  'High-tolerance machined part for OEM assembly.',
  'Consumable supply, replenished on PAR-level schedule.',
  'Finished-good inventory item, pick-pack-ready.',
];
function itemMetaFor(sku: string) {
  const ah = hashStr(sku);
  return {
    category: ITEM_CATEGORIES[ah % ITEM_CATEGORIES.length],
    inventoryControl: ITEM_INVENTORY_CONTROLS[ah % ITEM_INVENTORY_CONTROLS.length],
    acquisition: ITEM_ACQUISITIONS[(ah * 3) % ITEM_ACQUISITIONS.length],
    shortDesc: ITEM_SHORT_DESCS[ah % ITEM_SHORT_DESCS.length],
    price: `$${(((ah * 7) % 500) + 10).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  };
}
const LONG_DESC_TAILS: Record<string, string> = {
  STEEL: 'Cold-rolled, ASTM A53 Grade B, ISO 9001 mill certified. Suitable for structural fabrication, laser-cutting, and process-piping applications. Batch-traceable from receiving through QA inspection.',
  COPPER: 'High-purity electrolytic copper at 99.95% conductivity, deburred and chamfered, RoHS-compliant. Indicated for power distribution, grounding, and HVAC line-set assembly.',
  WELD: 'AWS A5.1 E7018 low-hydrogen electrodes, moisture-resistant flux coating. Recommended for arc and TIG welding on mild / low-alloy steels under structural code.',
  MILD: 'ASTM A36 grade mild steel, hot-rolled finish with mill scale, normalized and stress-relieved. Ready for machining, drilling, and downstream powder coating.',
  ALLOY: '4140 chromoly alloy, normalized and tempered to HRC 28-32. Indicated for high-stress shaft, gear, and structural applications under cyclic loading.',
  ELEC: 'Industrial-grade power management IC, 450V rated, IEC 60068 environmental compliance. Includes anti-static packaging and full traceability documentation.',
  CAB: 'Heavy-duty 10 AWG copper conductor with XLPE insulation and tinned-copper shield. Suitable for industrial control panels, motor leads, and outdoor runs to NEC 600V.',
  BRKT: 'Hot-dipped galvanized steel mounting bracket, 12 ga, pre-drilled to 3/8" hole pattern. Powder-coated finish, indoor / outdoor rated, includes mounting hardware.',
  TECH: 'Pro-grade workstation hardware bundle including chassis, peripherals, and mounting kit. Pre-configured imaging, 3-year onsite warranty, asset-tag ready.',
  HYD: 'ISO VG 46 anti-wear hydraulic fluid, zinc-additive formula, oxidation-stabilized for extended drain intervals on industrial gear and hydraulic systems.',
  SAFE: 'Type I Class C ANSI Z89.1 hard hat with 4-point ratchet suspension, vented shell, dielectric-rated. Sweatband replaceable, side-slot accessory-ready.',
  GLOVE: 'Cut-resistant ANSI A4 work gloves with HPPE-blend liner and PU palm coating. Touchscreen-capable, machine-washable, sold in bulk by weight.',
  DEFAULT: 'Industrial-grade component sourced from a certified mill, batch-tracked through receiving QA, and approved for production-line use. Includes COA and mill-test report on request.',
};
function longDescriptionFor(sku: string, baseDescription: string) {
  const prefix = sku.split(/[-_\s]/)[0]?.toUpperCase() ?? 'DEFAULT';
  const tail = LONG_DESC_TAILS[prefix] ?? LONG_DESC_TAILS.DEFAULT;
  return baseDescription ? `${baseDescription}, ${tail}` : tail;
}

const ITEMS_MODULE_URL = 'https://nimble-palette.lovable.app';
// Partner master detail — same destination the invoice detail header uses
// (meeting feedback 7/17/26: the vendor field links to the partner master).
// Vendor links resolve per vendor (9/22/26, GPT LINK-01).
// PO record in the external Purchase Orders app (pleasant-flow) — the PO
// number in the breakdown hover cards deep-links here in a new tab.
const PO_EXTERNAL_URL = 'https://pleasant-flow.lovable.app/purchase-orders/po-10';

// Image with hover-card quick-preview + click-to-zoom. Mirrors the
// selection-modal pattern (slate gradient header → category, on-hand,
// unit price, status pill) so the two surfaces feel identical.
function LineItemImage({
  sku,
  src,
  alt,
  onPreview,
}: {
  sku: string;
  src: string;
  alt: string;
  onPreview: () => void;
}) {
  const meta = itemMetaFor(sku);
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className="w-8 h-8 rounded-md border border-border bg-slate-50 overflow-hidden shrink-0 cursor-zoom-in hover:border-primary/40 transition-colors group/img"
        >
          <ImageWithFallback
            src={src}
            alt={alt}
            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
          />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[280px] p-0 rounded-xl border-0 overflow-hidden z-[300]"
        style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
          <div className="flex items-center gap-3 relative">
            <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden shrink-0">
              <ImageWithFallback src={src} alt={alt} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{sku}</p>
              <p className="text-[11px] text-slate-400 truncate">{meta.shortDesc}</p>
            </div>
          </div>
        </div>
        <div className="bg-white px-3.5 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{meta.category}</span>
            </div>
            <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
              {meta.price}
              <span className="text-slate-400 ml-1" style={{ fontWeight: 400 }}>/ unit</span>
            </span>
          </div>
          {/* Master-data attributes (neutral pills) — no stock status. */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-200" style={{ fontWeight: 500 }}>
              <Hash className="w-3 h-3 text-slate-400" />
              {meta.inventoryControl}
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-200" style={{ fontWeight: 500 }}>
              <ShoppingCart className="w-3 h-3 text-slate-400" />
              {meta.acquisition}
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

// Description with inline "more / Show less" toggle so the row stays
// compact by default but lets the user reveal full mill-cert / spec copy
// on demand. Matches the selection-modal pattern.
// Wrap matched substring with a soft yellow highlight so the user can
// see why each row matched their search.
// Shared yellow search mark so every search in the system reads the same
// (10/9/26).
function highlightMatch(text: string, query: string): React.ReactNode {
  return highlightText(text, query);
}

interface GLAccountPickerProps {
  value: string;
  defaultValue: string;
  onChange: (next: string) => void;
  /** Locked off for now — renders a static, non-interactive chip so the
   *  account is visible but can't be changed. */
  disabled?: boolean;
  /** Trigger height (user 10/5): defaults to the table-row h-8, but the
   *  charge/freight cards pass h-9 so the picker matches the money input
   *  and Select beside it. */
  heightClass?: string;
}
// The account value reads as code + name, code emphasized (Nophil 9/28:
// "bring the GL account properly in a block" — a flat string read as one
// undifferentiated run).
function GlAccountValue({ value, muted = false }: { value?: string; muted?: boolean }) {
  if (!value) return <span className="truncate min-w-0 flex-1 text-left mr-1 text-[11px]" style={{ fontWeight: 500 }}>Select GL…</span>;
  const sp = value.indexOf(' ');
  const code = sp > 0 ? value.slice(0, sp) : value;
  const name = sp > 0 ? value.slice(sp + 1) : '';
  return (
    <span className="truncate min-w-0 flex-1 text-left mr-1 text-[11px]">
      <span className={muted ? 'text-slate-500' : 'text-foreground'} style={{ fontWeight: 600 }}>{code}</span>
      {name && <span className={`ml-1 ${muted ? 'text-slate-400' : 'text-slate-600'}`} style={{ fontWeight: 400 }}>{name}</span>}
    </span>
  );
}

function GLAccountPicker({ value, defaultValue, onChange, disabled = false, heightClass = 'h-8' }: GLAccountPickerProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  // Trigger fills its table column (width is governed by the table's
  // <colgroup>), so the value gets as much room as the column allows and
  // only truncates when the column itself is narrower than the text.
  const groups = useMemo(() => groupGLAccounts(GL_ACCOUNTS), []);
  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center justify-between w-full ${heightClass} px-2.5 bg-slate-50 text-slate-500 rounded-md border border-slate-200 cursor-not-allowed`}>
            <GlAccountValue value={value} muted />
            <Lock className="w-3 h-3 text-slate-300 shrink-0" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
          <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>
            {value ? (
              <>
                {/* Opens the ITEM MASTER detail page where the GL mapping
                    actually lives (meeting feedback 7/17/26) — that's the
                    place to change it, not the Chart of Accounts. */}
                <a
                  href={ITEMS_MODULE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] leading-snug text-foreground hover:text-primary underline decoration-slate-300 hover:decoration-primary underline-offset-2 transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  {value}
                </a>{' '}is locked for editing
              </>
            ) : 'Editing is disabled'}
          </p>
          {/* One short sentence (Nophil 9/28: "very wordy"). */}
          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Mapped from the item master. Open the item to change it.</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center justify-between w-full ${heightClass} px-2.5 bg-white hover:bg-slate-50 hover:border-primary/40 text-foreground rounded-md border border-slate-200 transition-colors group/gl`}
        >
          <GlAccountValue value={value} />
          <ChevronDown className="w-3 h-3 text-slate-400 group-hover/gl:text-primary shrink-0 transition-colors" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-[340px] p-0 border border-border rounded-xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18)] z-[120] overflow-hidden"
        onOpenAutoFocus={() => setSearch('')}
      >
        <Command className="rounded-xl bg-white">
          <CommandInput
            placeholder="Search GL account…"
            value={search}
            onValueChange={setSearch}
            className="text-[12px] outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="py-6 text-center text-[12px] text-slate-400">
              No accounts match.
            </CommandEmpty>
            {Object.entries(groups).map(([category, accounts]) => (
              <CommandGroup
                key={category}
                heading={category}
                className="[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-slate-500 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:tracking-normal"
              >
                {accounts.map(account => {
                  const code = account.split(' ')[0];
                  const name = account.substring(code.length + 1);
                  const isSelected = value === account;
                  return (
                    <CommandItem
                      key={account}
                      value={account}
                      onSelect={() => { onChange(account); setOpen(false); }}
                      className="flex items-center gap-2 mx-1.5 px-2 py-1.5 rounded-md cursor-pointer data-[selected=true]:bg-blue-50"
                    >
                      <span className={`text-[11px] ${isSelected ? 'text-primary' : 'text-slate-500'}`} style={{ fontWeight: 600 }}>
                        {highlightMatch(code, search)}
                      </span>
                      <span className={`text-[11px] truncate flex-1 ${isSelected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>
                        {highlightMatch(name, search)}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
          {value !== defaultValue && defaultValue && (
            <div className="border-t border-slate-100 px-2 py-1.5 bg-slate-50/60">
              <button
                type="button"
                onClick={() => { onChange(defaultValue); setOpen(false); }}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] text-primary hover:text-blue-700 transition-colors py-1.5 rounded-md hover:bg-blue-50"
                style={{ fontWeight: 500 }}
              >
                <RotateCcw className="w-3 h-3" />
                Reset to default <span className="" style={{ fontWeight: 600 }}>{defaultValue.split(' ')[0]}</span>
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Bulk GL Account picker, applies one account to every selected line item.
// Mirrors GLAccountPicker's command list, minus the per-row reset affordance.
function BulkGLAccountPicker({ count, onSelect }: { count: number; onSelect: (account: string) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupGLAccounts(GL_ACCOUNTS), []);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-[10px] font-bold bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-primary hover:border-primary/40 shadow-none rounded-md tracking-wider gap-1.5 border transition-all animate-in fade-in slide-in-from-right-1"
        >
          <Wallet className="w-3 h-3" />
          Set GL Account
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="w-[340px] p-0 border border-border rounded-xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18)] z-[120] overflow-hidden"
        onOpenAutoFocus={() => setSearch('')}
      >
        <div className="px-3 pt-2.5 pb-1.5 border-b border-slate-100">
          <p className="text-[11px] text-slate-500 leading-snug">
            Apply a GL account to{' '}
            <span className="text-foreground " style={{ fontWeight: 600 }}>{count}</span>{' '}
            selected {count === 1 ? 'item' : 'items'}
          </p>
        </div>
        <Command className="rounded-none bg-white">
          <CommandInput
            placeholder="Search GL account…"
            value={search}
            onValueChange={setSearch}
            className="text-[12px] outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-0"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty className="py-6 text-center text-[12px] text-slate-400">
              No accounts match.
            </CommandEmpty>
            {Object.entries(groups).map(([category, accounts]) => (
              <CommandGroup
                key={category}
                heading={category}
                className="[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-slate-500 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:tracking-normal"
              >
                {accounts.map(account => {
                  const code = account.split(' ')[0];
                  const name = account.substring(code.length + 1);
                  return (
                    <CommandItem
                      key={account}
                      value={account}
                      onSelect={() => { onSelect(account); setOpen(false); }}
                      className="flex items-center gap-2 mx-1.5 px-2 py-1.5 rounded-md cursor-pointer data-[selected=true]:bg-blue-50"
                    >
                      <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                        {highlightMatch(code, search)}
                      </span>
                      <span className="text-[11px] truncate flex-1 text-foreground" style={{ fontWeight: 500 }}>
                        {highlightMatch(name, search)}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Highlight the line-item search query inside a text snippet so search
// feedback reads identically across the creation flow (design review 7/9/26).
function highlightQuery(text: string, query: string) {
  // Shared yellow search mark, uniform with every listing (10/9/26).
  return highlightText(text, query);
}

function LineItemDescription({ description, query = '' }: { description: string; query?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!description) return null;
  return (
    <div className="text-[11px] text-slate-500 font-normal leading-snug mt-0.5 w-full max-w-full">
      {expanded ? (
        <span className="block leading-relaxed">
          {highlightQuery(description, query)}{' '}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            className="inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors align-baseline text-[11px]"
            style={{ fontWeight: 500 }}
          >
            Show Less
            <ChevronUp className="w-3 h-3" />
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-1 w-full">
          <span className="truncate flex-1 min-w-0">{highlightQuery(description, query)}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            className="inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors shrink-0 text-[11px]"
            style={{ fontWeight: 500 }}
          >
            more
            <ChevronDown className="w-3 h-3" />
          </button>
        </span>
      )}
    </div>
  );
}

// Deterministic vendor stats — matches the recipe used in
// InvoiceDataTable's VendorQuickCard so the hover card on this screen
// reads with the same address / phone shape as the invoice listing.
function getVendorStats(vendor: string) {
  let hash = 0;
  for (let i = 0; i < vendor.length; i++) {
    hash = (hash << 5) - hash + vendor.charCodeAt(i);
    hash |= 0;
  }
  const abs = Math.abs(hash);
  return {
    addressLine: `${(abs % 900) + 100} Industrial Park Dr`,
    city: ['Detroit, MI', 'San Jose, CA', 'Austin, TX', 'Chicago, IL', 'Atlanta, GA'][abs % 5],
    phone: `+1 (${(abs % 900) + 100}) ${((abs >> 5) % 900) + 100}-${((abs >> 9) % 9000) + 1000}`,
  };
}

export function CreateInvoiceScreen({ onClose, onGoBack, invoiceType, selectedPOsData = [], standaloneVendor, liveInvoices, onInvoicesCreated, resubmitInvoice, resubmitReason, initialPaymentTerm, openTermsPickerOnMount, termsPickerNotice, prepaidPOContext, ledger = 'ap', flowKind = null, onResubmitRecordation }: CreateInvoiceScreenProps) {
  const isStandalone = invoiceType === 'standalone';
  const isResubmit = !!resubmitInvoice;
  // Edit mode (9/3/26): a PENDING APPROVAL invoice reopens in this same
  // modal to be edited before the approver sees it — same form, edit
  // copy, no rejection banner, and saving keeps it in Pending Approval.
  // Rejected/Exception invoices keep the resubmit/resolve framing.
  const isEdit = isResubmit && resubmitInvoice?.status === 'Pending Approval';
  // The exception fix path: resubmitting resolves the exception, so the
  // confirm wears the green resolution treatment (9/5/26 review) and
  // records notes + documents + notify like the detail Resolve modal.
  const resubIsException = isResubmit && !isEdit && resubmitInvoice?.status === 'Exception';
  const resubRecordation = isResubmit && !isEdit;
  const [resubNotes, setResubNotes] = useState('');
  // Required-note highlight (GPT QC23, 9/30).
  const [resubNotesError, setResubNotesError] = useState(false);
  const [resubAttachments, setResubAttachments] = useState<string[]>([]);
  const [resubNotify, setResubNotify] = useState(true);
  const [resubRecipients, setResubRecipients] = useState<Set<string>>(() => {
    if (!isResubmit) return new Set<string>();
    const entry = [...(resubmitInvoice?.actionHistory ?? [])].reverse().find(
      (e) => e.action === (resubmitInvoice?.status === 'Exception' ? 'flagException' : 'reject'),
    );
    const ids = new Set(entry?.notifiedRecipientIds ?? []);
    // The person who raised the flag is a recipient by default (Nophil
    // 9/22): resolving tells the flagger first.
    const creator = SYSTEM_USERS.find((u) => u.name === (entry?.by ?? resubmitInvoice?.createdBy));
    if (creator) ids.add(creator.id);
    return ids;
  });

  // No-change resubmit confirm (Nophil 9/22): no field-level validation,
  // but resolving without editing anything asks once. A snapshot of the
  // editable state is taken shortly after mount (after seeding settles);
  // the resolve CTA compares against the latest.
  const [resubNoChangeOpen, setResubNoChangeOpen] = useState(false);
  const resubNoChangeAckedRef = useRef(false);
  const resubSnapshotRef = useRef<string | null>(null);
  const latestResubJsonRef = useRef('');

  // A/P account + the inventory invoice's per-line GL account are locked off
  // for now (logic + derived values stay intact; users just can't change them
  // yet). The standalone invoice's per-line GL account stays selectable — the
  // user chooses the expense account there. Flip to false to re-enable the
  // inventory/A-P pickers when the feature is wanted.
  const GL_FIELDS_LOCKED = true;
  const [isFullScreen, setIsFullScreen] = useState(false);
  // Additional Charges open as an empty state — no charge is pre-created and
  // nothing is pre-selected. The user adds charges from the list via "Add
  // charge".
  // Each charge now carries an EDITABLE GL account (Eli 10/5): it defaults
  // from the module default but routes wherever the user picks, so a
  // standalone invoice's charges have a real expense account and an
  // inventory invoice can split a charge out of the capitalised value.
  // description is required when type is "Other" (design review 7/9/26) —
  // a catch-all charge means nothing to approvers without one.
  // A resubmit/edit seeds the record's saved charges (GPT QC14, 9/30: the
  // form reopened with zero charges, so an untouched resubmit silently
  // dropped ~11% of a seeded invoice's total).
  const [additionalCharges, setAdditionalCharges] = useState<{id: number, type: string, amount: number, description?: string, glAccount?: string}[]>(() =>
    (resubmitInvoice?.charges?.additional ?? [])
      .filter((c) => c.amount > 0)
      .map((c, k) => ({ id: k + 1, type: c.label, amount: c.amount, glAccount: c.glAccount || DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT })),
  );
  const [chargeDescriptionError, setChargeDescriptionError] = useState(false);

  // Standalone line items state. A resubmit/edit seeds the RECORD'S OWN
  // lines (GPT QC14, 9/30: the edit form opened empty, so re-saving
  // replaced the invoice's lines with blanks and approval posted zero GL
  // lines) — what you reopen is what was saved.
  const [standaloneItems, setStandaloneItems] = useState<{id: string; description: string; quantity: number; uom: string; unitPrice: number; glAccount: string; amount: number}[]>(() =>
    isStandalone && (resubmitInvoice?.savedLineItems?.length ?? 0) > 0
      ? (resubmitInvoice!.savedLineItems ?? []).map((l, k) => ({
          id: `sa-seed-${k}`,
          description: l.description,
          quantity: l.quantity,
          uom: l.uom,
          unitPrice: l.unitPrice,
          glAccount: l.glAccount,
          amount: l.lineTotal,
        }))
      : [{ id: `sa-${Date.now()}`, description: '', quantity: 1, uom: 'EA', unitPrice: 0, glAccount: '', amount: 0 }],
  );

  const addStandaloneItem = () => {
    setStandaloneItems(prev => [...prev, {
      id: `sa-${Date.now()}-${prev.length}`,
      description: '',
      quantity: 1,
      uom: 'EA',
      unitPrice: 0,
      // New rows inherit the vendor's default expense account (if any).
      glAccount: vendorDefaultExpense || '',
      amount: 0
    }]);
  };

  const formatFileSize = (bytes: number) =>
    bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  // Standalone line removal confirms first, same as the inventory
  // invoice (Mahreen 10/10); the undo toast follows.
  const [standaloneItemToRemove, setStandaloneItemToRemove] = useState<{ id: string; label: string } | null>(null);
  const removeStandaloneItem = (id: string) => {
    const previous = standaloneItems;
    const index = standaloneItems.findIndex((i) => i.id === id);
    setStandaloneItems(prev => prev.filter(i => i.id !== id));
    setStandaloneSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    toast(`Line ${index + 1} removed from ${invoiceNumber}`, {
      action: { label: 'Undo', onClick: () => setStandaloneItems(previous) },
      duration: 30000,
    });
  };

  const updateStandaloneItem = (id: string, field: string, value: any) => {
    setStandaloneItems(prev => {
      // Money and quantities never go negative (9/22/26 review response,
      // Claude C05-X1): a typed or scripted minus clamps to zero.
      const clean = (field === 'amount' || field === 'unitPrice' || field === 'quantity') && typeof value === 'number'
        ? Math.max(0, value)
        : value;
      const next = prev.map(i => i.id === id ? { ...i, [field]: clean } : i);
      // Lift the GL-required highlight as soon as every line has an account.
      if (field === 'glAccount' && next.every(i => i.glAccount && i.glAccount.trim())) {
        setGlMissingError(false);
      }
      return next;
    });
  };

  // Bulk removal for standalone lines (user 10/10), the inventory
  // invoice's recipe: select rows, "Remove N items", confirm, Undo toast.
  // Removing every line leaves one blank row (an invoice needs a line).
  const [standaloneSelectedIds, setStandaloneSelectedIds] = useState<Set<string>>(new Set());
  const [standaloneBulkRemoveOpen, setStandaloneBulkRemoveOpen] = useState(false);
  const removeSelectedStandaloneItems = () => {
    const previous = standaloneItems;
    const count = standaloneSelectedIds.size;
    const remaining = standaloneItems.filter((i) => !standaloneSelectedIds.has(i.id));
    setStandaloneItems(
      remaining.length > 0
        ? remaining
        : [{ id: `sa-${Date.now()}`, description: '', quantity: 1, uom: 'EA', unitPrice: 0, glAccount: vendorDefaultExpense || '', amount: 0 }],
    );
    setStandaloneSelectedIds(new Set());
    setStandaloneBulkRemoveOpen(false);
    toast(`${count} item${count === 1 ? '' : 's'} removed from ${invoiceNumber}`, {
      action: { label: 'Undo', onClick: () => setStandaloneItems(previous) },
      duration: 30000,
    });
  };

  const standaloneSubtotal = standaloneItems.reduce((sum, i) => sum + (i.amount || 0), 0);

  // Local state for POs to allow adding/removing
  const [currentPOsData, setCurrentPOsData] = useState<SelectedPOData[]>(selectedPOsData || []);
  const [glConfigModalItemId, setGlConfigModalItemId] = useState<string | null>(null);
  const [glModalSearch, setGlModalSearch] = useState('');
  const [poGlConfigModalItemId, setPoGlConfigModalItemId] = useState<string | null>(null);
  const [poGlModalSearch, setPoGlModalSearch] = useState('');
  const [poToRemove, setPoToRemove] = useState<string | null>(null);
  // Line-item removal confirms first (8/31/26) — same destructive
  // modal recipe as Remove PO; the undo toast fires after the confirm.
  const [itemToRemove, setItemToRemove] = useState<{ id: string; sku: string; poNumber: string } | null>(null);
  // Bulk removal confirms too (8/31/26).
  const [bulkRemoveConfirmOpen, setBulkRemoveConfirmOpen] = useState(false);
  // Submit confirmation — opened when the user clicks Submit and the
  // invoice carries an Exception flag or a Payment Hold flag, so they
  // get one last "you sure?" gate. Same AlertDialog recipe as the
  // discard confirmation below, just amber-toned instead of rose.
  // Over-billing acknowledgment (9/22/26, spec 3.2.3): warn once, then
  // let the invoice through with a recorded quantity variance.
  // Price-entry drafts (9/22/26 review response, Claude C03-D3): the
  // controlled input re-rendered parseFloat('28.') as "28", eating the
  // decimal point mid-keystroke — 28.53 became 2,853. While a price
  // field has focus its TEXT is the source of truth; the number lands
  // on blur.
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [showSubmitWarning, setShowSubmitWarning] = useState(false);
  // Standalone GL-required highlight — set when a submit is attempted with
  // one or more line items missing a GL account, cleared once they're filled.
  const [glMissingError, setGlMissingError] = useState(false);
  // Blank-description / zero-amount highlight (GPT QC21, 9/30).
  const [lineContentError, setLineContentError] = useState(false);
  // Submit modal opt-in: 'once' uses the chosen GL accounts for this invoice
  // only; 'default' also promotes the most-used account to the vendor's
  // default expense account going forward.
  const [glDefaultChoice, setGlDefaultChoice] = useState<'once' | 'default'>('once');

  // Discard confirmation — opened from header-X or footer-Cancel, mirrors
  // partner CreatePartnerModal flow so unsaved invoice work isn't lost
  // when the user accidentally closes the screen.
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);
  const handleAttemptClose = () => {
    // A no-change edit closes silently (VI-53): if the baseline snapshot
    // still matches the current form, there's nothing to discard.
    if (resubSnapshotRef.current !== null && resubSnapshotRef.current === latestResubJsonRef.current) {
      onClose();
      return;
    }
    setShowDiscardConfirmation(true);
  };
  const handleConfirmDiscard = () => { setShowDiscardConfirmation(false); onClose(); };
  // Header back button — same "you sure?" gate, but routes to the previous
  // screen (item picker / vendor select) instead of closing the flow. The
  // entered details AND the selection are discarded on confirm.
  const [showBackConfirmation, setShowBackConfirmation] = useState(false);
  const handleAttemptBack = () => setShowBackConfirmation(true);
  const handleConfirmBack = () => { setShowBackConfirmation(false); onGoBack?.(); };
  const [isAddPOOpen, setIsAddPOOpen] = useState(false);
  // Line-items table "expand" — pops the table into a larger floating
  // panel (capped to the creation modal's footprint) so the user can
  // review many rows at once; click-away / Escape collapses it. Mirrors
  // the description box's expand affordance.
  //
  // `lineItemsClosing` keeps the panel mounted for the exit animation so
  // collapse eases out instead of snapping. Enter/exit reuse the same
  // fade + zoom + slide-from-center recipe (and 200ms duration) as the
  // shared Dialog component so expand/collapse matches every other modal.
  const EXPAND_ANIM_MS = 200;
  const [lineItemsExpanded, setLineItemsExpanded] = useState(false);
  const [lineItemsClosing, setLineItemsClosing] = useState(false);
  // Free-text filter for the PO line-items table (item number / name / description).
  const [lineItemSearch, setLineItemSearch] = useState('');
  const closeTimerRef = useRef<number | null>(null);
  const openLineItems = () => {
    if (closeTimerRef.current) { window.clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setLineItemsClosing(false);
    setLineItemsExpanded(true);
  };
  const collapseLineItems = () => {
    setLineItemsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setLineItemsExpanded(false);
      setLineItemsClosing(false);
      closeTimerRef.current = null;
    }, EXPAND_ANIM_MS);
  };
  useEffect(() => {
    if (!lineItemsExpanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') collapseLineItems(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItemsExpanded]);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Item image lightbox — opened when the user clicks an item image in
  // the line-items table. Uses the rich ItemQuickView design (carousel +
  // stat grid + detail rows + Go to Item CTA) ported from the selection
  // modal so the two surfaces feel identical.
  const [previewImage, setPreviewImage] = useState<{ src: string; sku: string; description?: string } | null>(null);
  const [previewPhotoIdx, setPreviewPhotoIdx] = useState(0);
  useEffect(() => { setPreviewPhotoIdx(0); }, [previewImage?.sku]);
  // Lock body scroll + suppress background interaction while the item
  // preview is open. Without this, the user could keep scrolling /
  // clicking through to the Create Invoice form sitting behind it.
  useEffect(() => {
    if (!previewImage) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [previewImage]);

  // Lock body scroll for the lifetime of the Create Invoice modal so
  // the side-nav / page underneath can't be scrolled or clicked.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Freight State
  const [carrierName, setCarrierName] = useState('FedEx Ground');
  const [shippingMethod, setShippingMethod] = useState('Standard');
  const [dispatchType, setDispatchType] = useState('Direct');
  // Seeded from the record on resubmit/edit (GPT QC14) — see
  // additionalCharges above for the rationale.
  const [freightAmount, setFreightAmount] = useState(resubmitInvoice?.charges?.freight ?? 0);
  // Freight GL account is editable too (Eli 10/5): defaults from the
  // module default, routes wherever the user picks. On every invoice type.
  const [freightGlAccount, setFreightGlAccount] = useState<string>(
    resubmitInvoice?.charges?.freightGlAccount || DEFAULT_FREIGHT_GL_ACCOUNT,
  );

  // Editing a flagged invoice SEEDS its flags (BA 9/6, "cover every use
  // case"): an invoice carrying an exception or a payment hold reopens
  // with that section ON, EXPANDED, and pre-filled from the flag's
  // recorded reason — the sidebar tells the issue's story right where
  // it gets fixed.
  const seedFlag = resubmitInvoice ? [...(resubmitInvoice.actionHistory ?? [])].reverse().find((e) => e.action === 'flagException') : undefined;
  const seedHold = resubmitInvoice ? [...(resubmitInvoice.actionHistory ?? [])].reverse().find((e) => e.action === 'paymentHold') : undefined;
  const seedExceptionOn = !!resubmitInvoice && (resubmitInvoice.is_exception === true || resubmitInvoice.status === 'Exception');
  const seedHoldOn = !!resubmitInvoice && (resubmitInvoice.is_payment_held === true || resubmitInvoice.status === 'Payment Hold');

  // Payment Hold State
  const [isPaymentHoldActive, setIsPaymentHoldActive] = useState(seedHoldOn);
  // A SUBMITTED hold can't be toggled off (Eli 9/8) — Release on the
  // seeded card queues the release for this save, with an Undo. The
  // submit payload already derives from isPaymentHoldActive, so the
  // pending flag only drives the card's state.
  const [pendingHoldRelease, setPendingHoldRelease] = useState(false);
  const [holdReason, setHoldReason] = useState(seedHoldOn ? seedHold?.reason ?? '' : '');
  const [holdAttachments, setHoldAttachments] = useState<any[]>(() => (seedHoldOn ? (seedHold?.attachments ?? []).map((name) => ({ name })) : []));
  const [notifiedStakeholders, setNotifiedStakeholders] = useState<Set<string>>(() => new Set(seedHoldOn ? seedHold?.notifiedRecipientIds ?? [] : []));
  // Resolving a flag collapses General Information (user 9/22): the
  // attention belongs on the exception/hold section, which opens instead.
  const [expandedSections, setExpandedSections] = useState([
    ...(seedHoldOn || seedExceptionOn ? [] : ['additional-details']),
    ...(seedHoldOn ? ['hold'] : []),
    ...(seedExceptionOn ? ['exception'] : []),
  ]);
  // The accordion no longer drives the flags (9/4/26 Eli, BB-18): the
  // Switch alone turns Hold/Exception on and off, so an ACTIVE section
  // can be collapsed out of the way — "if it's on and I force you on…
  // it eats my whole UI." (Toggling on still auto-expands as a courtesy.)

  // Exception State
  const [isExceptionActive, setIsExceptionActive] = useState(seedExceptionOn);
  const [exceptionTypes, setExceptionTypes] = useState<string[]>(() =>
    // A recorded reason that names no catalogued type still lands on a
    // valid selection — the shared parser falls back to Other.
    seedExceptionOn ? exceptionTypeValuesFromReason(seedFlag?.reason ?? '') : []
  );
  const [exceptionDescription, setExceptionDescription] = useState(seedExceptionOn ? seedFlag?.reason ?? '' : '');
  const [exceptionAttachments, setExceptionAttachments] = useState<any[]>(() => (seedExceptionOn ? (seedFlag?.attachments ?? []).map((name) => ({ name })) : []));
  // Invoice documents: an edit reopens on the record's saved files (BA
  // 10/10: files vanished after Edit), with their real sizes.
  const [invoiceAttachments, setInvoiceAttachments] = useState<{ name: string; size?: number }[]>(() =>
    (resubmitInvoice?.attachments ?? []).map((name) => ({ name, size: resubmitInvoice?.attachmentSizes?.[name] })),
  );
  const [invoiceAttachmentError, setInvoiceAttachmentError] = useState<string | null>(null);
  const [notifiedExceptionStakeholders, setNotifiedExceptionStakeholders] = useState<Set<string>>(() => new Set(seedExceptionOn ? seedFlag?.notifiedRecipientIds ?? [] : []));

  const vendorData = useMemo(() => {
    // For standalone invoices, use the standalone vendor data
    if (invoiceType === 'standalone' && standaloneVendor) {
      return mockVendors.find(v => v.vendorCode === standaloneVendor.vendorCode) || null;
    }
    const firstPO = currentPOsData[0];
    if (!firstPO) return null;
    return mockVendors.find(v => v.vendorCode === firstPO.vendorCode) || null;
  }, [currentPOsData, standaloneVendor, invoiceType]);

  const currentVendorId = vendorData?.id || standaloneVendor?.vendorId || null;

  // Standalone invoices pre-fill each line's GL from the vendor's default
  // expense account (a partner-level setting). Resolved from localStorage
  // with a fallback to the seeded mock value; empty when none is configured.
  const vendorDefaultExpense = useMemo(
    () => (isStandalone ? getVendorDefaultExpenseAccount(currentVendorId, vendorData?.defaultExpenseAccount) : ''),
    [isStandalone, currentVendorId, vendorData?.defaultExpenseAccount],
  );

  // Seed any still-empty standalone line GL with the vendor default once it
  // resolves — pre-fills the initial row(s) without clobbering manual picks.
  useEffect(() => {
    if (!isStandalone || !vendorDefaultExpense) return;
    setStandaloneItems(prev => {
      let changed = false;
      const next = prev.map(item => {
        if (!item.glAccount) { changed = true; return { ...item, glAccount: vendorDefaultExpense }; }
        return item;
      });
      return changed ? next : prev;
    });
  }, [isStandalone, vendorDefaultExpense]);

  // Most-used expense account across standalone lines (ties → first-seen).
  // Offered in the submit modal as the candidate vendor default.
  const mostUsedGl = useMemo(() => {
    if (!isStandalone) return '';
    const counts = new Map<string, number>();
    for (const item of standaloneItems) {
      const gl = item.glAccount?.trim();
      if (!gl) continue;
      counts.set(gl, (counts.get(gl) || 0) + 1);
    }
    let best = '';
    let bestCount = 0;
    for (const [gl, count] of counts) {
      if (count > bestCount) { best = gl; bestCount = count; }
    }
    return best;
  }, [isStandalone, standaloneItems]);

  // Vendor-level carrier list — read-only on the invoice flow. Pulled
  // deterministically from a hash of the vendor code so each vendor's
  // Freight & Logistics section feels like real partner config without
  // requiring per-vendor records.
  const vendorCarriers = useMemo(
    () => getCarriersForVendor(vendorData?.vendorCode || standaloneVendor?.vendorCode),
    [vendorData?.vendorCode, standaloneVendor?.vendorCode],
  );
  // The vendor's inherited default carrier (first in the per-vendor slice,
  // always the primary one). Used as the initial freight carrier and to
  // flag the "Vendor default" hint in the picker.
  const vendorDefaultCarrierId = vendorCarriers[0]?.id ?? null;

  // Freight carrier picker — mirrors the payment-terms interaction. The
  // carrier inherits from the vendor profile but the invoicing user can
  // override it for this invoice (or push the change to the vendor going
  // forward) via a browse modal + scope-confirmation dialog.
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(vendorDefaultCarrierId);
  const [carrierModalOpen, setCarrierModalOpen] = useState(false);
  const [carrierDraftId, setCarrierDraftId] = useState<string | null>(vendorDefaultCarrierId);
  const [carrierConfirmOpen, setCarrierConfirmOpen] = useState(false);
  const [carrierSearch, setCarrierSearch] = useState('');
  const [carrierModeFilter, setCarrierModeFilter] = useState<'' | CarrierMode>('');
  const [carrierStatusFilter, setCarrierStatusFilter] = useState<string>('all');
  const [carrierFullscreen, setCarrierFullscreen] = useState(false);
  const [carrierSortBy, setCarrierSortBy] = useState<'name' | 'transit' | 'mode'>('name');
  const [carrierSortDir, setCarrierSortDir] = useState<'asc' | 'desc'>('asc');
  const [carrierSortOpen, setCarrierSortOpen] = useState(false);

  // Resolved carrier objects for the summary card + confirm-dialog diff.
  const selectedCarrier = useMemo(
    () => findCarrierById(selectedCarrierId) ?? vendorCarriers[0],
    [selectedCarrierId, vendorCarriers],
  );
  const draftCarrier = useMemo(() => findCarrierById(carrierDraftId), [carrierDraftId]);

  const filteredCarriers = useMemo(() => {
    let list = CARRIER_CATALOGUE.filter((c) => {
      if (carrierModeFilter && c.mode !== carrierModeFilter) return false;
      if (carrierStatusFilter === 'active' && c.status !== 'Active') return false;
      if (carrierStatusFilter === 'under_review' && c.status !== 'Under Review') return false;
      if (carrierStatusFilter === 'vendor' && c.id !== vendorDefaultCarrierId) return false;
      if (carrierSearch.trim()) {
        const q = carrierSearch.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.methodName.toLowerCase().includes(q) && !c.region.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
    const dir = carrierSortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (carrierSortBy === 'name') return a.name.localeCompare(b.name) * dir;
      if (carrierSortBy === 'mode') return a.mode.localeCompare(b.mode) * dir;
      return (a.minDays - b.minDays) * dir; // transit
    });
    return list;
  }, [carrierModeFilter, carrierStatusFilter, carrierSearch, carrierSortBy, carrierSortDir, vendorDefaultCarrierId]);

  // Invoice Details State — the OMNE number: system-generated in
  // sequence (9/22/26), never the typed vendor invoice number. A
  // resubmit keeps the record's existing identity.
  const [invoiceNumber, setInvoiceNumber] = useState(() => resubmitInvoice?.invoiceNumber ?? nextSystemInvoiceNumber());
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState(resubmitInvoice?.vendorInvoiceNumber || resubmitInvoice?.invoiceNumber || '');
  // Field-level validation state — flipped to true when Submit is
  // attempted with an empty required field, drives the red outline +
  // helper copy. Cleared as soon as the user types into the field.
  const [vendorInvoiceNumberError, setVendorInvoiceNumberError] = useState(false);
  // Submit-time required-field highlights (design feedback: the Submit
  // button stays active; clicking it paints the missing fields + their
  // sections red instead of disabling the CTA).
  const [holdReasonError, setHoldReasonError] = useState(false);
  const [exceptionTypeError, setExceptionTypeError] = useState(false);
  const [exceptionDescriptionError, setExceptionDescriptionError] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(resubmitInvoice?.invoiceDate || localTodayIso());
  // Kind-aware fallback seed (9/2/26): a pre-invoice can never open on a
  // NET term, so when no term arrives from the flow it defaults to the
  // prepayment side's most-used template instead of Net 30 — the amber
  // kind-conflict strip stays as a backstop, not the opening state.
  const seedKindIsPre = flowKind
    ? flowKind === 'pre'
    : selectedPOsData.length > 0 && selectedPOsData.every((po) => po.isPreInvoice);
  const fallbackSeedTerm = seedKindIsPre ? 'Full Advance Payment: Order Confirmation' : 'Net 30';
  const [paymentTerms, setPaymentTerms] = useState(initialPaymentTerm || fallbackSeedTerm);
  // The vendor's inherited default term, captured once. When the active
  // term still equals it, the summary card shows the "Inherited" pill
  // (mirrors the carrier's vendorDefault → "Inherited" treatment).
  const [vendorDefaultPaymentTerm] = useState(() => 'Net 30');
  // Payment terms picker — opens a rich modal patterned after the
  // partner module; Apply updates this invoice's term directly (8/28/26
  // review: the scope-confirmation step is gone, vendor defaults are
  // managed in Partner Management).
  const [paymentTermsModalOpen, setPaymentTermsModalOpen] = useState(false);
  // Select-then-apply (Eli 9/8, partner group-selection pattern): a card
  // CLICK only marks the pending pick; the footer "Apply to invoice" is
  // the one affirmative commit. Closing without Apply discards the pick —
  // applyTermToInvoice stays the only mutation path.
  const [ptPendingId, setPtPendingId] = useState<string | null>(null);
  // "See detail" opens the partner-style detail modal (view-only in the
  // browse context — its Apply footer is gone per Eli 9/8). The label
  // whose detail modal is open:
  const [browseTermDetail, setBrowseTermDetail] = useState<string | null>(null);
  // Gate route (8/31/26): "choose from templates" lands here with the
  // browse modal already open on the NET terms tab (the default read —
  // Pre and Split stay one click away).
  useEffect(() => {
    if (openTermsPickerOnMount) {
      // Land on a tab that fits the invoice kind: pre-invoices cannot
      // take NET terms, so they open on Prepayment (9/1/26).
      setPtTypeFilters(seedKindIsPre ? 'prepayment' : 'net');
      setPaymentTermsModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [paymentTermsDraft, setPaymentTermsDraft] = useState(initialPaymentTerm || fallbackSeedTerm);
  const [ptSearch, setPtSearch] = useState('');
  const [ptTypeFilters, setPtTypeFilters] = useState<'' | PaymentTermCategory>('net');
  const [ptStatusFilter, setPtStatusFilter] = useState<string>('all');
  const [ptFullscreen, setPtFullscreen] = useState(false);
  const [ptSortBy, setPtSortBy] = useState<'name' | 'vendorsApplied' | 'duration' | 'category'>('name');
  const [ptSortDir, setPtSortDir] = useState<'asc' | 'desc'>('asc');
  const [ptSortOpen, setPtSortOpen] = useState(false);
  const [selectedPaymentTermId, setSelectedPaymentTermId] = useState<string | null>(() => {
    const initial = findPresetByLabel(paymentTermsDraft) ?? findPresetByLabel(fallbackSeedTerm);
    return initial?.id ?? null;
  });
  // Mixed PO terms (8/28/26 evening review): the per-PO cards are
  // read-only context — terms change at the INVOICE level only, and an
  // unresolved mixed state BLOCKS submit until one term is picked.
  // poTermOverrides aligns every PO once the user picks.
  const [poTermOverrides, setPoTermOverrides] = useState<Record<string, string>>(() =>
    // Gate resolution: the picked term aligns every PO from the first
    // render, so the screen opens conflict-free.
    initialPaymentTerm
      ? Object.fromEntries(selectedPOsData.map((po) => [po.poNumber, initialPaymentTerm]))
      : {},
  );
  const [mixedTermsError, setMixedTermsError] = useState(false);
  // Mixed-terms card starts collapsed (9/1/26): the per-PO term cards
  // are context, not a decision surface, so they fold behind a summary
  // row until the user opens them.
  const [mixedTermsExpanded, setMixedTermsExpanded] = useState(false);
  // Create Payment Term modal — Create New opens it blank, Duplicate
  // (browse cards + term details footer) seeds it from the source term.
  const [createPtOpen, setCreatePtOpen] = useState(false);
  const [createPtSeed, setCreatePtSeed] = useState<PaymentTermPreset | undefined>(undefined);
  const [apAccount, setApAccount] = useState(() => {
    // The record's own A/P account round-trips (GPT QC14 retest 10/2:
    // an untouched resolve swapped 2140-AP-Rent for the vendor-category
    // default); the mapping only seeds fresh creates.
    if (resubmitInvoice?.apAccount) return resubmitInvoice.apAccount;
    const vendorCategory = standaloneVendor?.vendorCategory || vendorData?.category || '';
    return VENDOR_AP_MAPPING[vendorCategory] || VENDOR_AP_MAPPING['default'];
  });
  const [apConfigModalOpen, setApConfigModalOpen] = useState(false);
  const [apModalSearch, setApModalSearch] = useState('');
  // Advances account on the pre-invoice rail, unlocked (user 10/5):
  // defaults to the standard advances account, picker over the
  // prepaid-asset accounts.
  const [advancesAccount, setAdvancesAccount] = useState(ADVANCES_ACCOUNT);
  const [advancesPickOpen, setAdvancesPickOpen] = useState(false);
  const [description, setDescription] = useState(resubmitInvoice?.description || '');
  // Posting date is the ledger ENTRY date (8/25/26 meeting): defaults to
  // today and is editable within an open period for every posted type.
  // It no longer derives from the receiving date — the receiver already
  // booked inventory and the AP accrual; this entry just transfers the
  // liability. Pre-invoices still post at receiving, so theirs stays
  // locked and empty.
  // A resubmit reopens on the record's SAVED posting date (GPT QC14
  // retest 10/2: an untouched resolve re-stamped the ledger entry date
  // to today) — unless that period has since closed, where the editable
  // field would gate the submit; then it falls to today like a fresh
  // entry. Fresh creates still default to today.
  const [postingDate, setPostingDate] = useState(() => {
    const saved = resubmitInvoice?.postingDate;
    return saved && !isClosedPeriod(saved) ? saved : localTodayIso();
  });
  // Trigger Date for terms whose event isn't Receiving or Invoice Date
  // (Shipping, Production End, ...). Starts EMPTY and is required
  // (8/28/26 review): the vendor supplies this date on their invoice and
  // the due date can't compute without it. A resubmit reopens on the
  // record's SAVED trigger date (Mahreen 9/29: the resolve form showed
  // today instead of the saved date).
  const [manualTriggerDate, setManualTriggerDate] = useState<string | null>(resubmitInvoice?.triggerDate ?? null);
  const [triggerDateError, setTriggerDateError] = useState(false);
  // Receiving-triggered terms auto-pick per the company setting, but the
  // user may switch to ANY linked receiving's date (not a custom date).
  const [receivingTriggerOverride, setReceivingTriggerOverride] = useState<string | null>(null);
  // The receiving-date picker popover (9/3/26): a custom popover, not a
  // Select, so each receiving document can render as a CLICKABLE pill.
  const [receivingPickOpen, setReceivingPickOpen] = useState(false);
  
  const vendorName = standaloneVendor?.vendorName || currentPOsData[0]?.vendorName || 'Global Logistics Partners';

  // Latest editable-state fingerprint, refreshed every render; the mount
  // snapshot copies from it after the seeding effects settle.
  latestResubJsonRef.current = JSON.stringify([
    vendorInvoiceNumber, invoiceDate, postingDate, manualTriggerDate,
    receivingTriggerOverride, description, paymentTerms, additionalCharges, currentPOsData, standaloneItems,
  ]);
  useEffect(() => {
    // Baseline captured for EVERY edit/resubmit (VI-53), not just the
    // recordation path, so closing a no-change edit can skip the discard
    // prompt. The submit-time no-change check stays gated separately.
    if (!isResubmit) return;
    const t = setTimeout(() => {
      if (resubSnapshotRef.current === null) resubSnapshotRef.current = latestResubJsonRef.current;
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResubmit]);

  // Vendor invoice numbers must be unique PER VENDOR, not system-wide
  // (design review 7/9/26). Engineers will pair the locked internal ID
  // with this vendor-supplied number; the UI blocks a duplicate for the
  // same vendor and points at the invoice that already carries it.
  const vendorInvoiceNumberDuplicate = useMemo(() => {
    const q = normalizeInvoiceNumber(vendorInvoiceNumber);
    if (!q) return null;
    const vendorKey = normalizeVendor(vendorName);
    // Live session records + seeds (GPT QC16, 9/30): the check used to
    // read only the static seed array, so a second manual submit with
    // the same vendor + number sailed through while the import path
    // blocked it. Same normalization as the import engine now, so the
    // two routes enforce one rule.
    const pool = liveInvoices?.length ? liveInvoices : mockInvoices;
    return (
      pool.find(
        (inv) =>
          normalizeVendor(inv.vendor) === vendorKey &&
          normalizeInvoiceNumber(inv.vendorInvoiceNumber) === q &&
          // Resubmission edits an EXISTING invoice, so its own number is
          // not a duplicate of itself (feedback 7/20/26). A different
          // invoice's number still blocks, same as creation.
          inv.id !== resubmitInvoice?.id &&
          inv.invoiceNumber !== resubmitInvoice?.invoiceNumber
      ) ?? null
    );
  }, [vendorInvoiceNumber, vendorName, resubmitInvoice, liveInvoices]);

  // PO-based tabs
  const uniquePONumbers = useMemo(() => {
    const pos = currentPOsData.map(po => po.poNumber);
    return Array.from(new Set(pos));
  }, [currentPOsData]);

  const [activePOTab, setActivePOTab] = useState<string>(uniquePONumbers[0] || '');

  // First-seen GL default per line-item id. The lineItem useMemo below
  // mutates poItem.glAccount when the user changes a row's account, so
  // we can't read the "default" from the source data afterwards. This
  // ref caches the original value the first time we encounter each id
  // so the Reset-to-default control keeps working forever.
  const defaultGlRef = useRef<Map<string, string>>(new Map());
  // First-seen unit price per line — editing overwrites the PO item's
  // price in state, so the original is pinned here for the change tag.
  const originalPriceRef = useRef<Map<string, number>>(new Map());

  // Group items
  const lineItems = useMemo(() => {
    const items: LineItem[] = [];
    currentPOsData.forEach(poData => {
      if (poData.isPreInvoice) {
        // For Pre-Invoices, poData.items is already filtered by the selection modal
        poData.items.forEach(item => {
          // A pre-invoice covers the UNRECEIVED remainder of a line
          // (9/4/26 Eli, D-01a: pre vs post lives at the line level) — a
          // 100-ordered / 40-received line opens at 60, clamps at 60.
          // max(receivedQty, invoicedQty) handles both the partially
          // received case and the already-partially-pre-invoiced one.
          const remaining = Math.max(0, item.quantity - Math.max(item.receivedQty || 0, item.invoicedQty || 0));
          const invQty = item.customInvoiceQty !== undefined ? item.customInvoiceQty : remaining;
          items.push({
            id: `pre-${poData.poNumber}-${item.id}`,
            sku: item.sku,
            description: item.description,
            orderedQty: item.quantity,
            receivedQty: item.receivedQty || 0,
            invoiceQty: invQty,
            remainingQty: remaining,
            uom: item.uom,
            unitPrice: item.unitPrice,
            originalUnitPrice: (() => {
              const id = `pre-${poData.poNumber}-${item.id}`;
              if (!originalPriceRef.current.has(id)) originalPriceRef.current.set(id, (item as { poUnitPrice?: number }).poUnitPrice ?? item.unitPrice);
              return originalPriceRef.current.get(id)!;
            })(),
            lineTotal: invQty * item.unitPrice,
            poNumber: poData.poNumber,
            grnNumbers: [],
            isPreInvoice: true,
            glAccount: item.glAccount || '1205 Advance Payments',
            defaultGlAccount: (() => {
              const id = `pre-${poData.poNumber}-${item.id}`;
              if (!defaultGlRef.current.has(id)) defaultGlRef.current.set(id, item.glAccount || '1205 Advance Payments');
              return defaultGlRef.current.get(id)!;
            })(),
          });
        });
      } else {
        // Standard invoice — iterate every selected GRN item across the
        // PO and CONSOLIDATE by PO item id, so a single item number split across
        // multiple GRNs (which happens whenever a partial receipt was
        // followed by a second delivery) renders as ONE invoice line
        // instead of one row per GRN. Quantities sum, linked GRN
        // numbers stack into `grnNumbers`.
        const agg = new Map<string, LineItem>();
        poData.relatedGRNs.forEach(grn => {
          grn.items.forEach(item => {
            const isItemSelected = poData.selectedGRNItemIds?.includes(`${grn.grnNumber}:${item.id}`);
            if (!isItemSelected && poData.selectedGRNItemIds) return;

            const poItem = poData.items.find(si => si.sku === item.sku);
            if (!poItem) return;

            const key = `${poData.poNumber}-${poItem.id}`;
            const unitPrice = poItem.unitPrice || item.unitPrice;
            const existing = agg.get(key);

            if (existing) {
              // Same PO item already aggregated — fold this GRN slice in.
              // The TYPED aggregate quantity is authoritative (9/22/26
              // review response, GPT F28): when the user set a quantity on
              // the merged line, later slices only grow received/remaining
              // — they never re-add on top of the typed value (2 stayed 2,
              // instead of becoming 72 of 79).
              existing.receivedQty += item.quantity;
              const remainingFromThisGrn = item.quantity - (item.invoicedQty || 0);
              existing.remainingQty += remainingFromThisGrn;
              if (poItem.customInvoiceQty === undefined) {
                existing.invoiceQty += remainingFromThisGrn;
              }
              existing.lineTotal = existing.invoiceQty * existing.unitPrice;
              if (!existing.grnNumbers.includes(grn.grnNumber)) {
                existing.grnNumbers.push(grn.grnNumber);
              }
              // Keep the latest GRN date so the dueDate calculation stays
              // anchored to the most recent receipt.
              if (!existing.grnDate || new Date(grn.grnDate) > new Date(existing.grnDate)) {
                existing.grnDate = grn.grnDate;
              }
            } else {
              const remaining = item.quantity - (item.invoicedQty || 0);
              const invQty = poItem.customInvoiceQty !== undefined ? poItem.customInvoiceQty : remaining;
              const lineId = `inv-${poData.poNumber}-${poItem.id}`;
              if (!defaultGlRef.current.has(lineId)) defaultGlRef.current.set(lineId, poItem.glAccount || '1200 Inventory');
              if (!originalPriceRef.current.has(lineId)) originalPriceRef.current.set(lineId, (poItem as { poUnitPrice?: number }).poUnitPrice ?? unitPrice);
              agg.set(key, {
                id: lineId,
                sku: item.sku,
                description: item.description,
                orderedQty: poItem.quantity,
                receivedQty: item.quantity,
                invoiceQty: invQty,
                remainingQty: remaining,
                uom: item.uom,
                unitPrice,
                originalUnitPrice: originalPriceRef.current.get(lineId)!,
                lineTotal: unitPrice * invQty,
                poNumber: poData.poNumber,
                grnNumbers: [grn.grnNumber],
                grnDate: grn.grnDate,
                isPreInvoice: false,
                glAccount: poItem.glAccount || '1200 Inventory',
                defaultGlAccount: defaultGlRef.current.get(lineId)!,
              });
            }
          });
        });
        items.push(...agg.values());
      }
    });
    return items;
  }, [currentPOsData]);

  // Static presets + runtime-created custom terms (Create New/Duplicate).
  const runtimePtTerms = useRuntimeTerms();
  const allPtTerms = useMemo(() => [...PAYMENT_TERM_PRESETS, ...runtimePtTerms], [runtimePtTerms]);

  const filteredPaymentTermPresets = useMemo(() => {
    let terms = allPtTerms.slice();
    if (ptTypeFilters) terms = terms.filter((t) => t.category === ptTypeFilters);
    if (ptStatusFilter === 'preset') terms = terms.filter((t) => !t.id.startsWith('pt-custom-'));
    else if (ptStatusFilter === 'custom') terms = terms.filter((t) => t.id.startsWith('pt-custom-'));
    else if (ptStatusFilter === 'created_by_me') terms = terms.filter((t) => t.id.startsWith('pt-custom-'));
    else if (ptStatusFilter === 'in_use') terms = terms.filter((t) => t.vendorsApplied >= 1);
    if (ptSearch.trim()) {
      const q = ptSearch.toLowerCase();
      terms = terms.filter((t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    const sorted = [...terms].sort((a, b) => {
      let cmp = 0;
      if (ptSortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (ptSortBy === 'vendorsApplied') cmp = a.vendorsApplied - b.vendorsApplied;
      else if (ptSortBy === 'duration') {
        const da = parseInt(a.duration || a.name.match(/\d+/)?.[0] || '0', 10);
        const db = parseInt(b.duration || b.name.match(/\d+/)?.[0] || '0', 10);
        cmp = da - db;
      } else if (ptSortBy === 'category') cmp = a.category.localeCompare(b.category);
      return ptSortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [allPtTerms, ptTypeFilters, ptStatusFilter, ptSearch, ptSortBy, ptSortDir]);

  // ── Trigger date engine (8/25/26 meeting) ─────────────────────────
  // Due date = trigger date + term days, fully decoupled from the
  // posting date. The trigger comes from the vendor's payment term:
  //   Receiving     -> receiving date(s); a system setting picks earliest
  //                    or latest when several receivings feed one invoice.
  //   Invoice Date  -> the vendor invoice date.
  //   anything else -> the editable Trigger Date field, defaulting to the
  //                    vendor invoice date.
  const { receivingDateBasis } = useSystemSettings();
  // Term category rule (9/1/26): the invoice kind bounds which term
  // types make sense. A pre-invoice pays BEFORE receiving, so NET terms
  // (clocks that run after an event) don't apply — only prepayment or
  // split. A post-invoice bills received goods, so prepayment terms
  // don't apply — only NET or split. Split passes both because its
  // slices span both sides. Standalone invoices carry no POs, so no
  // restriction applies.
  // The flow's assertion wins (9/4/26, D-01); the every-PO-unreceived
  // inference remains only as the fallback for legacy callers that don't
  // pass flowKind (exception resubmit).
  const invoiceKind: 'pre' | 'post' | null =
    isStandalone || currentPOsData.length === 0
      ? null
      : flowKind ?? (currentPOsData.every((po) => po.isPreInvoice) ? 'pre' : 'post');
  const termCategoryAllowed = (category: PaymentTermCategory) =>
    invoiceKind === 'pre' ? category !== 'net'
      : invoiceKind === 'post' ? category !== 'prepayment'
      // Standalone invoices bill for something already delivered, so the
      // Pre (prepayment) tab is disabled (VI-28).
      : isStandalone ? category !== 'prepayment'
      : true;
  const termKindWarning = (category: PaymentTermCategory) =>
    invoiceKind === 'pre' && category === 'net'
      ? 'NET terms apply after goods are received, so they don’t fit a pre-invoice. Pick a prepayment or split term.'
      : invoiceKind === 'post' && category === 'prepayment'
        ? 'Prepayment terms apply before goods ship, so they don’t fit an invoice for received goods. Pick a NET or split term.'
        : isStandalone && category === 'prepayment'
          ? 'A standalone invoice bills for goods already delivered, so prepayment terms don’t apply. Pick a NET or split term.'
          : null;
  // Slice rule inside a split (9/1/26, Mahreen): a slice due at a
  // pre-transfer event is the split's PREPAYMENT part; the Receiving and
  // Shipping slices are its standard-invoice part. A pre-invoice may
  // only cover prepayment slices, a received-goods invoice only the
  // others.
  const sliceIsPostSide = (s: SplitSlice) => s.triggerEvent === 'Receiving' || s.triggerEvent === 'Shipping';
  const sliceAllowedForKind = (s: SplitSlice) =>
    invoiceKind === 'pre' ? !sliceIsPostSide(s) : invoiceKind === 'post' ? sliceIsPostSide(s) : true;

  const activeTermPreset = useMemo(() => findRuntimeTerm(paymentTerms) ?? resolvePaymentTerm(paymentTerms), [paymentTerms]);
  // Split terms: the user picks WHICH SLICE this invoice covers (Eli,
  // 8/31/26 review) — the vendor sends a separate invoice per slice, so
  // the system mirrors that one-invoice-per-slice. The chosen slice's
  // trigger event and net days drive the payment clock.
  const [splitSliceIdx, setSplitSliceIdx] = useState(0);
  // Default to the first slice the invoice kind can cover (9/1/26).
  useEffect(() => {
    const slices = activeTermPreset.category === 'split' ? SPLIT_TERM_SLICES[activeTermPreset.id] ?? [] : [];
    const first = slices.findIndex(sliceAllowedForKind);
    setSplitSliceIdx(first >= 0 ? first : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentTerms, invoiceKind]);
  const splitSlices = useMemo(
    () => (activeTermPreset.category === 'split' ? SPLIT_TERM_SLICES[activeTermPreset.id] ?? [] : []),
    [activeTermPreset],
  );
  const activeSlice = splitSlices.length > 0 ? splitSlices[Math.min(splitSliceIdx, splitSlices.length - 1)] : null;
  // Standalone invoices never carry receivings, so a receiving-triggered
  // term falls back to the manual Trigger Date behavior.
  const triggerKind = useMemo(() => {
    const kind = triggerKindFor(activeSlice?.triggerEvent ?? activeTermPreset.trigger);
    return kind === 'receiving' && isStandalone ? 'other' : kind;
  }, [activeTermPreset, activeSlice, isStandalone]);
  // Event triggers the vendor states on their document (Order
  // Confirmation, Production Start/End, Shipping) start EMPTY and stay
  // empty until keyed (Mahreen 10/10); only a standalone's receiving
  // fallback still defaults to the invoice date.
  const triggerIsVendorEvent = useMemo(
    () => triggerKindFor(activeSlice?.triggerEvent ?? activeTermPreset.trigger) === 'other',
    [activeTermPreset, activeSlice],
  );

  // Distinct linked receiving dates with their GRN numbers, oldest first.
  // Feeds both the company-setting auto-pick and the override select.
  const linkedReceivingOptions = useMemo(() => {
    const byDate = new Map<string, Set<string>>();
    lineItems.forEach((item) => {
      if (!item.isPreInvoice && item.grnDate) {
        const grns = byDate.get(item.grnDate) ?? new Set<string>();
        (item.grnNumbers || []).forEach((g) => grns.add(g));
        byDate.set(item.grnDate, grns);
      }
    });
    return Array.from(byDate.entries())
      .map(([date, grns]) => ({ date, grns: Array.from(grns) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [lineItems]);

  // Empty string = the payment clock hasn't started: a receiving trigger
  // with nothing received, or a manual trigger the user hasn't keyed yet.
  const triggerDate = useMemo(() => {
    if (triggerKind === 'receiving') {
      if (linkedReceivingOptions.length === 0) return '';
      if (
        receivingTriggerOverride &&
        linkedReceivingOptions.some((o) => o.date === receivingTriggerOverride)
      ) {
        return receivingTriggerOverride;
      }
      return receivingDateBasis === 'latest'
        ? linkedReceivingOptions[linkedReceivingOptions.length - 1].date
        : linkedReceivingOptions[0].date;
    }
    // Invoice-date terms: defaults from the vendor invoice date and
    // stays EDITABLE (Sep 8 VI-D10; 9/22/26 review response, GPT NEW-01).
    if (triggerKind === 'invoiceDate') return manualTriggerDate ?? invoiceDate;
    // Vendor-event triggers never prefill (Mahreen 10/10, supersedes the
    // 9/4 BB-13 invoice-date default): Clear empties the field for real.
    if (triggerIsVendorEvent) return manualTriggerDate ?? '';
    return manualTriggerDate ?? invoiceDate;
  }, [triggerKind, triggerIsVendorEvent, linkedReceivingOptions, receivingTriggerOverride, receivingDateBasis, invoiceDate, manualTriggerDate]);

  const dueDate = useMemo(() => {
    if (!triggerDate) return '';
    // addDaysIso counts real calendar days at local midnight (9/22/26
    // review response, Claude C03-D7): Feb 3, 2024 + 45 lands on Mar 19,
    // counting Feb 29 — the UTC round-trip that ate a day is gone.
    if (paymentTerms === 'Due on Receipt') return triggerDate.slice(0, 10);
    // Split slice: due = the slice's trigger date + ITS net days (0 =
    // due at the event).
    if (activeSlice) return addDaysIso(triggerDate, activeSlice.netDays);
    const preset = findPresetByLabel(paymentTerms);
    const days = preset ? daysForPreset(preset) : (parseInt(paymentTerms.replace(/\D/g, '')) || 0);
    return addDaysIso(triggerDate, days);
  }, [triggerDate, paymentTerms, activeSlice]);

  // Posting is blocked into closed periods (anything before the current
  // month): red helper + submit lock while the picked date is closed.
  const postingDateClosed = !!postingDate && isClosedPeriod(postingDate);

  // Format date for display, the system-wide pattern (Feb 15, 2024).
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const hasReceivingDocs = lineItems.some(item => !item.isPreInvoice && item.grnDate);
  // A pure pre-invoice: the Pre-Invoice flow asserts it (9/4/26); the
  // no-receiving-docs inference stays as the legacy-caller fallback.
  const isPurePreInvoice = invoiceKind ? invoiceKind === 'pre' : (!isStandalone && !hasReceivingDocs);

  const updateLineItem = (id: string, field: string, value: any) => {
    setCurrentPOsData(prev => prev.map(po => {
      const newItems = po.items.map(item => {
        if (id.endsWith(item.id)) {
          const updatedItem = { ...item };
          if (field === 'invoiceQty') {
            // Quantities and prices are never negative (9/22/26 review
            // response, Claude C03-X2): a minus sign clamps to zero, and
            // zero honestly means "this line is left off the invoice".
            const qty = Math.max(0, parseFloat(value) || 0);
            updatedItem.customInvoiceQty = qty;
            // Also update price based on custom qty if available
            updatedItem.totalPrice = qty * (updatedItem.unitPrice || item.unitPrice);
          } else if (field === 'unitPrice') {
            const price = Math.max(0, parseFloat(value) || 0);
            updatedItem.unitPrice = price;
            const currentQty = updatedItem.customInvoiceQty !== undefined ? updatedItem.customInvoiceQty : item.quantity;
            updatedItem.totalPrice = currentQty * price;
          } else if (field === 'glAccount') {
            updatedItem.glAccount = value;
          }
          return updatedItem;
        }
        return item;
      });

      return { ...po, items: newItems };
    }));
  };

  const currentPOItems = lineItems.filter(item => item.poNumber === activePOTab);
  // Free-text filter for the line-items table — matches item number or description.
  // Only the displayed rows are filtered; counts/totals/select-all still work
  // off the full currentPOItems set.
  const lineItemQuery = lineItemSearch.trim().toLowerCase();
  const displayedPOItems = lineItemQuery
    ? currentPOItems.filter(
        (item) =>
          item.sku.toLowerCase().includes(lineItemQuery) ||
          (item.description || '').toLowerCase().includes(lineItemQuery),
      )
    : currentPOItems;
  const subtotal = isStandalone ? standaloneSubtotal : lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const additionalChargesTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
  // Tax carried from the reopened record (GPT QC14): the form has no tax
  // field, so a seeded invoice's tax share rides through read-only — an
  // untouched resubmit must round-trip the exact saved total.
  const seededTax = resubmitInvoice?.charges?.tax ?? 0;
  const total = subtotal + freightAmount + additionalChargesTotal + seededTax;
  // Split slice math (Eli, 8/31/26 review + 9/2/26): a PRE invoice on a
  // split term bills only ITS slice of the order value — the total
  // adjusts to the slice percent and an explicit reduction row explains
  // it. A POST invoice keeps the full total; the prepaid slices arrive
  // as reconciled prepayments instead.
  const sliceFraction = invoiceKind === 'pre' && activeSlice ? activeSlice.percent / 100 : 1;
  const sliceAdjustedTotal = Math.round(total * sliceFraction * 100) / 100;
  const sliceReduction = Math.round((total - sliceAdjustedTotal) * 100) / 100;
  // Reconciliation (Eli, 8/31/26): prepayments on the selected POs apply
  // at the TOTALS level (never per line item), reduce the payable, and
  // close their pre-invoices on submit.
  const appliedPrepayEntries = useMemo(() => {
    if (isStandalone || !prepaidPOContext) return [] as { invoiceNumber: string; amount: number }[];
    const seen = new Map<string, number>();
    uniquePONumbers.forEach((po) => {
      const ctx = prepaidPOContext[po];
      if (ctx) seen.set(ctx.preInvoiceNumber, Math.round(((seen.get(ctx.preInvoiceNumber) ?? 0) + ctx.amount) * 100) / 100);
    });
    return Array.from(seen.entries()).map(([invoiceNumber, amount]) => ({ invoiceNumber, amount }));
  }, [isStandalone, prepaidPOContext, uniquePONumbers]);
  const prepayApplied = Math.min(
    Math.round(appliedPrepayEntries.reduce((sum, e) => sum + e.amount, 0) * 100) / 100,
    sliceAdjustedTotal,
  );
  const totalDueAfterPrepay = Math.max(0, Math.round((sliceAdjustedTotal - prepayApplied) * 100) / 100);

  // ── Currency & Exchange Rates (spec 4.4, 3.5) ─────────────────────────
  // The invoice is written in one currency: its PO's, else the vendor's
  // partner-record default (a reopened invoice keeps its own). The rate is
  // taken on the posting date: mid-market is read-only, a corporate rate can
  // be changed here. A/P posts in the base currency at this rate, the rate a
  // later payment is compared against. A pre-invoice posts when it's paid,
  // so its rate is taken then (today's stands in for the preview).
  const poCurrency = !isStandalone ? currentPOsData[0]?.currency : undefined;
  const vendorDefaultCurrency = vendorData?.currency || standaloneVendor?.currency || BASE_CURRENCY;
  const [invoiceCurrency, setInvoiceCurrency] = useState<string>(
    () => resubmitInvoice?.currency || poCurrency || vendorDefaultCurrency,
  );
  const [rateType, setRateType] = useState<RateType>(resubmitInvoice?.rateType ?? DEFAULT_RATE_TYPE);
  // A corporate rate typed on the invoice; null keeps the rate table's.
  const [typedRate, setTypedRate] = useState<string | null>(
    resubmitInvoice?.rateEdited && resubmitInvoice.exchangeRate ? String(resubmitInvoice.exchangeRate) : null,
  );
  const [rateError, setRateError] = useState(false);
  const invoiceIsBase = isBaseCurrency(invoiceCurrency);
  const ratePending = invoiceKind === 'pre';
  const rateDay = ratePending || !postingDate ? localTodayIso() : postingDate;
  const tableQuote = useMemo(() => rateOn(invoiceCurrency, rateDay, rateType), [invoiceCurrency, rateDay, rateType]);
  const midQuote = useMemo(() => rateOn(invoiceCurrency, rateDay, 'mid'), [invoiceCurrency, rateDay]);
  const typedRateValue = typedRate != null && typedRate.trim() !== '' ? Number(typedRate) : null;
  const invoiceRate: number | null = invoiceIsBase
    ? 1
    : rateType === 'corporate' && typedRate != null
      ? typedRateValue != null && typedRateValue > 0
        ? typedRateValue
        : null
      : tableQuote.rate;
  const rateEdited = rateType === 'corporate' && typedRateValue != null && typedRateValue !== tableQuote.rate;
  // Nothing to post at when a foreign invoice has no usable rate (blocks submit).
  const rateMissing = !invoiceIsBase && !ratePending && invoiceRate == null;
  /** An invoice-currency amount in the base currency, at the invoice rate. */
  const inBase = (n: number) => toBase(n, invoiceRate ?? midQuote.rate ?? 1);
  /** An invoice-currency amount as text: $12,400.00 · €980.50. */
  const money = (n: number) => formatMoney(n, invoiceCurrency);
  // Money inputs show the symbol on the left; their padding clears it (pl-5 fits "$").
  const moneySymbol = moneyPrefix(invoiceCurrency).replace(/\u200E/g, '').trim();
  const symbolPad = moneySymbol.length <= 1 ? 'pl-5' : moneySymbol.length === 2 ? 'pl-7' : 'pl-9';
  const symbolPadWide = moneySymbol.length <= 1 ? 'pl-6' : moneySymbol.length === 2 ? 'pl-8' : 'pl-10';
  /** The rate fields an invoice saved from this form carries. */
  /** The rate fields an invoice saved from this form carries. `posted`:
   *  a record that posts now (a split's receiving child does even on the
   *  pre-invoice screen), at the rate its GL is built with. */
  const invoiceFxFields = (
    posted = !ratePending,
  ): Pick<Invoice, 'currency' | 'exchangeRate' | 'rateType' | 'rateDate' | 'rateEdited'> => {
    const rate = invoiceRate ?? (posted ? midQuote.rate : null);
    return {
      currency: invoiceCurrency,
      ...(!posted || rate == null
        ? {}
        : { exchangeRate: rate, rateType: invoiceRate != null ? rateType : 'mid', rateDate: rateDay, rateEdited: rateEdited || undefined }),
    };
  };
  // The PO's own rate, for the "vs PO" comparison on the rate field.
  const poRateRef = !isStandalone && currentPOsData[0]?.poExchangeRate
    ? { poNumber: currentPOsData[0].poNumber, rate: currentPOsData[0].poExchangeRate, date: currentPOsData[0].poDate }
    : null;
  // The currency and rate are editable state too: an edit that only changes
  // them is still a change (the fingerprint above is built before them).
  latestResubJsonRef.current += JSON.stringify([invoiceCurrency, rateType, typedRate]);

  const activePOOriginalData = useMemo(() => {
    if (!activePOTab) return null;
    for (const vendor of mockVendors) {
      const po = vendor.purchaseOrders.find(p => p.poNumber === activePOTab);
      if (po) return po;
    }
    return null;
  }, [activePOTab]);

  // Mixed payment terms across the linked POs (8/25/26 meeting): the
  // vendor's document decides what's on the invoice, so combining such
  // POs is allowed. The user is warned and asked to pick the term that
  // matches the vendor's invoice; the browse modal lists each PO's term
  // as a quick-pick (8/28/26 review).
  const poTermPairs = useMemo(() => {
    const pairs: { poNumber: string; term: string }[] = [];
    currentPOsData.forEach((po) => {
      for (const vendor of mockVendors) {
        const src = vendor.purchaseOrders.find((p) => p.poNumber === po.poNumber);
        if (src) {
          // A per-PO change made on this invoice wins over the PO's own
          // term (8/28/26 review).
          pairs.push({ poNumber: po.poNumber, term: poTermOverrides[po.poNumber] ?? (src.paymentTerms || vendor.paymentTerms) });
          break;
        }
      }
    });
    return pairs;
  }, [currentPOsData, poTermOverrides]);
  const mixedPoTerms = useMemo(
    () => Array.from(new Set(poTermPairs.map((p) => p.term))),
    [poTermPairs],
  );
  const hasMixedPoTerms = mixedPoTerms.length > 1;

  // The active term can arrive invalid (the vendor default seeds the
  // invoice), so submit gates on it and the sidebar card warns.
  const activeTermKindConflict = !hasMixedPoTerms && !termCategoryAllowed(activeTermPreset.category);
  const [termKindError, setTermKindError] = useState(false);
  useEffect(() => { if (!activeTermKindConflict) setTermKindError(false); }, [activeTermKindConflict]);

  // Apply a term to THIS invoice (extracted 8/31/26 so the details
  // modal's Apply and the card's Apply share one path). An invoice-level
  // pick also resolves a mixed-terms state: every PO aligns to it.
  const applyTermToInvoice = (t: PaymentTermPreset) => {
    // Kind guard (9/1/26): refuse categories that don't fit the invoice
    // kind and say why, instead of applying silently.
    const kindWarning = termKindWarning(t.category);
    if (kindWarning) {
      toast.warning(`${t.name} doesn’t fit this invoice`, { description: kindWarning });
      return;
    }
    // A split passes only if at least one slice sits on this invoice's
    // side (9/1/26, Mahreen) — a runtime split can be all-prepayment or
    // all-post, and then there is nothing here for it to cover.
    if (t.category === 'split') {
      const slices = SPLIT_TERM_SLICES[t.id] ?? [];
      if (slices.length > 0 && !slices.some(sliceAllowedForKind)) {
        toast.warning(`${t.name} doesn’t fit this invoice`, {
          description:
            invoiceKind === 'pre'
              ? 'Every slice of this split is due after transfer, so none of it can be billed on a pre-invoice.'
              : 'Every slice of this split is a prepayment, so none of it bills against received goods.',
        });
        return;
      }
    }
    setSelectedPaymentTermId(t.id);
    setPaymentTermsDraft(t.name);
    setPaymentTermsModalOpen(false);
    if (hasMixedPoTerms) {
      setPoTermOverrides(Object.fromEntries(poTermPairs.map((p) => [p.poNumber, t.name])));
      setMixedTermsError(false);
    }
    if (t.name !== paymentTerms) {
      setPaymentTerms(t.name);
      toast.success('Payment terms updated', {
        description: `${t.name} now applies to this invoice. The vendor profile is unchanged.`,
      });
    }
  };

  const handleAddItemsFromPO = (selectedItems: MockLineItem[]) => {
    setCurrentPOsData(prev => prev.map(po => {
      if (po.poNumber === activePOTab) {
        const existingIds = new Set(po.items.map(i => i.id));
        const newItems = [...po.items];
        selectedItems.forEach(item => {
          if (!existingIds.has(item.id)) {
            newItems.push(item);
          }
        });
        return { ...po, items: newItems };
      }
      return po;
    }));
    setIsAddItemModalOpen(false);
    toast.success(`${selectedItems.length} items added to ${activePOTab}`);
  };

  // Confirmed line-item removal: the row leaves the invoice, the undo
  // toast follows the system recipe (Undo action only, 30s window).
  const handleRemoveItem = () => {
    if (!itemToRemove) return;
    const previousData = JSON.parse(JSON.stringify(currentPOsData));
    const originalItemId = itemToRemove.id.split('-').pop();
    const live = lineItems.find((li) => li.id === itemToRemove.id);
    setCurrentPOsData(prev => prev.map(po => {
      if (po.poNumber !== itemToRemove.poNumber) return po;
      // Filter items, selectedItemIds, and selectedGRNItemIds to ensure full removal
      return {
        ...po,
        items: po.items.filter(pItem => !itemToRemove.id.endsWith(pItem.id)),
        selectedItemIds: po.selectedItemIds.filter(id => id !== originalItemId),
        selectedGRNItemIds: po.selectedGRNItemIds?.filter(id => id !== `${live?.grnNumbers[0]}:${originalItemId}`),
      };
    }));
    const sku = itemToRemove.sku;
    setItemToRemove(null);
    // Empty-PO cleanup (8/31/26): a PO whose last item leaves goes with
    // it; the last PO leaving returns the user to the item picker.
    const emptied = currentPOsData.find((po) => po.poNumber === itemToRemove.poNumber)?.items.length === 1;
    if (emptied) {
      const remaining = currentPOsData.filter((po) => po.poNumber !== itemToRemove.poNumber);
      setCurrentPOsData(remaining);
      if (remaining.length === 0) {
        toast(`Item ${sku} removed`, {
          description: 'That was the last item on this invoice, so it returned to item selection.',
        });
        onGoBack?.();
        return;
      }
      if (activePOTab === itemToRemove.poNumber) setActivePOTab(remaining[0].poNumber);
      // No countdown copy on undo toasts (user 9/28): the Undo button is
      // the whole story; the window stays via duration.
      toast(`Item ${sku} removed, PO ${itemToRemove.poNumber} left the invoice`, {
        description: 'It was the PO\u2019s last item.',
        action: { label: 'Undo', onClick: () => setCurrentPOsData(previousData) },
        duration: 30000,
      });
      return;
    }
    toast(`Item ${sku} removed from ${invoiceNumber}`, {
      action: {
        label: 'Undo',
        onClick: () => setCurrentPOsData(previousData),
      },
      duration: 30000,
    });
  };


  // Confirmed bulk removal (8/31/26): the selected lines leave the
  // invoice; a PO whose items are all removed leaves with them, and
  // removing the last PO returns the user to the item picker.
  const handleBulkRemoveItems = () => {
    const previousData = JSON.parse(JSON.stringify(currentPOsData));
    const count = selectedIds.size;
    const idsToRemove = new Set(selectedIds);
    const next = currentPOsData
      .map(po => po.poNumber !== activePOTab
        ? po
        : { ...po, items: po.items.filter(pItem => !Array.from(idsToRemove).some(id => id.endsWith(pItem.id))) })
      .filter(po => po.items.length > 0);
    setBulkRemoveConfirmOpen(false);
    setSelectedIds(new Set());
    setCurrentPOsData(next);
    if (next.length === 0) {
      toast(`${count} item${count === 1 ? '' : 's'} removed`, {
        description: 'That was everything on this invoice, so it returned to item selection.',
      });
      onGoBack?.();
      return;
    }
    if (activePOTab && !next.some(p => p.poNumber === activePOTab)) {
      setActivePOTab(next[0].poNumber);
      toast(`${count} item${count === 1 ? '' : 's'} removed, PO ${activePOTab} left the invoice`, {
        description: 'Every item on that PO was removed.',
        action: { label: 'Undo', onClick: () => { setCurrentPOsData(previousData); setSelectedIds(idsToRemove); } },
        duration: 30000,
      });
      return;
    }
    toast(`${count} item${count === 1 ? '' : 's'} removed from PO ${activePOTab}`, {
      action: { label: 'Undo', onClick: () => { setCurrentPOsData(previousData); setSelectedIds(idsToRemove); } },
      duration: 30000,
    });
  };

  const handleRemovePO = () => {
    if (!poToRemove) return;

    const nextPOs = currentPOsData.filter(po => po.poNumber !== poToRemove);
    setCurrentPOsData(nextPOs);
    
    if (activePOTab === poToRemove) {
      setActivePOTab(nextPOs[0]?.poNumber || '');
    }
    
    setPoToRemove(null);
    if (nextPOs.length === 0) {
      toast(`Purchase Order ${poToRemove} removed`, {
        description: 'That was the only PO on this invoice, so it returned to item selection.',
      });
      onGoBack?.();
      return;
    }
    toast.success(`Purchase Order ${poToRemove} removed`);
  };

  const handleAddPOs = (newData: SelectedPOData[]) => {
    setCurrentPOsData(prev => {
      const mergedMap = new Map(prev.map(p => [p.poNumber, p]));
      newData.forEach(newPo => {
        const existing = mergedMap.get(newPo.poNumber);
        if (existing) {
          // Merge GRNs: add new GRNs that don't already exist
          const existingGRNNumbers = new Set(existing.relatedGRNs.map(g => g.grnNumber));
          const newGRNs = newPo.relatedGRNs.filter(g => !existingGRNNumbers.has(g.grnNumber));
          const mergedGRNs = [...existing.relatedGRNs, ...newGRNs];

          // Merge selectedGRNItemIds
          const existingGRNItemIds = new Set(existing.selectedGRNItemIds || []);
          const mergedGRNItemIds = [
            ...(existing.selectedGRNItemIds || []),
            ...(newPo.selectedGRNItemIds || []).filter(id => !existingGRNItemIds.has(id))
          ];

          // Merge items: add new items that don't already exist (by id)
          const existingItemIds = new Set(existing.items.map(i => i.id));
          const newItems = newPo.items.filter(i => !existingItemIds.has(i.id));
          const mergedItems = [...existing.items, ...newItems];

          // Merge selectedItemIds
          const existingSelectedIds = new Set(existing.selectedItemIds || []);
          const mergedSelectedItemIds = [
            ...(existing.selectedItemIds || []),
            ...(newPo.selectedItemIds || []).filter(id => !existingSelectedIds.has(id))
          ];

          mergedMap.set(newPo.poNumber, {
            ...existing,
            relatedGRNs: mergedGRNs,
            selectedGRNItemIds: mergedGRNItemIds,
            items: mergedItems,
            selectedItemIds: mergedSelectedItemIds,
            itemCount: mergedItems.length,
          });
        } else {
          mergedMap.set(newPo.poNumber, newPo);
        }
      });
      return Array.from(mergedMap.values());
    });
    setIsAddPOOpen(false);
    toast.success('Selection updated successfully');
  };

  // Post-split note (9/4/26, D-01/L-02): the invoice must match the
  // receiver — an inventory invoice only ever bills received quantities
  // (unreceived lines are greyed in the picker and never reach this
  // screen), and a pre-invoice only bills unreceived remainders. The old
  // "over-received billing is treated as a pre-payment downstream"
  // allowance is dead; the flows can't mix.

  // PRD §4.5 — validation gate that blocks Submit until Payment Hold,
  // Exception, and GL account requirements are satisfied.
  const validateBeforeSubmit = (): { ok: boolean; message?: string } => {
    if (isPaymentHoldActive) {
      if (!holdReason.trim()) {
        return { ok: false, message: 'Payment Hold requires a reason.' };
      }
      // Supporting documents are NOT mandatory for Payment Hold (BA
      // feedback) — the reason alone gates submission; docs stay an
      // optional attach for audit context.
    }
    // Exception no longer blocks submission. The invoice posts with
    // status = 'Exception' (the holding state); a reason + supporting
    // doc are still recommended in the UI but optional, so the invoice
    // can be submitted and triaged downstream until the exception is
    // resolved -- at which point the backend transitions it to Approved.
    const itemsToCheck = isStandalone ? standaloneItems : lineItems;
    const missingGl = itemsToCheck.filter((item) => !item.glAccount || item.glAccount.trim() === '');
    if (missingGl.length > 0) {
      return {
        ok: false,
        message: `Every line item must have a GL account (${missingGl.length} missing).`,
      };
    }
    // Posting into a closed period is never allowed (8/25/26 meeting).
    // Pre-invoices skip this: their posting date is locked empty (10/5).
    if (invoiceKind !== 'pre' && postingDateClosed) {
      return {
        ok: false,
        message: `${postingDate} falls in a closed period. Pick a posting date in the open period.`,
      };
    }
    // Manual trigger events (Shipping, Production ...) require the date
    // from the vendor's document — the due date can't compute without it
    // (8/28/26 review).
    if (triggerKind === 'other' && !triggerDate) {
      setTriggerDateError(true);
      return { ok: false, message: 'Trigger date is required to calculate the due date.' };
    }
    return { ok: true };
  };

  // Submit stays ALWAYS active (design feedback) — validation runs on
  // click and highlights the offending fields/sections instead of
  // disabling the CTA.
  // PRD §4.2.3 — Exception ON routes the new invoice to Exception status
  // instead of Pending Approval. Otherwise it follows the existing flow.
  const submitStatus: Invoice['status'] = isExceptionActive ? 'Exception' : 'Pending Approval';
  const submitPaymentHeld = !!isPaymentHoldActive;
  const submitIsException = !!isExceptionActive;
  // Flags recorded AS HISTORY on the created invoice (BA 9/6, cover
  // every use case): a UI-created exception/hold carries the same
  // flagException/paymentHold entry the detail-page actions write —
  // reason, recipients, documents — so the detail banner, sidebar card
  // and any later edit all read the full story.
  const submitActionHistory = (): Invoice['actionHistory'] => {
    const nowIso = new Date().toISOString();
    const entries: NonNullable<Invoice['actionHistory']> = [];
    if (submitIsException) {
      const labels = EXCEPTION_TYPE_OPTIONS.filter((o) => exceptionTypes.includes(o.value)).map((o) => o.label).join(', ');
      const desc = exceptionDescription.trim();
      entries.push({
        action: 'flagException',
        reason: labels && desc && desc !== labels ? `${labels}: ${desc}` : desc || labels,
        by: 'Ahtisham Ahmad',
        at: nowIso,
        notifiedRecipientIds: notifiedExceptionStakeholders.size > 0 ? Array.from(notifiedExceptionStakeholders) : undefined,
        attachments: exceptionAttachments.length > 0 ? exceptionAttachments.map((f: any) => f.name) : undefined,
      });
    }
    if (submitPaymentHeld) {
      entries.push({
        action: 'paymentHold',
        reason: holdReason.trim(),
        by: 'Ahtisham Ahmad',
        at: nowIso,
        notifiedRecipientIds: notifiedStakeholders.size > 0 ? Array.from(notifiedStakeholders) : undefined,
        attachments: holdAttachments.length > 0 ? holdAttachments.map((f: any) => f.name) : undefined,
      });
    }
    return entries.length > 0 ? entries : undefined;
  };

  // Click handler on the footer Submit button. Runs field-level + cross-
  // field validation first; if everything is OK and the invoice carries
  // an Exception or Payment Hold flag, open the amber warning modal so
  // the user explicitly acknowledges the holding state. Otherwise submit
  // directly via performSubmit.
  const handleSubmit = () => {
    if (!onInvoicesCreated) return;

    // Field-level validation — collect EVERY missing required field,
    // highlight it (red border + helper, same recipe as the vendor
    // invoice number), make sure its section is expanded, and scroll
    // the first offender into view. The CTA itself never disables.
    const missingFieldTargets: string[] = [];
    if (!vendorInvoiceNumber.trim()) {
      setVendorInvoiceNumberError(true);
      missingFieldTargets.push('vendor-invoice-number-field');
    }
    // Duplicate per-vendor number blocks submit exactly like a missing one.
    if (vendorInvoiceNumberDuplicate) {
      missingFieldTargets.push('vendor-invoice-number-field');
    }
    // A foreign-currency invoice needs a rate to post A/P at (spec 4.4):
    // a corporate rate with none on file must be entered.
    if (rateMissing) {
      setRateError(true);
      missingFieldTargets.push('invoice-exchange-rate-field');
    }
    // "Other" additional charges must say what they are.
    const otherChargeMissingDesc = additionalCharges.find(
      (c) => c.type === 'Other' && !(c.description || '').trim()
    );
    if (otherChargeMissingDesc) {
      setChargeDescriptionError(true);
      missingFieldTargets.push(`charge-description-${otherChargeMissingDesc.id}`);
    }
    if (isPaymentHoldActive && !holdReason.trim()) {
      setHoldReasonError(true);
      setExpandedSections((prev) => (prev.includes('hold') ? prev : [...prev, 'hold']));
      missingFieldTargets.push('payment-hold-section');
    }
    if (isExceptionActive) {
      let exceptionMissing = false;
      if (exceptionTypes.length === 0) {
        setExceptionTypeError(true);
        exceptionMissing = true;
      }
      // Description is only mandatory when the catch-all "Other" type is among
      // the selected reasons — named types are self-describing.
      if (exceptionTypes.includes('other') && !exceptionDescription.trim()) {
        setExceptionDescriptionError(true);
        exceptionMissing = true;
      }
      if (exceptionMissing) {
        setExpandedSections((prev) => (prev.includes('exception') ? prev : [...prev, 'exception']));
        missingFieldTargets.push('exception-section');
      }
    }
    // Standalone line items each require a GL account — highlight the empty
    // chips in red (same recipe as the other required fields) and scroll the
    // table into view rather than only surfacing a toast.
    const lineGlMissing = isStandalone && standaloneItems.some((item) => !item.glAccount || !item.glAccount.trim());
    setGlMissingError(lineGlMissing);
    // Zero-value invoices don't submit (GPT QC21, 9/30). The line
    // description is OPTIONAL (Mahreen 10/10): only a missing GL account
    // or an amount at $0.00 blocks, and one toast names both rules.
    const lineAmountMissing = isStandalone && standaloneItems.some((item) => (item.amount || 0) <= 0);
    if (isStandalone) setLineContentError(lineAmountMissing);
    const lineItemsIncomplete = lineGlMissing || lineAmountMissing;
    if (lineItemsIncomplete) missingFieldTargets.push('standalone-line-items');
    // Mixed PO terms block submit (8/28/26 evening): the invoice needs ONE
    // payment term, picked from the sidebar's Change, before it can go out.
    if (hasMixedPoTerms) {
      setMixedTermsError(true);
      // Surface the conflict: pop the collapsed per-PO list open so the
      // user sees exactly which terms disagree.
      setMixedTermsExpanded(true);
      setExpandedSections((prev) => (prev.includes('additional-details') ? prev : [...prev, 'additional-details']));
      missingFieldTargets.push('payment-terms-card');
    }
    // Kind conflict blocks submit too (9/1/26): a pre-invoice cannot go
    // out on a NET term, a received-goods invoice cannot go out on a
    // prepayment term.
    if (activeTermKindConflict) {
      setTermKindError(true);
      setExpandedSections((prev) => (prev.includes('additional-details') ? prev : [...prev, 'additional-details']));
      if (!missingFieldTargets.includes('payment-terms-card')) missingFieldTargets.push('payment-terms-card');
    }
    // ONE standard alert for every flow (user 10/10): the inventory
    // invoice's "Cannot submit invoice" toast, with the description naming
    // the fix. Standalone lines carry Mahreen's wording (10/10).
    if (missingFieldTargets.length > 0) {
      const onlyTarget = missingFieldTargets.every((t) => t === missingFieldTargets[0]) ? missingFieldTargets[0] : null;
      // Standalone lines alone keep their own title (BA 10/10).
      toast.error(onlyTarget === 'standalone-line-items' ? 'Line items are incomplete' : 'Cannot submit invoice', {
        description:
          onlyTarget === 'payment-terms-card'
            ? hasMixedPoTerms
              ? 'This invoice carries multiple payment terms. Pick a single term to submit.'
              : termKindWarning(activeTermPreset.category) ?? 'Pick a payment term that fits this invoice.'
            : onlyTarget === 'standalone-line-items'
              ? 'Every line needs a GL account and an amount above $0.00 before the invoice can submit.'
              : 'Fill in the highlighted required fields.',
      });
      // Let the section expand before scrolling to it. FOCUS lands on the
      // first invalid field too (GPT QC23, 9/30 — S2#51: focus stayed on
      // Submit and keyboard users had to hunt for the failure).
      setTimeout(() => {
        const el = document.getElementById(missingFieldTargets[0]);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = el?.matches('input, textarea, select, button, [tabindex]')
          ? (el as HTMLElement)
          : el?.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]');
        focusable?.focus({ preventScroll: true });
      }, 150);
      return;
    }

    // Over-billing is NOT allowed (reverted flow, Mahreen 10/7): the
    // invoiced quantity can never exceed the quantity available to invoice,
    // on inventory invoices and pre-invoices alike. Offending lines are
    // already flagged red inline; submission is BLOCKED with an error until
    // they are fixed — no acknowledgment modal, no quantity-variance
    // Exception route. The first offending line scrolls into view and
    // pulses so the eye lands on it.
    if (!isStandalone) {
      const overBilled = lineItems.filter((i) => i.invoiceQty > i.remainingQty);
      if (overBilled.length > 0) {
        const first = overBilled[0];
        if (first.poNumber !== activePOTab) setActivePOTab(first.poNumber);
        toast.error(
          overBilled.length === 1
            ? 'One line is over the available quantity'
            : `${overBilled.length} lines are over the available quantity`,
          { description: `Invoice quantity can't be more than the quantity available to invoice. Lower the highlighted ${overBilled.length === 1 ? 'line' : 'lines'} to submit.` },
        );
        setTimeout(() => {
          const el = document.getElementById(`line-qty-${first.id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el?.animate(
            [
              { backgroundColor: 'rgba(239, 68, 68, 0.18)' },
              { backgroundColor: 'transparent' },
            ],
            { duration: 700, iterations: 3, easing: 'ease-out' },
          );
        }, 150);
        return;
      }
    }

    const check = validateBeforeSubmit();
    if (!check.ok) {
      toast.error('Cannot submit invoice', { description: check.message });
      return;
    }

    // Always show the confirmation modal — the BA spec covers four
    // cases (default / Payment Hold only / Exception only / both),
    // each with its own how-it-works + implications copy. Even the
    // clean no-flags case gets a confirmation so the user sees the
    // GL-posting + Net-30 implications before posting.
    setGlDefaultChoice('once');
    setShowSubmitWarning(true);
  };

  // The green confirm's commit, also fired by the amber no-change
  // alert's Proceed (user 9/23 evening: green leads, amber follows).
  const confirmResolveSubmit = () => {
    if (resubRecordation) {
      // Resolution note is OPTIONAL (VI-11, supersedes QC23 9/30): a blank
      // note still records the resolution and resubmits. The no-change
      // warning below already guards against resolving with nothing done.
      onResubmitRecordation?.({
        notes: resubNotes.trim(),
        attachments: resubAttachments.length > 0 ? resubAttachments : undefined,
        notifyIds: resubNotify ? Array.from(resubRecipients) : undefined,
      });
    }
    setShowSubmitWarning(false);
    performSubmit();
  };

  // Actual submit -- consumed by handleSubmit (clean case) and by the
  // warning modal's confirm button (exception / payment-hold case).
  const performSubmit = () => {
    if (!onInvoicesCreated) return;

    // Hard stop wherever submit is triggered (reverted flow): an invoice can
    // never bill past the available quantity, so an over-billed line blocks
    // the save — including the resubmit/resolve path — with no Exception
    // route out. handleSubmit catches this earlier for the create flow; this
    // is the backstop so nothing over-billed ever posts.
    if (!isStandalone) {
      const over = lineItems.filter((i) => i.invoiceQty > i.remainingQty);
      if (over.length > 0) {
        if (over[0].poNumber !== activePOTab) setActivePOTab(over[0].poNumber);
        setShowSubmitWarning(false);
        toast.error(
          over.length === 1
            ? 'One line is over the available quantity'
            : `${over.length} lines are over the available quantity`,
          { description: `Invoice quantity can't exceed the quantity available to invoice. Lower the highlighted ${over.length === 1 ? 'line' : 'lines'} to submit.` },
        );
        return;
      }
    }

    const newInvoices: Invoice[] = [];
    const timestamp = Date.now();
    const vendorName = vendorData?.vendorName || standaloneVendor?.vendorName || 'Global Logistics Partners';
    const currentDate = localTodayIso();

    // Over-billing can no longer reach this point (blocked above and in
    // handleSubmit, Mahreen 10/7): billing past the available quantity is
    // refused outright, so there is NO quantity-variance Exception route —
    // the invoice always posts with the status the form chose.
    const varianceEntry: { action: string; reason: string; by: string; at: string }[] = [];
    const withVarianceStatus: Invoice['status'] = varianceEntry.length > 0 ? 'Exception' : submitStatus;
    const withVarianceIsException = varianceEntry.length > 0 || submitIsException;

    // The chosen trigger event persists with the date (BA 9/28): the saved
    // detail read "Set on receiving" after the editor picked Sep 28, order
    // confirmation. Same source the form's own clock runs from.
    const triggerEventLabel = activeSlice?.triggerEvent ?? activeTermPreset.trigger;

    // What the form held, persisted verbatim (9/22/26 review response):
    // the saved record IS the entered record. Detail surfaces render
    // these fields for user-created invoices instead of synthesizing.
    const savedCharges: InvoiceCharges = {
      tax: seededTax,
      freight: freightAmount,
      // Per-invoice editable GL accounts (Eli 10/5) replace the hardcoded
      // module defaults; the state already defaults to them.
      freightGlAccount: freightGlAccount || DEFAULT_FREIGHT_GL_ACCOUNT,
      additional: additionalCharges
        .filter((c) => c.amount > 0)
        .map((c) => ({ label: c.type, amount: c.amount, glAccount: c.glAccount || DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT })),
    };
    // An edit saved WITHOUT changes keeps the record's own journal
    // (Mahreen 10/10): the GL is never rebuilt, so the price difference
    // stays on the Inventory line exactly as it was posted. Dropping the
    // snapshot lets App's merge keep the stored entries.
    // Only what the user actually attached travels onto the record (user
    // 10/10): the Attachments accordion plus any resubmit documents.
    const savedAttachments = Array.from(new Set([...invoiceAttachments.map((f) => f.name), ...resubAttachments]));
    const savedAttachmentSizes = Object.fromEntries(
      invoiceAttachments.filter((f) => f.size !== undefined).map((f) => [f.name, f.size as number]),
    );
    // A rate re-taken on reopening (a closed-period posting date moves to
    // today) changes the posting even when no field was touched.
    const rateUnchanged =
      invoiceFxFields().exchangeRate === resubmitInvoice?.exchangeRate && invoiceCurrency === resubmitInvoice?.currency;
    const keepGlIfUnchanged = (created: Invoice[]): Invoice[] =>
      isResubmit && rateUnchanged && resubSnapshotRef.current !== null && resubSnapshotRef.current === latestResubJsonRef.current
        ? created.map((inv) => ({ ...inv, glEntries: undefined }))
        : created;
    const savedFromLineItems = (items: LineItem[]): SavedInvoiceLineItem[] =>
      items
        .filter((i) => i.invoiceQty > 0)
        .map((i) => ({
          sku: i.sku,
          description: i.description,
          quantity: i.invoiceQty,
          uom: i.uom,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
          glAccount: i.glAccount,
          // Source quantities survive the save (Eli 9/24 R02).
          ...(i.orderedQty > 0 ? { orderedQty: i.orderedQty } : {}),
          // The PO price survives too (Mahreen 10/10): an edit re-seeds it
          // so the price difference stays on Inventory, never folding into
          // the accrual or variance lines.
          ...(i.originalUnitPrice !== undefined && Math.abs(i.originalUnitPrice - i.unitPrice) > 0.0001 ? { poUnitPrice: i.originalUnitPrice } : {}),
          ...(i.receivedQty > 0 ? { receivedQty: i.receivedQty } : {}),
          ...(i.poNumber ? { poNumber: i.poNumber } : {}),
          ...(i.grnNumbers?.length ? { grnNumbers: i.grnNumbers } : {}),
        }));
    // The ledger is kept in the base currency: every snapshot posts at the
    // invoice rate (Currency & Exchange Rates, spec 4.4).
    const postInBase = (gl: ReturnType<typeof buildInvoiceGl>) =>
      baseGlEntries(glInBase(gl, invoiceRate ?? midQuote.rate ?? 1, invoiceCurrency));
    const glForInventory = (items: LineItem[], docTotal: number, docSliceTotal: number) =>
      postInBase(
        buildInvoiceGl({
          kind: items.some((i) => i.grnDate) ? 'received' : 'unreceived',
          lines: items
            .filter((i) => i.invoiceQty > 0)
            .map((i) => ({
              glAccount: i.glAccount,
              amount: i.lineTotal,
              ...accrualSplit(i),
            })),
          freightAmount,
          freightGlAccount: DEFAULT_FREIGHT_GL_ACCOUNT,
          // Seeded tax rides with the charges (QC14) so debits keep
          // matching the A/P credit, which includes it via `total`.
          additionalChargesTotal: additionalChargesTotal + seededTax,
          additionalChargeGlAccount: DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT,
          // Per-charge GL routing on inventory too (Known 1): each charge
          // debits its own picked account; seeded tax (no line) is the
          // remainder that falls back to the aggregate account.
          additionalChargeLines: additionalCharges
            .filter((c) => c.amount > 0)
            .map((c) => ({ glAccount: c.glAccount || DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT, amount: c.amount })),
          apAccount,
          total: docTotal,
          sliceAdjustedTotal: docSliceTotal,
          sliceFraction,
        }),
      );

    // Standalone invoice submission
    if (isStandalone) {
      const standaloneInvoice: Invoice = {
        id: `inv-${timestamp}-sa`,
        // The system-generated ID stays the record's identity (F24, both
        // 9/20 reviews): the vendor's number lives in its own field.
        invoiceNumber: invoiceNumber,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: 'Standalone' as any,
        amount: total,
        outstandingBalance: total,
        ...invoiceFxFields(),
        date: currentDate,
        invoiceDate: invoiceDate,
        createdDate: currentDate,
        dueDate: dueDate,
        triggerDate: triggerDate || undefined,
        triggerEvent: triggerEventLabel,
        postingDate: postingDate,
        status: withVarianceStatus,
        is_payment_held: submitPaymentHeld,
        is_exception: withVarianceIsException,
        actionHistory: (() => { const entries = [...(submitActionHistory() ?? []), ...varianceEntry]; return entries.length > 0 ? entries : undefined; })(),
        createdBy: 'Ahtisham Ahmad',
        apAccount: apAccount,
        // Saved exactly as typed (Mahreen 10/10): an empty description
        // stays empty, never "Standalone invoice for [Vendor]".
        description: description.trim(),
        linkedPOs: [],
        linkedGRNs: [],
        reference: vendorInvoiceNumber,
        isUserCreated: true,
        // An edit always sends its list, so a removed file stays removed.
        ...(savedAttachments.length > 0 || isResubmit ? { attachments: savedAttachments, attachmentSizes: savedAttachmentSizes } : {}),
        // Files attached inside Edit Invoice ride onto the record (VI-13),
        // so the Attachments tab keeps them after Save.
        paymentTerms: paymentTerms,
        charges: savedCharges,
        savedLineItems: standaloneItems
          .filter((i) => i.amount > 0)
          .map((i) => ({
            sku: '',
            description: i.description,
            quantity: i.quantity,
            uom: i.uom,
            // Amount-first form: derive the unit price from the amount so
            // the saved record and its print carry a real price
            // (Mahreen 9/29: a $1,234.56 line printed at $0.00).
            unitPrice: i.unitPrice || (i.quantity > 0 ? Math.round((i.amount / i.quantity) * 100) / 100 : i.amount),
            lineTotal: i.amount,
            glAccount: i.glAccount,
          })),
        glEntries: postInBase(
          buildInvoiceGl({
            kind: 'standalone',
            lines: standaloneItems.filter((i) => i.amount > 0 && i.glAccount).map((i) => ({ glAccount: i.glAccount, amount: i.amount })),
            freightAmount,
            freightGlAccount: freightGlAccount || DEFAULT_FREIGHT_GL_ACCOUNT,
            additionalChargesTotal: additionalChargesTotal + seededTax,
            additionalChargeGlAccount: DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT,
            // Per-charge GL routing (Eli 10/5): each charge expenses to
            // its own picked account on standalone.
            additionalChargeLines: additionalCharges
              .filter((c) => c.amount > 0)
              .map((c) => ({ glAccount: c.glAccount || DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT, amount: c.amount })),
            apAccount,
            total,
            sliceAdjustedTotal: total,
            sliceFraction: 1,
          }),
        ),
      };
      newInvoices.push(standaloneInvoice);

      // Promote the most-used expense account to this vendor's default going
      // forward, if the user opted in via the submit modal.
      if (glDefaultChoice === 'default' && currentVendorId && mostUsedGl) {
        setVendorDefaultExpenseAccount(currentVendorId, mostUsedGl);
        toast.success('Default expense account updated', {
          description: `${mostUsedGl} is now ${vendorName}'s default for new standalone invoices.`,
        });
      }

      // One message per save (VI-12): edits and resubmits are announced by
      // the caller ("Invoice updated" / "resubmitted for approval"), so the
      // create toast only fires for a genuinely new invoice.
      if (!isResubmit) {
        toast.success('Standalone invoice submitted', {
          description: `Invoice ${vendorInvoiceNumber || invoiceNumber} has been created for ${vendorName}.`
        });
      }

      onInvoicesCreated(keepGlIfUnchanged(newInvoices));
      onClose();
      return;
    }
    
    // Check if we have pre-invoice items
    const preInvoiceItems = lineItems.filter(item => item.isPreInvoice);
    const standardInvoiceItems = lineItems.filter(item => !item.isPreInvoice);
    
    const hasPre = preInvoiceItems.length > 0;
    const hasStandard = standardInvoiceItems.length > 0;

    if (hasPre && hasStandard) {
      // Split scenario: One Pre-Invoice (Parent) and one Standard Invoice (Child)
      
      // 1. Parent Pre-Invoice (Matches full amount)
      const parentInvoice: Invoice = {
        id: `inv-${timestamp}-pre`,
        invoiceNumber: `${invoiceNumber}-PRE`,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: 'Pre-Invoice',
        amount: total,
        outstandingBalance: total,
        // A pre-invoice posts when it is paid, so it takes its rate then.
        currency: invoiceCurrency,
        date: currentDate,
        // The vendor invoice date is the FORM'S date (GPT QC14, 9/30: a
        // trigger-only edit stamped today here and silently moved the
        // saved vendor invoice date).
        invoiceDate: invoiceDate,
        createdDate: currentDate,
        dueDate: dueDate,
        // A receiving trigger hasn't fired, so that stays unset — but a
        // selected order-confirmation/invoice-date trigger is a REAL date
        // and persists (Eli 9/24 R07: "Set on receiving" lied about it).
        // No posting date on a pre-invoice (user 10/5, supersedes Mahreen
        // 9/29): nothing posts to the GL until conversion.
        ...(triggerKind !== 'receiving' && triggerDate ? { triggerDate, triggerEvent: triggerEventLabel } : {}),
        status: withVarianceStatus,
        is_payment_held: submitPaymentHeld,
        is_exception: withVarianceIsException,
        actionHistory: (() => { const entries = [...(submitActionHistory() ?? []), ...varianceEntry]; return entries.length > 0 ? entries : undefined; })(),
        createdBy: 'Ahtisham Ahmad',
        apAccount: apAccount,
        description: description || `Pre-Invoice for PO(s): ${uniquePONumbers.join(', ')}`,
        linkedPOs: uniquePONumbers,
        linkedGRNs: [],
        reference: uniquePONumbers[0],
        isUserCreated: true,
        // An edit always sends its list, so a removed file stays removed.
        ...(savedAttachments.length > 0 || isResubmit ? { attachments: savedAttachments, attachmentSizes: savedAttachmentSizes } : {}),
        paymentTerms: paymentTerms,
        charges: savedCharges,
        savedLineItems: savedFromLineItems(preInvoiceItems),
        // A pre-invoice posts nothing when created or approved: the
        // snapshot is honestly empty (first entry is its payment).
        glEntries: [],
      };
      newInvoices.push(parentInvoice);

      // 2. Child Standard Invoice (Offsetting for received items)
      // The amount here represents the goods already received
      const standardAmount = standardInvoiceItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const childInvoice: Invoice = {
        id: `inv-${timestamp}-std`,
        invoiceNumber: `${invoiceNumber}-STD`,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: 'Receiving-based',
        amount: standardAmount,
        outstandingBalance: standardAmount,
        ...invoiceFxFields(true),
        date: currentDate,
        // Form state, not today (GPT QC14).
        invoiceDate: invoiceDate,
        createdDate: currentDate,
        dueDate: dueDate,
        triggerDate: triggerDate || undefined,
        triggerEvent: triggerEventLabel,
        postingDate: postingDate,
        status: withVarianceStatus,
        is_payment_held: submitPaymentHeld,
        is_exception: withVarianceIsException,
        actionHistory: (() => { const entries = [...(submitActionHistory() ?? []), ...varianceEntry]; return entries.length > 0 ? entries : undefined; })(),
        createdBy: 'Ahtisham Ahmad',
        apAccount: apAccount,
        description: description || `Standard Invoice for received items from PO(s): ${uniquePONumbers.join(', ')}`,
        linkedPOs: uniquePONumbers,
        linkedGRNs: Array.from(new Set(standardInvoiceItems.flatMap(i => i.grnNumbers))),
        reference: uniquePONumbers[0],
        isUserCreated: true,
        // An edit always sends its list, so a removed file stays removed.
        ...(savedAttachments.length > 0 || isResubmit ? { attachments: savedAttachments, attachmentSizes: savedAttachmentSizes } : {}),
        paymentTerms: paymentTerms,
        // Freight and charges ride the parent pre-invoice in a split;
        // the child carries exactly its received lines.
        charges: { tax: 0, freight: 0, freightGlAccount: DEFAULT_FREIGHT_GL_ACCOUNT, additional: [] },
        savedLineItems: savedFromLineItems(standardInvoiceItems),
        glEntries: postInBase(
          buildInvoiceGl({
            kind: standardInvoiceItems.some((i) => i.grnDate) ? 'received' : 'unreceived',
            lines: standardInvoiceItems
              .filter((i) => i.invoiceQty > 0)
              .map((i) => ({
                glAccount: i.glAccount,
                amount: i.lineTotal,
                ...accrualSplit(i),
              })),
            freightAmount: 0,
            freightGlAccount: DEFAULT_FREIGHT_GL_ACCOUNT,
            additionalChargesTotal: 0,
            additionalChargeGlAccount: DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT,
            apAccount,
            total: standardAmount,
            sliceAdjustedTotal: standardAmount,
            sliceFraction: 1,
          }),
        ),
      };
      newInvoices.push(childInvoice);

      if (!isResubmit) {
        toast.success('Invoices submitted successfully', {
          description: `Automated split: 1 Pre-Invoice and 1 Standard Invoice have been created.`
        });
      }
    } else {
      // Single invoice scenario
      const finalType = hasPre ? 'Pre-Invoice' : 'PO-based';
      const consumesPrepay = !hasPre && prepayApplied > 0;
      const singleInvoice: Invoice = {
        id: `inv-${timestamp}`,
        invoiceNumber: invoiceNumber,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: finalType as any,
        // Split slice (Eli, 8/31/26): a pre-invoice on a split term is
        // FOR its slice of the order value, so the document amount is
        // the slice-adjusted total (equal to the full total otherwise).
        amount: sliceAdjustedTotal,
        // Reconciliation: applied prepayments reduce the payable from
        // birth; the pre-invoices close via handleInvoicesCreated.
        outstandingBalance: consumesPrepay ? totalDueAfterPrepay : sliceAdjustedTotal,
        ...(consumesPrepay
          ? {
              appliedPrepayments: appliedPrepayEntries.map((e) => ({ invoiceNumber: e.invoiceNumber, amount: Math.min(e.amount, sliceAdjustedTotal) })),
              reconcilesPreInvoiceNumbers: appliedPrepayEntries.map((e) => e.invoiceNumber),
            }
          : {}),
        ...invoiceFxFields(),
        date: currentDate,
        // Form state, not today (GPT QC14).
        invoiceDate: invoiceDate,
        createdDate: currentDate,
        dueDate: dueDate,
        // A pre-invoice carries NO posting date (user 10/5, supersedes
        // Mahreen 9/29): nothing posts to the GL until conversion, so the
        // field stays empty on the record. A chosen non-receiving trigger
        // is a real date and persists with its event (BA 9/28).
        ...(hasPre
          ? { ...(triggerKind !== 'receiving' && triggerDate ? { triggerDate, triggerEvent: triggerEventLabel } : {}) }
          : { triggerDate: triggerDate || undefined, triggerEvent: triggerEventLabel, postingDate: postingDate }),
        status: withVarianceStatus,
        is_payment_held: submitPaymentHeld,
        is_exception: withVarianceIsException,
        actionHistory: (() => { const entries = [...(submitActionHistory() ?? []), ...varianceEntry]; return entries.length > 0 ? entries : undefined; })(),
        createdBy: 'Ahtisham Ahmad',
        apAccount: apAccount,
        description: description || `${finalType} for PO(s): ${uniquePONumbers.join(', ')}`,
        linkedPOs: uniquePONumbers,
        linkedGRNs: Array.from(new Set(lineItems.flatMap(i => i.grnNumbers))),
        reference: uniquePONumbers[0],
        isUserCreated: true,
        // An edit always sends its list, so a removed file stays removed.
        ...(savedAttachments.length > 0 || isResubmit ? { attachments: savedAttachments, attachmentSizes: savedAttachmentSizes } : {}),
        // Files attached inside Edit Invoice ride onto the record (VI-13).
        paymentTerms: paymentTerms,
        charges: savedCharges,
        savedLineItems: savedFromLineItems(lineItems),
        // Pre-invoices post nothing at creation or approval; posted
        // types snapshot the same journal the confirmation shows.
        glEntries: hasPre ? [] : glForInventory(lineItems, total, sliceAdjustedTotal),
      };
      newInvoices.push(singleInvoice);

      // One message per save (VI-12): the create toast is suppressed on
      // edit/resubmit, which the caller announces instead.
      if (!isResubmit) {
        toast.success('Invoice submitted successfully', {
          description: consumesPrepay
            ? `Invoice ${vendorInvoiceNumber} created with ${appliedPrepayEntries.map((e) => e.invoiceNumber).join(', ')} applied; the pre-invoice${appliedPrepayEntries.length === 1 ? ' is' : 's are'} reconciled.`
            : `Invoice ${vendorInvoiceNumber} has been created for ${vendorName}.`,
        });
      }
    }

    // Editing an existing invoice is a REPLACE, not a second add
    // (VI-01): release the stored invoice's prior billed quantities
    // before posting the edited lines, so the PO's invoiced quantity
    // reflects the new figures instead of double-counting.
    if (resubmitInvoice) {
      releaseInvoiceFromVendorDocs(resubmitInvoice.vendor, billedLineRefsFromSaved(resubmitInvoice));
    }

    // Post the billed quantities back onto the vendor's POs and GRNs
    // (8/13/26): the create picker, vendor profile, and detail views
    // reflect this invoice for the rest of the session. A fully
    // invoiced PO drops out of the default picker list. Pre-invoice
    // lines are skipped (BA 9/28): nothing was received, so the PO
    // must not read Invoiced; the receiving invoice applies the
    // quantities once, at conversion.
    applyInvoiceToVendorDocs(
      vendorName,
      lineItems
        .filter((li) => li.poNumber && li.invoiceQty > 0 && !li.isPreInvoice)
        .map((li) => ({ poNumber: li.poNumber, sku: li.sku, invoiceQty: li.invoiceQty, grnNumbers: li.grnNumbers })),
    );

    onInvoicesCreated(keepGlIfUnchanged(newInvoices));
    onClose();
  };

  const hasMixedInvoiceTypes = useMemo(() => {
    const hasPre = currentPOsData.some(po => po.isPreInvoice);
    const hasStandard = currentPOsData.some(po => !po.isPreInvoice);
    return hasPre && hasStandard;
  }, [currentPOsData]);

  // Shared PO-breakdown popover body — reused by the PO tab chips and the
  // line-items header pill so both surfaces show the same hover card
  // (slate header + billed items with image/quick-card/blue item number link +
  // line-items total).
  const renderPoBreakdownContent = (
    poNum: string,
    poData: SelectedPOData | undefined,
    items: typeof lineItems,
  ) => (
    <HoverCardContent className="w-80 p-0 overflow-hidden rounded-xl border border-border/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-[300]" align="start">
      {/* Pre-invoice POs trade the slate header for a violet one
          (feedback 8/13/26) so the card itself says "deposit" at a
          glance; standard POs keep the slate identity. */}
      <div className={`bg-gradient-to-br px-3.5 py-3 relative overflow-hidden ${
        poData?.isPreInvoice ? 'from-violet-700 to-violet-600' : 'from-slate-800 to-slate-700'
      }`}>
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
        <div className="flex items-center justify-between gap-2 relative">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingCart className="w-3.5 h-3.5 text-white/70 shrink-0" />
            {/* PO number deep-links to the record in the Purchase Orders
                app, opened in a new browser tab. */}
            <a
              href={PO_EXTERNAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white text-[13px] truncate cursor-pointer hover:text-blue-300 hover:underline transition-colors"
              style={{ fontWeight: 600 }}
            >
              <span className="text-white/60">PO No.</span> {poNum}
            </a>
          </div>
          <span
            className={`inline-flex items-center px-1.5 py-px rounded border text-[9px] shrink-0 ${
              poData?.isPreInvoice
                ? 'bg-violet-50 text-violet-700 border-violet-300 border-dashed'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
            style={{ fontWeight: 700 }}
          >
            {poData?.isPreInvoice ? 'Pre-Invoice' : 'Invoice'}
          </span>
        </div>
        <p className="text-[11px] text-white/50 mt-1" style={{ fontWeight: 400 }}>
          Issued {poData?.poDate}
        </p>
      </div>
      <div className="px-3.5 py-3 space-y-2.5 bg-white">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
            Billed items <span className="text-slate-400">·</span> <span className="text-slate-700" style={{ fontWeight: 600 }}>{items.length}</span>
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] ${poData?.isPreInvoice ? 'text-violet-700' : 'text-blue-700'}`} style={{ fontWeight: 600 }}>
            <span className={`w-1.5 h-1.5 rounded-full ${poData?.isPreInvoice ? 'bg-violet-500' : 'bg-blue-500'}`} />
            {poData?.isPreInvoice ? '2-Way Match' : '3-Way Match'}
          </span>
        </div>
        <div className="space-y-0.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar -mx-1">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 py-1.5 px-1 border-b border-slate-50 last:border-0">
              <LineItemImage
                sku={item.sku}
                src={imageForSku(item.sku)}
                alt={item.sku}
                onPreview={() => setPreviewImage({ src: imageForSku(item.sku), sku: item.sku, description: item.description })}
              />
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <a
                  href={ITEMS_MODULE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[12px] text-slate-800 leading-tight truncate hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  {item.sku}
                </a>
                <span className="text-[10px] text-slate-500 leading-tight truncate">{item.description}</span>
              </div>
              <div className="text-right shrink-0 ml-2">
                <span className="text-[12px] text-slate-800" style={{ fontWeight: 600 }}>{item.invoiceQty} {item.uom}</span>
                <p className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>{money(item.unitPrice)}/unit</p>
              </div>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center border border-primary/15">
              <Wallet className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 leading-none" style={{ fontWeight: 500 }}>Line Items Total</p>
              <p className="text-[14px] text-slate-800 mt-0.5" style={{ fontWeight: 600 }}>{money(items.reduce((sum, i) => sum + i.lineTotal, 0))}</p>
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] text-slate-600 bg-slate-50 border border-slate-200" style={{ fontWeight: 600 }}>
            <CurrencyFlag code={poData?.currency} size={12} className="mr-1" />
            {poData?.currency}
          </span>
        </div>
      </div>
    </HoverCardContent>
  );

  // Mount the modal via a portal to document.body so it isn't trapped
  // inside `<main className="relative z-0">` (Layout.tsx), which would
  // otherwise pin its stacking context below the side nav (z-50).
  return createPortal(
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 sm:p-5 lg:p-6">
      <div className={`bg-white shadow-2xl w-full flex flex-col overflow-hidden transition-all duration-300 relative rounded-lg ${isFullScreen ? 'h-full max-w-full' : 'max-w-[1430px] h-[92vh]'}`}>
        
        {/* Header — partner Configure Vendor (Step 3) sizing: smaller
            title (14/15px @ fontWeight 600) and slate-400 subtitle so the
            header reads compact, identical to the partner sub-page header
            shown when the user references "the header in the partner
            creation form". */}
        <div className="px-3 sm:px-4 lg:px-5 pt-3 pb-3 shrink-0 bg-white border-b border-[#EEF2F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              {/* Back button — returns to the item picker / vendor select.
                  Gated by a discard-confirmation so entered details and the
                  selection aren't lost by accident. */}
              {onGoBack && (
                <button
                  type="button"
                  onClick={handleAttemptBack}
                  className="mt-0.5 w-8 h-8 rounded-lg border border-border bg-white hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center shrink-0 cursor-pointer transition-all"
                  aria-label="Back to Previous Step"
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
              )}
              <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-[15px] text-foreground truncate" style={{ fontWeight: 600 }}>
                  {/* "Pre-Invoice (Pro-Forma)", unhyphenated per the
                      user's 10/4 call (supersedes QC13's Pro-Forma). */}
                  {isEdit ? 'Edit Vendor Invoice' : isResubmit ? 'Edit and Resubmit Invoice' : isStandalone ? 'Create Standalone Vendor Invoice' : invoiceKind === 'pre' ? 'Create Pre-Invoice (Pro-Forma)' : 'Create Vendor Invoice'}
                </h3>
                {/* Vendor pill — every flow (user 10/10): the standalone
                    strip under the header is gone, so the vendor rides
                    the header like the inventory invoice. The pill wears
                    the invoice TYPE's color: blue inventory, violet
                    pre-invoice, teal standalone. */}
                {vendorData && (
                  <HoverCard openDelay={300}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 border rounded-full transition-colors cursor-help shrink-0 ${
                          isStandalone
                            ? 'bg-teal-50 border-teal-200 hover:bg-teal-100/70'
                            : invoiceKind === 'pre'
                              ? 'bg-violet-50 border-violet-200 hover:bg-violet-100/70'
                              : 'bg-primary/[0.08] border-primary/15 hover:bg-primary/[0.12] hover:border-primary/25'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full overflow-hidden border border-white bg-white">
                          <ImageWithFallback
                            src={vendorData.imageUrl || ''}
                            alt={vendorData.vendorName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className={`text-[11px] max-w-[160px] truncate ${isStandalone ? 'text-teal-700' : invoiceKind === 'pre' ? 'text-violet-700' : 'text-primary'}`} style={{ fontWeight: 600 }}>
                          {vendorData.vendorName}
                        </span>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent
                      side="bottom"
                      align="start"
                      className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[100]"
                    >
                      {/* Header — slate gradient + soft white accent;
                          pixel-parity with VendorQuickCard from the
                          Invoice listing screen so both surfaces feel
                          like one design language. */}
                      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-4 py-3 relative overflow-hidden">
                        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/[0.04]" />
                        <div className="flex items-center gap-3 relative">
                          <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white/20 shadow-lg shrink-0">
                            <ImageWithFallback
                              src={vendorData.imageUrl || ''}
                              alt={vendorData.vendorName}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>
                              {vendorData.vendorName}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              Vendor · {getVendorStats(vendorData.vendorName).city}
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* Body — short description + address + phone */}
                      <div className="bg-white px-4 py-3 space-y-2">
                        <p className="text-[11px] text-slate-600 line-clamp-2">
                          {vendorData.category}, {vendorData.type}. Net terms {vendorData.paymentTerms}, settled in {vendorData.currency}.
                        </p>
                        <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {getVendorStats(vendorData.vendorName).addressLine}, {getVendorStats(vendorData.vendorName).city}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="">{getVendorStats(vendorData.vendorName).phone}</span>
                        </div>
                      </div>
                      {/* Footer — "Go to Vendor" opens the partner master
                          (meeting feedback 7/17/26). */}
                      <div className="bg-slate-50/60 border-t border-border/40 px-4 py-2 flex items-center justify-end">
                        <a
                          href={partnerVendorUrl(vendorName)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer"
                          style={{ fontWeight: 500 }}
                        >
                          Go to Vendor
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                )}
                {/* What the invoice draws from, in the payment run's
                    segmented pill (user 10/10): POs | receivings | items.
                    Inventory and pre-invoice only; standalone has none. */}
                {!isStandalone && currentPOsData.length > 0 && (() => {
                  const grnCount = new Set(lineItems.flatMap((li) => li.grnNumbers ?? [])).size;
                  return (
                    <SegmentedCountPill
                      icon={Package}
                      segments={[
                        `${currentPOsData.length} PO${currentPOsData.length === 1 ? '' : 's'}`,
                        ...(grnCount > 0 ? [`${grnCount} Receiving Document${grnCount === 1 ? '' : 's'}`] : []),
                        `${lineItems.length} Item${lineItems.length === 1 ? '' : 's'}`,
                      ]}
                    />
                  );
                })()}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                {isEdit
                  ? 'Update the invoice details below. It stays in Pending Approval and your approvers review the edited version.'
                  : isResubmit
                  ? 'Fix the flagged issues below, then resubmit the invoice for approval.'
                  : isStandalone
                    // Helper copy from the retired standalone strip (user 10/10).
                    ? 'Standalone invoice. Each line item debits an expense GL account. Add line items, fill in invoice details, and submit for approval.'
                    : invoiceKind === 'pre'
                      // Honest source state (GPT QC01, 9/30: the header said
                      // "Nothing has been received yet" over a PO with 60 of
                      // 100 received) — partially received POs teach the
                      // remaining-unreceived rule instead.
                      ? lineItems.some((i) => (i.receivedQty ?? 0) > 0)
                        ? 'Create a pre-invoice for the remaining unreceived quantity. Received units bill on a receiving invoice instead.'
                        : 'Review the items pulled from the selected POs, fill in invoice details, then submit for approval. Nothing has been received yet.'
                      : 'Review the items pulled from the selected POs and Receivings, fill in invoice details, then submit for approval.'}
              </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all"
                style={{ fontWeight: 500 }}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                {isFullScreen ? 'Exit Full' : 'Full View'}
              </button>
              <button
                type="button"
                onClick={handleAttemptClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-500 hover:bg-muted transition-all"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Automated Splitting Alert — accent-blue banner. The two key
            terms (Pre-invoice / Invoice) become hover-card triggers so
            the user can read the definition + 2-way / 3-way match
            example inline. Pre-invoice uses violet and Invoice uses blue,
            the system-wide type identities (user 10/10), both
            sourced from src/styles/tokens.css. */}
        {/* Edit-and-resubmit — full-bleed strip under the header replaying
            WHY the invoice was rejected / flagged, so the fix happens in
            context. Rejection reads red, exception amber (7/15/26). */}
        {isResubmit && !isEdit && (() => {
          const isExceptionResubmit = resubmitInvoice?.status === 'Exception';
          // High-level summary, not an instruction (Nophil 9/22): who
          // raised the exception and for what; the actual detail lives in
          // the accordion on the right. "Fix the details below" named no
          // details.
          const rejectEntry = !isExceptionResubmit && resubmitInvoice
            ? [...(resubmitInvoice.actionHistory ?? [])].reverse().find((e) => e.action === 'reject')
            : undefined;
          const flaggedBy = (isExceptionResubmit ? seedFlag?.by : rejectEntry?.by) ?? resubmitInvoice?.createdBy;
          const rawReason = resubmitReason || seedFlag?.reason || '';
          const reason = rawReason ? rawReason.replace(/[.!?]$/, '') : '';
          return (
            <div className={`shrink-0 border-b px-4 py-2 flex items-center gap-2.5 ${isExceptionResubmit ? 'bg-amber-50/70 border-amber-200' : 'bg-red-50/70 border-red-200'}`}>
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border shrink-0 ${isExceptionResubmit ? 'border-amber-200 text-amber-600' : 'border-red-200 text-red-600'}`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
              <p className={`text-[11px] min-w-0 flex-1 ${isExceptionResubmit ? 'text-amber-900' : 'text-red-900'}`} style={{ fontWeight: 500 }}>
                {isExceptionResubmit ? (
                  <>
                    <span style={{ fontWeight: 700 }}>{flaggedBy ?? 'Someone'}</span>
                    {' submitted an exception against this invoice'}
                    {reason ? <> for <span style={{ fontWeight: 700 }}>{reason}</span></> : ''}
                    {'. Please review the details and resolve to resubmit the invoice.'}
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: 700 }}>{flaggedBy ?? 'An approver'}</span>
                    {' rejected this invoice'}
                    {reason ? <> for <span style={{ fontWeight: 700 }}>{reason}</span></> : ''}
                    {'. Please review the details and resubmit the invoice for approval.'}
                  </>
                )}
              </p>
            </div>
          );
        })()}
        {!isStandalone && hasMixedInvoiceTypes && (
          <div className="shrink-0 border-b px-4 py-2 flex items-center gap-2.5 bg-accent/40 border-primary/10">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-primary/20 text-primary shrink-0">
              <Info className="w-3.5 h-3.5" />
            </span>
            <p className="text-[11px] min-w-0 flex-1 text-slate-700" style={{ fontWeight: 500 }}>
              <span className="text-primary" style={{ fontWeight: 700 }}>Automated Invoice Splitting</span>
              {' · '}
              Mixed document status detected. System will generate separate{' '}
              <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>
                  <span
                    className="cursor-help underline decoration-dotted decoration-violet-400/60 underline-offset-2 text-violet-700"
                    style={{ fontWeight: 700 }}
                  >
                    Pre-Invoice
                  </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 p-0 overflow-hidden rounded-xl border border-violet-200 shadow-xl z-[300]" align="start" side="bottom">
                  <div className="bg-violet-50 border-b border-violet-200 px-3.5 py-2.5 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-white border border-violet-300 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-violet-600" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] text-violet-700" style={{ fontWeight: 700 }}>Pre-Invoice</p>
                      <p className="text-[10px] text-violet-600/80" style={{ fontWeight: 500 }}>2-Way Match · No Receiving Required</p>
                    </div>
                  </div>
                  <div className="px-3.5 py-3 space-y-2 bg-white">
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Generated when a PO is billed before goods are received. The invoice is matched against the <b className="text-slate-800">PO line</b> alone, no GRN required.
                    </p>
                    <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-2.5 py-2 leading-snug">
                      <span className="text-slate-700" style={{ fontWeight: 600 }}>Example:</span> Vendor invoices 100 EA before shipment. Posted as Pre-Invoice; AP debits a prepayment GL until the receiving arrives and reconciles.
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              {' and '}
              <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>
                  <span
                    className="cursor-help underline decoration-dotted decoration-blue-400/60 underline-offset-2 text-blue-700"
                    style={{ fontWeight: 700 }}
                  >
                    Invoice
                  </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 p-0 overflow-hidden rounded-xl border border-success/20 shadow-xl z-[300]" align="start" side="bottom">
                  <div className="bg-blue-50 border-b border-blue-200 px-3.5 py-2.5 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-white border border-success/30 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] text-blue-700" style={{ fontWeight: 700 }}>Invoice</p>
                      <p className="text-[10px] text-blue-700/80" style={{ fontWeight: 500 }}>3-Way Match · PO + Receiving + Invoice</p>
                    </div>
                  </div>
                  <div className="px-3.5 py-3 space-y-2 bg-white">
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Generated when goods are received and the invoice can be matched against both the <b className="text-slate-800">PO line</b> and the <b className="text-slate-800">GRN</b>. Posts directly to inventory or expense.
                    </p>
                    <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-2.5 py-2 leading-snug">
                      <span className="text-slate-700" style={{ fontWeight: 600 }}>Example:</span> Vendor invoices 80 EA after an 80-unit receiving is logged. Posted as Invoice; AP credits and inventory debits in the same entry.
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              {' records upon posting.'}
            </p>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          
          {/* LEFT SECTION (70%) — slate-tinted canvas (#FAFBFC) so the
              white section cards lift off the surface, matching the
              Create Partner modal body. */}
          <div className="w-[70%] flex flex-col overflow-hidden bg-[#FAFBFC] border-r border-border/60">
            <div className={`flex-1 min-h-0 px-4 pt-3 pb-4 space-y-3 ${isStandalone ? 'overflow-y-auto custom-scrollbar' : 'flex flex-col overflow-hidden'}`}>

              {/* Standalone Vendor Badge removed -- vendor identity is
                  now folded into the (retired) Manual Expense Entry banner
                  at the top of the screen, so we no longer carry a
                  separate card here. */}

              {/* Invoice Details Section — boxed card patterned after the
                  Partner Management "Partner Details" card: outer rounded
                  shell + a slate-tinted header bar with section icon,
                  title, and a Required eyebrow, then a clean body block
                  for the fields. Keeps font + color tokens identical to
                  the partner module so the two products feel like one. */}
              <section className="space-y-3 shrink-0">
                <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                  <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] bg-[#FAFBFC] rounded-t-lg flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-6 h-6 rounded-md bg-primary/[0.08] flex items-center justify-center shrink-0">
                        <ReceiptText className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Invoice Details</span>
                      <span className="text-[9px] sm:text-[10px] text-slate-400 tracking-wider hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
                    </div>

                    {!isStandalone && currentPOsData.find(p => p.poNumber === activePOTab)?.isPreInvoice && (
                      <span className="inline-flex items-center px-1.5 py-px rounded text-[9px] border border-dashed bg-violet-50 text-violet-700 border-violet-300 tracking-wider" style={{ fontWeight: 700 }}>
                        Pre-Invoice
                      </span>
                    )}
                  </div>

                  {/* Body — fields live on the white surface below the
                      slate-tinted header bar, matching the partner card.
                      One reduced, equal padding on every side (user 10/2:
                      the sm:p-4 step read larger at the sides than the
                      field rhythm inside). */}
                  <div className="p-3 space-y-2">

                  {/* Row 1: Vendor Invoice Number & Vendor Invoice Date.
                      Labels + inputs adopt the partner module's recipe:
                      sentence-case `text-foreground` 13px label, `mt-1
                      h-10 rounded-lg` input with primary focus ring. */}
                  <div className="grid grid-cols-2 gap-4">
                    <div id="vendor-invoice-number-field">
                      <Label className="text-xs sm:text-[13px] text-foreground flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                        Vendor Invoice Number<span className="text-red-500">*</span>
                        {/* Helper copy off the field (user 9/28, per the
                            9/25 sweep): the explanation rides the label's
                            ⓘ like Trigger Date, not a line under the input. */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-slate-300 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                            {/* One line (user 10/4). */}
                            <p className="text-[11px] text-slate-500 leading-snug">The number on the vendor's invoice, unique for this vendor.</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <Input
                        value={vendorInvoiceNumber}
                        onChange={(e) => {
                          setVendorInvoiceNumber(e.target.value);
                          if (vendorInvoiceNumberError && e.target.value.trim()) setVendorInvoiceNumberError(false);
                        }}
                        placeholder="e.g. VEN-98231"
                        className={`mt-1 rounded-lg !h-10 text-sm text-foreground placeholder:text-slate-400 bg-white ${
                          vendorInvoiceNumberError || vendorInvoiceNumberDuplicate
                            ? 'border-red-400 ring-2 ring-red-100 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                            : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/20'
                        }`}
                      />
                      {vendorInvoiceNumberDuplicate ? (
                        <p className="text-[11px] text-red-500 mt-1" style={{ fontWeight: 500 }}>
                          {vendorName} already has an invoice with this number.{' '}
                          <a
                            href={`/invoices/${vendorInvoiceNumberDuplicate.invoiceNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700"
                            style={{ fontWeight: 600 }}
                          >
                            View {vendorInvoiceNumberDuplicate.invoiceNumber}
                          </a>
                        </p>
                      ) : vendorInvoiceNumberError ? (
                        <p className="text-[11px] text-red-500 mt-1" style={{ fontWeight: 500 }}>Vendor invoice number is required.</p>
                      ) : null}
                    </div>
                    <div>
                      <Label className="text-xs sm:text-[13px] text-foreground flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                        Vendor Invoice Date<span className="text-red-500">*</span>
                        {/* ⓘ restored (user 10/4, supersedes Nophil 9/28's
                            no-helper call): one line on what date this is. */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-slate-300 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                            <p className="text-[11px] text-slate-500 leading-snug">The date printed on the vendor's invoice.</p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      <DatePicker
                        value={invoiceDate}
                        onChange={setInvoiceDate}
                        placeholder="Select invoice date"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  {/* Row 2: Posting Date & Trigger Date. Posting is the
                      ledger entry date (editable, open periods only);
                      the trigger date starts the payment clock and is
                      resolved from the vendor term's trigger event
                      (8/25/26 meeting). */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs sm:text-[13px] text-foreground flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                        Posting Date
                        {/* Mandatory (user 9/23) — except on a pre-invoice,
                            where the field is locked and empty. */}
                        {invoiceKind !== 'pre' && <span style={{ color: '#DC2626' }}>*</span>}
                      </Label>
                      {invoiceKind === 'pre' ? (
                        /* Locked and EMPTY on pre-invoices (user 10/5,
                           supersedes Mahreen 9/29's editable field): a
                           pre-invoice posts to the GL when PAYMENT is
                           made (the advances entry), so the posting date
                           is set then, not typed here. */
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 flex items-center justify-between gap-2 cursor-not-allowed">
                              <span className="text-sm text-slate-400 italic">Set when paid</span>
                              <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                            <p className="text-[11px] text-slate-500 leading-snug">A pre-invoice posts to the general ledger when payment is made. The posting date is set then.</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (() => {
                        // Amber "not today" cue in the helper text only
                        // (BA UX feedback); a closed-period pick escalates
                        // to red copy and locks Submit.
                        const todayIso = new Date().toISOString().slice(0, 10);
                        const notToday = !!postingDate && postingDate !== todayIso;
                        return (
                          <>
                            <DatePicker
                              value={postingDate}
                              onChange={setPostingDate}
                              placeholder="Select posting date"
                              className="mt-1"
                            />
                            <div className="text-[11px] mt-1 flex items-center gap-1" style={{ color: postingDateClosed ? '#DC2626' : notToday ? '#B45309' : 'rgb(148 163 184)' }}>
                              {(postingDateClosed || notToday) && <AlertCircle className="w-3 h-3 shrink-0" />}
                              <span>
                                {postingDateClosed
                                  ? `${postingDate} falls in a closed period. Pick a date in the open period.`
                                  : notToday
                                    ? `Posting on ${postingDate}, not today's date`
                                    : 'The date this invoice is recorded in the general ledger, today by default.'}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <div>
                      {/* Split slice picking moved to the sidebar Payment
                          Terms card (9/1/26): the S-chips there choose
                          which slice THIS invoice covers, so Trigger Date
                          keeps its standard position in this column. The
                          chosen slice still drives the clock below. */}
                      <Label className="text-xs sm:text-[13px] text-foreground flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                        Trigger Date
                        {/* Mandatory (user 9/23; Aug 28 rule): the clock
                            can't start without it. */}
                        <span style={{ color: '#DC2626' }}>*</span>
                        {/* ⓘ explainer (9/4/26 Eli, BB-15): "we've been
                            talking about trigger dates for weeks and it's
                            baked into our brains, but I don't know that you
                            would know that without an explanation." */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-slate-300 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                            {/* One line (user 10/4): what it is + the default. */}
                            {/* Per trigger kind (Mahreen 10/10): "latest
                                receiving" only where a receiving sets it. */}
                            <p className="text-[11px] text-slate-500 leading-snug">
                              {triggerKind === 'receiving'
                                ? `The date the payment term counts from, set to the ${receivingDateBasis === 'latest' ? 'latest' : 'first'} receiving by default.`
                                : triggerKind === 'invoiceDate'
                                  ? 'The date the payment term counts from, set to the vendor invoice date by default.'
                                  : triggerIsVendorEvent
                                    ? 'The date the payment term counts from. Enter the date the vendor states for this event.'
                                    : 'The date the payment term counts from, set to the vendor invoice date by default.'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </Label>
                      {/* Static label, dynamic copy (8/28/26 review): the
                          helper + tooltip explain the term's trigger event
                          so the field itself never changes name. */}
                      {triggerKind === 'other' ? (
                        <>
                          <DatePicker
                            value={triggerDate}
                            onChange={(d) => {
                              setManualTriggerDate(d || null);
                              // Clearing a required trigger says why right away.
                              setTriggerDateError(!d && triggerIsVendorEvent);
                            }}
                            placeholder="Select trigger date"
                            className="mt-1"
                            error={triggerDateError}
                          />
                          {triggerDateError ? (
                            <p className="text-[11px] text-red-500 mt-1" style={{ fontWeight: 500 }}>
                              Trigger date is required to calculate the due date.
                            </p>
                          ) : (
                            /* One-liner (8/28/26 review): the trigger
                               event's own sentence, nothing appended. */
                            <p className="text-[11px] text-slate-400 mt-1 truncate">
                              {activeSlice
                                ? `Covers the ${activeSlice.percent}% slice. ${TRIGGER_EVENT_COPY[activeSlice.triggerEvent]}`
                                : TRIGGER_EVENT_COPY[activeTermPreset.trigger]}
                            </p>
                          )}
                        </>
                      ) : triggerKind === 'receiving' && linkedReceivingOptions.length > 0 ? (
                        (() => {
                          // Auto-picked per the company setting, but the
                          // user may switch to another LINKED receiving's
                          // date — never a custom date (8/28/26 review).
                          const settingDate =
                            receivingDateBasis === 'latest'
                              ? linkedReceivingOptions[linkedReceivingOptions.length - 1].date
                              : linkedReceivingOptions[0].date;
                          const isSettingPick = triggerDate === settingDate;
                          return (
                            <>
                              {/* Custom popover picker (9/3/26 review,
                                  replaces the Select): the receiving
                                  documents render as CLICKABLE pills
                                  (open the record in a new tab), never a
                                  truncated comma dump; overflow folds to
                                  a "+N more" pill with the standard
                                  tooltip; the company-setting pick is
                                  identified ONCE in the header and by a
                                  star on its row, not a pill per row. */}
                              <Popover open={receivingPickOpen} onOpenChange={setReceivingPickOpen}>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="mt-1 h-10 w-full rounded-lg text-sm bg-white border border-border hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none px-3 flex items-center justify-between gap-2 cursor-pointer transition-colors"
                                  >
                                    {/* The closed field shows the DATE plus a
                                        quiet provenance tag (8/28/26 review). */}
                                    <span className="flex items-center gap-2 min-w-0">
                                      <span className="" style={{ fontWeight: 500 }}>
                                        {triggerDate ? formatDateDisplay(triggerDate) : 'Select receiving date'}
                                      </span>
                                      {triggerDate && (
                                        isSettingPick ? (
                                          <span className="inline-flex items-center px-1.5 py-px rounded-full bg-slate-100 text-slate-500 text-[10px] whitespace-nowrap" style={{ fontWeight: 600 }}>
                                            Auto · {receivingDateBasis} receiving
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-1.5 py-px rounded-full bg-blue-50 text-primary text-[10px] whitespace-nowrap" style={{ fontWeight: 600 }}>
                                            Changed
                                          </span>
                                        )
                                      )}
                                    </span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${receivingPickOpen ? 'rotate-180' : ''}`} />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="start"
                                  sideOffset={6}
                                  className="w-[min(460px,calc(100vw-2rem))] p-0 bg-white border border-border rounded-xl overflow-hidden z-[260]"
                                  style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}
                                >
                                  {/* No heading or helper (user 9/28): the rows
                                      speak for themselves — the Auto tag's
                                      tooltip explains the company-setting pick. */}
                                  <div className="p-1.5 max-h-[280px] overflow-y-auto">
                                    {linkedReceivingOptions.map((opt) => {
                                      const rowSelected = triggerDate === opt.date;
                                      const rowIsSetting = opt.date === settingDate;
                                      const shownGrns = opt.grns.slice(0, 2);
                                      const restGrns = opt.grns.slice(2);
                                      return (
                                        <button
                                          key={opt.date}
                                          type="button"
                                          onClick={() => {
                                            setReceivingTriggerOverride(opt.date);
                                            setReceivingPickOpen(false);
                                          }}
                                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                                            rowSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                                          }`}
                                        >
                                          {/* Fixed-width date column so the
                                              document pills start right after
                                              the date and line up across rows
                                              (9/3/26 review). The auto-pick
                                              marker is an "Auto" tag, not a
                                              star (user 9/28: stars belong to
                                              saved views), and a hairline
                                              separates date from documents. */}
                                          <span className="flex items-center gap-1.5 w-[136px] shrink-0">
                                            <span className={`text-[13px] ${rowSelected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>
                                              {formatDateDisplay(opt.date)}
                                            </span>
                                            {rowIsSetting && (
                                              <Tooltip delayDuration={300}>
                                                <TooltipTrigger asChild>
                                                  <span
                                                    className="inline-flex items-center px-1.5 py-px rounded-full bg-slate-100 text-slate-500 text-[9px] whitespace-nowrap shrink-0 cursor-help"
                                                    style={{ fontWeight: 600 }}
                                                  >
                                                    Auto
                                                  </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="z-[300] max-w-[220px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                                                  <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Company-Setting Pick</p>
                                                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">The system auto-picks the {receivingDateBasis} receiving date. Manage this in Company Setup.</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            )}
                                          </span>
                                          <span className="h-3.5 w-px bg-slate-200 shrink-0" />
                                          <span className="flex items-center gap-1 shrink-0 pl-1" onClick={(e) => e.stopPropagation()}>
                                            {shownGrns.map((g) => (
                                              <span
                                                key={g}
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openReceivingTab(g);
                                                }}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    openReceivingTab(g);
                                                  }
                                                }}
                                                className="inline-flex items-center gap-1 px-1.5 py-px rounded-md border border-slate-200 bg-slate-50 text-[10px] text-slate-600 whitespace-nowrap hover:border-primary/45 hover:bg-blue-50/60 hover:text-primary transition-colors cursor-pointer"
                                                style={{ fontWeight: 600 }}
                                              >
                                                <Package className="w-2.5 h-2.5 text-slate-400" />
                                                {g}
                                                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                              </span>
                                            ))}
                                            {restGrns.length > 0 && (
                                              <Tooltip delayDuration={200}>
                                                <TooltipTrigger asChild>
                                                  <span
                                                    className="inline-flex items-center px-1.5 py-px rounded-md border border-slate-200 bg-white text-[10px] text-slate-500 whitespace-nowrap cursor-help"
                                                    style={{ fontWeight: 600 }}
                                                  >
                                                    +{restGrns.length} more
                                                  </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="z-[300] max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                                                  <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Also Received This Day</p>
                                                  <div className="mt-1 space-y-0.5">
                                                    {restGrns.map((g) => (
                                                      <p key={g} className="text-[11px] text-slate-500 leading-snug">{g}</p>
                                                    ))}
                                                  </div>
                                                </TooltipContent>
                                              </Tooltip>
                                            )}
                                          </span>
                                          <span className="flex-1" />
                                          {rowSelected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              {/* No one-liner (Nophil 9/28, superseding the
                                  8/28 helper): the field's own Auto/Changed
                                  tag already carries the provenance. */}
                            </>
                          );
                        })()
                      ) : (
                        triggerKind === 'invoiceDate' ? (
                          <>
                            {/* Editable (Sep 8 VI-D10; 9/22/26, GPT NEW-01):
                                defaults from the vendor invoice date, and the
                                payer can move the clock when the vendor's
                                paperwork says so. */}
                            <DatePicker value={triggerDate} onChange={(v) => setManualTriggerDate(v || null)} className="mt-1" />
                            <p className="text-[11px] text-slate-400 mt-1">
                              {manualTriggerDate
                                ? 'Changed from the vendor invoice date.'
                                : 'Defaults to the vendor invoice date; editable.'}
                            </p>
                          </>
                        ) : (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="mt-1 inline-block w-full cursor-not-allowed">
                                <Input
                                  type="text"
                                  value={triggerDate ? formatDateDisplay(triggerDate) : ''}
                                  placeholder="Set on receiving"
                                  readOnly
                                  aria-disabled="true"
                                  className="rounded-lg border-slate-200 bg-slate-50 !h-10 text-sm text-slate-500 cursor-not-allowed pointer-events-none w-full disabled:opacity-100 placeholder:text-slate-400"
                                  style={{ fontWeight: 500 }}
                                />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Starts at Receiving</p>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">This vendor's payment term runs from receiving and nothing has been received yet, so the payment clock hasn't started.</p>
                            </TooltipContent>
                          </Tooltip>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Starts the payment clock once goods are received.
                          </p>
                        </>
                        )
                      )}
                    </div>
                  </div>

                  {/* Vendor Invoice Total field removed (user 10/2): the
                      stated-total capture is out of the design. The import
                      path keeps its supplied-total variance check. */}

                  {/* Currency & Exchange Rate (Currency & Exchange Rates
                      audit, spec 4.4 / 3.5): the currency defaults from the
                      PO (locked to it) else the vendor; the rate is taken on
                      the posting date, read-only on Mid-market and editable
                      on Corporate. */}
                  <div className="grid grid-cols-2 gap-4" id="invoice-exchange-rate-field">
                    <InvoiceCurrencyField
                      value={invoiceCurrency}
                      onChange={(code) => {
                        setInvoiceCurrency(code);
                        setTypedRate(null);
                        setRateError(false);
                      }}
                      source={
                        poCurrency
                          ? { kind: 'po', ref: currentPOsData[0]?.poNumber ? `PO-${currentPOsData[0].poNumber}` : 'the PO' }
                          : { kind: 'vendor', ref: vendorDefaultCurrency }
                      }
                    />
                    <InvoiceExchangeRateField
                      currency={invoiceCurrency}
                      rateType={rateType}
                      onRateTypeChange={(t) => {
                        setRateType(t);
                        setTypedRate(null);
                        setRateError(false);
                      }}
                      quote={tableQuote}
                      midQuote={midQuote}
                      typed={typedRate}
                      onTypedChange={(v) => {
                        setTypedRate(v);
                        if (rateError) setRateError(false);
                      }}
                      rate={invoiceRate}
                      pending={ratePending}
                      error={rateError && rateMissing}
                      po={poRateRef && invoiceCurrency === currentPOsData[0]?.currency ? { ...poRateRef, poNumber: `PO-${poRateRef.poNumber}` } : null}
                    />
                  </div>

                  {/* Row 3: Description */}
                  <div>
                    <Label className="text-xs sm:text-[13px] text-foreground flex items-center gap-1.5" style={{ fontWeight: 500 }}>
                      Description
                      {/* ⓘ added (user 10/4): says what it's for and that
                          it's optional, since the label carries no mark. */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 text-slate-300 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                          <p className="text-[11px] text-slate-500 leading-snug">A short note on what this invoice is for. Optional.</p>
                        </TooltipContent>
                      </Tooltip>
                    </Label>
                    <div className="mt-1">
                      <ExpandableTextarea
                        value={description}
                        onChange={setDescription}
                        placeholder="Brief summary of invoice purpose or context."
                        expandMode="full"
                      />
                    </div>
                  </div>
                  </div>{/* /Body */}
                </div>
              </section>

              {/* Standalone Line Items - Simplified Table */}
              {isStandalone && (
                <section id="standalone-line-items" className="scroll-mt-4">
                  {/* One card, the inventory invoice's header recipe (user
                      10/10): title + type pill on the left, actions on the
                      right of the header bar; the count rides the column
                      header and the subtotal lives in the summary. */}
                  <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] bg-[#FAFBFC] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Invoice Line Items</span>
                      {/* Standalone's teal identity (type colors, user 10/10). */}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full border bg-teal-50 border-teal-200 text-teal-700 text-[11px]" style={{ fontWeight: 600 }}>
                        Manual Entry
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {standaloneSelectedIds.size > 0 ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setStandaloneBulkRemoveOpen(true)}
                          className="h-7 px-2.5 text-[10px] font-bold bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white shadow-none rounded-md tracking-wider gap-1.5 border transition-all animate-in fade-in slide-in-from-right-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove {standaloneSelectedIds.size} item{standaloneSelectedIds.size === 1 ? '' : 's'}
                        </Button>
                      ) : (
                        <button
                          type="button"
                          onClick={addStandaloneItem}
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white border border-primary text-primary text-[11px] hover:bg-primary/5 hover:shadow-sm transition-all duration-150"
                          style={{ fontWeight: 500 }}
                        >
                          <Plus className="w-3 h-3" />
                          Add More Items
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto relative">
                    <table className="w-full text-left border-collapse min-w-[650px]">
                      <thead
                        className="bg-gray-50 border-b border-gray-100 text-slate-500 text-[11px]"
                        style={{ fontWeight: 500 }}
                      >
                        <tr>
                          <th className="pl-3 pr-1 py-2 w-[36px]">
                            <div className="flex items-center justify-center">
                              <Checkbox
                                checked={standaloneItems.length > 0 && standaloneSelectedIds.size === standaloneItems.length}
                                onCheckedChange={() =>
                                  setStandaloneSelectedIds(
                                    standaloneSelectedIds.size === standaloneItems.length ? new Set() : new Set(standaloneItems.map((i) => i.id)),
                                  )
                                }
                                className="rounded border-border"
                                aria-label="Select All Lines"
                              />
                            </div>
                          </th>
                          {/* Words, not "#" (user 10/10). */}
                          <th className="px-1.5 py-2 w-[64px] text-center whitespace-nowrap" style={{ fontWeight: 500 }}>Line No.</th>
                          <th className="px-1.5 py-2 w-[180px]" style={{ fontWeight: 500 }}>
                            <span className="inline-flex items-center gap-1.5">
                              GL Account
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center justify-center cursor-help">
                                    <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[280px]">
                                  <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Expense Account</p>
                                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                    Pre-filled from this vendor's default expense account when one is set at the partner level. You can change it per line.
                                  </p>
                                  <p className="text-[11px] text-slate-500 leading-snug mt-1.5">
                                    If the vendor has no default, it stays empty, but every line needs a GL account before you can submit.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </span>
                          </th>
                          <th className="px-1.5 py-2" style={{ fontWeight: 500 }}>
                            Description
                            {/* Count rides the column header, like the inventory "Items (N)". */}
                            <span className="ml-1.5 text-slate-400" style={{ fontWeight: 500 }}>({standaloneItems.length})</span>
                          </th>
                          <th className="px-1.5 py-2 w-[150px] text-right" style={{ fontWeight: 500 }}>Amount</th>
                          <th className="px-1.5 py-2 w-9 text-center" style={{ fontWeight: 500 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {standaloneItems.map((item, index) => (
                          <tr key={item.id} className={`transition-colors group ${standaloneSelectedIds.has(item.id) ? 'bg-blue-50' : 'hover:bg-gray-50/50'}`}>
                            <td className="pl-3 pr-1 py-2">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={standaloneSelectedIds.has(item.id)}
                                  onCheckedChange={() => {
                                    const next = new Set(standaloneSelectedIds);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    setStandaloneSelectedIds(next);
                                  }}
                                  className="rounded border-border"
                                  aria-label={`Select line ${index + 1}`}
                                />
                              </div>
                            </td>
                            <td className="px-1.5 py-2 text-center">
                              <span className="text-[12px] text-foreground" style={{ fontWeight: 400 }}>{index + 1}</span>
                            </td>
                            {/* GL Account, single labeled-chip button
                                matching the right sidebar's recipe (A/P
                                Account, Freight GL, per-charge GL).
                                Clicking opens the same configuration
                                modal via setGlConfigModalItemId. */}
                            <td className="px-1.5 py-1.5">
                              {/* Standalone line items: the per-line GL
                                  account stays selectable — the user picks the
                                  expense account here. (The GL lock only
                                  applies to inventory invoices + A/P.)
                                  Missing GL turns the chip red once a submit
                                  is attempted (same recipe as required fields). */}
                              {(() => {
                                const glMissing = glMissingError && (!item.glAccount || !item.glAccount.trim());
                                return (
                              <button
                                type="button"
                                onClick={() => { setGlConfigModalItemId(item.id); setGlModalSearch(''); }}
                                className={`w-full inline-flex items-center justify-between gap-2 h-8 px-2 rounded-md border bg-white text-[11px] transition-colors ${
                                  glMissing
                                    ? 'border-red-300 text-red-600 hover:border-red-400'
                                    : 'border-slate-200 text-foreground hover:bg-primary/[0.03] hover:border-primary/40'
                                }`}
                                style={{ fontWeight: 500 }}
                              >
                                <span className={`truncate ${item.glAccount ? '' : glMissing ? 'italic' : 'italic text-slate-400'}`}>
                                  {item.glAccount || 'No account'}
                                </span>
                                <Settings2 className={`w-3 h-3 shrink-0 ${glMissing ? 'text-red-400' : 'text-slate-400'}`} />
                              </button>
                                );
                              })()}
                            </td>
                            {/* Description — uses the same ExpandableTextarea
                                recipe as the Invoicing Information section's
                                Description field. Double-click expands the
                                textarea within its container for more
                                writing space without resizing the table. */}
                            <td className="px-1.5 py-1.5">
                              {/* Description is optional (Mahreen 10/10),
                                  so it never wears the required ring. */}
                              <div>
                                <ExpandableTextarea
                                  value={item.description}
                                  onChange={(val) => updateStandaloneItem(item.id, 'description', val)}
                                  placeholder="Enter description..."
                                  expandMode="full"
                                  collapsedHeight={32}
                                  portalExpand
                                />
                              </div>
                            </td>
                            {/* Amount — $ prefix + right-aligned value, matching
                                the inventory invoice's Unit Price input. */}
                            <td className="px-1.5 py-1.5">
                              <div className="relative w-full">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>{moneySymbol}</span>
                                <MoneyInput
                                  fluid
                                  value={item.amount || 0}
                                  onValueChange={(n) => updateStandaloneItem(item.id, 'amount', n)}
                                  placeholder="0.00"
                                  className={`flex h-8 w-full min-w-0 rounded-md border bg-white ${symbolPad} pr-2 py-1 text-right font-bold text-[11px] shadow-none outline-none focus-visible:ring-1 focus-visible:ring-blue-100 ${
                                    lineContentError && (item.amount || 0) <= 0 ? 'border-red-300 ring-2 ring-red-100' : 'border-border'
                                  }`}
                                />
                              </div>
                            </td>
                            {/* Delete */}
                            <td className="px-1.5 py-1.5 text-center">
                              <button 
                                onClick={() => {
                                  const n = standaloneItems.findIndex((i) => i.id === item.id) + 1;
                                  const desc = (item.description || '').trim();
                                  setStandaloneItemToRemove({ id: item.id, label: desc ? `line ${n}, ${desc.length > 40 ? desc.slice(0, 40) + '…' : desc}` : `line ${n}` });
                                }}
                                className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-md transition-colors disabled:opacity-30"
                                disabled={standaloneItems.length <= 1}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  </div>
                </section>
              )}

              {/* PO-based Invoice Line Items — wrapped in the same boxed
                  card recipe as the Invoice details section above, so the
                  page reads as a consistent stack of titled cards. The
                  header bar holds the icon tile, title, match-status
                  pill, item count, and the Add more / Remove N CTAs. */}
              {!isStandalone && <section className="min-h-0 flex flex-col">
                {/* Click-away backdrop while the table is expanded —
                    fades in on open, out on close. */}
                {lineItemsExpanded && (
                  <div
                    className={`fixed inset-0 z-[140] bg-black/50 ${
                      lineItemsClosing
                        ? 'animate-out fade-out duration-200'
                        : 'animate-in fade-in duration-200'
                    }`}
                    style={{ animationFillMode: 'both', animationTimingFunction: 'ease-out' }}
                    onClick={collapseLineItems}
                  />
                )}
                <div className={
                  lineItemsExpanded
                    ? `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[150] w-[calc(100vw-3rem)] max-w-[1380px] h-[calc(100vh-4rem)] max-h-[88vh] rounded-xl border border-border bg-white shadow-2xl overflow-hidden flex flex-col duration-200 ${
                        lineItemsClosing
                          ? 'animate-out fade-out-0 zoom-out-95 slide-out-to-left-1/2 slide-out-to-top-1/2'
                          : 'animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-1/2'
                      }`
                    : 'min-h-0 flex flex-col rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden'
                } style={lineItemsExpanded ? { animationFillMode: 'both' } : undefined}>
                  <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] bg-[#FAFBFC] flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Title leads the header, followed by the match-status
                        pill. The active-PO pill is gone (8/31/26): the tab
                        strip now sits directly above this card, so the
                        header repeating the PO number was noise. */}
                    <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>Invoice Line Items</span>
                    {(() => {
                      const activePO = currentPOsData.find(p => p.poNumber === activePOTab);
                      const isPre = activePO?.isPreInvoice;
                      const hasIssue = !isPre && currentPOItems.some(item => item.invoiceQty > item.receivedQty);

                      const statusColor = hasIssue
                        ? 'bg-destructive/10 border-destructive/20 text-destructive'
                        : isPre
                          ? 'bg-violet-50 border-violet-200 text-violet-700'
                          // Type colors (user 10/10): inventory = blue.
                          : 'bg-blue-50 border-blue-200 text-blue-700';

                      const dotColor = hasIssue ? 'bg-destructive' : isPre ? 'bg-violet-500' : 'bg-blue-500';
                      const label = hasIssue ? '3-Way Match Issue' : isPre ? '2-Way Match (Pre-Invoice)' : '3-Way Match (Invoice)';

                      // Hovering the pill itself surfaces the tooltip —
                      // no separate Info/AlertTriangle icon needed, the
                      // pill carries the affordance via cursor-help.
                      return (
                        <HoverCard openDelay={300}>
                          <HoverCardTrigger asChild>
                            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border cursor-help ${statusColor}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                              <span className="text-[11px]" style={{ fontWeight: 600 }}>
                                {label}
                              </span>
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent
                            side="top"
                            className="w-[280px] p-3 z-[100] bg-white border border-border rounded-lg shadow-md"
                          >
                            <p className="text-[12px] text-foreground leading-snug" style={{ fontWeight: 600 }}>
                              {hasIssue ? 'Matching Discrepancy' : isPre ? 'Pre-Invoice' : '3-Way Match'}
                            </p>
                            <p className="text-[11px] text-slate-500 leading-relaxed mt-1.5" style={{ fontWeight: 400 }}>
                              {hasIssue
                                ? 'Invoice quantity exceeds warehouse received quantity (GRN). Requires manual review or adjustment before posting.'
                                : isPre
                                  ? 'Generated when a PO is billed before goods are received. The invoice is matched against the PO line items, no GRN required.'
                                  : 'Quantities and pricing are validated against the linked receiving documents (GRNs) so the invoice ties out across PO + Receiving + Invoice.'}
                            </p>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Bulk remove kicks in from the FIRST selected row —
                        BA feedback: it previously required 2+ selections. */}
                    {selectedIds.size > 0 ? (
                      <>
                      {/* Bulk GL setter hidden while GL editing is locked. */}
                      {!GL_FIELDS_LOCKED && (
                      <BulkGLAccountPicker
                        count={selectedIds.size}
                        onSelect={(account) => {
                          const previousData = JSON.parse(JSON.stringify(currentPOsData));
                          const count = selectedIds.size;
                          const idsToUpdate = new Set(selectedIds);

                          setCurrentPOsData(prev => prev.map(po => {
                            if (po.poNumber !== activePOTab) return po;
                            return {
                              ...po,
                              items: po.items.map(pItem => {
                                const isSelected = Array.from(idsToUpdate).some(selectedId => selectedId.endsWith(pItem.id));
                                return isSelected ? { ...pItem, glAccount: account } : pItem;
                              })
                            };
                          }));

                          const code = account.split(' ')[0];
                          toast(`GL account set to ${code} for ${count} item${count === 1 ? '' : 's'}`, {
                            action: {
                              label: 'Undo',
                              onClick: () => setCurrentPOsData(previousData),
                            },
                            duration: 30000,
                          });
                        }}
                      />
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        // Confirmation first (8/31/26): bulk removal runs
                        // through the same destructive confirm as single
                        // rows and PO removal.
                        onClick={() => setBulkRemoveConfirmOpen(true)}
                        className="h-7 px-2.5 text-[10px] font-bold bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white shadow-none rounded-md tracking-wider gap-1.5 border transition-all animate-in fade-in slide-in-from-right-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove {selectedIds.size} item{selectedIds.size === 1 ? '' : 's'}
                      </Button>
                      </>
                    ) : (
                      <>
                        {/* Search — compact, lives in the title row (8/31/26);
                            the item count moved into the Items column header. */}
                        <div className="relative w-[200px] sm:w-[240px] shrink-0 hidden sm:block">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <Input
                            value={lineItemSearch}
                            onChange={(e) => setLineItemSearch(e.target.value)}
                            placeholder="Search items…"
                            className="h-8 pl-8 pr-8 text-[11px] bg-white border-slate-200 shadow-none rounded-md focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-slate-400"
                          />
                          {lineItemSearch && (
                            <button
                              type="button"
                              onClick={() => setLineItemSearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                              aria-label="Clear Search"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {/* Full view — only while collapsed; expanded, the X
                            on the far right closes it. */}
                        {!lineItemsExpanded && (
                          <button
                            type="button"
                            onClick={openLineItems}
                            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
                            style={{ fontWeight: 500 }}
                            title="Full View"
                            aria-label="Full View"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            Full View
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsAddPOOpen(true)}
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white border border-primary text-primary text-[11px] hover:bg-primary/5 hover:shadow-sm transition-all duration-150"
                          style={{ fontWeight: 500 }}
                        >
                          <Plus className="w-3 h-3" />
                          Add More Items
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddPOOpen(true)}
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white border border-primary text-primary text-[11px] hover:bg-primary/5 hover:shadow-sm transition-all duration-150"
                          style={{ fontWeight: 500 }}
                        >
                          <Plus className="w-3 h-3" />
                          {/* Copy follows the source type (design review
                              7/9/26): receiver-based invoices add
                              receivers, not POs. */}
                          {invoiceType === 'receiving' ? 'Add More Receivings' : 'Add More POs'}
                        </button>
                      </>
                    )}
                    {/* Close — rightmost, expanded panel only. Collapses the
                        floating table back into the in-flow card. */}
                    {lineItemsExpanded && (
                      <button
                        type="button"
                        onClick={() => (!lineItemsClosing ? collapseLineItems() : undefined)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0"
                        title="Close"
                        aria-label="Close Full View"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* PO pills band (8/31/26): pills only, in their ORIGINAL
                    square design (rounded-lg, cart icon, X); the search,
                    count and every CTA live in the title row / column
                    header. Lives INSIDE the card so the expanded Full view
                    keeps it. */}
                <div className="px-3 sm:px-4 py-2 border-b border-[#EEF2F6] bg-white flex items-center gap-2 shrink-0">
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide items-center flex-1 min-w-0">
                    {uniquePONumbers.map(po => {
                      const poData = currentPOsData.find(p => p.poNumber === po);
                      const itemsForThisPO = lineItems.filter(li => li.poNumber === po);
                      // Pre-invoice POs wear a violet dashed OUTLINE + the
                      // PRE tag, and when active a light violet fill instead
                      // of the blue accent (8/19/26; violet = the system-wide
                      // pre-invoice identity, user 10/1).
                      const isPrePO = !!poData?.isPreInvoice;
                      return (
                        // 1200ms, raised from 800 (feedback 8/31/26, "too
                        // quick"): the rich document preview must not flash
                        // open in passing. Controlled-closed while a removal
                        // confirm is up — the portal'd card otherwise floats
                        // over the modal (hover glitch, 8/31/26).
                        <HoverCard key={po} openDelay={1200} closeDelay={120} open={poToRemove || itemToRemove ? false : undefined}>
                          <HoverCardTrigger asChild>
                            <div
                              className={`group flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg border transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                                isPrePO
                                  ? `border-dashed ${
                                      activePOTab === po
                                        ? 'bg-violet-50 text-violet-800 border-violet-400'
                                        : 'bg-white text-slate-700 border-violet-400 hover:border-violet-500'
                                    }`
                                  : activePOTab === po
                                    ? 'bg-accent text-primary border-primary/30'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <button
                                onClick={() => setActivePOTab(po)}
                                className="flex items-center gap-1.5 text-[12px]"
                                style={{ fontWeight: 500 }}
                              >
                                <ShoppingCart className={`w-3 h-3 ${activePOTab === po ? (isPrePO ? 'text-violet-600' : 'text-primary/70') : 'text-slate-400'}`} />
                                {/* Hard-coded "PO No." label so the value is
                                    unambiguously a PO number without relying on
                                    the icon or a fake "PO-" value prefix. */}
                                <span><span className="text-slate-400" style={{ fontWeight: 600 }}>PO No.</span> {po}</span>
                                {isPrePO && (
                                  <span
                                    className="px-1.5 py-[1px] rounded text-[9.5px] bg-violet-100 text-violet-700"
                                    style={{ fontWeight: 700 }}
                                  >
                                    Pre
                                  </span>
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPoToRemove(po);
                                }}
                                className="w-5 h-5 rounded-full flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                aria-label={`Remove ${po}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </HoverCardTrigger>
                          {renderPoBreakdownContent(po, poData, itemsForThisPO)}
                        </HoverCard>
                      );
                    })}
                  </div>
                </div>

                {/* Table body — sits inside the same card as the header
                    bar above so the section reads as a single titled
                    container. Horizontal scroll lives on this inner div;
                    when expanded it flexes + scrolls within the panel. */}
                <div className="min-h-0 overflow-y-scroll overflow-x-hidden items-scroll pb-4">
                  <table className="w-full table-fixed text-left border-collapse text-[11px]">
                    {/* Full view stretches to fill the modal — proportional
                        widths with Items at 40%. Inline view keeps the fixed
                        layout tuned to fit without horizontal scroll.
                        Pre-invoices have NO GL column (BA 9/5) — its col is
                        dropped and the freed width goes to ITEMS, never to
                        the action column (BA 9/6). */}
                    <colgroup>
                      {lineItemsExpanded ? (
                        <>
                          <col className="w-[4%]" />
                          <col className={invoiceKind === 'pre' ? 'w-[55%]' : 'w-[40%]'} />
                          <col className="w-[8%]" />
                          <col className="w-[10%]" />
                          <col className="w-[10%]" />
                          <col className="w-[8%]" />
                          {invoiceKind !== 'pre' && <col className="w-[15%]" />}
                          <col className="w-[5%]" />
                        </>
                      ) : (
                        <>
                          <col className="w-[30px]" />
                          <col />
                          <col className="w-[98px]" />
                          <col className="w-[146px]" />
                          <col className="w-[124px]" />
                          <col className="w-[98px]" />
                          {invoiceKind !== 'pre' && <col className="w-[150px]" />}
                          <col className="w-[34px]" />
                        </>
                      )}
                    </colgroup>
                    <thead className="sticky top-0 z-30 bg-gray-50 border-b border-gray-100 text-slate-500 text-[11px]" style={{ fontWeight: 500 }}>
                      <tr>
                        <th className="px-0 py-2 sticky left-0 bg-gray-50 border-r border-gray-100 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="flex items-center justify-center">
                           <Checkbox
                             checked={currentPOItems.length > 0 && selectedIds.size === currentPOItems.length}
                             onCheckedChange={() => {
                               if (selectedIds.size === currentPOItems.length) {
                                 setSelectedIds(new Set());
                               } else {
                                 setSelectedIds(new Set(currentPOItems.map(i => i.id)));
                                }
                             }}
                             className="rounded border-border"
                           />
                          </div>
                        </th>
                        <th className="px-4 py-2 whitespace-nowrap">
                          Items
                          {/* Count rides the column header (8/31/26) — the
                              "42 items" readout left the card header. */}
                          <span className="ml-1.5 text-slate-400 " style={{ fontWeight: 500 }}>
                            {lineItemQuery ? `(${displayedPOItems.length} of ${currentPOItems.length})` : `(${currentPOItems.length})`}
                          </span>
                        </th>
                        <th className="px-2 py-2 text-right leading-tight">Received / Ordered</th>
                        <th className="px-2 py-2 text-right whitespace-nowrap">Price per Unit</th>
                        <th className="px-2 py-2 text-right leading-tight bg-emerald-50/40 text-emerald-700">Invoice Qty</th>
                        <th className="px-2 py-2 text-right whitespace-nowrap">Total</th>
                        {/* GL column hidden on pre-invoices (BA 9/5): every
                            pre line posts to the same locked advances
                            account — the sidebar Advances Account card
                            tells that story; a column of identical locked
                            1205 chips was noise. */}
                        {invoiceKind !== 'pre' && <th className="px-3 py-2">GL Account</th>}
                        {/* Action column always rendered so the rest of
                            the columns don't reflow when bulk-select
                            kicks in. The body cell conditionally hides
                            the per-row delete button instead. */}
                        <th className="px-0 py-2 text-center sticky right-0 bg-gray-50 border-l border-gray-100 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)] z-20 whitespace-nowrap">
                          {lineItemsExpanded && selectedIds.size === 0 ? 'Action' : <span aria-hidden>&nbsp;</span>}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {displayedPOItems.length === 0 && (
                        /* Table Empty States Standard (11/3/26): compact, with Did you mean. */
                        <TableEmptyRow
                          colSpan={invoiceKind === 'pre' ? 7 : 8}
                          compact
                          kind={resolveTableEmptyKind({ totalCount: currentPOItems.length, filteredCount: 0, searchQuery: lineItemSearch }) ?? 'no-data'}
                          entity={{ singular: 'line item', plural: 'line items' }}
                          searchQuery={lineItemSearch}
                          suggestion={findSearchSuggestion(lineItemSearch, currentPOItems.flatMap((i) => [i.sku, i.description]))}
                          onApplySuggestion={setLineItemSearch}
                          onClearSearch={() => setLineItemSearch('')}
                        />
                      )}
                      {displayedPOItems.map(item => {
                        const isOverBilled = item.invoiceQty > item.remainingQty;
                        const lineTotal = item.invoiceQty * item.unitPrice;
                        const isSelected = selectedIds.has(item.id);
                        // Change-warning tiers (design review 7/9/26): red =
                        // invoicing more than received (blocking-grade),
                        // amber = any price change or under-invoicing
                        // (deliberate but worth flagging). Each carries a
                        // hover tooltip with the original value as a blue
                        // click-to-revert.
                        const priceChanged = Math.abs(item.unitPrice - item.originalUnitPrice) > 0.004;
                        const isUnderBilled = !isOverBilled && item.invoiceQty > 0 && item.invoiceQty < item.remainingQty;
                        // Fully received line on a pre-invoice (Eli 9/8,
                        // S8-06): nothing left to pre-invoice — the row
                        // greys out at the LINE level, same principle as
                        // the inventory flow's grey-out.
                        const fullyReceivedPre = !!item.isPreInvoice && item.remainingQty <= 0;

                        return (
                          <tr key={item.id} className={`transition-colors group ${fullyReceivedPre ? 'opacity-60 bg-slate-50/70' : isSelected ? 'bg-blue-50' : 'hover:bg-[#F5F9FF]'}`}>
                            <td className={`px-0 py-2 sticky left-0 z-10 border-r border-gray-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] transition-colors ${fullyReceivedPre ? 'bg-slate-50' : isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-[#F5F9FF]'}`}>
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={isSelected}
                                  disabled={fullyReceivedPre}
                                  onCheckedChange={() => {
                                    const next = new Set(selectedIds);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    setSelectedIds(next);
                                  }}
                                  className="rounded border-border"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-3">
                                <LineItemImage
                                  sku={item.sku}
                                  src={imageForSku(item.sku)}
                                  alt={item.sku}
                                  onPreview={() => setPreviewImage({ src: imageForSku(item.sku), sku: item.sku, description: item.description })}
                                />
                                <div className="min-w-0">
                                  <a
                                    href={ITEMS_MODULE_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-900 hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors inline-block"
                                    style={{ fontWeight: 600 }}
                                  >
                                    {highlightQuery(item.sku, lineItemSearch)}
                                  </a>
                                  <LineItemDescription description={longDescriptionFor(item.sku, item.description)} query={lineItemSearch} />
                                </div>
                              </div>
                            </td>
                            {/* Received / Ordered — combined as received-of-
                                ordered. (Per BA: no $ figure, a sum
                                amalgamates mixed-price receipts.) */}
                            <td className="px-2 py-2 text-right whitespace-nowrap">
                              <span className="text-[12px] font-semibold text-gray-900 ">{item.receivedQty}</span>
                              <span className="text-[11px] text-gray-300 mx-1">/</span>
                              <span className="text-[12px] font-medium text-gray-500 ">{item.orderedQty}</span>
                              <span className="text-[10px] font-medium text-gray-400 ml-1">{item.uom}</span>
                            </td>
                            <td className={`px-2 py-2 transition-colors ${priceChanged ? 'bg-amber-50/60' : ''}`}>
                              <div className="relative w-full">
                                {priceChanged ? (
                                  <HoverCard openDelay={300} closeDelay={120}>
                                    <HoverCardTrigger asChild>
                                      <button
                                        type="button"
                                        tabIndex={-1}
                                        className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-amber-500 hover:bg-amber-100 transition-colors cursor-help"
                                        aria-label="Price differs from the purchase order"
                                      >
                                        <AlertTriangle className="w-3 h-3" />
                                      </button>
                                    </HoverCardTrigger>
                                    <HoverCardContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                      <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Price Changed</p>
                                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                        The PO priced this item at{' '}
                                        <button
                                          type="button"
                                          onClick={() => updateLineItem(item.id, 'unitPrice', String(item.originalUnitPrice))}
                                          className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors cursor-pointer p-0 bg-transparent border-0 align-baseline"
                                          style={{ fontWeight: 600, fontFamily: 'inherit' }}
                                          aria-label={`Revert unit price to ${item.originalUnitPrice}`}
                                        >
                                          {money(item.originalUnitPrice)}
                                        </button>
                                        . Click the price to revert.
                                      </p>
                                    </HoverCardContent>
                                  </HoverCard>
                                ) : (
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>{moneySymbol}</span>
                                )}
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  // At rest a fractional price always shows
                                  // both decimals (user 9/22: "4,876.8" read
                                  // as a different style than the creation
                                  // form) — integers stay bare, drafts win
                                  // while typing.
                                  value={
                                    priceDrafts[item.id] ??
                                    (item.unitPrice == null || Number.isInteger(item.unitPrice)
                                      ? formatMoneyText(String(item.unitPrice ?? ''))
                                      : formatMoneyText(item.unitPrice.toFixed(2)))
                                  }
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^\d.]/g, '');
                                    setPriceDrafts((prev) => ({ ...prev, [item.id]: raw }));
                                    updateLineItem(item.id, 'unitPrice', raw);
                                  }}
                                  onBlur={() => setPriceDrafts((prev) => { const next = { ...prev }; delete next[item.id]; return next; })}
                                  className={`h-7 ${symbolPad} text-right text-[11px] shadow-none rounded-md font-semibold focus-visible:ring-1 ${
                                    priceChanged
                                      ? 'pl-7 bg-white border-amber-400 text-amber-700 focus-visible:ring-amber-100 focus-visible:border-amber-500'
                                      : 'text-gray-900 bg-white border-slate-200 hover:border-slate-300 focus-visible:ring-primary/20 focus-visible:border-primary'
                                  }`}
                                  // Suffix-aware padding (user 9/22): a long
                                  // price against a long unit ("4,876.80" +
                                  // "/ROLL") ran into the suffix — the gap
                                  // now scales with the unit's width.
                                  style={{ paddingRight: `${14 + (item.uom.length + 1) * 6}px` }}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none whitespace-nowrap" style={{ fontWeight: 500 }}>/{item.uom}</span>
                              </div>
                            </td>
                            <td id={`line-qty-${item.id}`} className={`px-2 py-2 transition-colors ${isOverBilled ? 'bg-red-50/60' : isUnderBilled ? 'bg-amber-50/60' : 'bg-emerald-50/[0.4]'}`}>
                              <div className="relative w-full">
                                  <Input
                                    type="number"
                                    value={fullyReceivedPre ? 0 : item.invoiceQty}
                                    disabled={fullyReceivedPre}
                                    onChange={(e) => updateLineItem(item.id, 'invoiceQty', e.target.value)}
                                    className={`h-7 w-full text-right text-[11px] shadow-none rounded-md font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-1 ${
                                      fullyReceivedPre
                                        ? 'pl-2 bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                        : isOverBilled
                                          ? 'pl-7 bg-white border-red-400 text-red-600 focus-visible:ring-red-100 focus-visible:border-red-500'
                                          : isUnderBilled
                                            ? 'pl-7 bg-white border-amber-400 text-amber-700 focus-visible:ring-amber-100 focus-visible:border-amber-500'
                                            : 'pl-2 text-emerald-700 bg-white border-emerald-200 focus-visible:ring-emerald-100'
                                    }`}
                                    // Suffix-aware padding (user 9/22): the
                                    // qty never touches its unit label.
                                    style={{ paddingRight: `${14 + item.uom.length * 6}px` }}
                                  />
                                  {fullyReceivedPre && (
                                    <HoverCard openDelay={300} closeDelay={120}>
                                      <HoverCardTrigger asChild>
                                        <button
                                          type="button"
                                          tabIndex={-1}
                                          className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:bg-slate-200/70 transition-colors cursor-help"
                                          aria-label="Fully received, nothing left to pre-invoice"
                                        >
                                          <Lock className="w-3 h-3" />
                                        </button>
                                      </HoverCardTrigger>
                                      <HoverCardContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                        <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Fully Received</p>
                                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                          All {item.receivedQty} {item.uom} on this line have been received. Pre-invoice only covers what's not yet received; bill this line through the inventory invoice flow.
                                        </p>
                                      </HoverCardContent>
                                    </HoverCard>
                                  )}
                                  {isUnderBilled && (
                                    <HoverCard openDelay={300} closeDelay={120}>
                                      <HoverCardTrigger asChild>
                                        <button
                                          type="button"
                                          tabIndex={-1}
                                          className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-amber-500 hover:bg-amber-100 transition-colors cursor-help"
                                          aria-label="Invoicing less than the remaining quantity"
                                        >
                                          <AlertTriangle className="w-3 h-3" />
                                        </button>
                                      </HoverCardTrigger>
                                      <HoverCardContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                        {/* Pre-invoice variant (BA 9/5): four-row
                                            breakdown in pre-invoice language. */}
                                        <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>{item.isPreInvoice ? 'Below Available' : 'Below Remaining'}</p>
                                        <div className="mt-1 space-y-0.5 text-[11px] text-slate-500 leading-snug">
                                          {item.isPreInvoice && (
                                            <p>Total Ordered: <span className="text-foreground " style={{ fontWeight: 600 }}>{item.orderedQty} {item.uom}</span></p>
                                          )}
                                          <p>Received: <span className="text-foreground " style={{ fontWeight: 600 }}>{item.receivedQty} {item.uom}</span></p>
                                          <p>{item.isPreInvoice ? 'Already Pre-Invoiced' : 'Already Invoiced'}: <span className="text-foreground " style={{ fontWeight: 600 }}>{item.isPreInvoice ? Math.max(0, item.orderedQty - item.receivedQty - item.remainingQty) : Math.max(0, item.receivedQty - item.remainingQty)} {item.uom}</span></p>
                                          <p>
                                            {item.isPreInvoice ? 'Available to Pre-Invoice' : 'Remaining'}:{' '}
                                            <button
                                              type="button"
                                              onClick={() => updateLineItem(item.id, 'invoiceQty', item.remainingQty)}
                                              className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors cursor-pointer p-0 bg-transparent border-0 align-baseline"
                                              style={{ fontWeight: 600, fontFamily: 'inherit' }}
                                              aria-label={`Set invoice quantity to ${item.remainingQty} ${item.uom}`}
                                            >
                                              {item.remainingQty} {item.uom}
                                            </button>
                                          </p>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-snug mt-1.5">
                                          {item.isPreInvoice
                                            ? `You're invoicing less than the available ${item.remainingQty} ${item.uom}. The remaining ${item.remainingQty - item.invoiceQty} ${item.uom} will stay available for a future pre-invoice.`
                                            : `You're invoicing less than the remaining ${item.remainingQty} ${item.uom}. The other ${item.remainingQty - item.invoiceQty} ${item.uom} will stay open for a future invoice.`}
                                        </p>
                                      </HoverCardContent>
                                    </HoverCard>
                                  )}
                                  {isOverBilled && (
                                    /* HoverCard (not Tooltip) so the user
                                       can move cursor into the popover
                                       and click the "fix to {remaining}"
                                       link without it dismissing. */
                                    <HoverCard openDelay={300} closeDelay={120}>
                                      <HoverCardTrigger asChild>
                                        <button
                                          type="button"
                                          tabIndex={-1}
                                          className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-red-500 hover:bg-red-100 transition-colors cursor-help"
                                          aria-label="Invoice quantity exceeds remaining"
                                        >
                                          <AlertTriangle className="w-3 h-3" />
                                        </button>
                                      </HoverCardTrigger>
                                      <HoverCardContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                        {/* Pre-invoice variant (BA 9/5): "you can
                                            pre-invoice only the quantity not yet
                                            received or pre-invoiced". */}
                                        <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>{item.isPreInvoice ? 'Pre-Invoice Quantity' : 'Exceeds Remaining'}</p>
                                        {item.isPreInvoice && (
                                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                            You can pre-invoice only the quantity that has not been received or pre-invoiced.
                                          </p>
                                        )}
                                        <div className="mt-1 space-y-0.5 text-[11px] text-slate-500 leading-snug">
                                          {item.isPreInvoice && (
                                            <p>Total Ordered: <span className="text-foreground " style={{ fontWeight: 600 }}>{item.orderedQty} {item.uom}</span></p>
                                          )}
                                          <p>Received: <span className="text-foreground " style={{ fontWeight: 600 }}>{item.receivedQty} {item.uom}</span></p>
                                          <p>{item.isPreInvoice ? 'Already Pre-Invoiced' : 'Already Invoiced'}: <span className="text-foreground " style={{ fontWeight: 600 }}>{item.isPreInvoice ? Math.max(0, item.orderedQty - item.receivedQty - item.remainingQty) : Math.max(0, item.receivedQty - item.remainingQty)} {item.uom}</span></p>
                                          <p>
                                            {item.isPreInvoice ? 'Available to Pre-Invoice' : 'Remaining'}:{' '}
                                            <button
                                              type="button"
                                              onClick={() => updateLineItem(item.id, 'invoiceQty', item.remainingQty)}
                                              className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors cursor-pointer p-0 bg-transparent border-0 align-baseline"
                                              style={{ fontWeight: 600, fontFamily: 'inherit' }}
                                              aria-label={`Set invoice quantity to ${item.remainingQty} ${item.uom}`}
                                            >
                                              {item.remainingQty} {item.uom}
                                            </button>
                                          </p>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-snug mt-1.5">
                                          {item.isPreInvoice
                                            ? "You can't pre-invoice more than the available quantity. Click the number to reset it."
                                            : "You can't invoice more than the remaining quantity. Click the number to reset it."}
                                        </p>
                                      </HoverCardContent>
                                    </HoverCard>
                                  )}
                                <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none whitespace-nowrap ${isOverBilled ? 'text-red-400' : isUnderBilled ? 'text-amber-500' : 'text-emerald-700/70'}`} style={{ fontWeight: 500 }}>{item.uom}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right">
                              <div className="text-[11px] font-semibold text-gray-900 whitespace-nowrap">{money(lineTotal)}</div>
                            </td>
                            {invoiceKind !== 'pre' && (
                              <td className="px-3 py-2">
                                <GLAccountPicker
                                  value={item.glAccount}
                                  defaultValue={item.defaultGlAccount}
                                  onChange={(next) => updateLineItem(item.id, 'glAccount', next)}
                                  disabled={GL_FIELDS_LOCKED}
                                />
                              </td>
                            )}
                            <td className={`px-0 py-2 text-center sticky right-0 z-10 border-l border-gray-100 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)] transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-[#F5F9FF]'}`}>
                              {selectedIds.size === 0 && (
                                <div className="flex items-center justify-center">
                                  <button
                                    // Confirmation first (8/31/26): the row
                                    // no longer vanishes on a stray click.
                                    onClick={() => setItemToRemove({ id: item.id, sku: item.sku, poNumber: item.poNumber })}
                                    className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-md transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </div>{/* /Outer card */}
              </section>}

              {/* Standalone keeps a little scroll breathing room at the
                  bottom; the PO-based view manages its own 16px via the
                  line-items card, so no extra spacer there. */}
              {isStandalone && <div className="h-6" />}
            </div>
          </div>

          {/* RIGHT SECTION (30%) */}
          <div className="w-[30%] bg-[#FAFBFC] flex flex-col overflow-hidden border-l border-[#EEF2F6]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {/* Multi-Section Accordion Review */}
              <Accordion 
                type="multiple" 
                value={expandedSections} 
                onValueChange={setExpandedSections}
                className="space-y-2.5"
              >
                
                {/* Section 1: General information */}
                <AccordionItem value="additional-details" className="border border-border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-2.5 group">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                        <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>General Information</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1.5">
                        {/* "Generate new ID" removed (design review 7/9/26):
                            regenerating an internal identifier has no valid
                            use case and breaks traceability. The ID is
                            system-assigned and locked, full stop. */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 cursor-help w-fit">
                              <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Invoice ID</Label>
                              <Info className="w-2.5 h-2.5 text-gray-300" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                            {/* One copy on both triggers (user 10/4): the
                                label ⓘ and the locked field say the same
                                sentence instead of two variants. */}
                            <p className="text-[11px] text-slate-500 leading-snug">Omne's own reference for this invoice. Assigned automatically and can't be changed.</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-block w-full cursor-not-allowed">
                              <Input
                                value={invoiceNumber}
                                readOnly
                                aria-disabled="true"
                                className="h-9 bg-slate-50 border-slate-200 text-[11px] text-slate-500 cursor-not-allowed pointer-events-none shadow-none disabled:opacity-100 w-full"
                                style={{ fontWeight: 600 }}
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                            <p className="text-[11px] text-slate-500 leading-snug">Omne's own reference for this invoice. Assigned automatically and can't be changed.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Due Date</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative cursor-not-allowed">
                                <Input
                                  value={dueDate ? formatDateDisplay(dueDate) : ''}
                                  placeholder={triggerKind === 'other' ? 'Set by trigger date' : 'Set on receiving'}
                                  readOnly
                                  aria-disabled="true"
                                  className="h-9 bg-slate-50 border-slate-200 text-[11px] text-slate-500 cursor-not-allowed pointer-events-none shadow-none disabled:opacity-100 w-full placeholder:text-slate-400"
                                  style={{ fontWeight: 600 }}
                                />
                                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Auto-Calculated</p>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                {dueDate
                                  ? "Due date is the trigger date plus the term days from the vendor's payment terms. Change either of those to recompute it."
                                  : triggerKind === 'other'
                                    ? 'Enter the trigger date to calculate the due date.'
                                    : "This term's payment clock runs from receiving. The due date is set once goods are received."}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                      </div>

                      {invoiceKind === 'pre' ? (
                        /* Advances Account (9/4/26 Eli, BB-09): at the
                           pre-invoice stage there is no accounts payable,
                           so an A/P field has no job. The one account a
                           pre-invoice needs is where the deposit lands
                           when paid: Advances to Vendors. The vendor's A/P
                           account STAYS on the document data — it surfaces
                           when the goods are received and invoiced. Same
                           component, same position, the account swaps. */
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Advances Account</Label>
                          {/* Unlocked (user 10/5): the advances account is
                              user-changeable like the A/P field — a small
                              picker over the prepaid-asset accounts. */}
                          <Popover open={advancesPickOpen} onOpenChange={setAdvancesPickOpen}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-full inline-flex items-center justify-between gap-2 h-9 px-2.5 rounded-md border border-slate-200 text-[12px] transition-colors bg-white text-foreground hover:bg-primary/[0.03] hover:border-primary/40"
                                style={{ fontWeight: 500 }}
                              >
                                <span className="truncate">{advancesAccount}</span>
                                <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" sideOffset={6} className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-1 z-[260] bg-white border border-border rounded-xl" style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12)' }}>
                              {PREPAYMENT_ASSET_ACCOUNTS.map((account) => {
                                const isSelected = advancesAccount === account;
                                return (
                                  <button
                                    key={account}
                                    type="button"
                                    onClick={() => { setAdvancesAccount(account); setAdvancesPickOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                  >
                                    <span className={`text-[12px] flex-1 truncate ${isSelected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>{account}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                  </button>
                                );
                              })}
                            </PopoverContent>
                          </Popover>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-[10px] text-slate-500 leading-tight" style={{ fontWeight: 500 }}>
                              Pre-invoice payments post as vendor advances.
                            </span>
                          </div>
                        </div>
                      ) : (
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>A/P Account</Label>
                        {/* Unlocked (user 10/4): the AP header account is
                            user-changeable on the invoice — the picker
                            modal lists every A/P account, pre-populated
                            from the vendor's profile. Per-line GL stays
                            behind GL_FIELDS_LOCKED; only this header
                            field opened up. */}
                        <button
                          type="button"
                          onClick={() => { setApConfigModalOpen(true); setApModalSearch(''); }}
                          className="w-full inline-flex items-center justify-between gap-2 h-9 px-2.5 rounded-md border border-slate-200 text-[12px] transition-colors bg-white text-foreground hover:bg-primary/[0.03] hover:border-primary/40"
                          style={{ fontWeight: 500 }}
                        >
                          <span className={`truncate ${apAccount ? '' : 'italic text-slate-400'}`}>
                            {apAccount || 'No A/P account'}
                          </span>
                          <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>
                        {/* Auto-populated indicator — derived from vendor
                            category mapping (VENDOR_AP_MAPPING). */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="text-[10px] text-slate-500 leading-tight" style={{ fontWeight: 500 }}>
                            Auto-derived from this vendor's profile.
                          </span>
                        </div>
                        {/* A/P posting (Currency & Exchange Rates, spec 4.4):
                            A/P is posted in the base currency at the invoice
                            rate, the rate a payment is later compared against. */}
                        {!invoiceIsBase && (
                          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Posts to A/P in {BASE_CURRENCY}</span>
                              <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                                {formatMoney(inBase(sliceAdjustedTotal), BASE_CURRENCY)}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                              {money(sliceAdjustedTotal)} at {rateSentence(invoiceCurrency, invoiceRate ?? midQuote.rate ?? 1)}
                              {invoiceRate == null ? ' (enter a rate)' : ''}. A payment is later compared against this rate.
                            </p>
                          </div>
                        )}
                      </div>
                      )}

                      {/* Payment terms, bottom of the section because
                          it's changed rarely. Read-only summary card; the
                          "Change" link in the label row opens the full
                          Browse Payment Terms modal. */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Payment Terms</Label>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentTermsDraft(paymentTerms);
                              const current = findPresetByLabel(paymentTerms);
                              setSelectedPaymentTermId(current?.id ?? null);
                              // Open on a tab that fits the invoice kind
                              // (9/1/26): pre-invoices land on Prepayment.
                              setPtTypeFilters(invoiceKind === 'pre' ? 'prepayment' : 'net');
                              setPtStatusFilter('all');
                              setPtSearch('');
                              setPaymentTermsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-blue-700 transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            Change
                          </button>
                        </div>
                        {!hasMixedPoTerms ? (
                          (() => {
                            const preset = findPresetByLabel(paymentTerms) ?? findRuntimeTerm(paymentTerms);
                            // Synthesize a preset shape when the current term doesn't
                            // map to a known template so the card can still render the
                            // partner-style layout.
                            const current = preset ?? {
                              id: `pt-current-${paymentTerms}`,
                              name: paymentTerms,
                              category: 'net' as const,
                              typeBadge: 'NET',
                              badgeColor: 'hsl(var(--primary))',
                              trigger: 'Invoice Date',
                              description: 'Payment is due per the agreed terms.',
                              vendorsApplied: 0,
                            };
                            const kindConflictCopy = termKindWarning(current.category);
                            const card = (
                              <PaymentTermCard
                                term={current}
                                isSelected
                                hideCheckmark
                                compact
                                readOnly
                                showPresetBadge
                                // Click-through to the partner-style term
                                // details modal (9/3/26 review) — the
                                // slice chips swallow their own clicks,
                                // so picking a slice never opens it.
                                onClick={() => setBrowseTermDetail(paymentTerms)}
                                isInherited={paymentTerms === vendorDefaultPaymentTerm}
                                // Split slice picker (9/1/26): moved out of
                                // the form column onto this card — the
                                // S-chips choose which slice THIS invoice
                                // covers, and the trigger clock follows.
                                sliceIdx={current.category === 'split' ? splitSliceIdx : undefined}
                                onSliceSelect={current.category === 'split' ? setSplitSliceIdx : undefined}
                                // Kind rule (9/1/26, Mahreen): a pre-invoice
                                // may only cover the prepayment slices; a
                                // received-goods invoice only the others.
                                sliceDisabledReasons={
                                  current.category === 'split'
                                    ? splitSlices.map((s) =>
                                        sliceAllowedForKind(s)
                                          ? null
                                          : invoiceKind === 'pre'
                                            ? `This ${s.percent}% slice is due ${s.netDays > 0 ? `${s.netDays} days after` : 'at'} ${s.triggerEvent.toLowerCase()}, so it belongs to the standard invoice, not this pre-invoice.`
                                            : `This ${s.percent}% slice is a prepayment due at ${s.triggerEvent.toLowerCase()}, so it belongs to a pre-invoice.`,
                                      )
                                    : undefined
                                }
                              />
                            );
                            // Kind conflict (9/1/26): the vendor default can
                            // seed a term the invoice kind can't take — the
                            // card wears the warning strip until the user
                            // picks a valid term (rose once submit tried).
                            return kindConflictCopy ? (
                              <div
                                id="payment-terms-card"
                                className={`rounded-xl bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] border transition-colors ${
                                  termKindError ? 'border-rose-300 ring-2 ring-rose-100' : 'border-amber-300'
                                }`}
                              >
                                <div
                                  className={`flex items-start gap-2 border-b px-2.5 py-2 ${
                                    termKindError ? 'bg-rose-50/80 border-rose-200' : 'bg-amber-50/80 border-amber-200'
                                  }`}
                                >
                                  <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-px ${termKindError ? 'text-rose-600' : 'text-amber-600'}`} />
                                  <p className={`text-[11px] leading-snug ${termKindError ? 'text-rose-700' : 'text-amber-800'}`} style={{ fontWeight: 500 }}>
                                    {kindConflictCopy} Use Change to pick one.
                                  </p>
                                </div>
                                <div className="p-2">{card}</div>
                              </div>
                            ) : (
                              card
                            );
                          })()
                        ) : (
                          /* Mixed terms = ONE clubbed card (8/28/26 review,
                             hardened same evening): the warning strip rides
                             the card, the per-PO term cards are READ-ONLY
                             context, and the invoice cannot submit until a
                             single term is picked from the top-level Change
                             — attempting to submit turns this card red. */
                          <div
                            id="payment-terms-card"
                            className={`rounded-xl bg-white overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] border transition-colors ${
                              mixedTermsError ? 'border-rose-300 ring-2 ring-rose-100' : 'border-amber-300'
                            }`}
                          >
                            <div
                              className={`flex items-start gap-2 border-b px-2.5 py-2 ${
                                mixedTermsError ? 'bg-rose-50/80 border-rose-200' : 'bg-amber-50/80 border-amber-200'
                              }`}
                            >
                              <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-px ${mixedTermsError ? 'text-rose-600' : 'text-amber-600'}`} />
                              <p className={`text-[11px] leading-snug ${mixedTermsError ? 'text-rose-700' : 'text-amber-800'}`} style={{ fontWeight: 500 }}>
                                {mixedTermsError
                                  ? 'Pick the one term this invoice follows before submitting: review the POs below, or use Change.'
                                  : 'An invoice follows one payment term, and these POs disagree. Review them below and use one term for all, or pick a template with Change.'}
                              </p>
                            </div>
                            {/* Accordion (9/1/26): the per-PO cards fold
                                behind a summary row to cut clutter; each
                                PO row carries a Use-for-all CTA that
                                aligns the whole invoice to that term. */}
                            <button
                              type="button"
                              onClick={() => setMixedTermsExpanded((v) => !v)}
                              className="w-full flex items-center justify-between px-2.5 py-2 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              {/* Real middle dot (9/3/26 review: the JSX
                                  text rendered a literal "\u00b7"). */}
                              <span className="text-[11px] text-slate-600" style={{ fontWeight: 600 }}>
                                {poTermPairs.length} POs {'\u00b7'} {mixedPoTerms.length} different terms
                              </span>
                              {/* Amber Review chip (9/3/26 review): the
                                  resolve CTA wears the warning's own tone
                                  instead of disappearing into grey. */}
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-[10.5px] text-amber-700"
                                style={{ fontWeight: 600 }}
                              >
                                {mixedTermsExpanded ? 'Hide' : 'Review'}
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${mixedTermsExpanded ? 'rotate-180' : ''}`} />
                              </span>
                            </button>
                            {mixedTermsExpanded && (
                              <div className="p-2 pt-1.5 space-y-2.5 border-t border-border/60">
                                <p className="px-0.5 text-[10.5px] text-slate-500 leading-snug">
                                  <span className="text-slate-700" style={{ fontWeight: 600 }}>Use for All</span> applies that PO&rsquo;s term to every PO on this invoice. The vendor profile is unchanged.
                                </p>
                                {poTermPairs.map(({ poNumber, term }) => {
                                  const preset = findPresetByLabel(term) ?? {
                                    id: `pt-current-${term}`,
                                    name: term,
                                    category: 'net' as const,
                                    typeBadge: 'NET',
                                    badgeColor: 'hsl(var(--primary))',
                                    trigger: 'Invoice Date',
                                    description: 'Payment is due per the agreed terms.',
                                    vendorsApplied: 0,
                                  };
                                  return (
                                    <div key={poNumber}>
                                      <div className="px-0.5 pb-1 flex items-center justify-between">
                                        <span className="text-[10.5px] text-slate-500 " style={{ fontWeight: 600 }}>
                                          PO {poNumber}
                                        </span>
                                        {(() => {
                                          // Kind lock (9/1/26): a term the
                                          // invoice kind can't take never
                                          // offers Use for all.
                                          const kindBlocked = termKindWarning(preset.category);
                                          return (
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button
                                                  type="button"
                                                  onClick={() => { if (!kindBlocked) applyTermToInvoice(preset); }}
                                                  aria-disabled={!!kindBlocked}
                                                  className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-md border text-[10px] transition-colors ${
                                                    kindBlocked
                                                      ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                                      : 'border-primary/25 bg-white text-primary hover:bg-blue-50 cursor-pointer'
                                                  }`}
                                                  style={{ fontWeight: 600 }}
                                                >
                                                  {kindBlocked ? <Lock className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                                                  Use for All
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" sideOffset={6} className="max-w-[240px] text-center leading-relaxed">
                                                {kindBlocked ?? `Applies ${preset.name} to every PO on this invoice and clears the conflict. The vendor profile is unchanged.`}
                                              </TooltipContent>
                                            </Tooltip>
                                          );
                                        })()}
                                      </div>
                                      <PaymentTermCard
                                        term={preset}
                                        isSelected={term === paymentTerms}
                                        hideCheckmark
                                        compact
                                        readOnly
                                        showPresetBadge
                                        isInherited={term === vendorDefaultPaymentTerm}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 2: GL Impact */}
                {/* Section 3: Payment hold */}
                <AccordionItem
                  value="hold"
                  id="payment-hold-section"
                  className={`border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden ${
                    holdReasonError ? 'border-red-300 ring-2 ring-red-100' : 'border-border'
                  }`}
                >
                  {/* Header layout matches the other accordions (9/6): the
                      chevron sits at the FAR RIGHT with the standard icon +
                      color (the trigger's own svg), and the Switch rides
                      just left of it inside the trigger row. */}
                  <AccordionTrigger className="hover:no-underline py-2.5 w-full group">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-yellow-50 flex items-center justify-center">
                          <Lock className="w-3.5 h-3.5 text-yellow-700" />
                        </div>
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Payment Hold</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex items-center justify-center cursor-help"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[300px]">
                            <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Payment Hold</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                              {/* A pre-invoice posts nothing until paid (Mahreen 10/10). */}
                              {invoiceKind === 'pre'
                                ? 'Submit for approval as normal, but block payment until you release the hold.'
                                : "Submit and post the invoice as normal, but block payment until you release the hold. Use it when the invoice is valid but you're not ready to pay."}
                            </p>
                            {/* Partner example-card recipe (BA 9/6). */}
                            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                              <p className="text-[9px] text-slate-400" style={{ fontWeight: 600 }}>Example</p>
                              <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                                <span className="text-amber-600" style={{ fontWeight: 600 }}>Damaged pump</span>, waiting on a credit note. {invoiceKind === 'pre' ? 'Submit it now but hold payment until it is settled.' : "Post the invoice now but hold payment until it's settled."}
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {seedHoldOn ? (
                        /* A hold that came in ON THE INVOICE can't be
                           toggled off (Eli 9/8) — it releases, it doesn't
                           un-happen. The switch stays visible but greyed;
                           the seeded card below carries the Release. */
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="mr-2 inline-flex" onClick={(e) => e.stopPropagation()}>
                              <Switch
                                checked={isPaymentHoldActive}
                                disabled
                                className="scale-90 opacity-50 pointer-events-none"
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px]">
                            <p className="text-[11px] text-slate-500 leading-snug">
                              A submitted hold is removed by releasing it, not by toggling it off.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Switch
                          checked={isPaymentHoldActive}
                          onCheckedChange={(checked) => {
                            setIsPaymentHoldActive(checked);
                            if (checked) {
                              if (!expandedSections.includes("hold")) {
                                setExpandedSections(prev => [...prev, "hold"]);
                              }
                            } else {
                              setExpandedSections(prev => prev.filter(s => s !== "hold"));
                              setHoldReasonError(false);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="scale-90 mr-2"
                        />
                      )}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-2 space-y-3.5">
                    {seedHoldOn ? (
                      /* Submitted hold = the shared flag card (Eli 9/8):
                         non-editable reason, who placed it, attachments,
                         and ONE Release action. Releasing queues for this
                         save (the payload derives from the toggle state)
                         with an Undo to back out. */
                      pendingHoldRelease ? (
                        <SubmittedFlagCard
                          kind="resolved"
                          flat
                          title="Hold Releases When You Save"
                          reason={seedHold?.reason}
                          resolution={{ by: seedHold?.by, at: seedHold?.at }}
                          footnote="The payment hold comes off when this invoice is saved. Payments unblock after that."
                          actionLabel="Undo Release"
                          actionVariant="outline"
                          onAction={() => {
                            setPendingHoldRelease(false);
                            setIsPaymentHoldActive(true);
                          }}
                        />
                      ) : (
                        <SubmittedFlagCard
                          kind="hold"
                          flat
                          reason={seedHold?.reason}
                          by={seedHold?.by}
                          at={seedHold?.at}
                          attachments={seedHold?.attachments}
                          footnote="Posted to GL but payments are blocked."
                          actionLabel="Release"
                          onAction={() => {
                            setPendingHoldRelease(true);
                            setIsPaymentHoldActive(false);
                            setHoldReasonError(false);
                          }}
                          actionHint="Queues the release; it takes effect when you save."
                        />
                      )
                    ) : (<>
                    {/* Reason, eyebrow label with red asterisk
                        to flag required; the icon-text helper is dropped
                        in favor of that single character cue. */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                        Reason
                        <span style={{ color: '#DC2626' }}>*</span>
                      </Label>
                      <Textarea
                        placeholder="Add a short note on why this invoice is on hold…"
                        value={holdReason}
                        onChange={(e) => {
                          setHoldReason(e.target.value);
                          if (holdReasonError && e.target.value.trim()) setHoldReasonError(false);
                        }}
                        className={`min-h-[68px] text-[11px] bg-white shadow-none resize-none placeholder:text-[11px] placeholder:text-slate-400 ${
                          holdReasonError
                            ? 'border-red-400 ring-2 ring-red-100 focus-visible:border-red-500 focus-visible:ring-red-200'
                            : 'border-slate-200 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary'
                        }`}
                        style={{ fontWeight: 400 }}
                      />
                      {holdReasonError && (
                        <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>Reason is required to submit with a Payment Hold.</p>
                      )}
                    </div>

                    {/* Notify stakeholders, partner SearchableUserPicker
                        with red accent to match the Payment hold icon. */}
                    <div className="pt-0.5">
                      <SearchableUserPicker
                        selectedIds={notifiedStakeholders}
                        onSelectionChange={setNotifiedStakeholders}
                        accentColor="#A16207"
                        accentBg="#FEFCE8"
                        accentBorder="#FEF08A"
                        accentText="#A16207"
                        label="Notify on Hold"
                      />
                    </div>

                    {/* Supporting documents — last block, partner-style drop
                        zone (attachment visuals rev 7/15/26). */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                        Supporting Documents
                      </Label>
                      <input
                        type="file"
                        id="payment-hold-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setHoldAttachments(prev => [...prev, { name: file.name }]);
                          }
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('payment-hold-upload')?.click()}
                        className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Upload className="w-4 h-4 text-slate-500" />
                        </span>
                        <span className="text-[11px] text-slate-600 mt-1" style={{ fontWeight: 500 }}>
                          <span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span> or drag and drop
                        </span>
                        <span className="text-[10px] text-slate-400">PDF, DOC, XLS, PNG, JPG up to 10MB</span>
                      </button>
                      {holdAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {holdAttachments.map((file, idx) => (
                            <div key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600 group/attachment" style={{ fontWeight: 500 }}>
                              <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                              <span className="truncate max-w-[140px]">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => setHoldAttachments(prev => prev.filter((_, i) => i !== idx))}
                                className="ml-0.5 p-0.5 hover:bg-red-50 rounded-sm text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    </>)}
                  </AccordionContent>
                </AccordionItem>

                {/* Section 4: Exception */}
                <AccordionItem
                  value="exception"
                  id="exception-section"
                  className={`border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden ${
                    exceptionTypeError || exceptionDescriptionError ? 'border-red-300 ring-2 ring-red-100' : 'border-border'
                  }`}
                >
                  {/* Header layout matches the other accordions (9/6): far-
                      right chevron, Switch just left of it, all one trigger. */}
                  <AccordionTrigger className="hover:no-underline py-2.5 w-full group">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Exception</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex items-center justify-center cursor-help"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[300px]">
                            <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Exception</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                              {invoiceKind === 'pre'
                                ? 'Flag a problem so the pre-invoice cannot be approved or paid until it is resolved.'
                                : 'Flag an issue on this invoice, like a quantity or price mismatch, so it can be submitted without posting.'}
                            </p>
                            {/* Partner example-card recipe (BA 9/6). */}
                            <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
                              <p className="text-[9px] text-slate-400" style={{ fontWeight: 600 }}>Example</p>
                              <p className="text-[11px] text-slate-600 leading-snug mt-0.5">
                                <span className="text-amber-600" style={{ fontWeight: 600 }}>PO for 100, billed 120</span>. Submit it flagged so AP can investigate before it {invoiceKind === 'pre' ? 'is approved' : 'posts'}.
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {seedExceptionOn ? (
                        /* A submitted exception NEVER toggles off (Eli
                           9/8: "once you've turned it on as an exception,
                           that's it — you have to resolve it"). Greyed
                           switch; the seeded card below carries Resolve. */
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="mr-2 inline-flex" onClick={(e) => e.stopPropagation()}>
                              <Switch
                                checked={isExceptionActive}
                                disabled
                                className="scale-90 opacity-50 pointer-events-none"
                              />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[280px]">
                            <p className="text-[11px] text-slate-500 leading-snug">
                              An exception submitted with this invoice can't be turned off. Fix the invoice and resolve it by resubmitting.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Switch
                          checked={isExceptionActive}
                          onCheckedChange={(checked) => {
                            setIsExceptionActive(checked);
                            if (checked) {
                              if (!expandedSections.includes("exception")) {
                                setExpandedSections(prev => [...prev, "exception"]);
                              }
                            } else {
                              setExpandedSections(prev => prev.filter(s => s !== "exception"));
                              setExceptionTypeError(false);
                              setExceptionDescriptionError(false);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="scale-90 mr-2"
                        />
                      )}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-2 space-y-3.5">
                    {seedExceptionOn ? (
                      /* Submitted exception = the shared flag card (Eli
                         9/8): the logged exception is not editable — you
                         resolve it, you don't change it. The action runs
                         the normal submit so validation and the green
                         Resolve and resubmit confirm both fire. */
                      <SubmittedFlagCard
                        kind="exception"
                        // Flat inside the accordion (user 9/22): the header
                        // already frames and icons the section — no card in
                        // a card, no second flag glyph.
                        flat
                        reason={seedFlag?.reason}
                        typeLabels={EXCEPTION_TYPE_OPTIONS.filter((o) => exceptionTypes.includes(o.value)).map((o) => o.label)}
                        by={seedFlag?.by}
                        at={seedFlag?.at}
                        attachments={seedFlag?.attachments}
                        footnote="Excluded from GL posting until resolved."
                        actionLabel={resubIsException ? 'Resolve and Resubmit' : undefined}
                        onAction={resubIsException ? handleSubmit : undefined}
                        actionHint={resubIsException ? 'Fix the invoice details first; this records the resolution and resubmits.' : undefined}
                      />
                    ) : (<>
                    {/* Type + description, eyebrow labels with
                        a red asterisk to flag required. */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                        Type
                        <span style={{ color: '#DC2626' }}>*</span>
                      </Label>
                      {/* Multi-select, an invoice can carry several
                          exception reasons at once, so the user ticks one or
                          more from the dropdown. Modal (user 9/22): a click
                          anywhere else dismisses the open list first — it
                          never floats over the recipients modal. */}
                      <Popover modal>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={`flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 text-[12px] shadow-none transition-colors ${
                              exceptionTypeError
                                ? 'border-red-400 ring-2 ring-red-100'
                                : 'border-slate-200 hover:border-slate-300 focus:ring-1 focus:ring-primary/20 focus:border-primary'
                            }`}
                          >
                            <span className={`truncate ${exceptionTypes.length ? 'text-foreground' : 'text-slate-400'}`}>
                              {exceptionTypes.length
                                ? EXCEPTION_TYPE_OPTIONS.filter((o) => exceptionTypes.includes(o.value)).map((o) => o.label).join(', ')
                                : 'Select reasons…'}
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-1">
                          {/* Per-kind exception reasons (user 10/9): inventory,
                              pre-invoice and standalone each get their own list. */}
                          {exceptionOptionsFor(isStandalone ? 'standalone' : invoiceKind === 'pre' ? 'pre' : 'inventory').map((opt) => {
                            const checked = exceptionTypes.includes(opt.value);
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setExceptionTypes((prev) => {
                                    const next = prev.includes(opt.value)
                                      ? prev.filter((v) => v !== opt.value)
                                      : [...prev, opt.value];
                                    if (next.length > 0) setExceptionTypeError(false);
                                    // Drop a stale "Other" description error when
                                    // "Other" is no longer selected.
                                    if (!next.includes('other') && exceptionDescriptionError) setExceptionDescriptionError(false);
                                    return next;
                                  });
                                }}
                                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-slate-50 text-left transition-colors"
                              >
                                <Checkbox checked={checked} className="pointer-events-none" />
                                <span className="text-[12px] text-foreground">{opt.label}</span>
                              </button>
                            );
                          })}
                        </PopoverContent>
                      </Popover>
                      {exceptionTypeError && (
                        <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>Select at least one exception type.</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                        Description
                        {/* Mandatory only when the catch-all "Other" type is
                            selected; no "(optional)" text for named types. */}
                        {exceptionTypes.includes('other') && <span style={{ color: '#DC2626' }}>*</span>}
                      </Label>
                      <Textarea
                        placeholder="Describe the issue so reviewers can act on it…"
                        value={exceptionDescription}
                        onChange={(e) => {
                          setExceptionDescription(e.target.value);
                          if (exceptionDescriptionError && e.target.value.trim()) setExceptionDescriptionError(false);
                        }}
                        className={`min-h-[68px] text-[11px] bg-white shadow-none resize-none placeholder:text-[11px] placeholder:text-slate-400 ${
                          exceptionDescriptionError
                            ? 'border-red-400 ring-2 ring-red-100 focus-visible:border-red-500 focus-visible:ring-red-200'
                            : 'border-slate-200 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary'
                        }`}
                        style={{ fontWeight: 400 }}
                      />
                      {exceptionDescriptionError && (
                        <p className="text-[11px] text-red-500" style={{ fontWeight: 500 }}>Description is required for an "Other" exception.</p>
                      )}
                    </div>

                    {/* Notify stakeholders, partner SearchableUserPicker
                        with rose accent to match the Exception icon. */}
                    <div className="pt-0.5">
                      <SearchableUserPicker
                        selectedIds={notifiedExceptionStakeholders}
                        onSelectionChange={setNotifiedExceptionStakeholders}
                        accentColor="#D97706"
                        accentBg="#FFFBEB"
                        accentBorder="#FDE68A"
                        accentText="#B45309"
                        label="Notify on Exception"
                      />
                    </div>

                    {/* Supporting documents — last block, partner-style drop
                        zone (attachment visuals rev 7/15/26). */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                        Supporting Documents
                      </Label>
                      <input
                        type="file"
                        id="exception-upload"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setExceptionAttachments(prev => [...prev, { name: file.name }]);
                          }
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => document.getElementById('exception-upload')?.click()}
                        className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Upload className="w-4 h-4 text-slate-500" />
                        </span>
                        <span className="text-[11px] text-slate-600 mt-1" style={{ fontWeight: 500 }}>
                          <span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span> or drag and drop
                        </span>
                        <span className="text-[10px] text-slate-400">PDF, DOC, XLS, PNG, JPG up to 10MB</span>
                      </button>
                      {exceptionAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {exceptionAttachments.map((file, idx) => (
                            <div key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600 group/attachment" style={{ fontWeight: 500 }}>
                              <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                              <span className="truncate max-w-[140px]">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => setExceptionAttachments(prev => prev.filter((_, i) => i !== idx))}
                                className="ml-0.5 p-0.5 hover:bg-red-50 rounded-sm text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    </>)}
                  </AccordionContent>
                </AccordionItem>

                {/* Section 5: Additional charges */}
                <AccordionItem value="additional-charges" className="border border-border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-2.5 group">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-orange-50 flex items-center justify-center">
                        <DollarSign className="w-3.5 h-3.5 text-orange-600" />
                      </div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Additional Charges</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-2">
                    {/* Charge rows: each line is a compact type select +
                        amount input + subtle remove. No per-column headers
                        because the placeholders carry the meaning. "Add
                        charge" is a quiet primary-colored link at the
                        bottom instead of a big dashed button. Total sits
                        below a hairline as a right-aligned summary. */}
                    {/* Each charge is its own clean card with a tinted
                        header strip (icon tile + "Charge N" title + remove
                        X) and a white body holding labeled fields. Mirrors
                        the partner module's Pricing & Ordering Rules card
                        recipe so users get the same visual rhythm across
                        both flows. */}
                    <div className="space-y-2.5">
                      {additionalCharges.map((charge, index) => (
                        <div
                          key={charge.id}
                          className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-amber-200 hover:shadow-[0_4px_12px_-4px_rgba(245,158,11,0.10)] animate-in fade-in slide-in-from-top-1 duration-200"
                        >
                          {/* Header strip — icon tile + charge type as the
                              heading (falls back to "New Charge" when the
                              type isn't picked yet) + delete. Drops the
                              "Charge N" count + duplicate type chip so the
                              header carries one piece of identity. */}
                          <div
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-slate-100"
                            style={{ background: 'linear-gradient(90deg, #FFF7ED 0%, #FFFBEB 100%)' }}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-4 h-4 rounded bg-white border border-orange-100 flex items-center justify-center shrink-0">
                                <DollarSign className="w-2.5 h-2.5 text-orange-600" />
                              </div>
                              <span
                                className={`text-[11px] truncate ${charge.type ? 'text-foreground' : 'text-slate-400 italic'}`}
                                style={{ fontWeight: 600 }}
                              >
                                {charge.type || 'New Charge'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAdditionalCharges(additionalCharges.filter(c => c.id !== charge.id))}
                              className="w-5 h-5 shrink-0 inline-flex items-center justify-center rounded-md text-slate-400 transition-colors hover:text-red-500 hover:bg-red-50"
                              aria-label="Delete Charge"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Body — tighter padding so the card stays
                              compact in the narrow sidebar. */}
                          <div className="p-2.5 space-y-2">
                            {/* Row 1: Type + Amount, 50/50 split */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1 min-w-0">
                                <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Type</Label>
                                <Select
                                  value={charge.type}
                                  onValueChange={(value) => {
                                    const newCharges = [...additionalCharges];
                                    newCharges[index].type = value;
                                    setAdditionalCharges(newCharges);
                                  }}
                                >
                                  <SelectTrigger className="h-9 w-full bg-white border-slate-200 text-[11px] shadow-none focus:ring-1 focus:ring-primary/20 focus:border-primary">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Tax" className="text-[12px]">Tax</SelectItem>
                                    <SelectItem value="Service Fees" className="text-[12px]">Service Fees</SelectItem>
                                    <SelectItem value="Custom Charges" className="text-[12px]">Custom Charges</SelectItem>
                                    <SelectItem value="Handling Fees" className="text-[12px]">Handling Fees</SelectItem>
                                    <SelectItem value="Adjustments" className="text-[12px]">Adjustments</SelectItem>
                                    <SelectItem value="Insurance" className="text-[12px]">Insurance</SelectItem>
                                    <SelectItem value="Fuel Surcharge" className="text-[12px]">Fuel Surcharge</SelectItem>
                                    <SelectItem value="Other" className="text-[12px]">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>Amount</Label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]" style={{ fontWeight: 500 }}>{moneySymbol}</span>
                                  <MoneyInput
                                    fluid
                                    value={charge.amount || 0}
                                    onValueChange={(n) => {
                                      const newCharges = [...additionalCharges];
                                      newCharges[index].amount = n;
                                      setAdditionalCharges(newCharges);
                                    }}
                                    className={`flex h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white ${symbolPad} pr-2 py-1 text-[11px] shadow-none text-right font-medium outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-slate-300`}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* GL account — editable (Eli 10/5): defaults
                                from the module default, routes wherever
                                the user picks. On every invoice type. */}
                            <div className="space-y-1 min-w-0">
                              <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>GL Account</Label>
                              <GLAccountPicker
                                heightClass="h-9"
                                value={charge.glAccount || DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT}
                                defaultValue={DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT}
                                onChange={(next) => {
                                  const newCharges = [...additionalCharges];
                                  newCharges[index].glAccount = next;
                                  setAdditionalCharges(newCharges);
                                }}
                              />
                            </div>

                            {/* "Other" is a catch-all — it requires a
                                description so approvers know what the
                                charge actually is (design review 7/9/26). */}
                            {charge.type === 'Other' && (
                              <div className="space-y-1" id={`charge-description-${charge.id}`}>
                                <Label className="text-[10px] text-slate-500" style={{ fontWeight: 500 }}>
                                  Description<span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  value={charge.description || ''}
                                  onChange={(e) => {
                                    const newCharges = [...additionalCharges];
                                    newCharges[index].description = e.target.value;
                                    setAdditionalCharges(newCharges);
                                    if (chargeDescriptionError && e.target.value.trim()) setChargeDescriptionError(false);
                                  }}
                                  placeholder="What is this charge for?"
                                  className={`h-8 bg-white text-[11px] shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary placeholder:text-slate-300 ${
                                    chargeDescriptionError && !(charge.description || '').trim()
                                      ? 'border-red-400 ring-1 ring-red-100'
                                      : 'border-slate-200'
                                  }`}
                                  style={{ fontWeight: 500 }}
                                />
                                {chargeDescriptionError && !(charge.description || '').trim() && (
                                  <p className="text-[10px] text-red-500" style={{ fontWeight: 500 }}>Describe the charge, "Other" needs context.</p>
                                )}
                              </div>
                            )}

                          </div>
                        </div>
                      ))}

                      {/* Empty state — no charge exists yet. The user opts in
                          to each charge instead of the modal pre-selecting Tax. */}
                      {additionalCharges.length === 0 && (
                        <p className="text-[11px] text-slate-400 text-center py-1" style={{ fontWeight: 500 }}>
                          No additional charges. Add one below to get started.
                        </p>
                      )}

                      {/* New cards start fully blank — empty type, $0 amount —
                          so every field shows its placeholder. */}
                      {additionalCharges.length < 5 && (
                        <button
                          type="button"
                          onClick={() => setAdditionalCharges([...additionalCharges, { id: Date.now(), type: '', amount: 0, glAccount: DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT }])}
                          className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-slate-300 bg-white text-[11px] text-slate-500 hover:border-primary/50 hover:bg-accent/50 hover:text-amber-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
                          style={{ fontWeight: 500 }}
                        >
                          <Plus className="w-3 h-3" />
                          {additionalCharges.length === 0 ? 'Add Charge' : 'Add Another'}
                        </button>
                      )}

                      <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100">
                        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Total Additional Charges</span>
                        <span className="text-[13px] text-foreground " style={{ fontWeight: 600 }}>
                          {money(additionalChargesTotal)}
                        </span>
                      </div>

                      {/* No explainer line (Nophil 9/28): the GL Impact
                          section right below shows the posting itself —
                          charges capitalise into inventory (ASC 330) on
                          inventory invoices, expense on standalone. */}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 6: Freight & Logistics — read-only carrier
                    cards inherited from the vendor's partner config + an
                    editable freight charges amount and GL account. The
                    Carrier / Shipping method / Dispatch type selects are
                    gone because those decisions live on the partner page;
                    the invoicing user just records the cost. */}
                <AccordionItem value="freight" className="border border-border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-2.5 group">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center">
                        <Truck className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Freight &amp; Logistics</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-2 space-y-3">
                    {/* Carrier — inherited from the vendor profile but
                        changeable per invoice, mirroring Payment Terms. The
                        "Change" link opens the Browse Carriers modal; the
                        summary below is the partner-style carrier card. */}
                    {selectedCarrier && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Carrier</Label>
                          <button
                            type="button"
                            onClick={() => {
                              setCarrierDraftId(selectedCarrier.id);
                              setCarrierSearch('');
                              setCarrierModeFilter('');
                              setCarrierStatusFilter('all');
                              setCarrierModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-blue-700 transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            Change
                          </button>
                        </div>
                        <CarrierCard
                          carrier={selectedCarrier}
                          isSelected
                          hideCheckmark
                          readOnly
                          showStatusBadge
                          isVendorDefault={selectedCarrier.id === vendorDefaultCarrierId}
                        />
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="text-[10px] text-slate-500 leading-tight" style={{ fontWeight: 500 }}>
                            {selectedCarrier.id === vendorDefaultCarrierId
                              ? "Inherited from this vendor's profile."
                              : 'Overridden for this invoice.'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Editable freight cost — the per-invoice value. */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1.5 min-w-0">
                        <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Freight Charges</Label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]" style={{ fontWeight: 500 }}>{moneySymbol}</span>
                          <MoneyInput
                            fluid
                            value={freightAmount || 0}
                            onValueChange={setFreightAmount}
                            className={`flex h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white ${symbolPadWide} pr-2.5 py-1 text-[12px] shadow-none text-right font-medium outline-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary`}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      {/* GL account — editable (Eli 10/5), defaults from
                          the module default, on every invoice type. */}
                      <div className="space-y-1.5 min-w-0">
                        <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>GL Account</Label>
                        <GLAccountPicker
                          heightClass="h-9"
                          value={freightGlAccount || DEFAULT_FREIGHT_GL_ACCOUNT}
                          defaultValue={DEFAULT_FREIGHT_GL_ACCOUNT}
                          onChange={setFreightGlAccount}
                        />
                      </div>
                    </div>

                    {/* No explainer line (Nophil 9/28): GL Impact below
                        shows the posting — freight capitalises into
                        inventory (ASC 330) on inventory invoices, expenses
                        on standalone. */}
                  </AccordionContent>
                </AccordionItem>

                {/* GL impact — placed just above Attachments so the
                    journal preview sits at the tail of the sidebar
                    (after all sources that contribute Dr/Cr rows have
                    been configured above). */}
                <AccordionItem value="gl-impact" className="border border-border rounded-lg bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  {/* Horizontal padding lives on the trigger (not the
                      AccordionItem) for this section so the journal
                      content -- especially the green BALANCED strip --
                      can flow edge-to-edge inside the accordion card.
                      Radix Content's overflow-hidden clips any negative
                      margin trick, so the cleanest path is to never
                      pad the outer container in the first place. */}
                  <AccordionTrigger className="hover:no-underline py-2.5 px-3.5 group">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 text-violet-600" />
                      </div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>GL Impact</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0 pt-0">
                    {invoiceKind === 'pre' ? (
                      /* Pre-invoice (BA 9/5, Option A): a pre-invoice posts
                         NOTHING when created or approved — no Dr/Cr rows to
                         show. The section states that and previews the first
                         real entry: the payment (Dr Vendor Advance, Cr
                         Cash/Bank). */
                      <div className="px-3.5 pb-3.5">
                        <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2.5">
                          <p className="text-[11px] text-violet-900" style={{ fontWeight: 600 }}>No GL impact yet</p>
                          <p className="text-[11px] text-violet-800/80 leading-snug mt-0.5">
                            A pre-invoice posts nothing when created or approved. The first entry posts when a payment is made against it.
                          </p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-3 mb-1.5" style={{ fontWeight: 600 }}>At First Payment · Preview</p>
                        <div className="rounded-lg border border-slate-200 overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                            <span className="text-[11px]">
                              <span className="inline-flex px-1.5 py-px rounded text-[9px] bg-blue-50 text-blue-700 mr-1.5" style={{ fontWeight: 700 }}>Debit</span>
                              <span className="text-[10px] text-slate-400 mr-1">1205</span>
                              <span className="text-slate-700" style={{ fontWeight: 500 }}>Advance Payments</span>
                            </span>
                            <span className="text-[11px] text-foreground " style={{ fontWeight: 600 }}>
                              {formatMoney(inBase(total), BASE_CURRENCY)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-[11px]">
                              <span className="inline-flex px-1.5 py-px rounded text-[9px] bg-slate-100 text-slate-600 mr-1.5" style={{ fontWeight: 700 }}>Credit</span>
                              <span className="text-[10px] text-slate-400 mr-1">1000</span>
                              <span className="text-slate-700" style={{ fontWeight: 500 }}>Cash / Bank</span>
                            </span>
                            <span className="text-[11px] text-foreground " style={{ fontWeight: 600 }}>
                              {formatMoney(inBase(total), BASE_CURRENCY)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (() => {
                      // One GL rule (9/22/26): the sidebar preview renders
                      // buildInvoiceGl — the same builder the confirmation
                      // dialog shows and performSubmit persists, so the three
                      // surfaces can never disagree (GPT F55/RR11).
                      const gl = buildInvoiceGl({
                        kind: isStandalone ? 'standalone' : hasReceivingDocs ? 'received' : 'unreceived',
                        lines: isStandalone
                          ? standaloneItems.filter((i) => i.amount > 0 && i.glAccount).map((i) => ({ glAccount: i.glAccount, amount: i.amount }))
                          : lineItems.map((li) => ({
                              glAccount: li.glAccount,
                              amount: li.lineTotal,
                              ...accrualSplit(li),
                            })),
                        freightAmount,
                        freightGlAccount: freightGlAccount || DEFAULT_FREIGHT_GL_ACCOUNT,
                        additionalChargesTotal,
                        additionalChargeGlAccount: DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT,
                        // Per-charge GL routing on every type (Known 1, Eli
                        // 10/5): each charge debits its own picked account,
                        // inventory included, so the preview matches the
                        // account the form shows.
                        additionalChargeLines: additionalCharges
                          .filter((c) => c.amount > 0)
                          .map((c) => ({ glAccount: c.glAccount || DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT, amount: c.amount })),
                        apAccount,
                        total,
                        sliceAdjustedTotal,
                        sliceFraction,
                      });
                      // Posted in the base currency at the invoice rate (spec
                      // 4.4); a foreign invoice shows each line's own amount under it.
                      const posted = glInBase(gl, invoiceRate ?? midQuote.rate ?? 1, invoiceCurrency);
                      const glAmount = (amount: number, foreign?: number) => (
                        <span className="text-right">
                          <span className="block">{formatMoney(amount, BASE_CURRENCY)}</span>
                          {!invoiceIsBase && foreign != null && foreign > 0 && (
                            <span className="block text-[10px] text-slate-400" style={{ fontWeight: 500 }}>{money(foreign)}</span>
                          )}
                        </span>
                      );
                      const drRows: { code: string; name: string; amount: number; foreignAmount?: number }[] = [...posted.debits];
                      // Fallback: when nothing maps to a debit yet we still
                      // show a Dr placeholder so the panel has shape. Inventory
                      // invoices default to Inventory; standalone invoices
                      // prompt the user to pick a GL account per line.
                      if (drRows.length === 0) {
                        drRows.push(isStandalone
                          ? { code: ', ', name: 'Select a GL account on each line', amount: 0 }
                          : { code: '1200', name: 'Inventory', amount: 0 });
                      }
                      // Credits: buildInvoiceGl returns [inventory correction?, A/P].
                      const inventoryCreditRow = posted.credits.length > 1 ? posted.credits[0] : null;
                      const apRow = posted.credits[posted.credits.length - 1];
                      const apCode = apRow.code;
                      const apName = apRow.name;
                      const isBalanced = gl.balanced;
                      return (
                        <div className="border-t border-border bg-white">
                          {!invoiceIsBase && (
                            <div className="px-3.5 py-1.5 bg-slate-50/80 border-b border-border/60 text-[10px] text-slate-500 leading-snug" style={{ fontWeight: 500 }}>
                              Posts in {BASE_CURRENCY} at {rateSentence(invoiceCurrency, invoiceRate ?? midQuote.rate ?? 1)}. Each
                              line's {invoiceCurrency} amount is under it.
                            </div>
                          )}
                          {drRows.map((row, idx) => (
                            <div key={`dr-${row.code}-${idx}`}>
                              <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                                {/* Every debit row uses the same "DEBIT"
                                    badge (matching the "CREDIT" row) so the
                                    lingo is consistent across all GL accounts. */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className="inline-flex items-center px-1.5 h-[18px] rounded-md text-[10px] tracking-wide cursor-help"
                                      style={{ fontWeight: 700, backgroundColor: '#EBF3FF', color: '#0654BC' }}
                                    >
                                      Debit
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px]">
                                    <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Debit (Dr)</p>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Increases an asset or expense account, or clears a liability. Here it clears the AP accrual the receiving booked, or adds inventory or expense value.</p>
                                  </TooltipContent>
                                </Tooltip>
                                <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>
                                  {row.code}
                                </span>
                                <span className="text-[12px] text-foreground flex-1 truncate" style={{ fontWeight: 500 }}>
                                  {row.name}
                                </span>
                                <span className="text-[12px] text-foreground shrink-0" style={{ fontWeight: 600 }}>
                                  {glAmount(row.amount, row.foreignAmount)}
                                </span>
                              </div>
                              <div className="h-px bg-border/60 mx-3.5" />
                            </div>
                          ))}

                          {/* Inventory correction on the credit side — only
                              when the invoice prices received goods below
                              the PO estimate. */}
                          {inventoryCreditRow && (
                            <>
                              <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                                <span
                                  className="inline-flex items-center px-1.5 h-[18px] rounded-md text-[10px] tracking-wide"
                                  style={{ fontWeight: 700, backgroundColor: '#F1F5F9', color: '#475569' }}
                                >
                                  Credit
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>
                                  {inventoryCreditRow.code}
                                </span>
                                <span className="text-[12px] text-foreground flex-1 truncate" style={{ fontWeight: 500 }}>
                                  {inventoryCreditRow.name}
                                </span>
                                <span className="text-[12px] text-foreground shrink-0" style={{ fontWeight: 600 }}>
                                  {glAmount(inventoryCreditRow.amount, inventoryCreditRow.foreignAmount)}
                                </span>
                              </div>
                              <div className="h-px bg-border/60 mx-3.5" />
                            </>
                          )}

                          {/* Credit row — A/P, equal to invoice total */}
                          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="inline-flex items-center px-1.5 h-[18px] rounded-md text-[10px] tracking-wide cursor-help"
                                  style={{ fontWeight: 700, backgroundColor: '#F1F5F9', color: '#475569' }}
                                >
                                  Credit
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px]">
                                <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Credit (Cr)</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Increases a liability, equity, or revenue account. The invoice creates a payable to the vendor, so the offset lands on the credit side.</p>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-[10px] text-slate-400 shrink-0" style={{ fontWeight: 500 }}>
                              {apCode}
                            </span>
                            <span className="text-[12px] text-foreground flex-1 truncate" style={{ fontWeight: 500 }}>
                              {apName}
                            </span>
                            <span className="text-[12px] text-foreground shrink-0" style={{ fontWeight: 600 }}>
                              {glAmount(apRow.amount, apRow.foreignAmount)}
                            </span>
                          </div>

                          {/* Balanced / unbalanced strip — flips amber when
                              Dr total drifts from invoice total so users
                              spot configuration drift. */}
                          <div
                            className="flex items-center justify-between px-3.5 py-1.5 border-t"
                            style={isBalanced
                              ? { backgroundColor: '#ECFDF5', borderColor: '#D1FAE5' }
                              : { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}
                          >
                            <div className="flex items-center gap-1.5">
                              {isBalanced ? (
                                <CheckCircle2 className="w-3 h-3" style={{ color: '#059669' }} />
                              ) : (
                                <AlertTriangle className="w-3 h-3" style={{ color: '#B45309' }} />
                              )}
                              <span className="text-[10px] tracking-wide" style={{ fontWeight: 600, color: isBalanced ? '#047857' : '#92400E' }}>
                                {isBalanced ? 'Balanced' : 'Out of Balance'}
                              </span>
                            </div>
                            <span className="text-[10px]" style={{ fontWeight: 500, color: isBalanced ? '#047857' : '#92400E' }}>
                              Debit = Credit
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </AccordionContent>
                </AccordionItem>

                {/* Section 7: Attachments (Notes section removed) */}
                <AccordionItem value="attachments" className="border border-border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-2.5 group">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center">
                        <Paperclip className="w-3.5 h-3.5 text-slate-600" />
                      </div>
                      <span className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Attachments</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 pt-1">
                    <div className="space-y-3">
                      <input
                        type="file"
                        id="invoice-attachments-upload"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Errors stay under the upload area (BA 10/10).
                            const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
                            if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
                              setInvoiceAttachmentError(`${file.name} is not an accepted type. Use PDF, JPG or PNG.`);
                            } else if (file.size > 10 * 1024 * 1024) {
                              setInvoiceAttachmentError(`${file.name} is over the 10 MB limit.`);
                            } else {
                              setInvoiceAttachmentError(null);
                              setInvoiceAttachments(prev => [...prev, { name: file.name, size: file.size }]);
                            }
                          }
                          e.target.value = '';
                        }}
                      />
                      <div 
                        onClick={() => document.getElementById('invoice-attachments-upload')?.click()}
                        className="border-2 border-dashed border-border/60 rounded-xl p-5 flex flex-col items-center justify-center gap-2 hover:bg-blue-50/50 hover:border-blue-100 cursor-pointer transition-all group/upload"
                      >
                        <Upload className="w-6 h-6 text-gray-300 group-hover/upload:text-blue-500 group-hover/upload:scale-110 transition-all" />
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-muted-foreground">Attach Vendor Invoice</p>
                          <p className="text-[8px] text-muted-foreground/70 font-medium mt-0.5">PDF, JPG, or PNG up to 10MB</p>
                        </div>
                      </div>
                      {invoiceAttachmentError && (
                        <p className="text-[11px] text-red-600 -mt-1" style={{ fontWeight: 500 }}>{invoiceAttachmentError}</p>
                      )}

                      {invoiceAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {invoiceAttachments.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 border border-border/60 rounded text-[9px] font-medium text-muted-foreground group/attachment w-full justify-between">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Paperclip className="w-2.5 h-2.5 text-muted-foreground/70 shrink-0" />
                                <span className="truncate">{file.name}</span>
                                {/* Name and size (BA 10/10). */}
                                {file.size !== undefined && (
                                  <span className="shrink-0 text-muted-foreground/70">· {formatFileSize(file.size)}</span>
                                )}
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInvoiceAttachments(prev => prev.filter((_, i) => i !== idx));
                                }}
                                className="ml-0.5 p-0.5 hover:bg-gray-200 rounded-sm text-muted-foreground/70 hover:text-red-500 transition-colors shrink-0"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="h-10" />
            </div>

            <div className="px-3 sm:px-4 lg:px-5 py-3 border-t border-[#EEF2F6] bg-white shrink-0 sticky bottom-0 z-10">
              {/* Breakdown — quiet collapsible list of subtotals (sentence
                  case, slate text, right-aligned tabular values) topped
                  off with the Total row in foreground weight 600. */}
              <div className="mb-3 px-0.5">
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-blue-700 transition-colors cursor-pointer mb-2"
                  style={{ fontWeight: 500 }}
                >
                  {showBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showBreakdown ? 'Hide Breakdown' : 'Show Breakdown'}
                </button>

                {/* Smooth grid-template-rows 0fr <-> 1fr transition.
                    Modern CSS technique: the wrapper animates row tracks
                    while the inner div clips with overflow-hidden. No
                    height measurement, no JS, no fade-in jank -- just an
                    easing curve. */}
                <div
                  className="grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{
                    gridTemplateRows: showBreakdown ? '1fr' : '0fr',
                    opacity: showBreakdown ? 1 : 0,
                  }}
                  aria-hidden={!showBreakdown}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-1.5 pb-2">
                      {activeSlice && sliceReduction <= 0 && (
                        <p className="text-[10.5px] text-amber-700 leading-snug" style={{ fontWeight: 500 }}>
                          Split terms: This invoice covers the portion being received. Earlier portions were recorded as separate pre-invoices.
                        </p>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Subtotal</span>
                        <span className="text-[12px] text-foreground " style={{ fontWeight: 500 }}>{money(subtotal)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Freight</span>
                        <span className="text-[12px] text-foreground " style={{ fontWeight: 500 }}>{money(freightAmount)}</span>
                      </div>
                      {/* Tax carried from the reopened record (QC14) — the
                          form has no tax field, so it rides read-only and
                          keeps the round-trip total exact. */}
                      {seededTax > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Tax (From Record)</span>
                          <span className="text-[12px] text-foreground " style={{ fontWeight: 500 }}>{money(seededTax)}</span>
                        </div>
                      )}
                      {/* Prepayment applied — totals-level line (Eli,
                          8/31/26), like freight: named per pre-invoice,
                          reduces the payable, never per line item. */}
                      {appliedPrepayEntries.map((e) => (
                        <div key={e.invoiceNumber} className="flex justify-between items-center">
                          <span className="text-[11px] text-violet-700" style={{ fontWeight: 500 }}>Prepayment applied · {e.invoiceNumber}</span>
                          <span className="text-[12px] text-violet-700 " style={{ fontWeight: 600 }}>{money(-Math.min(e.amount, sliceAdjustedTotal))}</span>
                        </div>
                      ))}
                      {additionalCharges.map((charge) => charge.amount > 0 && (
                        <div key={charge.id} className="flex justify-between items-center">
                          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{charge.type || 'Charge'}</span>
                          <span className="text-[12px] text-foreground " style={{ fontWeight: 500 }}>{money(charge.amount)}</span>
                        </div>
                      ))}
                      {/* Split slice adjustment (Eli, 8/31/26 + 9/2/26): a
                          PRE invoice bills only its slice of the order
                          value — the reduction reads as its own row so the
                          Total Due math is explicit. */}
                      {activeSlice && sliceReduction > 0 && (
                        <>
                          {/* Split slice math, reworded (9/3/26 review):
                              the old single row said "Covers 20%" but
                              showed MINUS the other 80%, which read
                              backwards. Now the quiet line removes what
                              the OTHER slices bill, and the amber line
                              states the positive amount this slice pays. */}
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{`Billed on the Other Slices · ${100 - activeSlice.percent}%`}</span>
                            <span className="text-[12px] text-slate-500 " style={{ fontWeight: 500 }}>{money(-sliceReduction)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-amber-700" style={{ fontWeight: 500 }}>{`This Slice · ${activeSlice.percent}% at ${activeSlice.triggerEvent}`}</span>
                            <span className="text-[12px] text-amber-700 " style={{ fontWeight: 600 }}>{money(sliceAdjustedTotal)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>Total Due</span>
                  {/* Compact total (8/31/26): the 20px hero read louder than
                      the whole breakdown; one step above the row values.
                      Net of the slice adjustment AND applied prepayments. */}
                  <span className="text-[14px] text-foreground leading-none tracking-tight" style={{ fontWeight: 600 }}>
                    {money(totalDueAfterPrepay)}
                  </span>
                </div>
                {/* The same total in the base currency (Currency & Exchange
                    Rates, spec 4.4), at the invoice rate; the AR form's line. */}
                {!invoiceIsBase && (
                  <div className="flex justify-end mt-1">
                    <span className="text-[11px] text-slate-400 text-right" style={{ fontWeight: 400 }}>
                      ≈ {formatMoney(inBase(totalDueAfterPrepay), BASE_CURRENCY)} {BASE_CURRENCY} at{' '}
                      {formatRate(invoiceRate ?? midQuote.rate ?? 1)}
                      {ratePending ? ", today's rate" : invoiceRate == null ? '' : ` · ${RATE_TYPE_LABEL[rateType]}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Inline qty-mismatch / Exception alert banners removed per
                  design feedback — no alerts in this section. The same
                  guidance still reaches the user through the disabled-
                  Submit tooltip, the submit-attempt toast, and the
                  confirmation modal's variant copy. */}

              {/* Cancel + Submit CTAs — Cancel is forced-white-bordered
                  (so it doesn't blend into the off-white app background),
                  Submit is the standard primary with a paper-plane lead
                  icon and subtle shadow. */}
              <div className="flex items-center justify-end gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={handleAttemptClose}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                  className="inline-flex items-center justify-center h-9 rounded-lg px-5 text-[13px] border border-slate-200 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, color: '#0F172A', backgroundColor: '#FFFFFF' }}
                >
                  Cancel
                </button>
                {/* Submit button — ALWAYS active (design feedback).
                    Clicking with missing required fields highlights
                    them in red and scrolls the first one into view
                    instead of disabling the CTA. */}
                <Button
                  onClick={handleSubmit}
                  className="bg-primary text-primary-foreground shrink-0"
                >
                  <SendHorizontal className="w-4 h-4 mr-1.5" />
                  {isEdit ? 'Save Changes' : resubIsException ? 'Resolve and Resubmit' : isResubmit ? 'Resubmit' : 'Submit for Approval'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit confirmation — fires on every submit and branches on
          which flags are toggled. Copy comes from the BA-approved
          spec (4 cases: default / Payment Hold only / Exception only /
          both). Visual treatment adapts: clean submit is primary blue,
          Payment Hold amber, Exception rose, both rose. */}
      {/* The over-billing acknowledgment modal was removed (Mahreen 10/7):
          invoicing past the available quantity is blocked outright at submit
          with an inline error, so there is no "submit with variance" choice. */}


      <AlertDialog open={showSubmitWarning} onOpenChange={setShowSubmitWarning}>
        {/* Wider than the standard confirm (meeting feedback 7/17/26): the
            long-and-narrow shape scrolled badly once GL posting lines
            stack up. */}
        <AlertDialogContent
          // Resolve/resubmit carries the capture-family Description ∥
          // Documents pair, so it runs the family's 680px (user 9/22);
          // the plain submit variants keep 560px.
          className={`${resubRecordation ? 'sm:max-w-[680px]' : 'sm:max-w-[560px]'} p-0 gap-0 rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] max-h-[92vh] overflow-y-auto`}
          style={{ zIndex: 220 }}
          onInteractOutside={() => setShowSubmitWarning(false)}
        >
          {(() => {
            // Pick the right copy + visual treatment for the active
            // flag combo. Visual variants are keyed to STATUS_PALETTE
            // hues elsewhere in the app so this modal feels of a piece.
            type Variant = {
              chipLabel: string;
              chipBg: string;
              chipText: string;
              glowColor: string;
              tileBg: string;
              tileIconColor: string;
              title: string;
              howItWorks: string;
              implications: string;
              primaryLabel: string;
              primaryBg: string;
            };
            // A pure pre-invoice submission (created against a PO with nothing
            // received yet) gets its own copy: no GL impact until conversion.
            const isPreInvoiceSubmit = invoiceKind === 'pre';
            // Over-billing is blocked before this confirm ever opens
            // (Mahreen 10/7), so there is no quantity-variance path: only a
            // MANUALLY toggled exception drives the Exception confirm copy.
            const hasVariance = false;
            const variant: Variant = (() => {
              // Resubmits NEVER wear the red/amber warning variants (BA
              // 9/6): the seeded exception/hold flags describe what is
              // being FIXED, not a new flag — the green resolve treatment
              // wins.
              if (!resubRecordation && (isExceptionActive || hasVariance) && isPaymentHoldActive) {
                return {
                  chipLabel: 'Exception + Payment Hold',
                  // Amber, the exception state's own color (user 9/22):
                  // red is reserved for destructive actions.
                  chipBg: '#FFFBEB', chipText: '#92400E',
                  glowColor: '#F59E0B',
                  tileBg: '#FEF3C7', tileIconColor: '#B45309',
                  title: 'Submit with an Exception and Payment Hold?',
                  // One plain sentence each (Nophil 9/28): the sequencing
                  // story read as a paragraph nobody finished.
                  howItWorks: 'You have flagged an exception and a payment hold on this invoice.',
                  implications: isPreInvoiceSubmit
                    ? 'The pre-invoice cannot be approved or paid until both are resolved.'
                    : 'It cannot post or be paid until both are resolved.',
                  primaryLabel: 'Submit',
                  primaryBg: '#B45309',
                };
              }
              if (!resubRecordation && (isExceptionActive || hasVariance)) {
                return {
                  chipLabel: 'Exception',
                  chipBg: '#FFFBEB', chipText: '#92400E',
                  glowColor: '#F59E0B',
                  tileBg: '#FEF3C7', tileIconColor: '#B45309',
                  title: hasVariance && !isExceptionActive ? 'Submit as an exception?' : 'Submit with an open exception?',
                  howItWorks: hasVariance && !isExceptionActive
                    ? 'The quantity variance flags this invoice as an exception. It is submitted, but someone must resolve the variance before it can move to approval.'
                    : "The invoice is submitted but held on the flagged exception. It won't move to approval until someone resolves it.",
                  // A pre-invoice never posts before payment (Mahreen 10/10).
                  implications: isPreInvoiceSubmit
                    ? 'The pre-invoice cannot be approved or paid until the exception is resolved.'
                    : 'Nothing posts to the general ledger and no payment can happen until the exception is resolved.',
                  primaryLabel: 'Submit with Exception',
                  primaryBg: '#B45309',
                };
              }
              if (!resubRecordation && isPaymentHoldActive) {
                return {
                  chipLabel: 'Payment Hold',
                  chipBg: '#FFFBEB', chipText: '#92400E',
                  glowColor: '#F59E0B',
                  tileBg: '#FEF3C7', tileIconColor: '#B45309',
                  title: 'Submit with a Payment Hold?',
                  // Pre-invoice: no posting, no liability line (Mahreen 10/10).
                  howItWorks: isPreInvoiceSubmit
                    ? 'The pre-invoice goes through approval as usual. No payment can be made until the hold is released.'
                    : 'The invoice goes through approval and posts to the GL as usual. Payment stays blocked until you release the hold.',
                  implications: isPreInvoiceSubmit
                    ? ''
                    : 'The liability is recorded on your books now, but no money goes out until the hold is released.',
                  primaryLabel: 'Submit with Hold',
                  primaryBg: '#B45309',
                };
              }
              if (isPreInvoiceSubmit) {
                // BA copy pass 9/5: the confirm speaks Option A — nothing
                // posts at submit/approve, payability starts at approval,
                // and payments auto-apply at the receiving invoice.
                return {
                  chipLabel: 'Confirm Submission',
                  chipBg: '#EBF3FF', chipText: '#0654BC',
                  glowColor: '#0A77FF',
                  tileBg: '#D6E8FF', tileIconColor: '#0654BC',
                  title: 'Submit this pre-invoice for approval?',
                  howItWorks: 'This pre-invoice will be sent to the approvers. Once approved, it can be paid against.',
                  implications: 'No GL entry is created when a pre-invoice is submitted or approved. The pre-invoice becomes payable only after approval. Any payments made against this pre-invoice will be automatically applied when the inventory invoice is created for the PO after receiving.',
                  primaryLabel: 'Submit Pre-Invoice for Approval',
                  primaryBg: 'hsl(var(--primary))',
                };
              }
              if (isEdit) {
                return {
                  chipLabel: 'Confirm Changes',
                  chipBg: '#EBF3FF', chipText: '#0654BC',
                  glowColor: '#0A77FF',
                  tileBg: '#D6E8FF', tileIconColor: '#0654BC',
                  title: 'Save changes to this invoice?',
                  howItWorks: 'The invoice stays in Pending Approval and your approvers review the edited version. Nothing has posted yet, so editing is free.',
                  implications: 'Once approved, the invoice posts to the General Ledger with the updated details shown below.',
                  primaryLabel: 'Save Changes',
                  primaryBg: 'hsl(var(--primary))',
                };
              }
              if (isResubmit) {
                // Green resolution treatment (9/5/26 review): resubmitting
                // an exception/rejection RESOLVES it — the confirm wears
                // the same emerald identity as the detail Resolve modal
                // and carries the resolution record below.
                return {
                  chipLabel: resubIsException ? 'Resolve & Resubmit' : 'Confirm Resubmission',
                  chipBg: '#ECFDF5', chipText: '#047857',
                  glowColor: '#047857',
                  tileBg: '#D1FAE5', tileIconColor: '#047857',
                  title: resubIsException ? 'Resolve and resubmit this invoice?' : 'Resubmit this invoice?',
                  howItWorks: resubIsException
                    ? 'The exception clears and the fixed invoice goes back to your approvers. The original exception and your resolution both stay on the record.'
                    : 'It goes back to your approvers. Once approved, it posts to the General Ledger.',
                  implications: `The invoice becomes payable under its ${activeTermPreset.name} terms. Review the GL impact below before you resubmit.`,
                  primaryLabel: resubIsException ? 'Resolve and Resubmit' : 'Resubmit',
                  primaryBg: '#047857',
                };
              }
              return {
                chipLabel: 'Confirm Submission',
                chipBg: '#EBF3FF', chipText: '#0654BC',
                glowColor: '#0A77FF',
                tileBg: '#D6E8FF', tileIconColor: '#0654BC',
                title: 'Submit this invoice for approval?',
                howItWorks: 'It goes to your approvers. Once approved, it posts to the General Ledger.',
                implications: `The invoice becomes payable under its ${activeTermPreset.name} terms. Review the GL impact below before you submit.`,
                primaryLabel: 'Submit for Approval',
                primaryBg: 'hsl(var(--primary))',
              };
            })();

            const HeaderIcon = (isExceptionActive || hasVariance || isPaymentHoldActive) ? AlertTriangle : CheckCircle2;

            return (
              <>
                <div
                  className="relative flex flex-col items-center pt-10 pb-6"
                  style={{ background: `linear-gradient(180deg, ${variant.chipBg} 0%, ${variant.chipBg}4D 70%, transparent 100%)` }}
                >
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25"
                    style={{ backgroundColor: variant.glowColor }}
                  />
                  <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: variant.tileBg }}>
                    <HeaderIcon className="w-8 h-8" style={{ color: variant.tileIconColor }} />
                  </div>
                  <span
                    className="mt-4 px-3 py-1 rounded-full text-[11px]"
                    style={{ fontWeight: 600, backgroundColor: variant.chipBg, color: variant.chipText,  }}
                  >
                    {variant.chipLabel}
                  </span>
                </div>
                {/* Body — Partner-Group save-modal pattern: centered
                    title + lead description, then left-aligned cards with
                    a colored icon disk + bold title + supporting detail. */}
                <div className="flex flex-col items-center px-7 pb-7">
                  <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center items-center">
                    <AlertDialogTitle
                      className="text-[18px] tracking-[-0.02em]"
                      style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
                    >
                      {variant.title}
                    </AlertDialogTitle>
                  </AlertDialogHeader>
                  <p
                    className="text-[13px] mt-2 max-w-[560px] text-center"
                    style={{ color: 'hsl(var(--muted-foreground))', lineHeight: 1.65 }}
                  >
                    {variant.howItWorks}
                  </p>
                  {/* The "Recorded by" pill was CUT from this modal
                      (Nophil 9/22): no reason for it, it eats space. The
                      recordation still stamps the action history. */}

                  <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
                    {/* What are the implications — hidden on the resubmit/
                        resolve confirm (BA 9/6: the recordation is the
                        point there; implications + GL preview were noise
                        stretching the modal past the viewport). */}
                    {!resubRecordation && variant.implications && (
                    <div className="w-full rounded-xl border border-border bg-white shadow-sm p-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <p className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>
                          {isPreInvoiceSubmit ? 'What This Means' : 'What Are the Implications'}
                        </p>
                      </div>
                      <p className="text-[12px] text-slate-600" style={{ lineHeight: 1.6 }}>
                        {variant.implications}
                      </p>
                    </div>
                    )}

                    {/* Price deviations from the PO — surfaced at the moment
                        of submission so nothing lands on the approver
                        unannounced (design feedback 7/13/26). Partial
                        QUANTITIES are not listed here (Nophil + Mahreen
                        9/28): invoicing less than the remaining balance is
                        the system working as designed, not a change. */}
                    {!isStandalone && (() => {
                      const changedLines = lineItems.filter((i) => i.unitPrice !== i.originalUnitPrice);
                      if (changedLines.length === 0) return null;
                      return (
                        <div className="w-full rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm p-4">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <p className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>
                              Changes on This Invoice
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            {changedLines.map((i) => (
                              <div key={i.id} className="text-[12px] text-slate-600" style={{ lineHeight: 1.5 }}>
                                <span className="text-foreground" style={{ fontWeight: 600 }}>{i.sku}</span>
                                <span className="block">
                                  Price per Unit changed from {money(i.originalUnitPrice)} to {money(i.unitPrice)}.
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* GL impact — exact journal lines this invoice posts.
                        Pre-invoice (BA 9/5): the first GL entry is the
                        PAYMENT (Dr Vendor Advance / Cr Cash), so the section
                        previews that instead of the conversion entry.
                        Hidden on the resubmit/resolve confirm (BA 9/6). */}
                    {!resubRecordation && (
                    <div className="w-full rounded-xl border border-border bg-white shadow-sm p-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Receipt className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <p className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>
                          {isPreInvoiceSubmit ? 'GL Impact at Payment' : 'GL Impact'}
                        </p>
                      </div>
                      {isPreInvoiceSubmit && (
                        <p className="text-[12px] text-slate-500 mb-2" style={{ fontWeight: 600 }}>
                          Preview only. The GL is updated when payment is made.
                        </p>
                      )}
                      {/* Inventory invoices carry no intro line (user
                          10/4): the journal table speaks for itself. The
                          AR and standalone sentences stay because they
                          explain a non-obvious posting model. */}
                      {!isPreInvoiceSubmit && (ledger === 'ar' || isStandalone) && (
                        <p className="text-[12px] text-slate-600 mb-2" style={{ lineHeight: 1.6 }}>
                          {ledger === 'ar'
                            ? 'This invoice books a receivable from the customer and recognizes the full amount as revenue, including freight and other charges billed on.'
                            : 'This is a standalone invoice, so each line is an expense and posts to the expense account you choose. There is no inventory involved, so freight and other charges are expensed as well.'}
                        </p>
                      )}
                      {(() => {
                        // The AP journal is in the base currency, posted at the
                        // invoice rate (Currency & Exchange Rates, spec 4.4).
                        const fmtGl = (n: number) =>
                          ledger === 'ar'
                            ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : formatMoney(n, BASE_CURRENCY);
                        // GL account strings are stored as "CODE Name"
                        // (e.g. "6000 Office Expense"); split on the first
                        // space to render code + name in their columns.
                        const parseGl = (s: string) => {
                          const str = (s || '').trim();
                          const code = str.split(' ')[0];
                          return { code, name: str.substring(code.length + 1) || 'Expense' };
                        };
                        // One GL rule (9/22/26): the AP journals below come
                        // from the same buildInvoiceGl the sidebar preview
                        // and the persisted glEntries snapshot use, so the
                        // confirmation can never promise a different entry
                        // than the one that saves (GPT F55, RR11).
                        // AR mirror (7/20/26): a customer invoice books the
                        // receivable on the debit side and revenue on the
                        // credit side — the exact inverse of the AP posting.
                        const apGl = ledger === 'ar' || isPreInvoiceSubmit
                          ? null
                          : buildInvoiceGl({
                              kind: isStandalone ? 'standalone' : hasReceivingDocs ? 'received' : 'unreceived',
                              lines: isStandalone
                                ? standaloneItems.filter((i) => i.amount > 0 && i.glAccount).map((i) => ({ glAccount: i.glAccount, amount: i.amount }))
                                : lineItems
                                    .filter((i) => i.invoiceQty > 0)
                                    .map((i) => ({
                                      glAccount: i.glAccount,
                                      amount: i.lineTotal,
                                      ...accrualSplit(i),
                                    })),
                              freightAmount,
                              freightGlAccount: freightGlAccount || DEFAULT_FREIGHT_GL_ACCOUNT,
                              additionalChargesTotal,
                              additionalChargeGlAccount: DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT,
                              // Per-charge GL routing on every type (Known 1,
                              // Eli 10/5): each charge debits its own picked
                              // account so the confirm journal matches.
                              additionalChargeLines: additionalCharges
                                .filter((c) => c.amount > 0)
                                .map((c) => ({ glAccount: c.glAccount || DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT, amount: c.amount })),
                              apAccount,
                              total,
                              sliceAdjustedTotal,
                              sliceFraction,
                            });
                        const glLines: { code: string; name: string; debit?: number; credit?: number }[] = ledger === 'ar'
                          ? [
                              { code: '1200', name: 'Accounts Receivable', debit: total },
                              { code: '4000', name: 'Sales Revenue', credit: total },
                            ]
                          : isPreInvoiceSubmit
                            ? [
                                // Pre-invoice (BA 9/5, Option A): the first
                                // entry is the PAYMENT — Dr Vendor Advance,
                                // Cr Cash. Slice-adjusted for split terms.
                                { code: '1205', name: 'Advance Payments', debit: inBase(sliceAdjustedTotal) },
                                { code: '1000', name: 'Cash / Bank', credit: inBase(sliceAdjustedTotal) },
                              ]
                            : (() => {
                                const posted = glInBase(apGl!, invoiceRate ?? midQuote.rate ?? 1, invoiceCurrency);
                                return [
                                  ...posted.debits.map((r) => ({ code: r.code, name: r.name, debit: r.amount })),
                                  ...posted.credits.map((r) => ({ code: r.code, name: r.name, credit: r.amount })),
                                ];
                              })();
                        const drTotal = glLines.reduce((s, l) => s + (l.debit || 0), 0);
                        const crTotal = glLines.reduce((s, l) => s + (l.credit || 0), 0);
                        return (
                          <div className="mt-1.5 rounded-lg border border-slate-200 bg-white overflow-hidden text-left">
                            {ledger !== 'ar' && !invoiceIsBase && (
                              <p className="px-3 py-1.5 bg-slate-50/70 border-b border-slate-100 text-[10px] text-slate-500" style={{ fontWeight: 500 }}>
                                In {BASE_CURRENCY}, at {rateSentence(invoiceCurrency, invoiceRate ?? midQuote.rate ?? 1)}
                                {isPreInvoiceSubmit ? " (today's rate; the payment date's rate applies)" : ''}.
                              </p>
                            )}
                            <table className="w-full text-[12px]">
                              <thead className="bg-slate-50/70 border-b border-slate-100">
                                <tr>
                                  <th className="text-left px-3 py-1.5 text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Account</th>
                                  <th className="text-center px-3 py-1.5 text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Debit</th>
                                  <th className="text-center px-3 py-1.5 text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Credit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {glLines.map((line) => (
                                  <tr key={`${line.code}-${line.debit ? 'dr' : 'cr'}`} className="border-b border-slate-100 last:border-b-0">
                                    <td className="px-3 py-1.5">
                                      <span className="text-[11px] text-slate-500 " style={{ fontWeight: 500 }}>{line.code}</span>
                                      <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{line.name}</span>
                                    </td>
                                    <td className="px-3 py-1.5 text-center ">
                                      {line.debit ? <span className="text-foreground" style={{ fontWeight: 500 }}>{fmtGl(line.debit)}</span> : null}
                                    </td>
                                    <td className="px-3 py-1.5 text-center ">
                                      {line.credit ? <span className="text-foreground" style={{ fontWeight: 500 }}>{fmtGl(line.credit)}</span> : null}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-slate-200 bg-slate-50/70">
                                  <td className="px-3 py-1.5">
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[10px] border"
                                      style={{ fontWeight: 600, backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' }}
                                    >
                                      <CheckCircle2 className="w-2.5 h-2.5" />
                                      Debit = Credit (Balanced)
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-center text-foreground" style={{ fontWeight: 700 }}>{fmtGl(drTotal)}</td>
                                  <td className="px-3 py-1.5 text-center text-foreground" style={{ fontWeight: 700 }}>{fmtGl(crTotal)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                    )}

                    {/* Set-as-default — standalone only, when a vendor is
                        selected and at least one line has a GL account. Mirrors
                        the partner module's "apply changes" choice cards: keep
                        the pick for this invoice only, or promote the most-used
                        account to the vendor's default going forward. */}
                    {isStandalone && currentVendorId && mostUsedGl && (
                      <div className="w-full rounded-xl border border-border bg-white shadow-sm p-4">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <p className="text-[10px] text-slate-500" style={{ fontWeight: 600 }}>Default Expense Account</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setGlDefaultChoice('once')}
                            className={`w-full text-left rounded-lg border p-3 transition-colors ${glDefaultChoice === 'once' ? 'border-primary bg-primary/[0.04]' : 'border-slate-200 hover:border-slate-300'}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${glDefaultChoice === 'once' ? 'border-primary' : 'border-slate-300'}`}>
                                {glDefaultChoice === 'once' && <span className="w-2 h-2 rounded-full bg-primary" />}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Just This Invoice</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Use the accounts you picked for this invoice only. {vendorName}'s default stays unchanged.</p>
                              </div>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setGlDefaultChoice('default')}
                            className={`w-full text-left rounded-lg border p-3 transition-colors ${glDefaultChoice === 'default' ? 'border-primary bg-primary/[0.04]' : 'border-slate-200 hover:border-slate-300'}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${glDefaultChoice === 'default' ? 'border-primary' : 'border-slate-300'}`}>
                                {glDefaultChoice === 'default' && <span className="w-2 h-2 rounded-full bg-primary" />}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Set as Default Going Forward</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                  Make <span className="text-slate-700" style={{ fontWeight: 600 }}>{mostUsedGl}</span> {vendorName}'s default expense account. New standalone invoices for this vendor pre-fill it; past invoices aren't affected.
                                </p>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Resolution / resubmission record — the capture-modal
                        family recipe (user 9/22): notes ∥ documents at the
                        locked 104px pair height, NotifyToggleCard closing
                        the form. The stamp lives in the hero; no boxed
                        "record" section. */}
                    {resubRecordation && (
                      <>
                        {/* Cross-flag warning (user 9/23): resolving the
                            exception while a payment hold is still on says
                            so — neither block clears the other. */}
                        {resubIsException && isPaymentHoldActive && !pendingHoldRelease && (
                          <div className="w-full rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 flex items-start gap-2 text-left">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[12px] text-amber-800 leading-snug">
                              <span style={{ fontWeight: 600 }}>The payment hold stays on.</span> Resolving the exception does not release it; release the hold separately when payment can go out.
                            </p>
                          </div>
                        )}
                        <div className="grid sm:grid-cols-2 gap-3 items-start w-full">
                          <div className="space-y-1">
                            <span className="block text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                              {resubIsException ? 'Resolution Notes' : 'What Was Fixed'}
                              {/* Optional (VI-11): the resolution records with
                                  or without a note; no required asterisk. */}
                            </span>
                            <textarea
                              id="resub-notes-field"
                              value={resubNotes}
                              onChange={(e) => { setResubNotes(e.target.value); setResubNotesError(false); }}
                              placeholder={resubIsException ? 'How was the exception cleared?' : 'What changed before resubmitting?'}
                              rows={4}
                              className={`w-full h-[104px] text-[11px] rounded-md border bg-white px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-[11px] placeholder:text-slate-400 resize-none ${
                                resubNotesError ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'
                              }`}
                            />
                            {resubNotesError && <p className="text-[10px] text-red-600">Say what was fixed or why the exception clears.</p>}
                          </div>
                          <div className="space-y-1">
                            <span className="block text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Supporting Documents</span>
                            <input
                              type="file"
                              id="resubmit-recordation-upload"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setResubAttachments((prev) => [...prev, file.name]);
                                e.target.value = '';
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => document.getElementById('resubmit-recordation-upload')?.click()}
                              className="w-full h-[104px] flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                            >
                              <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                <Upload className="w-4 h-4 text-slate-500" />
                              </span>
                              <span className="text-[11px] text-slate-600 mt-0.5" style={{ fontWeight: 500 }}>
                                <span className="text-primary" style={{ fontWeight: 600 }}>Click to upload</span> or drag and drop
                              </span>
                              <span className="text-[10px] text-slate-400">PDF, DOC, XLS, PNG, JPG up to 10MB</span>
                            </button>
                            {resubAttachments.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {resubAttachments.map((name, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600" style={{ fontWeight: 500 }}>
                                    <Paperclip className="w-2.5 h-2.5 text-slate-400" />
                                    <span className="truncate max-w-[140px]">{name}</span>
                                    <button
                                      type="button"
                                      onClick={() => setResubAttachments((prev) => prev.filter((_, i) => i !== idx))}
                                      className="ml-0.5 p-0.5 hover:bg-red-50 rounded-sm text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Notify closes the form, full width — the
                            system's one notify interaction (user 9/9). */}
                        <NotifyToggleCard
                          title={`Notify the ${resubIsException ? 'Flag' : 'Rejection'} Recipients`}
                          helper={`Whoever was told when it was flagged will be told it's ${resubIsException ? 'resolved' : 'resubmitted'}.`}
                          checked={resubNotify}
                          onCheckedChange={(v) => setResubNotify(v === true)}
                          selectedIds={resubRecipients}
                          onSelectionChange={setResubRecipients}
                          accentColor="#047857"
                          accentBg="#ECFDF5"
                          accentBorder="#A7F3D0"
                          accentText="#047857"
                        />
                      </>
                    )}
                  </div>

                  {/* CTAs stay visible while the body scrolls (Eli 9/23:
                      Nophil lost the cancel behind a scroll). */}
                  <div className="w-full mt-6 flex flex-col gap-2.5 sticky bottom-0 bg-white pt-2 pb-1 -mb-2">
                    <button
                      onClick={() => {
                        // Zero-edit resolve asks once AFTER the green
                        // confirm (user 9/23 evening): the amber alert
                        // stacks above; Proceed anyway commits.
                        if (
                          resubRecordation &&
                          !resubNoChangeAckedRef.current &&
                          resubSnapshotRef.current !== null &&
                          resubSnapshotRef.current === latestResubJsonRef.current
                        ) {
                          setResubNoChangeOpen(true);
                          return;
                        }
                        confirmResolveSubmit();
                      }}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90"
                      style={{ fontWeight: 600, backgroundColor: variant.primaryBg, color: '#fff' }}
                    >
                      {variant.primaryLabel}
                    </button>
                    <button
                      onClick={() => setShowSubmitWarning(false)}
                      className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                      style={{ fontWeight: 500, backgroundColor: '#F8FAFC', color: '#334155' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    >
                      Continue Editing
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* No-change resubmit confirm (Nophil 9/22, order settled 9/23
          evening): it fires from the GREEN confirm's CTA and stacks
          above it — Proceed anyway commits the resubmit, Go back
          returns to the green confirm. */}
      <AlertDialog open={resubNoChangeOpen} onOpenChange={setResubNoChangeOpen}>
        <AlertDialogContent
          className="p-0 overflow-hidden gap-0 rounded-2xl border-0 max-w-[calc(100%-2rem)] sm:max-w-[400px]"
          style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)', zIndex: 260 }}
        >
          <div
            className="relative flex flex-col items-center pt-7 pb-4"
            style={{ background: 'linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: '#B45309', filter: 'blur(50px)' }} />
            <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
              <AlertTriangle className="w-6 h-6" style={{ color: '#B45309', strokeWidth: 2 }} />
            </div>
          </div>
          <div className="flex flex-col items-center text-center px-6 pb-6">
            <AlertDialogTitle className="text-[17px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600 }}>
              Resubmit without changes?
            </AlertDialogTitle>
            {/* The warning NAMES the open variance (Mahreen 9/29): a
                generic "no changes" line hid that the line was still a
                box over received. */}
            <AlertDialogDescription className="text-[12.5px] text-slate-500 mt-1.5 leading-relaxed">
              {(() => {
                const stillOver = lineItems.filter((i) => i.invoiceQty > i.remainingQty);
                if (stillOver.length === 0) {
                  return 'You are resubmitting this invoice without making any changes. Would you like to proceed?';
                }
                const named = stillOver
                  .map((i) => `${i.sku} is still ${i.invoiceQty - i.remainingQty} ${i.uom} over received`)
                  .join('; ');
                return `${named}. Resubmit anyway?`;
              })()}
            </AlertDialogDescription>
            <div className="w-full mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  resubNoChangeAckedRef.current = true;
                  setResubNoChangeOpen(false);
                  confirmResolveSubmit();
                }}
                className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-opacity hover:opacity-90 text-white"
                style={{ fontWeight: 600, backgroundColor: '#B45309' }}
              >
                Proceed Anyway
              </button>
              <button
                type="button"
                onClick={() => setResubNoChangeOpen(false)}
                className="w-full h-10 text-[13px] rounded-xl border border-border bg-white text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
                style={{ fontWeight: 500 }}
              >
                Go Back
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard confirmation, partner CreatePartnerModal recipe
          verbatim: AlertDialog + rose-glow header + AlertTriangle
          icon + DISCARD pill + centered title/description + destructive
          primary "Discard changes" + muted "Continue editing". */}
      <AlertDialog open={showDiscardConfirmation} onOpenChange={setShowDiscardConfirmation}>
        <AlertDialogContent
          className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => setShowDiscardConfirmation(false)}
        >
          <div
            className="relative flex flex-col items-center pt-10 pb-6"
            style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: '#EF4444' }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
              <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B',  }}
            >
              Discard
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle
                className="text-[18px] tracking-[-0.02em]"
                style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
              >
                {/* Mode-aware (GPT QC07, 9/30): an edit/resolve discards
                    CHANGES — the saved invoice survives; only creation
                    discards the invoice itself. */}
                {isResubmit ? 'Discard invoice changes?' : 'Discard invoice creation?'}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription
              className="text-[13px] mt-2 max-w-[300px] mx-auto"
              style={{ color: 'hsl(var(--muted-foreground))', lineHeight: '1.65' }}
            >
              {isResubmit
                ? 'Your unsaved edits will be lost. The saved invoice remains unchanged.'
                : 'All the information you’ve entered will be lost. This action cannot be undone.'}
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={handleConfirmDiscard}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
              >
                Discard Changes
              </button>
              <button
                onClick={() => setShowDiscardConfirmation(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
              >
                Continue Editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Go-back confirmation, same partner recipe as the discard modal,
          but routes to the previous screen (item picker / vendor select)
          and spells out that the selection is discarded too. */}
      <AlertDialog open={showBackConfirmation} onOpenChange={setShowBackConfirmation}>
        <AlertDialogContent
          className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 220 }}
          onInteractOutside={() => setShowBackConfirmation(false)}
        >
          <div
            className="relative flex flex-col items-center pt-10 pb-6"
            style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: '#EF4444' }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
              <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B',  }}
            >
              Go Back
            </span>
          </div>
          <div className="flex flex-col items-center text-center px-8 pb-8">
            <AlertDialogHeader className="p-0 gap-0 text-center sm:text-center">
              <AlertDialogTitle
                className="text-[18px] tracking-[-0.02em]"
                style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}
              >
                {isStandalone ? 'Go back and discard this invoice?' : 'Go back to item selection?'}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription
              className="text-[13px] mt-2 max-w-[310px] mx-auto"
              style={{ color: 'hsl(var(--muted-foreground))', lineHeight: '1.65' }}
            >
              {isStandalone
                ? 'The invoice details you’ve entered will be discarded and you’ll return to vendor selection. This cannot be undone.'
                : 'The invoice details you’ve entered and your item selection will be discarded, and you’ll return to the item picker. This cannot be undone.'}
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={handleConfirmBack}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
              >
                Discard and Go Back
              </button>
              <button
                onClick={() => setShowBackConfirmation(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
              >
                Continue Editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment term details — the partner-style modal, VIEW ONLY (Eli
          9/8: the duplicate Apply here "should be cut" — the browse
          footer's Apply to invoice is the one commit). Closing lands back
          on the still-open browse grid with the pending pick intact. */}
      {browseTermDetail && (
        <PaymentTermDetailsModal
          termLabel={browseTermDetail}
          onClose={() => setBrowseTermDetail(null)}
        />
      )}

      {/* Create Payment Term — Create New opens blank, Duplicate seeds.
          Created terms land in the runtime store and surface in the
          browse catalog immediately (Custom / Created by Me pills). */}
      <CreatePaymentTermModal
        open={createPtOpen}
        onClose={() => setCreatePtOpen(false)}
        seed={createPtSeed}
        onCreate={(t) => {
          addRuntimeTerm(t);
          // Land the catalog where the new term is visible.
          setPtTypeFilters(t.category);
          setPtStatusFilter('custom');
        }}
      />

      {/* Removal confirmations — the destructive gradient recipe (the
          go-back modal's exact treatment). z-[400] rides above the PO
          hover card so the preview can never linger on top. */}
      {!isStandalone && poToRemove && (
        <div className="fixed inset-0 bg-black/60 z-[400] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl max-w-[400px] w-full overflow-hidden animate-in zoom-in-95 duration-200"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
          >
            {/* Gradient hero — destructive red, matching Go back. */}
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                Remove PO
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                Remove PO {poToRemove}?
              </h3>
              <p className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.65, maxWidth: '310px' }}>
                It leaves this invoice and every line item it brought along is cleared. The purchase order itself is untouched.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleRemovePO}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  Yes, Remove It
                </button>
                <button
                  type="button"
                  onClick={() => setPoToRemove(null)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
                >
                  Keep It on the Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Bulk removal — same destructive recipe; confirm first. */}
      {!isStandalone && bulkRemoveConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 z-[400] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl max-w-[400px] w-full overflow-hidden animate-in zoom-in-95 duration-200"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                Remove Items
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                Remove {selectedIds.size} item{selectedIds.size === 1 ? '' : 's'}?
              </h3>
              <p className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.65, maxWidth: '310px' }}>
                The selected lines come off this invoice, and their quantities stay billable on their POs. A PO with nothing left leaves the invoice with them.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleBulkRemoveItems}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  Yes, Remove Them
                </button>
                <button
                  type="button"
                  onClick={() => setBulkRemoveConfirmOpen(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
                >
                  Keep Them on the Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Line-item removal — same destructive recipe; confirm first,
          the undo toast follows. */}
      {!isStandalone && itemToRemove && (
        <div className="fixed inset-0 bg-black/60 z-[400] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl max-w-[400px] w-full overflow-hidden animate-in zoom-in-95 duration-200"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                Remove Item
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                Remove item {itemToRemove.sku}?
              </h3>
              <p className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.65, maxWidth: '310px' }}>
                The line comes off this invoice. Its quantity returns to PO {itemToRemove.poNumber} and stays billable on a future invoice.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleRemoveItem}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  Yes, Remove It
                </button>
                <button
                  type="button"
                  onClick={() => setItemToRemove(null)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
                >
                  Keep It on the Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStandalone && standaloneBulkRemoveOpen && (
        <div className="fixed inset-0 bg-black/60 z-[400] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl max-w-[400px] w-full overflow-hidden animate-in zoom-in-95 duration-200"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                Remove Items
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                Remove {standaloneSelectedIds.size} item{standaloneSelectedIds.size === 1 ? '' : 's'}?
              </h3>
              <p className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.65, maxWidth: '310px' }}>
                The selected lines come off this invoice and their amounts leave the total.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={removeSelectedStandaloneItems}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  Yes, Remove Them
                </button>
                <button
                  type="button"
                  onClick={() => setStandaloneBulkRemoveOpen(false)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
                >
                  Keep Them on the Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standalone line removal (Mahreen 10/10): the inventory invoice's
          remove-item confirm, worded for a GL-coded line. */}
      {isStandalone && standaloneItemToRemove && (
        <div className="fixed inset-0 bg-black/60 z-[400] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl max-w-[400px] w-full overflow-hidden animate-in zoom-in-95 duration-200"
            style={{ boxShadow: '0 24px 80px -12px rgba(0,0,0,0.25)' }}
          >
            <div
              className="relative flex flex-col items-center pt-10 pb-6"
              style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, rgba(254,242,242,0.3) 70%, transparent 100%)' }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25 pointer-events-none" style={{ backgroundColor: '#EF4444' }} />
              <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertTriangle className="w-8 h-8" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span className="mt-4 px-3 py-1 rounded-full text-[11px]" style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B' }}>
                Remove Item
              </span>
            </div>
            <div className="flex flex-col items-center text-center px-8 pb-8">
              <h3 className="text-[18px] tracking-[-0.02em] text-foreground" style={{ fontWeight: 600, lineHeight: 1.3 }}>
                Remove this line item?
              </h3>
              <p className="text-[13px] mt-2 mx-auto text-muted-foreground" style={{ lineHeight: 1.65, maxWidth: '310px' }}>
                The {standaloneItemToRemove.label} comes off this invoice and its amount leaves the total.
              </p>
              <div className="w-full mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    removeStandaloneItem(standaloneItemToRemove.id);
                    setStandaloneItemToRemove(null);
                  }}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                  style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
                >
                  Yes, Remove It
                </button>
                <button
                  type="button"
                  onClick={() => setStandaloneItemToRemove(null)}
                  className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                  style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
                >
                  Keep It on the Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Items Modal */}
      {!isStandalone && (
        <AddItemFromPOModal 
          isOpen={isAddItemModalOpen}
          onClose={() => setIsAddItemModalOpen(false)}
          poData={activePOOriginalData}
          currentItems={currentPOsData.find(p => p.poNumber === activePOTab)?.items || []}
          onAdd={handleAddItemsFromPO}
        />
      )}

      {/* Vendor Selection Modal for adding more POs / items. Exclusion
          props hide POs / receivers / items already on the host invoice
          so the user can only pick net-new selections (and the merge in
          handleAddPOs always increments the running count). */}
      {!isStandalone && (
        <VendorSelectionModalNested
          isOpen={isAddPOOpen}
          onClose={() => setIsAddPOOpen(false)}
          onContinue={handleAddPOs}
          fixedVendorId={currentVendorId || undefined}
          // Add-more inherits the host document's kind (9/4/26 split): a
          // pre-invoice offers only unreceived portions, an inventory
          // invoice greys unreceived lines.
          flowKind={invoiceKind ?? 'post'}
          alreadySelectedPONumbers={currentPOsData.map((p) => p.poNumber)}
          alreadySelectedGRNNumbers={currentPOsData.flatMap((p) => p.relatedGRNs.map((g) => g.grnNumber))}
          alreadySelectedGRNItemIds={currentPOsData.flatMap((p) => p.selectedGRNItemIds ?? [])}
        />
      )}

      {/* Item QuickView, rich preview ported verbatim from the
          selection-modal ItemQuickView. Carousel hero, status pill,
          stat grid (Vendor / Unit Price / Stocking Unit / Lead Time),
          detail rows (no stock levels), Go-to-Item CTA. */}
      {previewImage && (() => {
        const sku = previewImage.sku;
        const vendorName = vendorData?.vendorName || standaloneVendor?.vendorName || '';
        const d = mockItemDataFull(sku, previewImage.description);
        const poolPhotos = photosForSku(sku);
        const photos = [previewImage.src.replace(/w=160&h=160/, 'w=600&h=400'), ...poolPhotos.filter(p => p !== previewImage.src)];
        const currentPhoto = photos[previewPhotoIdx % photos.length];
        return (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 animate-in fade-in duration-200 pointer-events-auto"
            onClick={() => setPreviewImage(null)}
          >
            <div
              className="relative w-[calc(100vw-32px)] sm:w-[480px] md:w-[540px] lg:w-[600px] max-h-[calc(100vh-48px)] bg-white rounded-2xl border border-gray-200/50 overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/90 hover:bg-white shadow-md transition-all cursor-pointer border border-gray-200"
              >
                <X className="w-4 h-4 text-slate-700" />
              </button>

              <div className="flex-1 overflow-y-auto">
                {/* Image carousel */}
                <div className="relative overflow-hidden bg-[#0C1222] select-none shrink-0" style={{ height: 'clamp(200px, 45vh, 420px)' }}>
                  <ImageWithFallback
                    src={currentPhoto}
                    alt={sku}
                    className="w-full h-full object-cover transition-opacity duration-200"
                  />
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); window.open(currentPhoto, '_blank', 'noopener'); }}
                    className="absolute top-3 right-14 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>

                  {photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewPhotoIdx(p => (p - 1 + photos.length) % photos.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewPhotoIdx(p => (p + 1) % photos.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/50 hover:text-white transition-colors cursor-pointer"
                      >
                        <ChevronRightIcon className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {photos.length > 1 && (
                    <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
                      {photos.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPreviewPhotoIdx(i)}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${i === (previewPhotoIdx % photos.length) ? 'bg-white w-3' : 'bg-white/40 hover:bg-white/60 w-1.5'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Detail body */}
                <div className="px-5 pt-4 pb-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>{sku}</span>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] border bg-slate-50 text-slate-600 border-slate-200"
                      style={{ fontWeight: 500 }}
                    >
                      <Star className="w-3 h-3" />
                      Primary: {d.category}
                    </span>
                  </div>

                  <p className="text-[13px] text-slate-500 mt-2 leading-relaxed line-clamp-3" style={{ fontWeight: 400 }}>
                    {d.desc}
                  </p>

                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-200 rounded-xl border border-gray-200 overflow-hidden [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:sm:border-t-0">
                    <div className="px-2.5 py-2.5 text-center">
                      <div className="text-[13px] text-gray-900 truncate" style={{ fontWeight: 700 }}>{(vendorName || 'Vendor').split(' ').slice(0, 2).join(' ')}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Partner</div>
                    </div>
                    <div className="px-2.5 py-2.5 text-center">
                      <div className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>{formatCurrency(d.unitPrice)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Price per Unit</div>
                    </div>
                    <div className="px-2.5 py-2.5 text-center">
                      <div className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>
                        {d.uom}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Stocking Unit</div>
                    </div>
                    <div className="px-2.5 py-2.5 text-center">
                      <div className="text-[15px] text-gray-900" style={{ fontWeight: 700 }}>
                        {d.leadTime}
                        <span className="text-[11px] text-slate-500 ml-0.5">days</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Lead Time</div>
                    </div>
                  </div>

                  {/* Master-data attributes (category / UOM, inventory
                      control / acquisition). No stock levels. */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-2.5 py-0.5">
                      <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[13px] text-slate-700" style={{ fontWeight: 500 }}>{d.category}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[13px] text-slate-500">{d.uom}</span>
                    </div>
                    <div className="flex items-center gap-2.5 py-0.5">
                      <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[13px] text-slate-700" style={{ fontWeight: 500 }}>{d.inventoryControl}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[13px] text-slate-500">{d.acquisition}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="text-[13px] text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                  style={{ fontWeight: 500 }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => { window.open(ITEMS_MODULE_URL, '_blank', 'noopener'); setPreviewImage(null); }}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] text-white transition-colors cursor-pointer bg-primary hover:bg-blue-700"
                  style={{ fontWeight: 600 }}
                >
                  Go to Item
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* GL Configuration Modal */}
      {glConfigModalItemId && (() => {
        const currentItem = standaloneItems.find(i => i.id === glConfigModalItemId);
        // Only show expense accounts: 5xxx COGS, 6xxx Operating, 7xxx Non-Operating, 9xxx Tax
        const expenseAccounts = GL_ACCOUNTS.filter(a => {
          const code = parseInt(a.split(' ')[0]);
          return (code >= 5000 && code < 8000) || code >= 9000;
        });
        const filteredAccounts = expenseAccounts.filter(a => 
          a.toLowerCase().includes(glModalSearch.toLowerCase())
        );
        
        // Group by category
        const grouped: Record<string, string[]> = {};
        filteredAccounts.forEach(account => {
          const code = parseInt(account.split(' ')[0]);
          let category = 'Other';
          if (code >= 5000 && code < 6000) category = 'Cost of Goods Sold';
          else if (code >= 6000 && code < 7000) category = 'Operating Expenses';
          else if (code >= 7000 && code < 8000) category = 'Non-Operating Expenses';
          else if (code >= 9000) category = 'Tax Expense';
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push(account);
        });

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setGlConfigModalItemId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden border border-border" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="px-5 pt-5 pb-3 border-b border-border/60">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <LayoutGrid className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-foreground">Expense Account</h3>
                      <p className="text-[10px] text-muted-foreground/70 font-medium">Select an expense account to debit for this line item</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setGlConfigModalItemId(null)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-muted-foreground/70 hover:text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Currently selected */}
                {currentItem?.glAccount && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 mb-3">
                    <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[11px] font-bold text-blue-700">Current: {currentItem.glAccount}</span>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
                  <Input 
                    value={glModalSearch}
                    onChange={(e) => setGlModalSearch(e.target.value)}
                    placeholder="Search by account code or name..."
                    className="h-[34px] pl-9 bg-muted/40 border-border text-[11px] font-medium shadow-none rounded-lg focus-visible:ring-1 focus-visible:ring-blue-200"
                    autoFocus
                  />
                </div>
              </div>

              {/* Account List */}
              <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
                {filteredAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/70">
                    <Search className="w-5 h-5 mb-2 text-gray-300" />
                    <span className="text-[11px] font-medium">No accounts match your search</span>
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, accounts]) => (
                    <div key={category} className="mb-2">
                      <div className="sticky top-0 z-10 bg-white px-2 py-1.5">
                        <span className="text-[9px] font-semibold text-muted-foreground/70 tracking-widest">{category}</span>
                      </div>
                      <div className="space-y-0.5">
                        {accounts.map((account) => {
                          const isSelected = currentItem?.glAccount === account;
                          const code = account.split(' ')[0];
                          const name = account.substring(code.length + 1);
                          return (
                            <button
                              key={account}
                              onClick={() => {
                                updateStandaloneItem(glConfigModalItemId, 'glAccount', account);
                                setGlConfigModalItemId(null);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group/item ${
                                isSelected 
                                  ? 'bg-blue-50 border border-blue-200' 
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-blue-600 border-blue-600' : 'border-border group-hover/item:border-input'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {/* Searchable, so it highlights like every other matched cell (10/9/26). */}
                                  <span className={`text-[11px] font-semibold tracking-tight ${isSelected ? 'text-blue-700' : 'text-muted-foreground'}`}>{highlightMatch(code, glModalSearch)}</span>
                                  <span className={`text-[11px] font-medium truncate ${isSelected ? 'text-blue-600' : 'text-muted-foreground'}`}>{highlightMatch(name, glModalSearch)}</span>
                                </div>
                              </div>
                              <span className="text-[9px] font-bold text-gray-300 shrink-0">DR</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-border/60 bg-gray-50/50 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground/70 font-medium">{filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''} available</span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentItem?.glAccount) {
                        updateStandaloneItem(glConfigModalItemId, 'glAccount', '');
                      }
                      setGlConfigModalItemId(null);
                    }}
                    className="h-8 px-3 text-[10px] font-bold border-border text-muted-foreground shadow-none"
                  >
                    {currentItem?.glAccount ? 'Clear & Close' : 'Cancel'}
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setGlConfigModalItemId(null)}
                    className="h-8 px-4 text-[10px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-none"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PO GL Configuration Modal */}
      {poGlConfigModalItemId && (() => {
        const currentItem = currentPOsData.flatMap(po => po.items).find(i => i.id === poGlConfigModalItemId);
        if (!currentItem) return null;

        // Filter and group GL accounts
        const filteredGLAccounts = GL_ACCOUNTS.filter(a =>
          a.toLowerCase().includes(poGlModalSearch.toLowerCase())
        );

        // Group GL accounts by category
        const glGrouped: Record<string, string[]> = {};
        filteredGLAccounts.forEach(account => {
          const code = parseInt(account.split(' ')[0]);
          let category = 'Other';
          if (code >= 1200 && code < 1300) category = 'Inventory Assets';
          else if (code >= 5000 && code < 5300) category = 'Cost of Goods Sold';
          else if (code >= 6000 && code < 7000) category = 'Operating Expenses';
          else if (code >= 7000 && code < 9000) category = 'Non-Operating Expenses';
          else if (code >= 9000) category = 'Tax Expenses';
          if (!glGrouped[category]) glGrouped[category] = [];
          glGrouped[category].push(account);
        });

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setPoGlConfigModalItemId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden border border-border" onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div className="px-5 pt-5 pb-3 border-b border-border/60">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <LayoutGrid className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-[13px] font-bold text-foreground">Expense Account</h3>
                      <p className="text-[10px] text-muted-foreground/70 font-medium">Select the general ledger account to debit</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setPoGlConfigModalItemId(null)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-muted-foreground/70 hover:text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Item info */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50/60 border border-border/60 mb-3">
                  <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-foreground block truncate">
                      {currentItem.description}
                    </span>
                    <span className="text-[9px] font-medium text-muted-foreground/70">
                      {currentItem.sku} • Invoice Qty: {currentItem.invoiceQty} {currentItem.uom}
                    </span>
                  </div>
                </div>

                {/* Currently selected */}
                {currentItem.glAccount && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100 mb-3">
                    <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-[11px] font-bold text-blue-700">Current: {currentItem.glAccount}</span>
                  </div>
                )}

                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
                  <Input 
                    value={poGlModalSearch}
                    onChange={(e) => setPoGlModalSearch(e.target.value)}
                    placeholder="Search by account code or name..."
                    className="h-[34px] pl-9 bg-muted/40 border-border text-[11px] font-medium shadow-none rounded-lg focus-visible:ring-1 focus-visible:ring-blue-200"
                    autoFocus
                  />
                </div>
              </div>

              {/* Account List */}
              <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
                {filteredGLAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/70">
                    <Search className="w-5 h-5 mb-2 text-gray-300" />
                    <span className="text-[11px] font-medium">No accounts match your search</span>
                  </div>
                ) : (
                  Object.entries(glGrouped).map(([category, accounts]) => (
                    <div key={category} className="mb-2">
                      <div className="sticky top-0 z-10 bg-white px-2 py-1.5">
                        <span className="text-[9px] font-semibold text-muted-foreground/70 tracking-widest">{category}</span>
                      </div>
                      <div className="space-y-0.5">
                        {accounts.map((account) => {
                          const isSelected = currentItem.glAccount === account;
                          const code = account.split(' ')[0];
                          const name = account.substring(code.length + 1);
                          return (
                            <button
                              key={account}
                              onClick={() => {
                                updateLineItem(currentItem.id, 'glAccount', account);
                                setPoGlConfigModalItemId(null);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group/item ${
                                isSelected 
                                  ? 'bg-blue-50 border border-blue-200' 
                                  : 'hover:bg-gray-50 border border-transparent'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-blue-600 border-blue-600' : 'border-border group-hover/item:border-input'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {/* Searchable, so it highlights like every other matched cell (10/9/26). */}
                                  <span className={`text-[11px] font-semibold tracking-tight ${isSelected ? 'text-blue-700' : 'text-muted-foreground'}`}>{highlightMatch(code, poGlModalSearch)}</span>
                                  <span className={`text-[11px] font-medium truncate ${isSelected ? 'text-blue-600' : 'text-muted-foreground'}`}>{highlightMatch(name, poGlModalSearch)}</span>
                                </div>
                              </div>
                              <span className="text-[9px] font-bold text-gray-300 shrink-0">DR</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-border/60 bg-gray-50/50 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground/70 font-medium">{filteredGLAccounts.length} account{filteredGLAccounts.length !== 1 ? 's' : ''} available</span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentItem?.glAccount) {
                        updateLineItem(currentItem.id, 'glAccount', '');
                      }
                      setPoGlConfigModalItemId(null);
                    }}
                    className="h-8 px-3 text-[10px] font-bold border-border text-muted-foreground shadow-none"
                  >
                    {currentItem?.glAccount ? 'Clear & Close' : 'Cancel'}
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setPoGlConfigModalItemId(null)}
                    className="h-8 px-4 text-[10px] font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-none"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Browse Payment Terms, partner shell ported verbatim from
          ahtisham-omne/Partner-Management---Vendor (the user's other
          repo). Tooltips, sort popover, type toggle with examples,
          status filter pills, and PaymentTermCard grid all mirror the
          partner module so the two flows look identical. Apply/card-
          click hand off to the existing scope-confirmation AlertDialog
          below; Create New + Duplicate stub to a toast (no Create-PT
          surface exists in vendor-invoicing). */}
      <Dialog
        open={paymentTermsModalOpen}
        onOpenChange={(v) => {
          setPaymentTermsModalOpen(v);
          if (v) {
            // Seed the pending pick from the invoice's current term so
            // the selected state reads on open.
            setPtPendingId(selectedPaymentTermId ?? null);
          } else {
            setPtFullscreen(false);
            setPtPendingId(null);
          }
        }}
      >
        <DialogContent
          className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:max-w-none"
          style={ptFullscreen
            ? { maxWidth: 'calc(100% - 1rem)', width: 'calc(100% - 1rem)', height: 'calc(100dvh - 1rem)', maxHeight: 'calc(100dvh - 1rem)', borderRadius: 16 }
            : { maxWidth: 'min(75vw, 1080px)', width: 'calc(100% - 2rem)', height: 'min(88vh, 1080px)', maxHeight: 'min(88vh, 1080px)', minHeight: 640, borderRadius: 16 }
          }
          showCloseButton={false}
        >
          <div className="flex items-center justify-between border-b border-[#EEF2F6] bg-card px-6 h-12 shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Payment Terms</h3>
                <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Browse templates or create custom terms</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPtFullscreen(!ptFullscreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {ptFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {ptFullscreen ? "Exit Full" : "Full View"}
              </button>
              <button
                onClick={() => setPaymentTermsModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
              {/* Mixed-terms strip (9/4/26 review): back to the system's
                  full-width below-header band (the Configure Vendor
                  pre-filled strip pattern) — the rounded card read as
                  page content, not modal chrome. The blue kind banner is
                  gone entirely: the locked type tab and its tooltip
                  already tell that story. */}
              {hasMixedPoTerms && (
                <div className="shrink-0 flex items-start gap-2 px-5 py-2 bg-amber-50/70 border-b border-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-px" />
                  <p className="text-[11px] text-amber-800 leading-snug" style={{ fontWeight: 500 }}>
                    <span style={{ fontWeight: 600 }}>These POs carry different terms.</span> Applying a term here aligns every PO on this invoice to it. Vendor profiles don't change.
                  </p>
                </div>
              )}
              {/* Kind-conflict strip (BA 9/28): the ONE explanation for why
                  the picker opened on an all-blocked selection — the gate
                  modal that used to precede it repeated the same message. */}
              {!hasMixedPoTerms && termsPickerNotice === 'kind-conflict' && (
                <div className="shrink-0 flex items-start gap-2 px-5 py-2 bg-amber-50/70 border-b border-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-px" />
                  <p className="text-[11px] text-amber-800 leading-snug" style={{ fontWeight: 500 }}>
                    {invoiceKind === 'pre' ? (
                      <><span style={{ fontWeight: 600 }}>The selected POs use NET terms, which apply only after receiving.</span> Since this is a pre-invoice, choose a prepayment or split term here.</>
                    ) : (
                      <><span style={{ fontWeight: 600 }}>The selected POs use prepayment terms, which apply before goods ship.</span> Since this is an inventory invoice, choose a NET or split term here.</>
                    )}
                  </p>
                </div>
              )}
              <div className="shrink-0 bg-white border-b border-[#EEF2F6] px-5 pt-4 pb-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={ptSearch}
                      onChange={(e) => setPtSearch(e.target.value)}
                      placeholder="Search payment terms..."
                      className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-primary focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
                    />
                    {ptSearch && (
                      <button onClick={() => setPtSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="inline-flex items-center rounded-lg bg-slate-50 border border-border/60 p-0.5 shrink-0">
                    {([
                      { key: "net", label: "NET", color: "hsl(var(--primary))", bg: "#EBF3FF", icon: Receipt, tip: "Payment is due a fixed number of days after an event (invoice date, receiving, etc.).", example: <><span className="text-primary" style={{ fontWeight: 600 }}>Net 30</span>: full payment due 30 days after invoice.</> },
                      { key: "prepayment", label: "Pre", color: "#7C3AED", bg: "#F5F3FF", icon: Clock, tip: "Prepayment terms apply to pre-invoices only, billed before goods are received.", example: <><span style={{ color: '#7C3AED', fontWeight: 600 }}>50% upfront</span> before goods are received.</> },
                      { key: "split", label: "Split", color: "#B45309", bg: "#FFFBEB", icon: SquareSplitHorizontal, tip: "Payment is divided into multiple installments, each due at different milestones.", example: <><span className="text-amber-600" style={{ fontWeight: 600 }}>30/70 split</span>: 30% on order, 70% on receiving.</> },
                    ] as const).map((cat) => {
                      const active = ptTypeFilters === cat.key;
                      const count = allPtTerms.filter((t) => t.category === cat.key).length;
                      // Kind lock (9/1/26): the category that cannot apply
                      // to this invoice kind is unselectable, and its
                      // tooltip says why.
                      const blocked = !termCategoryAllowed(cat.key);
                      return (
                        <Tooltip key={cat.key}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => { if (!blocked) setPtTypeFilters(cat.key); }}
                              aria-disabled={blocked}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all ${
                                blocked ? "opacity-45 cursor-not-allowed" : active ? "shadow-sm cursor-pointer" : "hover:bg-white/60 cursor-pointer"
                              }`}
                              style={{ fontWeight: active ? 600 : 500, color: active ? cat.color : "#334155", backgroundColor: active ? cat.bg : undefined }}
                            >
                              {blocked ? <Lock className="w-3.5 h-3.5" /> : <cat.icon className="w-3.5 h-3.5" />}
                              {cat.label}
                              <span
                                className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                                style={{ fontWeight: 600, color: active ? cat.color : "hsl(var(--muted-foreground))", backgroundColor: active ? `${cat.color}15` : "hsl(var(--border))" }}
                              >
                                {count}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={8} className="max-w-[260px] text-[11px] leading-[1.5] z-[300]">
                            {blocked && (
                              <p className="text-amber-700 mb-1.5" style={{ fontWeight: 600 }}>
                                {invoiceKind === 'pre'
                                  ? 'NET terms apply after goods are received, so they don’t fit a pre-invoice.'
                                  : 'Prepayment terms'}
                              </p>
                            )}
                            <p className="text-slate-500">{cat.tip}</p>
                            <div className="mt-2 px-2.5 py-2 rounded-lg bg-slate-50 border border-muted">
                              <p className="text-[10px] text-slate-400 tracking-wide" style={{ fontWeight: 600 }}>Example</p>
                              <p className="text-[11px] text-slate-700 mt-1">{cat.example}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>

                  <div className="flex-1" />
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md bg-primary/[0.04] text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                      {filteredPaymentTermPresets.length}
                    </span>
                    <Popover open={ptSortOpen} onOpenChange={setPtSortOpen}>
                      <PopoverTrigger asChild>
                        <button className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${ptSortOpen ? "text-primary bg-blue-50 border-blue-100" : "text-slate-500 hover:text-foreground hover:bg-slate-50 border-transparent hover:border-border"}`} style={{ fontWeight: 500 }}>
                          <ArrowUpDown className="w-3 h-3" />
                          {ptSortBy === "name" ? "Name" : ptSortBy === "vendorsApplied" ? "In Use" : ptSortBy === "duration" ? "Duration" : "Type"}
                          {ptSortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[200px] p-1.5 rounded-lg z-[250]" sideOffset={6}>
                        <div className="space-y-0.5">
                          {([
                            { key: "name", label: "Name", icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
                            { key: "vendorsApplied", label: "In Use", icon: <Building2 className="w-3.5 h-3.5" /> },
                            { key: "duration", label: "Duration", icon: <Clock className="w-3.5 h-3.5" /> },
                            { key: "category", label: "Type", icon: <Tag className="w-3.5 h-3.5" /> },
                          ] as const).map((opt) => {
                            const isActive = ptSortBy === opt.key;
                            return (
                              <button
                                key={opt.key}
                                onClick={() => {
                                  if (isActive) {
                                    setPtSortDir((d) => d === "asc" ? "desc" : "asc");
                                  } else {
                                    setPtSortBy(opt.key);
                                    setPtSortDir("asc");
                                  }
                                  setPtSortOpen(false);
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] transition-all ${
                                  isActive
                                    ? "bg-blue-50 text-primary"
                                    : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                                }`}
                                style={{ fontWeight: isActive ? 600 : 500 }}
                              >
                                <span className={isActive ? "text-primary" : "text-slate-400"}>{opt.icon}</span>
                                <span className="flex-1 text-left">{opt.label}</span>
                                {isActive && (
                                  ptSortDir === "asc"
                                    ? <ArrowUp className="w-3 h-3 text-primary" />
                                    : <ArrowDown className="w-3 h-3 text-primary" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {/* Secondary on purpose (Eli 9/8, twice): "the create
                        new is not a primary CTA here" — Apply to invoice
                        in the footer owns the blue. */}
                    <button
                      type="button"
                      onClick={() => { setCreatePtSeed(undefined); setCreatePtOpen(true); }}
                      className="shrink-0 h-8 px-3 rounded-lg border border-border bg-white text-[12px] text-foreground hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer inline-flex items-center"
                      style={{ fontWeight: 500 }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Create New
                    </button>
                  </div>
                </div>

                <div className="flex items-center overflow-x-auto">
                  <FilterPills
                    options={(() => {
                      const base = ptTypeFilters
                        ? allPtTerms.filter((t) => t.category === ptTypeFilters)
                        : allPtTerms;
                      const presetCount = base.filter((t) => !t.id.startsWith("pt-custom-")).length;
                      const customCount = base.filter((t) => t.id.startsWith("pt-custom-")).length;
                      const createdByMeCount = base.filter((t) => t.id.startsWith("pt-custom-")).length;
                      return [
                        { key: "all", label: "All", count: base.length, showCount: true },
                        { key: "preset", label: "Template", count: presetCount, showCount: true },
                        { key: "custom", label: "Custom", count: customCount, showCount: true },
                        { key: "created_by_me", label: "Created by Me", count: createdByMeCount, showCount: true },
                        { key: "in_use", label: "In Use", count: base.filter((t) => t.vendorsApplied >= 1).length, showCount: true },
                      ];
                    })()}
                    activeKey={ptStatusFilter}
                    onSelect={(k) => setPtStatusFilter(k)}
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                {/* The PO quick-pick strip is GONE (8/28/26 evening
                    review): the create screen's clubbed mixed-terms card
                    already lists each PO's term with its own Change, so
                    the modal stays a pure catalog. */}
                {filteredPaymentTermPresets.length === 0 ? (
                  (() => {
                    const ptFilterCount = (ptTypeFilters ? 1 : 0) + (ptStatusFilter !== 'all' ? 1 : 0);
                    return (
                      <TableEmptyState
                        compact
                        kind={resolveTableEmptyKind({ totalCount: allPtTerms.length, filteredCount: 0, searchQuery: ptSearch, filterCount: ptFilterCount }) ?? 'no-data'}
                        entity={{ singular: 'payment term', plural: 'payment terms' }}
                        searchQuery={ptSearch}
                        filterCount={ptFilterCount}
                        suggestion={findSearchSuggestion(ptSearch, allPtTerms.map((t) => t.name))}
                        onApplySuggestion={setPtSearch}
                        onClearSearch={() => setPtSearch('')}
                        onClearFilters={() => { setPtTypeFilters(''); setPtStatusFilter('all'); }}
                        onClearAll={() => { setPtSearch(''); setPtTypeFilters(''); setPtStatusFilter('all'); }}
                      />
                    );
                  })()
                ) : (
                  <div className="@container/ptgrid">
                  <div className="grid grid-cols-1 @[400px]/ptgrid:grid-cols-2 @[750px]/ptgrid:grid-cols-3 auto-rows-fr gap-4">
                    {filteredPaymentTermPresets.map((term) => {
                      // Click = SELECT (Eli 9/8: "an affirmative action
                      // that says, yes, I'm going to go with that choice");
                      // the footer Apply to invoice commits. Applying still
                      // aligns every PO on a mixed-terms invoice (8/28
                      // evening: no per-PO changes) and clears the block.
                      return (
                        <PaymentTermCard
                          key={term.id}
                          term={term}
                          isSelected={ptPendingId === term.id}
                          selectedRing
                          selectControl
                          onClick={() => setPtPendingId(term.id)}
                          onSeeDetail={(t) => setBrowseTermDetail(t.name)}
                          onDuplicate={() => { setCreatePtSeed(term); setCreatePtOpen(true); }}
                          searchText={ptSearch}
                          showPresetBadge
                          isInherited={term.name === vendorDefaultPaymentTerm}
                        />
                      );
                    })}
                  </div>
                  </div>
                )}
              </div>

              {/* Footer (Eli 9/8): the blue button at the bottom, "which
                  is how everything else we do flows" — Apply to invoice
                  commits the pending pick; Cancel discards it. */}
              <div className="shrink-0 flex items-center justify-between gap-3 border-t border-[#EEF2F6] bg-card px-5 py-3">
                <p className="text-[11px] text-slate-500 truncate" style={{ fontWeight: 500 }}>
                  {(() => {
                    const pending = ptPendingId ? allPtTerms.find((t) => t.id === ptPendingId) : null;
                    return pending ? (
                      <>
                        <span className="text-foreground" style={{ fontWeight: 600 }}>{pending.name}</span> selected
                      </>
                    ) : (
                      'Select a term to apply'
                    );
                  })()}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPaymentTermsModalOpen(false)}
                    className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[13px] text-foreground hover:bg-slate-50 transition-colors cursor-pointer"
                    style={{ fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                  <Button
                    onClick={() => {
                      if (!ptPendingId) {
                        toast.error('Pick a term first', { description: 'Select a payment term from the list to apply it.' });
                        return;
                      }
                      const t = allPtTerms.find((x) => x.id === ptPendingId);
                      if (t) applyTermToInvoice(t);
                    }}
                    className="bg-primary text-primary-foreground h-9 px-4 text-[13px]"
                  >
                    <Check className="w-4 h-4 mr-1.5" /> Apply to invoice
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {/* Browse Carriers — partner Freight & Logistics shell, structured
          identically to the Browse Payment Terms modal above (search, mode
          toggle with counts, status pills, sort popover, CarrierCard grid).
          Apply / card-click hand off to the scope-confirmation AlertDialog
          below; Create New stubs to a toast (carrier setup lives on the
          partner profile, not in vendor-invoicing). */}
      <Dialog
        open={carrierModalOpen}
        onOpenChange={(v) => { setCarrierModalOpen(v); if (!v) setCarrierFullscreen(false); }}
      >
        <DialogContent
          className="z-[210] flex flex-col gap-0 overflow-hidden border-0 p-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:max-w-none"
          style={carrierFullscreen
            ? { maxWidth: 'calc(100% - 1rem)', width: 'calc(100% - 1rem)', height: 'calc(100dvh - 1rem)', maxHeight: 'calc(100dvh - 1rem)', borderRadius: 16 }
            : { maxWidth: 'min(75vw, 1080px)', width: 'calc(100% - 2rem)', height: 'min(88vh, 1080px)', maxHeight: 'min(88vh, 1080px)', minHeight: 640, borderRadius: 16 }
          }
          showCloseButton={false}
        >
          <div className="flex items-center justify-between border-b border-[#EEF2F6] bg-card px-6 h-12 shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Freight &amp; Logistics</h3>
                <p className="text-[11px] text-muted-foreground" style={{ fontWeight: 400 }}>Choose a carrier for this invoice</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCarrierFullscreen(!carrierFullscreen)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
                style={{ fontWeight: 500 }}
              >
                {carrierFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                {carrierFullscreen ? 'Exit Full' : 'Full View'}
              </button>
              <button
                onClick={() => setCarrierModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-muted transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-white">
              <div className="shrink-0 bg-white border-b border-[#EEF2F6] px-5 pt-4 pb-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={carrierSearch}
                      onChange={(e) => setCarrierSearch(e.target.value)}
                      placeholder="Search carriers..."
                      className="pl-9 pr-8 rounded-lg border-[#D0D7E1] h-9 bg-white text-[13px] w-[220px] placeholder:text-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.05)] focus:border-primary focus:shadow-[0_0_0_3px_rgba(10,119,255,0.08)]"
                    />
                    {carrierSearch && (
                      <button onClick={() => setCarrierSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="inline-flex items-center rounded-lg bg-slate-50 border border-border/60 p-0.5 shrink-0">
                    {([
                      { key: '' as const, label: 'All' },
                      { key: 'air' as const, label: CARRIER_MODE_LABEL.air },
                      { key: 'ground' as const, label: CARRIER_MODE_LABEL.ground },
                      { key: 'sea' as const, label: CARRIER_MODE_LABEL.sea },
                    ]).map((cat) => {
                      const active = carrierModeFilter === cat.key;
                      const count = cat.key === '' ? CARRIER_CATALOGUE.length : CARRIER_CATALOGUE.filter((c) => c.mode === cat.key).length;
                      return (
                        <button
                          key={cat.key || 'all'}
                          onClick={() => setCarrierModeFilter(cat.key)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[12px] transition-all cursor-pointer ${
                            active ? 'shadow-sm bg-white text-primary' : 'hover:bg-white/60 text-slate-600'
                          }`}
                          style={{ fontWeight: active ? 600 : 500 }}
                        >
                          {cat.label}
                          <span
                            className="text-[10px] rounded-full px-1.5 py-px min-w-[18px] text-center"
                            style={{ fontWeight: 600, color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', backgroundColor: active ? 'rgba(10,119,255,0.10)' : 'hsl(var(--border))' }}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex-1" />
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md bg-primary/[0.04] text-[11px] text-slate-500" style={{ fontWeight: 600 }}>
                      {filteredCarriers.length}
                    </span>
                    <Popover open={carrierSortOpen} onOpenChange={setCarrierSortOpen}>
                      <PopoverTrigger asChild>
                        <button className={`inline-flex items-center gap-1 text-[12px] transition-colors px-2 py-1 rounded-md border ${carrierSortOpen ? 'text-primary bg-blue-50 border-blue-100' : 'text-slate-500 hover:text-foreground hover:bg-slate-50 border-transparent hover:border-border'}`} style={{ fontWeight: 500 }}>
                          <ArrowUpDown className="w-3 h-3" />
                          {carrierSortBy === 'name' ? 'Name' : carrierSortBy === 'transit' ? 'Transit' : 'Mode'}
                          {carrierSortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[200px] p-1.5 rounded-lg z-[250]" sideOffset={6}>
                        <div className="space-y-0.5">
                          {([
                            { key: 'name' as const, label: 'Name', icon: <ArrowUpDown className="w-3.5 h-3.5" /> },
                            { key: 'transit' as const, label: 'Transit', icon: <Clock className="w-3.5 h-3.5" /> },
                            { key: 'mode' as const, label: 'Mode', icon: <Truck className="w-3.5 h-3.5" /> },
                          ]).map((opt) => {
                            const isActive = carrierSortBy === opt.key;
                            return (
                              <button
                                key={opt.key}
                                onClick={() => {
                                  if (isActive) {
                                    setCarrierSortDir((d) => d === 'asc' ? 'desc' : 'asc');
                                  } else {
                                    setCarrierSortBy(opt.key);
                                    setCarrierSortDir('asc');
                                  }
                                  setCarrierSortOpen(false);
                                }}
                                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] transition-all ${
                                  isActive ? 'bg-blue-50 text-primary' : 'text-muted-foreground hover:bg-slate-50 hover:text-foreground'
                                }`}
                                style={{ fontWeight: isActive ? 600 : 500 }}
                              >
                                <span className={isActive ? 'text-primary' : 'text-slate-400'}>{opt.icon}</span>
                                <span className="flex-1 text-left">{opt.label}</span>
                                {isActive && (
                                  carrierSortDir === 'asc'
                                    ? <ArrowUp className="w-3 h-3 text-primary" />
                                    : <ArrowDown className="w-3 h-3 text-primary" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      onClick={() => { toast.info('Add new carriers from the partner profile.'); }}
                      className="bg-primary text-primary-foreground shrink-0 h-8 px-3 text-[12px]"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Create New
                    </Button>
                  </div>
                </div>

                <div className="flex items-center overflow-x-auto">
                  <FilterPills
                    options={[
                      { key: 'all', label: 'All', count: CARRIER_CATALOGUE.length, showCount: true },
                      { key: 'active', label: 'Active', count: CARRIER_CATALOGUE.filter((c) => c.status === 'Active').length, showCount: true },
                      { key: 'under_review', label: 'Under Review', count: CARRIER_CATALOGUE.filter((c) => c.status === 'Under Review').length, showCount: true },
                      { key: 'vendor', label: 'Vendor Default', count: CARRIER_CATALOGUE.filter((c) => c.id === vendorDefaultCarrierId).length, showCount: true },
                    ]}
                    activeKey={carrierStatusFilter}
                    onSelect={(k) => setCarrierStatusFilter(k)}
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                {filteredCarriers.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-12 h-12 rounded-lg bg-muted border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3">
                      <Search className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-[13px] text-muted-foreground" style={{ fontWeight: 600 }}>No carriers found</p>
                    <p className="text-[12px] text-slate-400 mt-1">Try adjusting your search or filter</p>
                  </div>
                ) : (
                  <div className="@container/carriergrid">
                  <div className="grid grid-cols-1 @[400px]/carriergrid:grid-cols-2 @[750px]/carriergrid:grid-cols-3 auto-rows-fr gap-4">
                    {filteredCarriers.map((carrier) => {
                      const isSelected = carrierDraftId === carrier.id;
                      const applyCarrier = (c: typeof carrier) => {
                        setCarrierDraftId(c.id);
                        setCarrierModalOpen(false);
                        if (c.id !== selectedCarrier?.id) setCarrierConfirmOpen(true);
                      };
                      return (
                        <CarrierCard
                          key={carrier.id}
                          carrier={carrier}
                          isSelected={isSelected}
                          onClick={() => applyCarrier(carrier)}
                          onApply={(c) => applyCarrier(c)}
                          searchText={carrierSearch}
                          showStatusBadge
                          isVendorDefault={carrier.id === vendorDefaultCarrierId}
                        />
                      );
                    })}
                  </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Carrier scope confirmation — same two-option pattern as the
          payment-terms dialog (this invoice only vs vendor going forward),
          themed amber to match the Freight & Logistics section. */}
      <AlertDialog open={carrierConfirmOpen} onOpenChange={setCarrierConfirmOpen}>
        <AlertDialogContent
          className="flex flex-col p-0 gap-0 border-0 sm:border !max-w-[600px] !w-[600px] !rounded-2xl overflow-hidden shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 230 }}
          onInteractOutside={() => setCarrierConfirmOpen(false)}
        >
          <AlertDialogHeader className="sr-only">
            <AlertDialogTitle>Update Carrier</AlertDialogTitle>
            <AlertDialogDescription>Choose how broadly this carrier update should apply.</AlertDialogDescription>
          </AlertDialogHeader>

          {/* Glow header */}
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: 'linear-gradient(180deg, #FFFBEB 0%, rgba(255,251,235,0.3) 70%, transparent 100%)' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: '#F59E0B' }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
              <Truck className="w-8 h-8" style={{ color: '#B45309' }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: '#FFFBEB', color: '#92400E',  }}
            >
              Update Carrier
            </span>
          </div>

          {/* Body */}
          {(() => {
            const carrierVendorName = vendorData?.vendorName || standaloneVendor?.vendorName || 'this vendor';
            return (
              <div className="flex flex-col items-center text-center px-7 pb-7">
                <h2 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  Update carrier for {carrierVendorName}?
                </h2>
                <p className="text-[13px] mt-2 max-w-[420px] leading-[1.65]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Choose how broadly this update should apply.
                </p>

                {/* What you're updating — prev → next diff. */}
                <div className="w-full mt-5 rounded-xl border px-4 py-3 text-left" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
                  <p className="text-[10px] mb-2" style={{ fontWeight: 600, color: '#92400E' }}>What You're Updating</p>
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>Carrier</span>
                      <span className="text-[11px] text-slate-600 inline-flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-slate-500 line-through">{selectedCarrier?.name ?? ', '}</span>
                        <span className="text-slate-400">→</span>
                        <span style={{ color: '#B45309', fontWeight: 600 }}>{draftCarrier?.name ?? ', '}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Option cards + Cancel */}
                <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
                  {/* Option 1, Apply for this invoice only. */}
                  <button
                    type="button"
                    onClick={() => {
                      if (carrierDraftId) setSelectedCarrierId(carrierDraftId);
                      setCarrierConfirmOpen(false);
                    }}
                    className="w-full text-left rounded-xl border border-border bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)] transition-all cursor-pointer p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-slate-100 text-slate-600">
                        <Check className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          Apply for This Invoice Only
                        </p>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-[11px] text-slate-600 truncate">
                              Only this invoice uses the new carrier.
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-[11px] text-slate-600 truncate">
                              Vendor profile stays unchanged.
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRightIcon className="w-4 h-4 text-slate-400 shrink-0 mt-2" />
                    </div>
                  </button>

                  {/* Option 2, Apply for vendor going forward. */}
                  <button
                    type="button"
                    onClick={() => {
                      if (carrierDraftId) setSelectedCarrierId(carrierDraftId);
                      setCarrierConfirmOpen(false);
                    }}
                    className="w-full text-left rounded-xl border border-amber-100 hover:bg-amber-100/60 transition-colors cursor-pointer p-4"
                    style={{ backgroundColor: '#FFFBEB' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 text-white shadow-[0_1px_4px_rgba(217,119,6,0.25)]" style={{ backgroundColor: '#D97706' }}>
                        <Zap className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px]" style={{ fontWeight: 600, color: '#B45309' }}>
                            Apply for {carrierVendorName} going forward
                          </p>
                          <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] border bg-white" style={{ fontWeight: 600, color: '#B45309', borderColor: '#FDE68A' }}>
                            Vendor Default
                          </span>
                        </div>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-[11px] text-slate-700 truncate">
                              Sets the vendor's default carrier.
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-[11px] text-slate-700 truncate">
                              Future invoices use it automatically.
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRightIcon className="w-4 h-4 shrink-0 mt-2" style={{ color: '#B45309' }} />
                    </div>
                  </button>

                  {/* Cancel — full-width muted button. */}
                  <button
                    onClick={() => setCarrierConfirmOpen(false)}
                    className="w-full h-10 text-[13px] rounded-xl border-0 cursor-pointer transition-colors mt-1"
                    style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* A/P Configuration Modal */}
      {apConfigModalOpen && (() => {
        const filteredAPAccounts = AP_ACCOUNTS.filter(a =>
          a.toLowerCase().includes(apModalSearch.toLowerCase())
        );

        // Group A/P accounts by sub-category
        const apGrouped: Record<string, string[]> = {};
        filteredAPAccounts.forEach(account => {
          const code = parseInt(account.split(' ')[0]);
          let category = 'Other Liabilities';
          if (code >= 2000 && code < 2100) category = 'Accounts Payable';
          else if (code >= 2100 && code < 2200) category = 'Accrued Liabilities';
          else if (code >= 2200 && code < 2600) category = 'Other Current Liabilities';
          else if (code >= 2500) category = 'Tax Liabilities';
          if (!apGrouped[category]) apGrouped[category] = [];
          apGrouped[category].push(account);
        });

        const vendorCategory = standaloneVendor?.vendorCategory || vendorData?.category || '';
        const defaultAP = VENDOR_AP_MAPPING[vendorCategory] || VENDOR_AP_MAPPING['default'];

        return (
          <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => setApConfigModalOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="px-5 py-4 border-b border-[#EEF2F6] flex items-center justify-between gap-3 bg-[#FAFBFC]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[14px] text-foreground leading-tight" style={{ fontWeight: 600 }}>A/P Account</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5" style={{ fontWeight: 400 }}>Pick the accounts-payable account to credit on this invoice.</p>
                  </div>
                </div>
                <button
                  onClick={() => setApConfigModalOpen(false)}
                  className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-foreground hover:bg-slate-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Vendor default banner — only when overridden, so the
                  clean state stays calm */}
              {apAccount !== defaultAP && (
                <div className="px-5 py-2.5 border-b border-amber-200 bg-amber-50/70 flex items-center gap-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="text-[11px] text-amber-900 flex-1" style={{ fontWeight: 500 }}>
                    Currently overriding the vendor default.{' '}
                    <button
                      type="button"
                      onClick={() => setApAccount(defaultAP)}
                      className="text-[11px] text-amber-900 underline decoration-amber-700/70 underline-offset-2 hover:decoration-amber-900 transition-colors"
                      style={{ fontWeight: 600 }}
                    >
                      reset to {defaultAP}
                    </button>
                  </span>
                </div>
              )}

              {/* Search */}
              <div className="px-5 py-3 border-b border-[#EEF2F6]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={apModalSearch}
                    onChange={(e) => setApModalSearch(e.target.value)}
                    placeholder="Search by code or name…"
                    className="h-10 pl-9 bg-white border-slate-200 text-[12px] text-foreground placeholder:text-slate-400 shadow-none rounded-lg focus:border-primary focus-visible:ring-1 focus-visible:ring-primary/20"
                    style={{ fontWeight: 500 }}
                    autoFocus
                  />
                </div>
              </div>

              {/* Account list */}
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredAPAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Search className="w-5 h-5 mb-2" />
                    <span className="text-[12px]" style={{ fontWeight: 500 }}>No accounts match your search.</span>
                  </div>
                ) : (
                  Object.entries(apGrouped).map(([category, accounts]) => (
                    <div key={category}>
                      <div className="px-5 py-2 sticky top-0 bg-white border-b border-slate-100 z-10">
                        <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{category}</span>
                      </div>
                      <div className="px-3 py-1.5">
                        {accounts.map((account) => {
                          const isSelected = apAccount === account;
                          const isDefault = account === defaultAP;
                          const code = account.split(' ')[0];
                          const name = account.substring(code.length + 1);
                          return (
                            <button
                              key={account}
                              onClick={() => {
                                setApAccount(account);
                                setApConfigModalOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left transition-colors ${
                                isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <span className={`text-[12px] shrink-0 ${isSelected ? 'text-primary' : 'text-slate-500'}`} style={{ fontWeight: 600 }}>
                                {highlightMatch(code, apModalSearch)}
                              </span>
                              <span className={`text-[12px] truncate flex-1 ${isSelected ? 'text-primary' : 'text-foreground'}`} style={{ fontWeight: 500 }}>
                                {highlightMatch(name, apModalSearch)}
                              </span>
                              {isDefault && !isSelected && (
                                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded shrink-0" style={{ fontWeight: 600 }}>Default</span>
                              )}
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-[#EEF2F6] bg-slate-50/40 flex items-center justify-between">
                <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                  {filteredAPAccounts.length} account{filteredAPAccounts.length !== 1 ? 's' : ''}
                </span>
                <Button
                  size="sm"
                  onClick={() => setApConfigModalOpen(false)}
                  className="h-8 px-4 text-[12px] bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow-sm"
                  style={{ fontWeight: 600 }}
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Freight GL Account modal removed — freight capitalises into
          inventory and no longer maps to its own GL account. */}

      {/* Per-charge GL Account modal removed — additional charges
          capitalise into inventory and no longer map to their own GL. */}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </div>,
    document.body,
  );
}

function AddItemFromPOModal({
  isOpen, 
  onClose, 
  poData, 
  currentItems, 
  onAdd 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  poData: VendorPO | null; 
  currentItems: MockLineItem[]; 
  onAdd: (items: MockLineItem[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const currentItemIds = new Set(currentItems.map(i => i.id));
  
  const availableItems = poData?.items.filter(item => !currentItemIds.has(item.id)) || [];

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleAdd = () => {
    const itemsToAdd = availableItems.filter(i => selectedIds.has(i.id));
    onAdd(itemsToAdd);
    setSelectedIds(new Set());
  };

  if (!isOpen || !poData) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 border border-border/60">
        <div className="px-8 py-6 border-b border-border/60 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-[16px] font-semibold text-foreground tracking-tighter">Add items from {poData.poNumber}</h3>
            <p className="text-[11px] text-muted-foreground font-bold mt-1 tracking-widest">{availableItems.length} available line items</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-all">
            <X className="w-5 h-5 text-muted-foreground/70" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {availableItems.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-muted/40 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-border">
                <Package className="w-8 h-8 text-gray-200" />
              </div>
              <p className="text-[12px] font-semibold text-muted-foreground/70 tracking-widest">All PO items are currently active</p>
              <p className="text-[10px] text-muted-foreground/70 mt-2">No additional items were found for this purchase order.</p>
            </div>
          ) : (
            <div className="border border-border/60 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-white border-b border-border/60 text-[10px] font-semibold text-muted-foreground/70 tracking-widest">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">
                      <Checkbox 
                        checked={selectedIds.size === availableItems.length}
                        onCheckedChange={() => {
                          if (selectedIds.size === availableItems.length) setSelectedIds(new Set());
                          else setSelectedIds(new Set(availableItems.map(i => i.id)));
                        }}
                      />
                    </th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3 text-right">Price per Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {availableItems.map((item) => (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-gray-50/50 cursor-pointer transition-colors ${selectedIds.has(item.id) ? 'bg-blue-50/30' : ''}`}
                      onClick={() => toggleSelection(item.id)}
                    >
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelection(item.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12px] font-bold text-foreground leading-tight">{item.description}</p>
                        <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5 tracking-tighter">{item.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[12px] font-semibold text-foreground">{item.quantity} {item.uom}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[12px] font-bold text-muted-foreground">{formatMoney(item.unitPrice, poData?.currency)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-8 py-6 border-t border-border/60 bg-gray-50/50 flex items-center justify-between">
          <div className="text-[11px] font-bold text-muted-foreground/70 tracking-wider">
            {selectedIds.size} ITEMS SELECTED
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="h-10 px-6 font-semibold text-[11px] tracking-widest border-border">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedIds.size === 0) {
                  toast.error('Nothing selected', { description: 'Pick at least one item to add.' });
                  return;
                }
                handleAdd();
              }}
              className="h-10 px-8 font-semibold text-[11px] tracking-widest bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              Add Items
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
