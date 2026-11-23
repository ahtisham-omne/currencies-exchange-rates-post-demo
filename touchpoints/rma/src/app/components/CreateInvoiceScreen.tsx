import { TrackingTag } from '@/app/components/rma/TrackingTag';
import React, { useState, useMemo, useEffect, useRef, useCallback, type ChangeEvent, type CSSProperties } from 'react';
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
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  ReceiptText,
  Package,
  Wallet,
  Landmark,
  Banknote,
  Plus,
  AlertTriangle,
  AlertCircle,
  Clock,
  ExternalLink,
  RotateCcw,
  Truck,
  DollarSign,
  ListChecks,
  Lock,
  Edit3,
  Trash2,
  Search,
  SendHorizontal,
  Users,
  ArrowRight,
  Building2,
  Settings2,
  MapPin,
  Phone,
  GitMerge,
  Layers,
  Hash,
  CreditCard,
  CalendarClock,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Star,
  Receipt,
  SquareSplitHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Tag,
  Zap,
  Scale,
  ArrowLeftRight,
  Minus,
  ScanLine,
  ChevronRight as ChevronRightIcon
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { DatePicker } from '@/app/components/ui/date-picker';
import { Label } from '@/app/components/ui/label';
import { CreateLineAttachments, type LineAttachmentFile } from '@/app/components/rma/CreateLineAttachments';
import { Textarea } from '@/app/components/ui/textarea';
import { ExpandableTextarea } from '@/app/components/ExpandableTextarea';
import { PAYMENT_TERM_PRESETS, findPresetByLabel, findPresetById, daysForPreset } from '@/app/data/paymentTermPresets';
import type { PaymentTermCategory } from '@/app/data/paymentTermPresets';
import { FilterPills } from '@/app/components/vendors/FilterPills';
import { PaymentTermCard } from '@/app/components/vendors/PaymentTermCard';
import { PaymentTermsBrowseModal } from '@/app/components/vendors/PaymentTermsBrowseModal';
import { RestockingFeeScopeModal } from '@/app/components/rma/RestockingFeeScopeModal';
import { useRMAContext } from '@/app/rma-context';
import {
  AdditionalChargesPanel,
  type AdditionalCharge,
} from '@/app/components/vendors/AdditionalChargesPanel';
import { SearchableUserPicker } from '@/app/components/vendors/SearchableUserPicker';
import { GLAccountConfigModal } from '@/app/components/GLAccountConfigModal';
import { CarrierCard } from '@/app/components/CarrierCard';
import { CarrierBrowseModal } from '@/app/components/CarrierBrowseModal';
import {
  GL_ACCOUNTS,
  groupGLAccounts,
  DEFAULT_FREIGHT_GL_ACCOUNT,
  DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT,
  AP_ACCOUNTS,
  VENDOR_AP_MAPPING,
  formatGLAccount,
} from '@/app/data/glAccounts';
import { PAY_FROM_ACCOUNTS, PAY_TO_ACCOUNTS, accountBalanceLabel } from '@/app/data/mockPayments';
import { PayFromAccountModal } from '@/app/components/payments/PayFromAccountModal';
import {
  addReceiptLineToSplit,
  emptySplit,
  paidQtyForReceiptLine,
  type LineInvoiceSplit,
} from '@/app/data/receiptInvoiceStatus';
import { InvoiceStatusChip } from '@/app/components/InvoiceStatusChip';
import { ReturnAllocationControl } from '@/app/components/ReturnAllocationControl';
import { ReturnUnitsCard, type DocChip } from '@/app/components/ReturnUnitsCard';
import { ReturnUnitsByReceipt, type ReturnReceiptRow } from '@/app/components/ReturnUnitsByReceipt';
import { ReturnLegItems, type LegItem } from '@/app/components/ReturnLegItems';
import {
  allocationTotal,
  autoAllocate,
  BUCKET_CHIP,
  BUCKET_LABELS,
  bucketCount,
  bucketDefaultReturnType,
  bucketReturnTypeOptions,
  RETURN_BUCKETS,
  type ReturnAllocation,
  type ReturnBucket,
} from '@/app/data/rmaReturnAllocation';
import {
  receiptInvoiceSlices,
  SLICE_STATE_LABELS,
  type ReceiptInvoiceSlice as ReturnSlice,
  type ReceiptLine,
  type SliceState,
} from '@/app/data/receiptInvoices';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { SelectedPOData, VendorSelectionModalNested } from '@/app/components/VendorSelectionModalNested';
import { formatQty } from '@/app/components/vendorSelectionModel';
import { TRACKING_CHIP, TRACKING_LABELS, receiversFor, receivedSince, returnableItems, vendorsForItem,
  lotUnitPool,
  unitStatesFor,
  lotBlocksFor,
  lotVendorFor,
  stockSplit,
  untracedStockFor,
} from '@/app/data/itemProvenance';
import { ItemDescriptionWithToggle } from '@/app/components/VendorSelectionItemCell';
import { resolveFromReceipts, resolveFromSerials, serialPoolForVendor,
  serialOrigins,
} from '@/app/data/rmaVendorResolution';
import type { ResolutionLine } from '@/app/components/rma/VendorResolutionCard';
import { ItemSearchModal } from '@/app/components/rma/ItemSearchModal';
import { InlineItemSearch } from '@/app/components/rma/InlineItemSearch';
import { ReturnSelectItemsStep } from '@/app/components/rma/ReturnSelectItemsStep';
import { ReturnConfigureItems, type DeliveryRow, type RailLine } from '@/app/components/rma/ReturnConfigureItems';
import { InlineVendorSearch, VendorItemsSheet } from '@/app/components/rma/InlineVendorSearch';
import { ReturnVendorCard } from '@/app/components/rma/ReturnVendorCard';
import {
  ReturnResolvePane,
  type ResolveRailItem,
} from '@/app/components/rma/ReturnResolvePane';
import { ReturnSerialResolve } from '@/app/components/rma/ReturnSerialResolve';
import { ReturnItemCard, type AddableVendor, type VendorRow } from '@/app/components/rma/ReturnItemCard';
import { ReturnVendorGroupCard } from '@/app/components/rma/ReturnVendorGroupCard';
import { ReturnSummaryPanel } from '@/app/components/rma/ReturnSummaryPanel';
import {
  ReturnGroupingPanel,
  mergeableFamilies,
  rmaCountFor,
  type SplitMode,
} from '@/app/components/rma/ReturnGroupingPanel';
import { ReturnFamilyMergeModal } from '@/app/components/rma/ReturnFamilyMergeModal';
import { ReturnVendorSplitList } from '@/app/components/rma/ReturnVendorSplitList';
import { ReturnVendorStep } from '@/app/components/rma/ReturnVendorStep';
import { ReturnResolutionStep } from '@/app/components/rma/ReturnResolutionStep';
import { ReturnPartnerStep } from '@/app/components/rma/VendorItemsModal';
import { ReturnResolveItemCard, VendorPicker } from '@/app/components/rma/ReturnResolveItemCard';
import { ReturnSourceChecklist, type ChecklistSource } from '@/app/components/rma/ReturnSourceChecklist';
import { selectionFromItems, selectionFromVendorItems } from '@/app/components/rma/itemSelectionBridge';
import { itemsForVendor } from '@/app/data/itemProvenance';
import { StandaloneVendorData } from '@/app/components/StandaloneVendorSelectionModal';
import { mockVendors, vendorDescription, LineItem as MockLineItem, VendorPO, VendorGRN,
  vendorAddress,
} from '@/app/data/mockVendors';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Popover as IssuesPopover,
  PopoverContent as IssuesPopoverContent,
  PopoverTrigger as IssuesPopoverTrigger,
} from '@/app/components/ui/popover';
import { RETURN_REASONS, availableSerials, returnShipToOptions, returnsContactFor, trackingModeFor, type RMALineSettlement, type RMALotAllocation, type RMAReturnLeg, type ReturnReason, type ReturnRouting, type ReturnType,
  isLotMode,
  hasSerials,
} from '@/app/data/mockRMAs';
import { accrualWarning, defaultReturnType, returnTypeOptions } from '@/app/data/rmaReturnTypeRules';
import { ShipToPicker, ShipToSelectionModal } from '@/app/components/ShipToSelectionModal';
import { SerialSelectionModal } from '@/app/components/SerialSelectionModal';
import {
  ReturnSerialVendors,
} from '@/app/components/rma/ReturnSerialVendors';
import { LotSelectionModal } from '@/app/components/LotSelectionModal';
import { SerialQtyCell } from '@/app/components/SerialQtyCell';
import { partnerForItem, type PartnerLocationItem } from '@/app/data/partnerLocations';
import { getVendorDefaultExpenseAccount, setVendorDefaultExpenseAccount } from '@/app/lib/vendorDefaults';
import { toast } from 'sonner';
import { otherCurrencyReason, poCurrency, poKey, receiptCurrency, receiptPO } from '@/app/currency/returnCurrency';
import { Invoice, mockInvoices } from '@/app/data/mockInvoices';

import { ImageWithFallback } from './figma/ImageWithFallback';
import { possessive } from '@/app/lib/possessive';

/** A draft the return will be saved as: one vendor's paperwork, and the items
 *  going back on it. A merged family's lines all sit on the branch that took
 *  them, each still naming the branch it came from. */
export interface VendorDraft {
  vendorCode: string;
  vendorName: string;
  lines: {
    sku: string;
    qty: number;
    uom: string;
    fromVendorCode: string;
    fromVendorName: string;
    /** Which of the vendor's deliveries this line's credit unwinds. */
    ties?: { grnNumber: string; qty: number }[];
    /** Tied to nothing on purpose: a floating credit, applied by hand. */
    untied?: boolean;
    /** This vendor's units, on a serialized line. The line's whole list would
     *  put every serial on every draft, so each vendor's record would claim
     *  units another vendor is crediting. */
    serials?: string[];
  }[];
}

interface CreateInvoiceScreenProps {
  onClose: () => void;
  /** Step back to the previous screen (item picker / vendor select).
   *  Distinct from onClose, which dismisses the whole flow. */
  onGoBack?: () => void;
  invoiceType?: 'draft' | 'receiving' | 'po' | 'standalone' | null;
  selectedPOsData?: SelectedPOData[];
  standaloneVendor?: StandaloneVendorData | null;
  onInvoicesCreated?: (
    invoices: Invoice[],
    meta?: {
      lineReasons?: Record<string, string>;
      lineReturnTypes?: Record<string, string>;
      /** Each RMA's resolution, keyed by the vendor that raises it. One RMA is
       *  one vendor, so this is Eli's "once per RMA" with more than one
       *  document in play. The header and every line of that draft take it. */
      resolutionsByVendor?: Record<
        string,
        {
          returnType: ReturnType | null;
          reason: ReturnReason | null;
          note: string;
          /** Money back, or a credit on the account. */
          settlement?: 'Refund' | 'Credit';
          /** Evidence for the document, which joins whatever the header
           *  already carries on the Attachments tab. */
          attachments?: { name: string }[];
          /** Words to find the return by. */
          tags?: string[];
          /** What the vendor keeps back out of the refund. */
          charges?: AdditionalCharge[];
          /** Why each part is going back, keyed by SKU, as step 4 asked it. */
          reasons?: Record<string, ReturnReason>;
          /** What Other means, for the parts that say Other. */
          reasonNotes?: Record<string, string>;
          /** Units counted as paid on the last step, keyed `sku|uom`. */
          paidQtyByItem?: Record<string, number>;
          /** The vendor's own number for this return, from the last step. */
          vendorRMANumber?: string;
          /** The date the vendor said the refund would arrive by. */
          refundExpectedDate?: string;
        }
      >;
      shippingInstruction?: string;
      returnShipTo?: string;
      /** Partner who owns the ship-to address. Can differ from the RMA's
       *  vendor when that vendor routes returns to another party's site. */
      returnShipToPartner?: string;
      returnRouting?: ReturnRouting;
      returnLegs?: RMAReturnLeg[];
      /** One entry per draft the second step decided on, with the vendor that
       *  raises it and the items it carries. Present on a return; the legs are
       *  what the flow falls back to without it. */
      vendorDrafts?: VendorDraft[];
      /** The orders and receipts this screen is actually working from. The
       *  by-item route builds them here rather than being handed them, so the
       *  caller's own copy is empty and every draft it wrote came out with no
       *  lines on it at all. */
      selectedPOs?: SelectedPOData[];
      /** Carrier picked in the freight card, so the return carries the same
       *  one the user confirmed here rather than resolving it again later. */
      carrier?: string;
      lineSerials?: Record<string, string[]>;
      /** Per-invoice-state breakdown for lines whose goods sat in more than one
       *  state. The line's own reason, type and price are the headline answer;
       *  these carry the rest so the record can show how each slice settles. */
      lineSettlements?: Record<string, RMALineSettlement[]>;
      /** Which batches each lot-tracked line is returning. */
      lineLots?: Record<string, RMALotAllocation[]>;
      /** What the user actually typed on each line. Without these the record
       *  would have to guess a return quantity and re-read the PO price,
       *  losing every correction made in the modal. */
      lineQuantities?: Record<string, number>;
      lineUnitPrices?: Record<string, number>;
      lineOriginalPrices?: Record<string, number>;
      lineNotes?: Record<string, string>;
      lineAttachments?: Record<string, { name: string }[]>;
      /** Every row the grid actually rendered, with the quantity it showed as
       *  received. A PO item with no receipt selected has no row here, and the
       *  received figure is summed across receipts rather than read off the PO. */
      lineReceivedQty?: Record<string, number>;
      /** Return-level fields collected on the header. The invoice payload has
       *  nowhere to put them, so they travel here or they are lost. */
      vendorRMANumber?: string;
      expectedResolutionDate?: string;
      headerAttachments?: { name: string }[];
      payToAccountId?: string;
    },
  ) => void;
  /** Edit-and-resubmit mode — the rejected invoice being fixed. Prefills
   *  the form, shows the rejection banner, and swaps the title + CTA to
   *  Resubmit (feedback 7/15/26). */
  resubmitInvoice?: Invoice | null;
  /** Rejection reason surfaced in the banner strip. */
  resubmitReason?: string;
  /** 'ap' = vendor invoice (Dr expense/inventory, Cr A/P); 'ar' =
   *  customer invoice (Dr A/R, Cr revenue). Flips the GL preview
   *  in the submit confirmation (7/20/26). */
  ledger?: 'ap' | 'ar';
  /** Which surface is using the modal. Defaults to 'invoice'. When
   *  'rma', the shared shell reads the RMA label bundle and hides
   *  invoice-only accordion sections (Payment Terms, Additional
   *  Charges, GL Impact, Freight & Logistics) so only the RMA-
   *  relevant fields remain. Every layout / component / interaction
   *  stays identical to the invoice flow. */
  mode?: 'invoice' | 'rma';
  /** Which way into the return the user came. Starting from the item, adding
   *  more means finding another part, not another vendor's order, so the
   *  add-more picker has to match the one they started in. */
  startMode?: 'item' | 'vendor';
  /** The by-vendor route names the partner before anything is picked, so every
   *  counted line arrives already answered. Null on the by-item route, where
   *  the vendor is the thing being decided. */
  lockedVendor?: string | null;
}

// The steps a return is built in. Eight, counting Start.
/** The eight-step stepper agreed on Sept 11 with Rida, less the start modal,
 *  which is a pre-step rather than a tab.
 *
 *  One question per step, and they stay apart: what is on the return, how much
 *  of it, which units, who takes it back, what the credit unwinds, how it is
 *  grouped and shipped, and how it settles. Steps 2 and 3 are the same rail
 *  read twice -- once to say what is coming back, once to say how much -- and
 *  that is the point: nothing is answered before it is asked.
 *
 *  `lines` keeps its old name, and means the quantity step, so the render
 *  gates already pointing at it do not move. `routing` likewise is the merge
 *  and split step. */
type RmaStepKey =
  | 'partner'
  | 'lines'
  | 'units'
  | 'vendor'
  | 'receivers'
  | 'routing'
  | 'resolution';

/** Steps the line panel answers. It holds all four and the step picks one. */
const CONFIGURE_STEPS: RmaStepKey[] = ['lines', 'units', 'vendor', 'receivers'];

/** Steps whose panel has not been re-hosted yet. They render a stub and never
 *  block Continue, so the shell can be walked before its contents move.
 *  Empty: every step answers something now. */
const STUB_STEPS: RmaStepKey[] = [];

const STUB_COPY: Partial<Record<RmaStepKey, string>> = {
  units: 'Naming the units going back, and picking lots for lot-tracked stock.',
  vendor: 'Choosing who plain stock goes back to, bounded by the vendors who actually shipped it.',
  receivers: 'Tying the credit to the receiving documents it unwinds.',
};

/** How the resolving step answers a line.
 *
 *  `checklist` is the cycle count planner's Configure step, ported: one list
 *  of the deliveries the units came off, the vendor read from whichever are
 *  ticked. `two-column` is the sheet it replaced, kept whole so the previous
 *  design can be put back by changing this word. The components for both are
 *  on disk; see .snapshots/step2-two-column-2026-09-10/README.md. */
const STEP2: 'checklist' | 'two-column' = 'checklist';

/** How the first step finds a part.
 *
 *  `configure` is the planner's real second step, Configure Items, brought
 *  over whole: the add card with its search dropdown, then the rail and the
 *  delivery table beside it. It answers on one screen what this flow asked
 *  across two.
 *
 *  `catalogue` was built from omne-frontend's port of that step, which had
 *  split it in three and revived a Select Items step the original never
 *  renders. `search` is the field-first step before either. All three are on
 *  disk. */
const STEP1: 'configure' | 'catalogue' | 'search' = 'configure';


// Copy bundle keyed by mode so every visible string flows through one
// map. The RMA variant repurposes the invoice modal without a rewrite —
// the layout, sections, and controls are unchanged; the labels swap.
const MODE_COPY = {
  invoice: {
    createTitle: 'Create Vendor Invoice',
    createStandaloneTitle: 'Create Standalone Vendor Invoice',
    editResubmitTitle: 'Edit and Resubmit Invoice',
    createSubtitle:
      'Review the items pulled from the selected POs and Receivings, fill in invoice details, then submit for approval.',
    createStandaloneSubtitle:
      'Capture a vendor invoice manually. Add line items, fill in invoice details, and submit for approval.',
    editResubmitSubtitle:
      'Fix the flagged issues below, then resubmit the invoice for approval.',
    detailsSection: 'Invoice Details',
    detailsIdLabel: 'Invoice ID',
    vendorDocLabel: 'Vendor Invoice Number',
    vendorDocDateLabel: 'Vendor Invoice Date',
    vendorDocDatePlaceholder: 'Select invoice date',
    vendorDocDateHint: 'Document date from the vendor invoice.',
    lineItemsSection: 'Invoice Line Items',
    qtyColumn: 'Invoice Qty',
    totalLabel: 'Total Due',
    submitLabel: 'Submit for approval',
    resubmitLabel: 'Resubmit',
    blockedTitle: 'Cannot submit invoice',
    docNoun: 'invoice',
    alreadyQtyLabel: 'Already invoiced:',
    discardTitle: 'Discard invoice creation?',
    discardBody:
      'The invoice details you’ve entered and your item selection will be discarded, and you’ll return to the item picker. This cannot be undone.',
    removePOBody: 'from this invoice creation',
    attachLabel: 'Attach vendor invoice',
    carrierScopeOne: 'Apply for this invoice only',
    carrierScopeOneHint: 'Only this invoice uses the new carrier.',
    carrierScopeAllHint: 'Future invoices use it automatically.',
    carrierBrowseSubtitle: 'Choose a carrier for this invoice',
    carrierOverriddenNote: 'Overridden for this invoice.',
    logisticsSection: 'Freight & Logistics',
  },
  rma: {
    createTitle: 'Create New RMA',
    createStandaloneTitle: 'Create New RMA',
    editResubmitTitle: 'Edit and Resubmit RMA',
    createSubtitle:
      "Select the received items you're returning to a vendor.",
    createStandaloneSubtitle:
      'Capture a return manually. Add line items, fill in return details, and save as a draft.',
    editResubmitSubtitle:
      'Fix the flagged issues below, then re-save the RMA.',
    detailsSection: 'RMA Details',
    detailsIdLabel: 'RMA ID',
    vendorDocLabel: 'Vendor RMA Number',
    vendorDocDateLabel: 'Expected Resolution Date',
    vendorDocDatePlaceholder: 'Select expected date',
    vendorDocDateHint: 'When you expect this settled, with credit issued or items back.',
    lineItemsSection: 'RMA Line Items',
    qtyColumn: 'Return Qty',
    totalLabel: 'Return Value',
    submitLabel: 'Save as Draft',
    resubmitLabel: 'Re-save',
    blockedTitle: 'Cannot save RMA',
    docNoun: 'RMA',
    alreadyQtyLabel: 'Already returned:',
    discardTitle: 'Discard RMA?',
    discardBody:
      'The return details you’ve entered and your item selection will be discarded, and you’ll return to the item picker. This cannot be undone.',
    removePOBody: 'from this RMA',
    attachLabel: 'Attach return documentation',
    carrierScopeOne: 'Apply for this RMA only',
    carrierScopeOneHint: 'Only this RMA uses the new carrier.',
    carrierScopeAllHint: 'Future returns use it automatically.',
    carrierBrowseSubtitle: 'Choose a carrier for this return',
    carrierOverriddenNote: 'Overridden for this return.',
    logisticsSection: 'Return Logistics',
  },
} as const;

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
  /** Stock with no receiver behind it, attached to a vendor by hand. Nothing
   *  reverses on its own, so the value and the reference are entered rather
   *  than derived. */
  unlinked?: boolean;
  /** Invoice state of the received quantity, summed across the line's
   *  receipts. Absent on a pre-invoice, which has no receipt yet. */
  invoiceSplit?: LineInvoiceSplit;
  /** The receipts behind that split, kept because a return is answered per
   *  invoice and per receiving document, which the summed figures cannot
   *  say. Empty on a pre-invoice. */
  receipts?: ReceiptLine[];
  isPreInvoice: boolean;
  glAccount: string;
  /** The unit price as it came off the PO, before any edit — drives the
   *  price-change indicator and its click-to-revert (review 7/9/26). */
  originalUnitPrice: number;
  // Pre-resolved default GL account so a row can be reverted back to
  // the system suggestion after the user overrode it.
  defaultGlAccount: string;
}

// GL_ACCOUNTS catalogue lives in @/app/data/glAccounts so both the inline
// GLAccountPicker and the new GLAccountConfigModal share one source.

// AP_ACCOUNTS + VENDOR_AP_MAPPING now live in @/app/data/glAccounts so the
// Record Payment A/P GL configuration shares the exact same catalogue + default.

// Exception reasons — an invoice can carry more than one at a time, so the
// Type control is a multi-select (checkboxes).
const EXCEPTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'price-discrepancy', label: 'Price Discrepancy' },
  { value: 'quantity-mismatch', label: 'Quantity Mismatch' },
  { value: 'damaged-goods', label: 'Damaged Goods' },
  { value: 'duplicate-invoice', label: 'Duplicate Invoice' },
  { value: 'incorrect-vendor', label: 'Incorrect Vendor' },
  { value: 'other', label: 'Other' },
];

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
const ITEM_UOMS_QV = ['EA', 'FT', 'PK', 'RL', 'KG', 'LB', 'BOX', 'SET'];
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
/* Invoice state of the whole received line, shown beside the tracking badge on
   a return. It answers what a return of this item would settle as: quantity the
   vendor has not billed yet simply drops off the open balance, while invoiced
   or paid quantity needs a credit note. A line received over several receipts
   can hold more than one state, so the mixed cases carry the split on hover. */
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
  const tail = LONG_DESC_TAILS[prefix] ?? LONG_DESC_TAILS['DEFAULT'] ?? '';
  return baseDescription ? `${baseDescription}, ${tail}` : tail;
}

const ITEMS_MODULE_URL = 'https://nimble-palette.lovable.app';
// Partner master detail — same destination the invoice detail header uses
// (meeting feedback 7/17/26: the vendor field links to the partner master).
const VENDOR_DETAIL_URL = 'https://partner-management-module.lovable.app/vendors/v-001';
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
  size = 'w-8 h-8',
}: {
  sku: string;
  src: string;
  alt: string;
  onPreview: () => void;
  size?: string;
}) {
  return (
    <HoverCard openDelay={300} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className={`${size} rounded-md border border-border bg-slate-50 overflow-hidden shrink-0 cursor-zoom-in hover:border-primary/40 transition-colors group/img`}
        >
          <ImageWithFallback
            src={src}
            alt={alt}
            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300"
          />
        </button>
      </HoverCardTrigger>
      <ItemMetaHoverContent sku={sku} src={src} alt={alt} />
    </HoverCard>
  );
}

/** Master-data card for an item. Shared by the row thumbnail and the
 *  line edit modal's header, which trigger it from different elements. */
function ItemMetaHoverContent({ sku, src, alt }: { sku: string; src: string; alt: string }) {
  const meta = itemMetaFor(sku);
  return (
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
  );
}

// Description with inline "more / Show less" toggle so the row stays
// compact by default but lets the user reveal full mill-cert / spec copy
// on demand. Matches the selection-modal pattern.
// Wrap matched substring with a soft yellow highlight so the user can
// see why each row matched their search.
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-foreground rounded-sm px-0.5" style={{ fontWeight: 600 }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

interface GLAccountPickerProps {
  value: string;
  defaultValue: string;
  onChange: (next: string) => void;
  /** Locked off for now — renders a static, non-interactive chip so the
   *  account is visible but can't be changed. */
  disabled?: boolean;
}
function GLAccountPicker({ value, defaultValue, onChange, disabled = false }: GLAccountPickerProps) {
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
          <div className="flex items-center justify-between w-full h-8 px-2.5 bg-slate-50 text-slate-500 rounded-md border border-slate-200 cursor-not-allowed">
            <span className="truncate min-w-0 flex-1 text-left mr-1 text-[11px] tabular-nums" style={{ fontWeight: 500 }}>
              {value || 'Select GL…'}
            </span>
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
                  className="text-[11px] leading-snug text-foreground hover:text-primary underline decoration-slate-300 hover:decoration-primary underline-offset-2 tabular-nums transition-colors"
                  style={{ fontWeight: 600 }}
                >
                  {value}
                </a>{' '}is locked for editing
              </>
            ) : 'Editing is disabled'}
          </p>
          <p className="text-[11px] text-slate-500 leading-snug mt-0.5">GL accounts are mapped from the item master for inventory invoices. Open the item to change the mapping there.</p>
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center justify-between w-full h-8 px-2.5 bg-white hover:bg-slate-50 hover:border-primary/40 text-foreground rounded-md border border-slate-200 transition-colors group/gl"
        >
          <span className="truncate min-w-0 flex-1 text-left mr-1 text-[11px] tabular-nums" style={{ fontWeight: 500 }}>
            {value || 'Select GL…'}
          </span>
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
                className="[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-slate-500 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:tracking-normal [&_[cmdk-group-heading]]:normal-case"
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
                      <span className={`text-[11px] tabular-nums ${isSelected ? 'text-primary' : 'text-slate-500'}`} style={{ fontWeight: 600 }}>
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
                Reset to default <span className="tabular-nums" style={{ fontWeight: 600 }}>{defaultValue.split(' ')[0]}</span>
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Return Qty cell for a serialized line. On these items the units *are* the
 * quantity, so the number is read-only and the cell opens the serial unit
 * picker instead — a typed qty could otherwise disagree with the units
 * actually chosen, which is what makes a serialized return unreceivable at
 * the vendor.
 */
/**
 * Return-destination choice card. Mirrors the shipment module's "Original Pick
 * Location vs Another Location" option card, applied to a return that spans
 * several vendor sites: the choice comes first, the address second, and the
 * address controls only appear under the option they belong to.
 */
function ReturnRoutingOption({
  active,
  onClick,
  icon: Icon,
  title,
  description,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${active ? '#0A77FF' : '#E2E8F0'}`,
        backgroundColor: active ? '#EFF6FF' : '#FFFFFF',
        transition: 'all 150ms',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-start gap-2.5 text-left cursor-pointer"
        style={{ padding: 12 }}
      >
        <span
          className="rounded-full border shrink-0 flex items-center justify-center"
          style={{
            width: 14,
            height: 14,
            marginTop: 3,
            borderColor: active ? '#0A77FF' : '#CBD5E1',
            backgroundColor: '#FFFFFF',
          }}
        >
          {active && <span className="rounded-full" style={{ width: 6, height: 6, backgroundColor: '#0A77FF' }} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: active ? '#0A77FF' : '#94A3B8' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{title}</span>
          </span>
          <span className="block" style={{ fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 1.4 }}>
            {description}
          </span>
        </span>
      </button>
      {active && children && <div style={{ padding: '0 12px 12px' }}>{children}</div>}
    </div>
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
          Set GL account
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
            <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{count}</span>{' '}
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
                className="[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-slate-500 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:tracking-normal [&_[cmdk-group-heading]]:normal-case"
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
                      <span className="text-[11px] tabular-nums text-slate-500" style={{ fontWeight: 600 }}>
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

// Highlight the line-item search query inside a text snippet — same amber
// mark treatment as the vendor-selection picker so search feedback reads
// identically across the creation flow (design review 7/9/26).
function highlightQuery(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={index} className="bg-amber-100 text-amber-900 rounded-sm px-0.5" style={{ fontWeight: 'inherit' }}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
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
            Show less
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

// The receipts a return line is raised against. One receipt reads inline;
// several collapse to the first plus a "more" that hovers open the full
// list, matching how long descriptions behave in the row above.
function ReceivingCell({
  receipts,
  records,
  uom,
}: {
  receipts: string[];
  records: VendorGRN[];
  uom: string;
}) {
  if (receipts.length === 0) {
    return <span className="text-[11px] text-slate-300" style={{ fontWeight: 500 }}>Not received</span>;
  }
  const first = receipts[0]!;
  const rest = receipts.length - 1;
  const recordFor = (num: string) => records.find((r) => r.grnNumber === num);
  return (
    <div className="flex items-center gap-1 min-w-0">
      {/* Chipped in the module's Receiving-based tint so a receipt number
          reads as the document it is, not as free text. */}
      <span
        className="inline-flex items-center px-2 py-1 rounded-md border border-green-200 bg-green-50 text-[11px] text-green-700 truncate min-w-0"
        style={{ fontWeight: 500 }}
      >
        {first}
      </span>
      {rest > 0 && (
        <HoverCard openDelay={200} closeDelay={120}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-0.5 text-primary hover:text-blue-700 transition-colors shrink-0 text-[11px]"
              style={{ fontWeight: 500 }}
            >
              +{rest} more
              <ChevronDown className="w-3 h-3" />
            </button>
          </HoverCardTrigger>
          <HoverCardContent side="bottom" align="start" className="w-[280px] p-0 overflow-hidden rounded-xl border border-border/60 shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-[300]">
            <div className="px-3.5 py-2.5 bg-emerald-50/60 border-b border-emerald-100">
              <p className="text-[12px] text-emerald-800" style={{ fontWeight: 600 }}>Received on {receipts.length} receiving documents</p>
              <p className="text-[11px] text-emerald-700/70 mt-0.5">This line can be returned against any of them.</p>
            </div>
            <div className="px-3.5 py-2.5 bg-white space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar">
              {receipts.map((num) => {
                const record = recordFor(num);
                return (
                  <div key={num} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] text-slate-800 truncate" style={{ fontWeight: 600 }}>{num}</p>
                      <p className="text-[11px] text-slate-500">
                        {record?.grnDate ? `Received ${record.grnDate}` : 'Receipt date not on file'}
                      </p>
                    </div>
                    {record && (
                      <span className="text-[11px] text-slate-700 tabular-nums shrink-0" style={{ fontWeight: 600 }}>
                        {record.receivedQty} {uom}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </HoverCardContent>
        </HoverCard>
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

/** Tab-group palette for the site-grouped PO strip, taken from the Purchase
 *  Order planner's GROUP_PALETTE: stroke, fill, label, and border per group. */
export function CreateInvoiceScreen({ onClose, onGoBack, invoiceType, selectedPOsData = [], standaloneVendor, onInvoicesCreated, resubmitInvoice, resubmitReason, ledger = 'ap', mode = 'invoice', startMode = 'vendor', lockedVendor: lockedVendorProp = null }: CreateInvoiceScreenProps) {
  /* Who the return settles with, when that was answered before anything was
   * picked. It arrived as a prop from a modal that asked outside the flow; the
   * by-vendor route asks it on a step of its own now, so the answer lives here
   * and can be changed by going back to that step. */
  const [lockedVendor, setLockedVendor] = useState<string | null>(lockedVendorProp);
  const isStandalone = invoiceType === 'standalone';
  const isResubmit = !!resubmitInvoice;
  const isRma = mode === 'rma';
  const copy = MODE_COPY[mode];

  // A/P account + the inventory invoice's per-line GL account are locked off
  // for now (logic + derived values stay intact; users just can't change them
  // yet). The standalone invoice's per-line GL account stays selectable — the
  // user chooses the expense account there. Flip to false to re-enable the
  // inventory/A-P pickers when the feature is wanted.
  const GL_FIELDS_LOCKED = true;
  const [isFullScreen, setIsFullScreen] = useState(false);
  // Additional Charges open as an empty state — no charge is pre-created and
  // nothing is pre-selected. The user adds charges from the list via "Add
  // charge", and every new card starts fully blank (no Tax/GL/amount defaults)
  // so the placeholders carry the meaning until the user fills them in.
  // Freight and additional charges no longer map to their own GL — like
  // freight, charges are capitalised into the inventory value (ASC 330)
  // and roll into the Inventory debit line in GL Impact. So a charge is
  // just a type + amount; no per-charge GL account.
  // description is required when type is "Other" (design review 7/9/26) —
  // a catch-all charge means nothing to approvers without one.
  const [additionalCharges, setAdditionalCharges] = useState<{id: number, type: string, amount: number, description?: string}[]>([]);
  const [chargeDescriptionError, setChargeDescriptionError] = useState(false);

  // RMA-mode only: per-line return reason. Keyed by the create-screen line
  // id so the map survives row add/remove; downstream the last id segment
  // maps back to the original PO line id used by invoiceToRMA().
  const [lineReasons, setLineReasons] = useState<Record<string, string>>({});
  // Why the goods are going back decides which remedies make sense, so a new
  // reason re-picks the type rather than leaving a stale one that the reason
  // no longer allows.
  const setLineReason = (id: string, reason: string, split?: LineInvoiceSplit) => {
    setLineReasons((prev) => ({ ...prev, [id]: reason }));
    setLineReturnTypes((prev) => {
      const next = { ...prev };
      const seeded = defaultReturnType(reason as ReturnReason, split);
      if (seeded) next[id] = seeded;
      else delete next[id];
      return next;
    });
  };

  // RMA-mode only: per-line return type. Same keying convention as
  // lineReasons (create-screen line id → downstream last-segment maps to
  // the original PO line id used by invoiceToRMA).
  const [lineReturnTypes, setLineReturnTypes] = useState<Record<string, string>>({});
  const setLineReturnType = (id: string, returnType: string) =>
    setLineReturnTypes((prev) => ({ ...prev, [id]: returnType }));

  // RMA-mode only: how a line's return quantity divides across the invoice
  // states behind it, and what each of those slices settles as. Only lines the
  // user adjusted appear here; everything else reads the automatic split, so
  // changing the quantity re-derives instead of stranding a stale allocation.
  const [lineAllocations, setLineAllocations] = useState<Record<string, ReturnAllocation>>({});
  // Quantities live at the finest grain the return actually has: one receiving
  // document under one invoice. The bucket allocation above is derived from
  // these, so everything downstream -- prices, payload, the invoice chip --
  // keeps reading the same three figures it always has.
  const [lineSliceAllocations, setLineSliceAllocations] = useState<
    Record<string, Record<string, number>>
  >({});
  // Reason and remedy belong to the invoice, not to the line: one bill gets
  // one answer even when it covers several receipts.
  const [invoiceReasons, setInvoiceReasons] = useState<Record<string, string>>({});
  const [invoiceTypes, setInvoiceTypes] = useState<Record<string, string>>({});
  const BUCKET_OF_SLICE: Record<SliceState, ReturnBucket> = {
    'not-invoiced': 'notInvoiced',
    unpaid: 'invoicedUnpaid',
    paid: 'paid',
  };
  const [lineBucketTypes, setLineBucketTypes] = useState<
    Record<string, Partial<Record<ReturnBucket, string>>>
  >({});

  const allocationFor = (id: string, qty: number, split: LineInvoiceSplit | undefined) => {
    const manual = lineAllocations[id];
    if (manual && RETURN_BUCKETS.every((b) => manual[b] <= (split?.[b] ?? 0) + 0.004)) return manual;
    return autoAllocate(qty, split);
  };
  const setAllocation = (id: string, next: ReturnAllocation) =>
    setLineAllocations((prev) => ({ ...prev, [id]: next }));

  const [lineBucketReasons, setLineBucketReasons] = useState<
    Record<string, Partial<Record<ReturnBucket, string>>>
  >({});
  // A slice can be worth a different unit price to its neighbours: the paid one
  // credits back what the invoice charged, while the unbilled one reverses at
  // the PO price. The line keeps the weighted average of them.
  const [lineBucketPrices, setLineBucketPrices] = useState<
    Record<string, Partial<Record<ReturnBucket, number>>>
  >({});

  const bucketReasonFor = (id: string, bucket: ReturnBucket) =>
    lineBucketReasons[id]?.[bucket] ?? returnReasonFor(id);
  const bucketTypeFor = (id: string, bucket: ReturnBucket, reason: ReturnReason, qty: number) =>
    lineBucketTypes[id]?.[bucket] ?? bucketDefaultReturnType(bucket, reason, qty) ?? '';
  const setBucketType = (id: string, bucket: ReturnBucket, next: string) =>
    setLineBucketTypes((prev) => ({ ...prev, [id]: { ...prev[id], [bucket]: next } }));
  // Same rule as the line-level pair: a new reason re-picks the type, since the
  // old one may be a remedy the new reason doesn't allow.
  const setBucketReason = (id: string, bucket: ReturnBucket, next: string, qty: number) => {
    setLineBucketReasons((prev) => ({ ...prev, [id]: { ...prev[id], [bucket]: next } }));
    setLineBucketTypes((prev) => {
      const forLine = { ...prev[id] };
      const seeded = bucketDefaultReturnType(bucket, next as ReturnReason, qty);
      if (seeded) forLine[bucket] = seeded;
      else delete forLine[bucket];
      return { ...prev, [id]: forLine };
    });
  };

  const bucketPriceFor = (id: string, bucket: ReturnBucket, fallback: number) =>
    lineBucketPrices[id]?.[bucket] ?? fallback;

  /** The line's own price is the average of its slices, weighted by how many
   *  units each one sends back, so the line total stays the sum of them. */
  const applyBucketPrices = (
    id: string,
    prices: Partial<Record<ReturnBucket, number>>,
    allocation: ReturnAllocation,
    fallback: number,
  ) => {
    const qty = allocationTotal(allocation);
    if (qty <= 0) return;
    const value = RETURN_BUCKETS.reduce((sum, b) => sum + allocation[b] * (prices[b] ?? fallback), 0);
    updateLineItem(id, 'unitPrice', String(value / qty));
  };

  const setBucketPrice = (
    id: string,
    bucket: ReturnBucket,
    price: number,
    allocation: ReturnAllocation,
    fallback: number,
  ) => {
    const prices = { ...lineBucketPrices[id], [bucket]: price };
    setLineBucketPrices((prev) => ({ ...prev, [id]: prices }));
    applyBucketPrices(id, prices, allocation, fallback);
  };

  // A serialized split line picks units, not numbers, so each bucket owns a
  // slice of the line's pool cut in bucket order and sized by the invoice
  // split. The picker then works one bucket at a time and the bucket's return
  // quantity is however many of its own units were chosen.
  const [lineBucketSerials, setLineBucketSerials] = useState<Record<string, Partial<Record<ReturnBucket, string[]>>>>({});

  const bucketSerialPool = (
    sku: string,
    lineId: string,
    receivedQty: number,
    split: LineInvoiceSplit,
    bucket: ReturnBucket,
  ) => {
    const pool = availableSerials(sku, lineId, receivedQty);
    let start = 0;
    for (const b of RETURN_BUCKETS) {
      const size = Math.round(split[b]);
      if (b === bucket) return pool.slice(start, start + size);
      start += size;
    }
    return [];
  };

  const bucketSerialsFor = (
    id: string,
    sku: string,
    receivedQty: number,
    split: LineInvoiceSplit,
    bucket: ReturnBucket,
    qty: number,
  ) =>
    lineBucketSerials[id]?.[bucket] ??
    bucketSerialPool(sku, id, receivedQty, split, bucket).slice(0, Math.max(0, qty));

  /** Units chosen from each bucket's own pool, laid end to end in bucket order,
   *  since the line still carries one flat list. */
  const flattenBucketSerials = (
    item: { id: string; sku: string; receivedQty: number },
    split: LineInvoiceSplit,
    byBucket: Partial<Record<ReturnBucket, string[]>>,
    allocation: ReturnAllocation,
  ) =>
    RETURN_BUCKETS.flatMap(
      (b) =>
        byBucket[b] ??
        bucketSerialPool(item.sku, item.id, item.receivedQty, split, b).slice(0, Math.max(0, allocation[b])),
    );

  /** Setting quantities rather than units, on a line whose units are named:
   *  each bucket takes the first however many of its own pool. */
  const syncBucketSerials = (
    item: { id: string; sku: string; receivedQty: number },
    split: LineInvoiceSplit,
    allocation: ReturnAllocation,
  ) => {
    const byBucket = Object.fromEntries(
      RETURN_BUCKETS.map((b) => [
        b,
        bucketSerialPool(item.sku, item.id, item.receivedQty, split, b).slice(0, Math.max(0, allocation[b])),
      ]),
    ) as Partial<Record<ReturnBucket, string[]>>;
    setLineBucketSerials((prev) => ({ ...prev, [item.id]: byBucket }));
    setLineSerials((prev) => ({ ...prev, [item.id]: flattenBucketSerials(item, split, byBucket, allocation) }));
  };

  const setBucketSerials = (
    item: { id: string; sku: string; receivedQty: number; unitPrice: number },
    split: LineInvoiceSplit,
    bucket: ReturnBucket,
    next: string[],
    allocation: ReturnAllocation,
  ) => {
    const byBucket = { ...lineBucketSerials[item.id], [bucket]: next };
    setLineBucketSerials((prev) => ({ ...prev, [item.id]: byBucket }));
    const nextAllocation = { ...allocation, [bucket]: next.length };
    setAllocation(item.id, nextAllocation);
    setLineSerials((prev) => ({
      ...prev,
      [item.id]: flattenBucketSerials(item, split, byBucket, nextAllocation),
    }));
    updateLineItem(item.id, 'invoiceQty', String(allocationTotal(nextAllocation)));
    applyBucketPrices(item.id, lineBucketPrices[item.id] ?? {}, nextAllocation, item.unitPrice);
  };

  // Bucket the units picker is open on, when it was opened from a split line's
  // breakdown rather than from the line itself.
  const [serialModalBucket, setSerialModalBucket] = useState<ReturnBucket | null>(null);

  /** A split line's buckets, biggest slice first, so the record can fall back
   *  to the one covering the most units. */
  const bucketsByShare = (allocation: ReturnAllocation) =>
    [...RETURN_BUCKETS].filter((b) => allocation[b] > 0.004).sort((a, b) => allocation[b] - allocation[a]);

  // How a line settles and why is decided per line: one unit can come back
  // damaged for credit while the next is a wrong part going out for
  // replacement. These read a line's own value and fall back to the opening
  // default only until it is touched.
  const returnReasonFor = (id: string) => lineReasons[id] ?? 'Failed inspection';
  const returnTypeFor = (id: string, split?: LineInvoiceSplit) =>
    lineReturnTypes[id] ?? defaultReturnType(returnReasonFor(id) as ReturnReason, split) ?? '';

  // RMA-mode only: which line the right pane is showing. The lines list is a
  // rail of items and everything about the selected one is edited beside it,
  // so there is one detail surface rather than a field per column.
  const [focusedLineId, setFocusedLineId] = useState<string | null>(null);
  // The line's detail is a modal now, so being focused in the list and being
  // open for editing are two different things. Clicking a row does both; closing
  // the modal leaves the row where it was.
  const [lineDetailOpen, setLineDetailOpen] = useState(false);
  // The first step's own search. It lives here rather than inside the field so
  // the list of lines can stand down while results are on screen: two lists of
  // parts stacked on one step invites picking from the wrong one.
  const [lineSearchQuery, setLineSearchQuery] = useState('');
  // Per-leg state the cart layout needs. A return becomes one RMA per vendor,
  // so the authorisation number the vendor gave belongs to the leg rather than
  // to the return, and each card folds on its own.
  const [collapsedLegs, setCollapsedLegs] = useState<Record<string, boolean>>({});
  const [originRmaNumber, setOriginRmaNumber] = useState<Record<string, string>>({});
  /** Vendors put on the return by hand, before anything has been placed with
   *  them. Splitting a part across two suppliers starts by naming the second. */
  const [extraVendors, setExtraVendors] = useState<string[]>([]);
  /** A serialized part whose units are about to be named. The picker works on a
   *  line -- the unit pool is derived from it -- so the part joins the return
   *  first, at nothing, and the picker opens as soon as its line exists. */
  const [pendingSerialSku, setPendingSerialSku] = useState<string | null>(null);
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});
  /** The vendor whose own sheet is open. A vendor's destination, carrier and
   *  authorisation number belong to them and not to any one part, and with the
   *  parts as the groups a vendor appears in several cards -- so those live in
   *  one sheet per vendor rather than repeated in each card that touches them. */
  /** The vendor whose half of the sheet is showing. Set together with the line,
   *  because the row you press edit on names both. */
  const [vendorSheetCode, setVendorSheetCode] = useState<string | null>(null);

  /** How the return divides into documents. One answer for the whole creation:
   *  splitting is the default because branches are separate vendors and each
   *  settles its own, and merging is a favour the group does the returner. */
  const [splitMode, setSplitMode] = useState<SplitMode>('split');
  /** Which branch of each family takes the group's whole return. */
  const [mergeInto, setMergeInto] = useState<Record<string, string>>({});
  const [mergeOpen, setMergeOpen] = useState(false);

  useEffect(() => {
    if (!lineDetailOpen && !vendorSheetCode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Topmost first: the vendor sheet opens over the step, and the line sheet
      // over that, so Escape closes what the user is actually looking at. It
      // backs out the same way Cancel does, because that is what Escape means
      // everywhere else -- leaving by it and leaving by the button cannot end
      // with different returns.
      if (lineDetailOpen) revertLineSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lineDetailOpen, vendorSheetCode]);

  // Per-line note and supporting documents, keyed by line id. A return is
  // argued line by line, so the evidence sits on the line rather than the
  // document-level Attachments section.
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});
  const [lineAttachments, setLineAttachments] = useState<Record<string, LineAttachmentFile[]>>({});

  // RMA-mode only: the partner or location the goods ship back to, picked
  // from the same catalogue the PO detail page addresses to. Surfaces on the
  // detail page under General Information.
  // Null until the user picks: a return goes back to the address it was
  // received from, which the origin sites already name, so the default is
  // derived rather than stored.
  const [shipTo, setShipTo] = useState<PartnerLocationItem | null>(null);
  const [shipToModalOpen, setShipToModalOpen] = useState(false);

  // RMA-mode only: how a return that spans several vendor sites ships back.
  // 'origin' is the default because that is what the receipts imply; the
  // vendor nominating one address is the exception the toggle exists for.
  // Returning to each site is what the receipts already imply, so it is the
  // starting choice and needs nothing else answered to be valid. Consolidating
  // is the deliberate one, and it cannot proceed until the user names the one
  // address that takes the lot.
  const [returnRouting, setReturnRouting] = useState<ReturnRouting>('origin');
  /** The one address a consolidated return ships to, picked on the merge and
   *  split step. Null leaves it at the vendor's own returns dock. */
  const [consolidatedShipTo, setConsolidatedShipTo] = useState<string | null>(null);
  // Per-site destination, so one site can be redirected without forcing the
  // whole return onto a single address. Keyed by origin id, absent until the
  // user overrides the site's own returns address.
  const [originShipTo, setOriginShipTo] = useState<Record<string, string>>({});
  // Origin whose destination picker is open, or null when it is closed.
  const [originPickerFor, setOriginPickerFor] = useState<string | null>(null);

  // RMA-mode only: which physical units a serialized line is returning. Same
  // keying convention as lineReasons. Absent until the user opens the picker,
  // at which point serialsForLine() falls back to the first `qty` units so the
  // row starts out consistent with the quantity already on it.
  const [lineSerials, setLineSerials] = useState<Record<string, string[]>>({});
  /** Which batches a lot-tracked line is returning, and how much off each.
   *  The lot counterpart of `lineSerials`: same keying, same absence-means-
   *  unanswered rule. Unlike serials there is no sensible fallback -- a batch
   *  nobody picked is not a batch the goods came off. */
  const [lineLots, setLineLots] = useState<Record<string, RMALotAllocation[]>>({});
  /** The line about to be cut to what the vendor can take back, while the
   *  user is being told what it costs. The figure was typed before anybody
   *  knew who the return was with, so it is theirs to change, not ours. */
  const [qtyGate, setQtyGate] = useState<{
    lineId: string;
    sku: string;
    uom: string;
    from: number;
    to: number;
    vendorName: string;
    units: boolean;
  } | null>(null);
  /** Line whose batches the picker is open on. */

  /** Lines added on a step after the first, from the unit menu. They have no
   *  quantity yet, and the rail past step one is otherwise the counted lines
   *  only. */
  const [addedLater, setAddedLater] = useState<string[]>([]);
  /** What the rail was carrying when this step opened.
   *
   *  Past the first step the rail is the counted lines, which is right on the
   *  way in and wrong once somebody is standing there: clearing a figure took
   *  the row off the screen mid-edit, so the line they were editing vanished
   *  rather than reading zero. A line stays for as long as the step does. */
  const [railHold, setRailHold] = useState<string[]>([]);
  const [lotModalLineId, setLotModalLineId] = useState<string | null>(null);
  /** Whose batches are open, when the lot picker is opened from a vendor row. */
  const [lotModalVendor, setLotModalVendor] = useState<string | null>(null);
  const lotQtyFor = (id: string) =>
    (lineLots[id] ?? []).reduce((n, a) => n + a.qty, 0);
  const serialsForLine = (id: string, sku: string, poLineId: string, receivedQty: number, qty: number) =>
    lineSerials[id] ?? availableSerials(sku, poLineId, receivedQty).slice(0, Math.max(0, qty));
  // Line whose units the picker is open on. The picker's own rail lets the
  // user move between the return's other serialized lines from there.
  const [serialModalLineId, setSerialModalLineId] = useState<string | null>(null);
  /** The vendor whose own units are being named, when the picker was opened
   *  from a vendor row on the second step rather than from the search. */
  const [serialModalVendor, setSerialModalVendor] = useState<string | null>(null);
  /** The vendor whose catalogue is open over the second step. */
  const [addItemsVendor, setAddItemsVendor] = useState<string | null>(null);
  /** What each counted line's return unwinds: how much of it is tied to each
   *  of the vendor's deliveries, or that it is deliberately tied to none. A
   *  tie is what a credit reverses, so it is recorded per receiving document
   *  rather than as one figure against the vendor. */
  const [itemTies, setItemTies] = useState<
    Record<string, Record<string, { ties: Record<string, number>; untied: boolean }>>
  >({});

  /** Vendors named on the return that the master does not carry.
   *
   *  The counted return can go back to somebody the system has never heard of:
   *  a distributor taking back what the maker sold, a partner set up after the
   *  goods came in. The list of who has delivered the part cannot contain
   *  them, so the picker has to let one be written down rather than only
   *  chosen. They have no delivery history by definition, which is why a share
   *  on one can only ever be untied. */
  const [adHocVendors, setAdHocVendors] = useState<{ vendorCode: string; vendorName: string }[]>([]);

  /** Any vendor the return can name: the master, plus the ones written down
   *  here. Everything that resolves a code has to look in both, or a vendor
   *  the user just typed vanishes from their own return. */
  const vendorByCode = useCallback(
    (code: string): { vendorCode: string; vendorName: string } | undefined =>
      mockVendors.find((v) => v.vendorCode === code) ?? adHocVendors.find((v) => v.vendorCode === code),
    [adHocVendors],
  );

  /** Rows the user has ticked but not yet given a figure. Held here rather
   *  than in the rows because a save has to refuse them, and the save is not
   *  something a row can see. */
  const [tickedEmpty, setTickedEmpty] = useState<string[]>([]);
  /** Flipped by a save attempt. Until then a ticked row with an empty field is
   *  someone mid-gesture, not a mistake to report. */
  const [showRowErrors, setShowRowErrors] = useState(false);
  const noteTick = useCallback((sku: string, empty: boolean) => {
    setTickedEmpty((prev) => {
      const has = prev.includes(sku);
      if (empty === has) return prev;
      return empty ? [...prev, sku] : prev.filter((s) => s !== sku);
    });
  }, []);

  /**
   * What the sheet found when it opened.
   *
   * Its fields write straight through, so the return is already changed by the
   * time anyone reaches the foot of it. A Cancel that only closed the sheet
   * would keep every one of those edits while saying it had thrown them away,
   * so leaving is a restore. Save has nothing to write for the same reason:
   * the work is done, and the button is there to say the sheet is finished
   * with.
   */
  const sheetSnapshot = useRef<{
    pos: typeof currentPOsData;
    reasons: Record<string, string>;
    returnTypes: Record<string, string>;
    notes: Record<string, string>;
    attachments: Record<string, LineAttachmentFile[]>;
    resolution: Record<string, string>;
    rmaNumbers: Record<string, string>;
    allocations: Record<string, Record<string, number>>;
    payTo: Record<string, string>;
    // The quantity travels through the invoice-state slices rather than
    // straight onto the line, so restoring the orders alone left the figure
    // where the sheet had put it.
    sliceAllocations: typeof lineSliceAllocations;
    bucketAllocations: Record<string, ReturnAllocation>;
    bucketPrices: typeof lineBucketPrices;
  } | null>(null);

  useEffect(() => {
    if (!lineDetailOpen) return;
    // Every slice is written immutably, so holding the reference holds the
    // state as it was.
    sheetSnapshot.current = {
      pos: currentPOsData,
      reasons: lineReasons,
      returnTypes: lineReturnTypes,
      notes: lineNotes,
      attachments: lineAttachments,
      resolution: lineExpectedResolution,
      rmaNumbers: originRmaNumber,
      allocations: vendorAllocations,
      payTo: vendorPayToIds,
      sliceAllocations: lineSliceAllocations,
      bucketAllocations: lineAllocations,
      bucketPrices: lineBucketPrices,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineDetailOpen]);

  const closeLineSheet = () => { setLineDetailOpen(false); setVendorSheetCode(null); };

  const revertLineSheet = () => {
    const snap = sheetSnapshot.current;
    if (snap) {
      setCurrentPOsData(snap.pos);
      setLineReasons(snap.reasons);
      setLineReturnTypes(snap.returnTypes);
      setLineNotes(snap.notes);
      setLineAttachments(snap.attachments);
      setLineExpectedResolution(snap.resolution);
      setOriginRmaNumber(snap.rmaNumbers);
      setVendorAllocations(snap.allocations);
      setVendorPayToIds(snap.payTo);
      setLineSliceAllocations(snap.sliceAllocations);
      setLineAllocations(snap.bucketAllocations);
      setLineBucketPrices(snap.bucketPrices);
    }
    closeLineSheet();
  };
  // Which shipment's details are open. A return that fans out to ten vendors
  // is ten shipments, and each one carries a contact, a carrier, two accounts,
  // an authorisation number and its own line breakdown. Stacked inline that is
  // a page of form per vendor; the list stays one row each and the detail
  // opens over it.
  const [legModalFor, setLegModalFor] = useState<string | null>(null);
  const [moneyDrafts, setMoneyDrafts] = useState<Record<string, string>>({});

  // Standalone line items state
  const [standaloneItems, setStandaloneItems] = useState<{id: string; description: string; quantity: number; uom: string; unitPrice: number; glAccount: string; amount: number}[]>([
    { id: `sa-${Date.now()}`, description: '', quantity: 1, uom: 'EA', unitPrice: 0, glAccount: '', amount: 0 }
  ]);

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

  const removeStandaloneItem = (id: string) => {
    setStandaloneItems(prev => prev.filter(i => i.id !== id));
  };

  const updateStandaloneItem = (id: string, field: string, value: any) => {
    setStandaloneItems(prev => {
      const next = prev.map(i => i.id === id ? { ...i, [field]: value } : i);
      // Lift the GL-required highlight as soon as every line has an account.
      if (field === 'glAccount' && next.every(i => i.glAccount && i.glAccount.trim())) {
        setGlMissingError(false);
      }
      return next;
    });
  };

  const clearAllStandaloneItems = () => {
    setStandaloneItems([{ id: `sa-${Date.now()}`, description: '', quantity: 1, uom: 'EA', unitPrice: 0, glAccount: vendorDefaultExpense || '', amount: 0 }]);
  };

  const standaloneSubtotal = standaloneItems.reduce((sum, i) => sum + (i.amount || 0), 0);

  // Local state for POs to allow adding/removing
  const [currentPOsData, setCurrentPOsData] = useState<SelectedPOData[]>(selectedPOsData || []);
  const [glConfigModalItemId, setGlConfigModalItemId] = useState<string | null>(null);
  const [glModalSearch, setGlModalSearch] = useState('');
  const [poGlConfigModalItemId, setPoGlConfigModalItemId] = useState<string | null>(null);
  const [poGlModalSearch, setPoGlModalSearch] = useState('');
  const [poToRemove, setPoToRemove] = useState<string | null>(null);
  // RMA-mode only: confirms that returning to each vendor site saves one draft
  // per site, before the drafts exist and the extra tabs open.
  // Submit confirmation — opened when the user clicks Submit and the
  // invoice carries an Exception flag or a Payment Hold flag, so they
  // get one last "you sure?" gate. Same AlertDialog recipe as the
  // discard confirmation below, just amber-toned instead of rose.
  const [showSubmitWarning, setShowSubmitWarning] = useState(false);
  /** The restocking fees on this save that are not what their vendor is on
   *  file for, one per vendor, asked through one at a time. A fan-out return
   *  can carry a fee for each vendor it becomes, and each is its own fact
   *  about its own partner. */
  const { restockingStandardFor, setRestockingStandard } = useRMAContext();
  const [feeScopeQueue, setFeeScopeQueue] = useState<
    {
      vendorCode: string;
      vendorName: string;
      pct: number;
      amount: number;
      currentPct: number | undefined;
    }[]
  >([]);
  /** Which button the open dialog is standing in front of. The Save charges
   *  pair commits that one vendor and stops; the final save has the whole
   *  return waiting behind it. */
  const [feeScopeIntent, setFeeScopeIntent] = useState<'charges' | 'submit'>('submit');
  /** The fee each vendor has already been asked about, by percentage. Asking
   *  again on the final save for a fee somebody answered on the Save charges
   *  button is the same dialog twice; changing the figure afterwards is a new
   *  question, which is why it is the percentage that is remembered and not
   *  just the fact of having asked. */
  const [feeScopeAnswered, setFeeScopeAnswered] = useState<Record<string, number>>({});
  /** The ported dialog closes itself once a choice is made, which on a queue
   *  of two vendors would take the second one down with the first. This marks
   *  the close as an answer rather than a dismissal. */
  const feeScopeAnswering = useRef(false);
  // Standalone GL-required highlight — set when a submit is attempted with
  // one or more line items missing a GL account, cleared once they're filled.
  const [glMissingError, setGlMissingError] = useState(false);
  // Submit modal opt-in: 'once' uses the chosen GL accounts for this invoice
  // only; 'default' also promotes the most-used account to the vendor's
  // default expense account going forward.
  const [glDefaultChoice, setGlDefaultChoice] = useState<'once' | 'default'>('once');

  // Discard confirmation — opened from header-X or footer-Cancel, mirrors
  // partner CreatePartnerModal flow so unsaved invoice work isn't lost
  // when the user accidentally closes the screen.
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);
  const handleAttemptClose = () => setShowDiscardConfirmation(true);
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

  // Freight State
  const [carrierName, setCarrierName] = useState('FedEx Ground');
  const [shippingMethod, setShippingMethod] = useState('Standard');
  const [dispatchType, setDispatchType] = useState('Direct');
  const [freightAmount, setFreightAmount] = useState(0);

  // Payment Hold State
  const [isPaymentHoldActive, setIsPaymentHoldActive] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [holdAttachments, setHoldAttachments] = useState<any[]>([]);
  const [notifiedStakeholders, setNotifiedStakeholders] = useState<Set<string>>(new Set());
  // A return renders these sections as wizard steps, and a step that opens
  // collapsed is a step that looks empty, so every section a return can reach
  // starts open. Collapsing stays available; it is just not the entry state.
  // An invoice keeps its single General Information default.
  const [expandedSections, setExpandedSections] = useState(
    isRma ? ["freight", "rma-details", "attachments"] : ["additional-details"],
  );

  useEffect(() => {
    setIsPaymentHoldActive(expandedSections.includes("hold"));
    setIsExceptionActive(expandedSections.includes("exception"));
  }, [expandedSections]);

  // Exception State
  const [isExceptionActive, setIsExceptionActive] = useState(false);
  const [exceptionTypes, setExceptionTypes] = useState<string[]>([]);
  const [exceptionDescription, setExceptionDescription] = useState('');
  const [exceptionAttachments, setExceptionAttachments] = useState<any[]>([]);
  const [invoiceAttachments, setInvoiceAttachments] = useState<any[]>([]);
  /** Evidence attached at the last step, per RMA. It belongs to the document
   *  rather than to a line -- an authorization email covers the return, not
   *  the third part on it -- so it is keyed by the vendor the RMA is with and
   *  lands on that document's Attachments tab. */
  const [resolutionFiles, setResolutionFiles] = useState<
    Record<string, LineAttachmentFile[]>
  >({});
  /** Words to find this return by, per RMA. Typed at the last step and
   *  searched by the returns listing. */
  const [resolutionTags, setResolutionTags] = useState<Record<string, string[]>>({});
  /** What the vendor keeps back out of the refund, per RMA. Agreed on the call
   *  that authorizes the return, so it is asked on the step written during
   *  that call rather than only on the saved record. */
  const [resolutionCharges, setResolutionCharges] = useState<
    Record<string, AdditionalCharge[]>
  >({});
  /** What was last committed on the Save charges button, per vendor. The panel
   *  still writes through on every keystroke, so a charge typed and left
   *  unsaved survives a step change and reaches the draft; this only records
   *  where Discard goes back to and when the pair has anything to offer.
   *  Losing a figure because somebody moved to another step before pressing a
   *  button is not a thing a wizard should do. */
  const [resolutionChargesSaved, setResolutionChargesSaved] = useState<
    Record<string, AdditionalCharge[]>
  >({});
  const [notifiedExceptionStakeholders, setNotifiedExceptionStakeholders] = useState<Set<string>>(new Set());

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
  // A return that goes back to each site is several shipments leaving for
  // several partner records, so the carrier is picked per site rather than
  // once for the return. Keyed by origin id; unset means that site's own
  // default still stands.
  const [originCarrierId, setOriginCarrierId] = useState<Record<string, string>>({});
  const [carrierPickerForOrigin, setCarrierPickerForOrigin] = useState<string | null>(null);

  // Resolved carrier objects for the summary card + confirm-dialog diff.
  const selectedCarrier = useMemo(
    () => findCarrierById(selectedCarrierId) ?? vendorCarriers[0],
    [selectedCarrierId, vendorCarriers],
  );
  const draftCarrier = useMemo(() => findCarrierById(carrierDraftId), [carrierDraftId]);

  // Invoice Details State
  const generateInvoiceNumber = () => `INV-${Math.floor(100000 + Math.random() * 900000)}`;
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber());
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
  const [invoiceDate, setInvoiceDate] = useState(resubmitInvoice?.invoiceDate || new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  // A vendor issues one authorisation for the whole return, so this is keyed
  // by vendor, not by line: every line going back to them travels under it.
  const [vendorRmaNumbers, setVendorRmaNumbers] = useState<Record<string, string>>({});
  // Terms changed for one vendor on this return, overriding what their
  // partner record says. Keyed by vendor, because each leg settles on its own.
  const [vendorPaymentTerms, setVendorPaymentTerms] = useState<Record<string, string>>({});
  // Which vendor the terms modal is editing; null means the whole document.
  const [termsTargetVendor, setTermsTargetVendor] = useState<string | null>(null);
  // The account each vendor's leg settles to, and which vendor the picker is
  // editing. A return spanning vendors can credit back to different accounts.
  const [vendorPayToIds, setVendorPayToIds] = useState<Record<string, string>>({});
  const [payToTargetVendor, setPayToTargetVendor] = useState<string | null>(null);
  // The vendor's inherited default term, captured once. When the active
  // term still equals it, the summary card shows the "Inherited" pill
  // (mirrors the carrier's vendorDefault → "Inherited" treatment).
  const [vendorDefaultPaymentTerm] = useState(() => 'Net 30');
  // Payment terms picker — opens a rich modal patterned after the
  // partner module; Apply hands off to a confirmation step that asks
  // whether the change is local to this invoice or should propagate
  // to the vendor profile going forward.
  const [paymentTermsModalOpen, setPaymentTermsModalOpen] = useState(false);
  const [paymentTermsDraft, setPaymentTermsDraft] = useState('Net 30');
  const [paymentTermsConfirmOpen, setPaymentTermsConfirmOpen] = useState(false);
  const [selectedPaymentTermId, setSelectedPaymentTermId] = useState<string | null>(() => {
    const initial = findPresetByLabel(paymentTermsDraft) ?? findPresetByLabel('Net 30');
    return initial?.id ?? null;
  });
  const [apAccount, setApAccount] = useState(() => {
    const vendorCategory = standaloneVendor?.vendorCategory || vendorData?.category || '';
    return VENDOR_AP_MAPPING[vendorCategory] || VENDOR_AP_MAPPING['default'];
  });
  const [apConfigModalOpen, setApConfigModalOpen] = useState(false);
  const [apModalSearch, setApModalSearch] = useState('');
  // RMA-only: the account the return settles against, picked the same way the
  // Record Payment flow picks one.
  const [payFromId, setPayFromId] = useState<string>(() => PAY_FROM_ACCOUNTS[0]?.id ?? '');
  const [payFromModalOpen, setPayFromModalOpen] = useState(false);
  const [description, setDescription] = useState(resubmitInvoice?.description || '');
  // RMA-only: free-text carrier / packing guidance that travels with the
  // return shipment.
  const [shippingInstruction, setShippingInstruction] = useState('');
  const [standalonePostingDate, setStandalonePostingDate] = useState(new Date().toISOString().split('T')[0]);
  
  const vendorName = standaloneVendor?.vendorName || currentPOsData[0]?.vendorName || 'Global Logistics Partners';

  // Both return addresses stand in with their first option until the user
  // picks otherwise, so a submitted RMA always says where the goods leave
  // from and go back to instead of reading blank on the detail page.
  // Vendor invoice numbers must be unique PER VENDOR, not system-wide
  // (design review 7/9/26). Engineers will pair the locked internal ID
  // with this vendor-supplied number; the UI blocks a duplicate for the
  // same vendor and points at the invoice that already carries it.
  const vendorInvoiceNumberDuplicate = useMemo(() => {
    const q = vendorInvoiceNumber.trim().toLowerCase();
    if (!q) return null;
    return (
      mockInvoices.find(
        (inv) =>
          inv.vendor === vendorName &&
          inv.vendorInvoiceNumber.toLowerCase() === q &&
          // Resubmission edits an EXISTING invoice, so its own number is
          // not a duplicate of itself (feedback 7/20/26). A different
          // invoice's number still blocks, same as creation.
          inv.id !== resubmitInvoice?.id &&
          inv.invoiceNumber !== resubmitInvoice?.invoiceNumber
      ) ?? null
    );
  }, [vendorInvoiceNumber, vendorName, resubmitInvoice]);

  // ─── Return origins ──────────────────────────────────────────────
  // A vendor can be ordered from at its headquarters or at any of its sites,
  // and one return can draw on receipts from several at once. Origin is fixed
  // by the receipt, so it groups the POs rather than being editable per line.
  // An RMA is raised against a vendor, so a leg is a vendor -- not one of its
  // sites. Grouping by site turned five suppliers into thirteen returns,
  // because a vendor with a headquarters and three branches was four partners
  // as far as this list was concerned. Where inside the vendor the goods go
  // back is an address on the leg, not a reason to raise another one.
  const returnOrigins = useMemo(() => {
    const seen = new Map<string, string>();
    currentPOsData.forEach(po => {
      if (!seen.has(po.vendorName)) seen.set(po.vendorName, po.vendorName);
    });
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [currentPOsData]);
  const isMultiOrigin = isRma && returnOrigins.length > 1;

  // Which POs a site's goods came in on. Origin is a property of the receipt,
  // so this is the only place the PO-to-site mapping is stated: the chip strip
  // deliberately carries no site label.
  // One reading of a line's slices and what each currently carries. Untouched
  // slices fall back to the line's own allocation spread over them in order,
  // so a line that starts unpicked -- every serialized one does -- contributes
  // nothing rather than everything it received.
  const slicesWithQty = (line: LineItem) => {
    const slices = receiptInvoiceSlices(line.poNumber, line.sku, line.receipts ?? []);
    const remaining: Record<ReturnBucket, number> = {
      ...allocationFor(line.id, line.invoiceQty, line.invoiceSplit),
    };
    return slices.map((slice) => {
      const bucket = BUCKET_OF_SLICE[slice.state];
      const fallback = Math.max(0, Math.min(slice.qty, remaining[bucket] ?? 0));
      remaining[bucket] = (remaining[bucket] ?? 0) - fallback;
      return { slice, qty: lineSliceAllocations[line.id]?.[slice.key] ?? fallback };
    });
  };

  /** Named units carved to the receipt-and-invoice they came off.
   *  `bucketSerialPool` cuts a line's pool by invoice state; this cuts each
   *  state's share again by document, so a unit maps back to exactly one bill. */
  const slicePools = (line: LineItem): { slice: ReturnSlice; pool: string[] }[] => {
    const split = line.invoiceSplit;
    if (!split) return [];
    const used: Record<ReturnBucket, number> = { notInvoiced: 0, invoicedUnpaid: 0, paid: 0 };
    return receiptInvoiceSlices(line.poNumber, line.sku, line.receipts ?? []).map((slice) => {
      const bucket = BUCKET_OF_SLICE[slice.state];
      const pool = bucketSerialPool(line.sku, line.id, line.receivedQty, split, bucket);
      const size = Math.round(slice.qty);
      const take = pool.slice(used[bucket], used[bucket] + size);
      used[bucket] += size;
      return { slice, pool: take };
    });
  };

  /** Write a line's slices, and let its three bucket figures, quantity and
   *  per-state prices follow. Everything downstream still reads those. */
  const writeSlices = (line: LineItem, map: Record<string, number>, keepQty = false) => {
    setLineSliceAllocations((prev) => ({ ...prev, [line.id]: map }));
    const alloc: Record<ReturnBucket, number> = { notInvoiced: 0, invoicedUnpaid: 0, paid: 0 };
    receiptInvoiceSlices(line.poNumber, line.sku, line.receipts ?? []).forEach((slice) => {
      alloc[BUCKET_OF_SLICE[slice.state]] += map[slice.key] ?? 0;
    });
    setAllocation(line.id, alloc);
    // Normally the slices are the quantity: the figure follows what the units
    // add up to. While a count is being answered they are not -- ticking the
    // fourteenth of fifteen would move the figure to fourteen, and the
    // miscount would agree with itself instead of being caught.
    if (!keepQty) updateLineItem(line.id, 'invoiceQty', allocationTotal(alloc));
    applyBucketPrices(line.id, lineBucketPrices[line.id] ?? {}, alloc, line.unitPrice);
    return alloc;
  };

  /** Units are picked by name, so which bill each came off is read back off the
   *  pools rather than asked for: the return knows what it is crediting. */
  const setSerialsForLine = (line: LineItem, next: string[], keepQty = false) => {
    const chosen = new Set(next);
    const map: Record<string, number> = {};
    slicePools(line).forEach(({ slice, pool }) => {
      map[slice.key] = pool.filter((sn) => chosen.has(sn)).length;
    });
    writeSlices(line, map, keepQty);
    setLineSerials((prev) => ({ ...prev, [line.id]: next }));
  };

  // A consolidated return is one leg covering every site, so it answers the
  // same per-leg questions through the same helpers rather than through a
  // second set of markup that drifts from the first.
  const CONSOLIDATED_ID = '__consolidated__';
  const posForOrigin = (originId: string) =>
    originId === CONSOLIDATED_ID
      ? currentPOsData.map(p => p.poNumber)
      : currentPOsData.filter(p => p.vendorName === originId).map(p => p.poNumber);

  // What one vendor site is actually being sent, item by item. The receipt
  // rows say how much moves; this says what it is, under which paperwork, and
  // -- where the units are named -- which ones. Notes and attachments come
  // along because they were written about these goods and the person packing
  // or receiving them is who they were written for.
  const returnItemsForOrigin = (originId: string): LegItem[] => {
    const pos = new Set(posForOrigin(originId));
    const bySku = new Map<string, LegItem & { lineIds: Set<string> }>();
    lineItems
      .filter((l) => pos.has(l.poNumber))
      .forEach((l) => {
        slicesWithQty(l).forEach(({ slice, qty }) => {
          if (qty <= 0.004) return;
          const bucket: ReturnBucket =
            slice.state === 'paid' ? 'paid' : slice.state === 'unpaid' ? 'invoicedUnpaid' : 'notInvoiced';
          const reason = invoiceReasons[slice.invoiceNumber ?? 'not-invoiced'] ?? bucketReasonFor(l.id, bucket);
          const remedy =
            invoiceTypes[slice.invoiceNumber ?? 'not-invoiced'] ??
            bucketTypeFor(l.id, bucket, reason as ReturnReason, qty);
          let entry = bySku.get(l.sku);
          if (!entry) {
            entry = {
              key: `${originId}:${l.sku}`,
              sku: l.sku,
              description: l.description,
              uom: l.uom,
              image: imageForSku(l.sku),
              qty: 0,
              serialized: trackingModeFor(l.sku) === 'serialized',
              purchaseOrders: [],
              receipts: [],
              states: [],
              invoices: [],
              remedies: [],
              serials: [],
              notes: '',
              attachments: [],
              lineIds: new Set<string>(),
            };
            bySku.set(l.sku, entry);
          }
          entry.qty += qty;
          if (!entry.purchaseOrders.includes(l.poNumber)) entry.purchaseOrders.push(l.poNumber);
          if (!entry.receipts.includes(slice.grnNumber)) entry.receipts.push(slice.grnNumber);
          if (!entry.states.includes(slice.state)) entry.states.push(slice.state);
          if (slice.invoiceNumber && !entry.invoices.includes(slice.invoiceNumber)) {
            entry.invoices.push(slice.invoiceNumber);
          }
          if (remedy && !entry.remedies.includes(remedy)) entry.remedies.push(remedy);
          entry.lineIds.add(l.id);
        });
      });

    return [...bySku.values()].map((entry) => {
      const lineIds = [...entry.lineIds];
      return {
        ...entry,
        purchaseOrders: entry.purchaseOrders.map((po) => `PO ${po}`),
        serials: entry.serialized ? lineIds.flatMap((id) => lineSerials[id] ?? []) : [],
        notes: lineIds.map((id) => lineNotes[id] ?? '').filter(Boolean).join(' · '),
        attachments: lineIds.flatMap((id) => lineAttachments[id] ?? []),
      };
    });
  };

  // What one vendor site is actually being sent, read back off the same slices
  // step 1 wrote. Goods leave against a receiving document, so the shipment
  // reads by receipt, with the invoice it settles named beside it.
  const returnRowsForOrigin = (originId: string): ReturnReceiptRow[] => {
    const pos = new Set(posForOrigin(originId));
    const rows: ReturnReceiptRow[] = [];
    lineItems
      .filter((l) => pos.has(l.poNumber))
      .forEach((l) => {
        receiptInvoiceSlices(l.poNumber, l.sku, l.receipts ?? []).forEach((slice) => {
          // Same seeding rule as step 1: an untouched line contributes what it
          // already quotes, not everything it received.
          const alloc = allocationFor(l.id, l.invoiceQty, l.invoiceSplit);
          const priorSameBucket = receiptInvoiceSlices(l.poNumber, l.sku, l.receipts ?? [])
            .slice(0, receiptInvoiceSlices(l.poNumber, l.sku, l.receipts ?? []).indexOf(slice))
            .filter((s2) => s2.state === slice.state)
            .reduce((n, s2) => n + s2.qty, 0);
          const bucketKey: ReturnBucket =
            slice.state === 'paid' ? 'paid' : slice.state === 'unpaid' ? 'invoicedUnpaid' : 'notInvoiced';
          const seeded = Math.max(0, Math.min(slice.qty, (alloc[bucketKey] ?? 0) - priorSameBucket));
          const qty = lineSliceAllocations[l.id]?.[slice.key] ?? seeded;
          if (qty <= 0.004) return;
          const groupId = slice.invoiceNumber ?? 'not-invoiced';
          const bucket: ReturnBucket =
            slice.state === 'paid' ? 'paid' : slice.state === 'unpaid' ? 'invoicedUnpaid' : 'notInvoiced';
          const reason = invoiceReasons[groupId] ?? bucketReasonFor(l.id, bucket);
          rows.push({
            key: `${l.id}:${slice.key}`,
            sku: l.sku,
            uom: l.uom,
            grnNumber: slice.grnNumber,
            poNumber: l.poNumber,
            invoiceNumber: slice.invoiceNumber,
            state: slice.state,
            qty,
            remedy: invoiceTypes[groupId] ?? bucketTypeFor(l.id, bucket, reason as ReturnReason, qty),
          });
        });
      });
    return rows;
  };

  // Copy follows the source type (design review 7/9/26): receiver-based
  // invoices add receivers, not POs.
  const addPOLabel = invoiceType === 'receiving' ? 'Add more receivings' : 'Add more POs';

  // A vendor can have any number of sites, so the group colour is hashed off
  // the site id onto a fixed palette rather than mapped per site.
  // Lines reach a site through their PO, so the count has to route through
  // currentPOsData rather than reading a field off the line.
  const lineCountForOrigin = (originId: string) =>
    originId === CONSOLIDATED_ID
      ? lineItems.length
      : lineItems.filter(li => {
          const po = currentPOsData.find(p => p.poNumber === li.poNumber);
          return po?.vendorName === originId;
        }).length;

  const receiptsForOrigin = (originId: string) =>
    Array.from(
      new Set(
        currentPOsData
          .filter(p => p.vendorName === originId)
          .flatMap(p => p.relatedGRNs.map(g => g.grnNumber)),
      ),
    );

  const shipToForOrigin = (origin: { id: string; name: string }): string =>
    origin.id === CONSOLIDATED_ID
      ? shipToName
      : originShipTo[origin.id] ?? returnShipToOptions(origin.name)[0];

  // Each site carries its own freight arrangements, so its default comes from
  // its own partner record rather than the header vendor's.
  const defaultCarrierForOrigin = (origin: { id: string; name: string }) =>
    getCarriersForVendor(origin.name)[0];
  const carrierForOrigin = (origin: { id: string; name: string }) =>
    origin.id === CONSOLIDATED_ID
      ? selectedCarrier ?? defaultCarrierForOrigin(origin)
      : findCarrierById(originCarrierId[origin.id]) ?? defaultCarrierForOrigin(origin);

  // Goods go back where they came from unless the user says otherwise: one
  // origin means that site's own returns dock, a consolidated multi-site
  // return means the vendor's. Only a picked destination overrides it.
  const receivedFromShipTo = (!isMultiOrigin && returnOrigins[0]
    ? shipToForOrigin(returnOrigins[0])
    : returnShipToOptions(vendorName)[0])!;
  // A consolidated return's address is asked for on the merge and split step,
  // and that answer outranks the one read off where the goods came from.
  const shipToName = consolidatedShipTo ?? shipTo?.name ?? receivedFromShipTo;

  // The picked destination can belong to a partner other than the vendor the
  // goods came from — a return bought from one and shipped back to another's
  // site. Returning to origin has no such choice, so those legs stay with the
  // vendor's own name.
  const shipToPartnerName = shipTo ? partnerForItem(shipTo)?.name ?? shipTo.name : vendorName;
  const shipToIsRedirect = shipToPartnerName !== vendorName;


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
    // A return starts empty and waits to be told what is going back. Assuming
    // the whole receipt was coming back put a figure in the field before the
    // user had said anything, which reads as an answer rather than a default,
    // and left them deleting a number instead of entering one. Serialized
    // lines always worked this way; the rest now match. An invoice is not the
    // same case -- it bills what was received, so it still arrives filled.
    const startsUnselected = (_sku: string) => isRma;
    // What a line can still be raised for. An invoice is capped by what has
    // not been billed yet; a return is capped by what was physically received,
    // since goods that were already invoiced can still go back to the vendor.
    const availableQty = (received: number, invoiced: number) =>
      isRma ? received : received - invoiced;
    const items: LineItem[] = [];
    currentPOsData.forEach(poData => {
      if (poData.isPreInvoice) {
        // For Pre-Invoices, poData.items is already filtered by the selection modal
        poData.items.forEach(item => {
          const remaining = availableQty(
            isRma ? item.receivedQty || 0 : item.quantity,
            item.invoicedQty || 0,
          );
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
              if (!originalPriceRef.current.has(id)) originalPriceRef.current.set(id, item.unitPrice);
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
      } else if (poData.relatedGRNs.length === 0) {
        // Stock with no receiver behind it. Every other line is built by
        // walking the deliveries it arrived on; this one has none, so it is
        // built from the selection itself. Skipping it silently dropped
        // hand-attached lines between the picker and the grid.
        poData.items.forEach((item) => {
          const qty = item.receivedQty ?? item.quantity;
          // The figure typed on the first step. Every other branch reads it;
          // this one did not, so a part picked with a quantity arrived on the
          // grid holding nothing and the step would not advance.
          const picked = item['customInvoiceQty'] !== undefined
            ? item['customInvoiceQty']
            : startsUnselected(item.sku) ? 0 : qty;
          const lineId = `inv-${poData.poNumber}-${item.id}`;
          if (!originalPriceRef.current.has(lineId)) originalPriceRef.current.set(lineId, item.unitPrice);
          if (!defaultGlRef.current.has(lineId)) {
            defaultGlRef.current.set(lineId, item['glAccount'] || '1200 Inventory');
          }
          items.push({
            id: lineId,
            sku: item.sku,
            description: item.description,
            orderedQty: qty,
            receivedQty: qty,
            invoiceQty: picked,
            remainingQty: qty,
            uom: item.uom,
            unitPrice: item.unitPrice,
            originalUnitPrice: originalPriceRef.current.get(lineId)!,
            lineTotal: picked * item.unitPrice,
            poNumber: poData.poNumber,
            grnNumbers: [],
            grnDate: '',
            // No delivery, so no invoice ever settled against it and nothing
            // reverses on its own -- the value is entered by hand.
            receipts: [],
            isPreInvoice: false,
            unlinked: true,
            glAccount: item['glAccount'] || '1200 Inventory',
            defaultGlAccount: defaultGlRef.current.get(lineId)!,
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

            // Matched on the part AND the unit. A part can be on the order
            // twice, once per unit it is coming back in, and matching on the
            // part alone handed every receipt to whichever row came first:
            // take the eaches line off and the boxes line inherited its
            // documents and started calling itself eaches.
            const poItem = poData.items.find(
              (si) => si.sku === item.sku && (si.uom ?? 'EA') === (item.uom ?? 'EA'),
            );
            // A receipt in a unit no row is asking for belongs to no line. It
            // is not dropped from the return, it simply is not this line's
            // evidence: a boxes line cannot be credited by an eaches document.
            if (!poItem) return;

            const key = `${poData.poNumber}-${poItem.id}`;
            const unitPrice = poItem.unitPrice || item.unitPrice;
            const existing = agg.get(key);

            if (existing) {
              // Same PO item already aggregated — fold this GRN slice in.
              addReceiptLineToSplit(
                (existing.invoiceSplit ??= emptySplit()),
                grn.grnNumber,
                item.sku,
                item.quantity,
                item.invoicedQty || 0,
              );
              existing.receivedQty += item.quantity;
              const remainingFromThisGrn = availableQty(item.quantity, item.invoicedQty || 0);
              // Capacity always grows with the receipt, but the quantity only
              // does while nobody has said what it should be. `customInvoiceQty`
              // is the whole consolidated line's figure, so folding later
              // receipts on top of it added their remainder back to a number
              // the user had already set — clearing a three-receipt line left
              // it holding the other two receipts (review 2/9/26).
              if (poItem['customInvoiceQty'] === undefined && !startsUnselected(item.sku)) {
                existing.invoiceQty += remainingFromThisGrn;
              }
              existing.remainingQty += remainingFromThisGrn;
              existing.lineTotal = existing.invoiceQty * existing.unitPrice;
              if (!existing.grnNumbers.includes(grn.grnNumber)) {
                existing.grnNumbers.push(grn.grnNumber);
              }
              (existing.receipts ??= []).push({
                grnNumber: grn.grnNumber,
                receivedQty: item.quantity,
                invoicedQty: item.invoicedQty || 0,
              });
              // Keep the latest GRN date so the dueDate calculation stays
              // anchored to the most recent receipt.
              if (!existing.grnDate || new Date(grn.grnDate) > new Date(existing.grnDate)) {
                existing.grnDate = grn.grnDate;
              }
            } else {
              const remaining = availableQty(item.quantity, item.invoicedQty || 0);
              const invQty = poItem.customInvoiceQty !== undefined
                ? poItem.customInvoiceQty
                : startsUnselected(item.sku) ? 0 : remaining;
              const lineId = `inv-${poData.poNumber}-${poItem.id}`;
              const invoiceSplit = emptySplit();
              addReceiptLineToSplit(
                invoiceSplit,
                grn.grnNumber,
                item.sku,
                item.quantity,
                item.invoicedQty || 0,
              );
              if (!defaultGlRef.current.has(lineId)) defaultGlRef.current.set(lineId, poItem.glAccount || '1200 Inventory');
              if (!originalPriceRef.current.has(lineId)) originalPriceRef.current.set(lineId, unitPrice);
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
                invoiceSplit,
                receipts: [
                  {
                    grnNumber: grn.grnNumber,
                    receivedQty: item.quantity,
                    invoicedQty: item.invoicedQty || 0,
                  },
                ],
                isPreInvoice: false,
                glAccount: poItem.glAccount || '1200 Inventory',
                defaultGlAccount: defaultGlRef.current.get(lineId)!,
              });
            }
          });
        });
        items.push(...agg.values());

        // A part put on the return in one of its alternative units.
        //
        // Lines are built by walking the receipts, and a receipt is written in
        // one unit: every SAFE-H-01 document on file says EA. So a line asked
        // for in PAL matched no receipt and was never built at all, which is
        // why adding a second unit looked like nothing happened. It exists, it
        // simply has no document behind it, and the flow already knows how to
        // say that: it goes back untied, against a vendor named by hand.
        poData.items.forEach((poItem) => {
          if (agg.has(`${poData.poNumber}-${poItem.id}`)) return;
          // The same id shape every other line has. The save reads rows back
          // as `inv-{po}-{poLineId}`, so a line under any other shape was
          // written on screen and then dropped on the way out.
          const lineId = `inv-${poData.poNumber}-${poItem.id}`;
          if (items.some((l) => l.id === lineId)) return;
          defaultGlRef.current.set(lineId, poItem['glAccount'] || '1200 Inventory');
          items.push({
            id: lineId,
            sku: poItem.sku,
            description: poItem.description,
            orderedQty: poItem.quantity,
            receivedQty: poItem.receivedQty ?? poItem.quantity,
            // What the user typed against this line, not a hard zero: the
            // figure is written onto the PO item and read back from it, the
            // same as every other line.
            invoiceQty: (poItem['customInvoiceQty'] as number | undefined) ?? 0,
            remainingQty: poItem.receivedQty ?? poItem.quantity,
            uom: poItem.uom,
            unitPrice: poItem.unitPrice,
            originalUnitPrice: poItem.unitPrice,
            lineTotal: 0,
            poNumber: poData.poNumber,
            grnNumbers: [],
            receipts: [],
            ...(poItem.image ? { image: poItem.image } : {}),
            isPreInvoice: false,
            glAccount: poItem['glAccount'] || '1200 Inventory',
            defaultGlAccount: defaultGlRef.current.get(lineId)!,
          });
        });
      }
    });
    return items;
  }, [currentPOsData, isRma]);

  // Sites a shipment is actually going to. Sits below `lineItems`, which is
  // what it reads through `returnItemsForOrigin`.
  //
  // A vendor location earns a leg by having goods on it, not by having
  // supplied some once: a site the user set nothing against would otherwise
  // print an empty card, and on a ten-vendor return most of the list would
  // be shipments nobody is making.
  const shippingOrigins = isRma
    ? returnOrigins.filter((o) => returnItemsForOrigin(o.id).length > 0)
    : returnOrigins;


  const dueDate = useMemo(() => {
    // The logic for due date is the date of receiving document plus the payment terms.
    // If it is set to "Due on Receipt" (due on receiving), it should show the receiving date
    // rather than matching the vendor invoice date.
    
    let baseDate = invoiceDate;
    
    // Find all receiving dates from items that have them (standard invoices)
    const receivingDates = lineItems
      .filter(item => !item.isPreInvoice && item.grnDate)
      .map(item => item.grnDate as string);
      
    if (receivingDates.length > 0) {
      // Use the latest (max) receiving date among all selected items as the baseline
      baseDate = receivingDates.reduce((latest, current) => 
        new Date(current) > new Date(latest) ? current : latest
      , receivingDates[0]);
    }
    
    const date = new Date(baseDate);
    
    if (paymentTerms === 'Due on Receipt') {
      return date.toISOString().split('T')[0];
    }

    const preset = findPresetByLabel(paymentTerms);
    const days = preset ? daysForPreset(preset) : (parseInt(paymentTerms.replace(/\D/g, '')) || 0);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }, [invoiceDate, paymentTerms, lineItems]);

  // Compute posting date: latest receiving date from all selected receiving documents
  const postingDate = useMemo(() => {
    const receivingDates = lineItems
      .filter(item => !item.isPreInvoice && item.grnDate)
      .map(item => item.grnDate as string);
    
    if (receivingDates.length > 0) {
      return receivingDates.reduce((latest, current) =>
        new Date(current) > new Date(latest) ? current : latest
      , receivingDates[0]);
    }
    // Pre-invoice scenario: nothing has been received, so there IS no
    // posting date yet — the field stays empty and locked instead of
    // showing a misleading real date (feedback 7/15/26).
    return '';
  }, [lineItems]);

  // Find the GRN number associated with the posting date for display
  const postingDateGRN = useMemo(() => {
    if (!postingDate) return null;
    const matchingItem = lineItems.find(item => !item.isPreInvoice && item.grnDate === postingDate);
    return matchingItem?.grnNumbers?.[0] || null;
  }, [lineItems, postingDate]);

  // Format date for display (DD/MM/YYYY)
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const hasReceivingDocs = lineItems.some(item => !item.isPreInvoice && item.grnDate);

  /** Whether a PO item is the one a built line id refers to.
   *
   *  A line id carries the PO it came from -- `inv-{po}-{itemId}` -- and the
   *  item's own id is only the tail of it. Comparing the two directly never
   *  matches, which is how switching a line's unit came to leave the old line
   *  standing and add a second one beside it. */
  const lineOwnsItem = (lineId: string, poNumber: string, itemId: string) =>
    lineId === `inv-${poNumber}-${itemId}` ||
    lineId === `pre-${poNumber}-${itemId}` ||
    (!/^(inv|pre)-/.test(lineId) && lineId.endsWith(itemId));

  const updateLineItem = (id: string, field: string, value: any) => {
    setCurrentPOsData(prev => prev.map(po => {
      const newItems = po.items.map(item => {
        // A line id carries the PO it came from, so match the whole thing.
        // `endsWith` alone matched item "3" in every PO at once, which only
        // showed up once a write touched several lines in one tick: the
        // last one through overwrote the rest (review 2/9/26).
        const owns =
          id === `inv-${po.poNumber}-${item.id}` ||
          id === `pre-${po.poNumber}-${item.id}` ||
          (!/^(inv|pre)-/.test(id) && id.endsWith(item.id));
        if (owns) {
          const updatedItem = { ...item };
          if (field === 'invoiceQty') {
            const qty = parseFloat(value) || 0;
            updatedItem.customInvoiceQty = qty;
            // Also update price based on custom qty if available
            updatedItem.totalPrice = qty * (updatedItem.unitPrice || item.unitPrice);
          } else if (field === 'unitPrice') {
            const price = parseFloat(value) || 0;
            updatedItem.unitPrice = price;
            const currentQty = updatedItem.customInvoiceQty !== undefined ? updatedItem.customInvoiceQty : item.quantity;
            updatedItem.totalPrice = currentQty * price;
          } else if (field === 'lineTotal') {
            // Total and unit price are two views of the same number, so
            // editing the total back-solves the price against the current
            // qty. Qty 0 has no solvable price, so the edit is ignored
            // rather than dividing by zero.
            const total = parseFloat(value) || 0;
            const currentQty = updatedItem['customInvoiceQty'] !== undefined ? updatedItem['customInvoiceQty'] : item.quantity;
            if (currentQty > 0) {
              updatedItem.unitPrice = total / currentQty;
              updatedItem.totalPrice = total;
            }
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

  // A number input holds the string the user typed, and React skips resyncing
  // it whenever that string compares loosely equal to the number it renders,
  // so typing onto a qty of 0 leaves "0123" on screen. Normalising the node
  // itself is what actually drops the leading zero.
  const handleQtyInput = (lineId: string, e: ChangeEvent<HTMLInputElement>) => {
    const normalized = e.target.value.replace(/^0+(?=\d)/, '');
    if (normalized !== e.target.value) e.target.value = normalized;
    updateLineItem(lineId, 'invoiceQty', normalized);
  };

  // Money inputs hold what was typed rather than what parses, so a backspace
  // can leave the field empty instead of snapping back to 0. Price and total
  // are two views of one figure, so filling either repaints the other.
  const moneyDraft = (lineId: string, field: 'unitPrice' | 'lineTotal') => moneyDrafts[`${lineId}:${field}`];
  const setMoneyDraft = (lineId: string, field: 'unitPrice' | 'lineTotal', raw: string) => {
    setMoneyDrafts(prev => {
      const next = { ...prev, [`${lineId}:${field}`]: raw };
      delete next[`${lineId}:${field === 'unitPrice' ? 'lineTotal' : 'unitPrice'}`];
      return next;
    });
    updateLineItem(lineId, field, raw);
  };
  const clearMoneyDrafts = (lineId: string) => setMoneyDrafts(prev => {
    const next = { ...prev };
    delete next[`${lineId}:unitPrice`];
    delete next[`${lineId}:lineTotal`];
    return next;
  });

  // A return is raised against one vendor and a handful of lines, so it reads
  // as a single list and each line carries its own PO in the detail panel.
  // Invoicing still works PO by PO through the tab strip.
  const currentPOItems = isRma ? lineItems : lineItems.filter(item => item.poNumber === activePOTab);

  // A return can span vendors, so the vendor is a property of the line rather
  // than of the document, and every line has to say whose goods it is.
  const vendorForPO = (poNumber: string) =>
    currentPOsData.find(p => p.poNumber === poNumber)?.vendorName ?? '';

  // ─── Who the return goes back to ─────────────────────────────────
  // Held per line and per vendor, because one RMA settles with one vendor:
  // splitting a line across two of them is splitting the return into two
  // drafts, which is a decision made here rather than discovered at save.
  const [vendorAllocations, setVendorAllocations] = useState<Record<string, Record<string, number>>>({});

  /** What every per-line answer is filed under.
   *
   *  A part alone is not enough. One part can come back on two lines, in two
   *  units, from two vendors: some suppliers ship helmets by the each and some
   *  by the box, and a return has to be able to say both. Keyed on the part,
   *  those two lines shared one vendor and one set of ties, so they looked
   *  separate and behaved as one. */
  const lineKey = (sku: string, uom: string) => `${sku}::${uom}`;

  /** Forget every unit's answers for a part. Used where only the part number
   *  is in hand -- taking it off the return, undoing a consolidation -- and a
   *  part may be on the return in more than one unit. */
  const forgetLine = <T,>(map: Record<string, T>, sku: string) => {
    const next = { ...map };
    Object.keys(next)
      .filter((k) => k === sku || k.startsWith(`${sku}::`))
      .forEach((k) => delete next[k]);
    return next;
  };

  /** A part goes back to at most this many suppliers, and opens on this many.
   *  Both are product rules rather than data limits: the receipts often name
   *  more, and the card is a decision rather than a ledger of them. */
  const MAX_VENDORS_PER_PART = 5;
  const DEFAULT_VENDORS_PER_PART = 2;

  /** Read by `allocateVendor`, which is declared before the lines it needs.
   *  A ref rather than a reorder: the write path only ever runs from an event,
   *  by which time the render that filled it has long finished. */
  const resolutionLinesRef = useRef<ResolutionLine[]>([]);

  /** Write one vendor's share.
   *
   *  Seeded from what is on screen, not from what has been stored. The opening
   *  split is derived rather than written down, so a stored map starting empty
   *  meant the first edit replaced the whole split with the one vendor being
   *  edited -- three rows of 173, 178 and 183 became one row of 100. */
  const allocateVendor = (lineKey: string, vendorCode: string, qty: number) =>
    setVendorAllocations((prev) => {
      const line = resolutionLinesRef.current.find((l) => l.key === lineKey);
      // A locked line's vendor lives in its resolution, not in the split, so
      // seeding from the split alone dropped the sole source the moment a
      // second vendor was added beside it.
      const base =
        prev[lineKey] ??
        (line
          ? line.locked
            ? Object.fromEntries(line.resolved.map((sl) => [sl.vendorCode, sl.qty]))
            : vendorSplitFor(line)
          : {});
      return { ...prev, [lineKey]: { ...base, [vendorCode]: qty } };
    });

  /** Every line's vendor question, in the state it is actually in. A line whose
   *  units are named has already answered it; the rest have not. */
  const resolutionLines = useMemo<ResolutionLine[]>(() => {
    if (!isRma) return [];
    const bySku = new Map<string, ResolutionLine>();
    lineItems.forEach((line) => {
      const qty = line.invoiceQty;
      if (qty <= 0) return;
      const serialized = hasSerials(trackingModeFor(line.sku));
      const receipts = (line.receipts ?? []).map((r) => ({
        grnNumber: r.grnNumber,
        receivedQty: r.receivedQty,
      }));
      // Named units name their vendor -- but only once they are named. The
      // fallback pool would resolve a supplier off units nobody picked.
      const serials = serialized ? lineSerials[line.id] ?? [] : [];
      // Named units carry their own receiver, so they resolve. Plain stock
      // resolves too when it only ever came from one vendor -- one supplier is
      // an answer, not a choice -- and otherwise it asks.
      const resolved = serialized
        ? resolveFromSerials(line.sku, line.id, line.receivedQty, receipts, serials)
        : resolveFromReceipts(receipts);
      // Serialized parts used to lock: the receiver named the vendor, so the
      // flow stated it and offered nothing back. But a returner does move named
      // units between suppliers -- a unit bought from one and warrantied
      // through another, a distributor taking back what the maker shipped --
      // and refusing to say so left them with a return they could not correct.
      // Only a part with a single supplier locks now, because there the answer
      // really is the only answer.
      //
      // A serialized part is offered the three vendors that shipped it. Which
      // units go back is the finer decision and it lives in the unit picker;
      // the row only says how many of them go to whom.
      // A part goes back to at most five suppliers. Beyond that the card stops
      // being a decision and becomes a spreadsheet, and a return split six ways
      // is six documents nobody wanted.
      const shipped = vendorsForItem(line.sku).slice(0, MAX_VENDORS_PER_PART);
      // Nobody shipped it, so there is nothing to bound the choice with. The
      // vendors this line offers are the ones the user has named for it, built
      // out of the stock itself: the ceiling is what is in the building, and
      // the price is what the item is carried at.
      // Nothing shipped this line: either the stock has no receiver at all, or
      // it is going back in a unit no receiver is written in. Both mean the
      // same thing here -- no delivery to derive a vendor from, and no
      // supplier's figure that can act as a ceiling. Keying this on the
      // catalogue's unsourced list instead let a pallet line inherit the each
      // level suppliers and read "up to 144 PAL", a number in one unit wearing
      // the label of another.
      const unsourced = receipts.length === 0;
      const named = Object.keys(vendorAllocations[lineKey(line.sku, line.uom)] ?? {});
      // A vendor with no delivery of this part behind them, written as an
      // option so that naming one puts a row on the card. Without this a
      // choice outside the shipped list was accepted and then not drawn,
      // because the rows are built by matching allocations against options.
      const synth = (code: string) => {
        const v = vendorByCode(code);
        if (!v) return [];
        return [{
          vendorCode: v.vendorCode,
          vendorName: v.vendorName,
          poNumbers: [],
          receivings: [],
          receivedQty: line.receivedQty,
          // No history, so nothing of theirs can bound the figure. The line's
          // own count is the ceiling, which is the only true one here.
          returnableQty: line.receivedQty,
          uom: line.uom,
          unitPrice: line.unitPrice,
          lastReceivedDate: '',
        }];
      };
      const shippedCodes = new Set(shipped.map((o) => o.vendorCode));
      const options = unsourced
        ? named.flatMap(synth)
        : [...shipped, ...named.filter((code) => !shippedCodes.has(code)).flatMap(synth)];
      const locked = !serialized && !unsourced && options.length === 1;
      // A resolved slice names the vendor behind a receipt, and carries that
      // receipt's whole delivery -- not the share of it going back. Laying the
      // return quantity across the slices in order keeps the claim true: six
      // units coming back off a 180-unit delivery is six, not 180. Serialized
      // slices already sum to the units picked, so this leaves them alone.
      const spread = (slices: typeof resolved) => {
        let left = qty;
        return slices.flatMap((sl) => {
          const take = Math.min(left, sl.qty);
          left -= take;
          return take > 0 ? [{ ...sl, qty: take }] : [];
        });
      };
      const lockedBy: 'units' | 'sole-source' = 'sole-source';

      // Keyed by part and unit. Keyed by part alone, a helmet coming back as
      // eaches and as boxes merged into one line here and the two answers
      // became one.
      const existing = bySku.get(lineKey(line.sku, line.uom));
      if (existing) {
        existing.qty += qty;
        return;
      }
      bySku.set(lineKey(line.sku, line.uom), {
        key: lineKey(line.sku, line.uom),
        ...(unsourced ? { unsourced: true } : {}),
        sku: line.sku,
        description: line.description,
        uom: line.uom,
        qty,
        locked,
        ...(locked ? { lockedBy } : {}),
        // A serialized line's vendors are read off its units, whether or not
        // the part has a single supplier. Keeping the reading only for locked
        // lines left every multi-supplier serialized line with no vendor at
        // all -- the serial named one, the return did not carry it, and the
        // save refused a line the system could already answer.
        // The slices from `resolveFromSerials` already sum to the units named,
        // so they are taken as they are; receipt-derived ones are laid across
        // the quantity instead.
        resolved: serialized
          ? resolved
          : locked
            ? (resolved.length > 0 ? spread(resolved) : options.slice(0, 1).map((o) => ({
                vendorCode: o.vendorCode,
                vendorName: o.vendorName,
                qty,
                grnNumbers: o.receivings.slice(0, 3),
                poNumbers: o.poNumbers.slice(0, 3),
              })))
            : [],
        options: locked ? [] : options,
      });
    });
    return [...bySku.values()];
    // vendorAllocations is a dependency because an unsourced line's options
    // are built from the vendors named for it. Leaving it out froze those at
    // empty, so naming a vendor left the line with no options, no unplaced
    // units and no vendors -- and the whole section, gated on one of those,
    // unmounted the moment the user answered its only question.
  }, [isRma, lineItems, lineSliceAllocations, lineBucketSerials, lineSerials, lineLots, vendorAllocations, vendorByCode]);

  /** Every part arrives with a vendor already on it.
   *
   *  Derived, not stored. Seeding the allocation froze it at whatever the
   *  quantity happened to be when it was written -- and a serialized line grows
   *  as units are named, so a part seeded at one unit stayed at one while the
   *  line went to five. Computed here it always matches the line, and the first
   *  edit writes a real allocation that takes over from it.
   *
   *  Likeliest means: a vendor that can absorb the whole line on its own, and
   *  among those the most recent delivery, which is where shelf stock came from. */
  const vendorSplitFor = (line: ResolutionLine): Record<string, number> => {
    const given = vendorAllocations[line.key];
    if (given !== undefined) return given;
    if (line.locked || line.options.length === 0) return {};
    // Named units carry their own receiver, so a serialized part opens on the
    // suppliers the serials actually came from, each with the count that came
    // from them. Nothing to guess and nothing to rank.
    if (hasSerials(trackingModeFor(line.sku)) && line.resolved.length > 0) {
      const out: Record<string, number> = {};
      // Every vendor the units name, not the first five of them. The cap is a
      // product rule about how many suppliers a part may be *split across by
      // choice*; a serialized split is not a choice, it is read off the serial
      // numbers. Capping it meant a line whose units traced to eight vendors
      // reported eight on the first step and carried five into the second, and
      // the other three vendors' goods were dropped from the return without a
      // word -- the same silent half-save the capped candidate list used to
      // cause.
      line.resolved.forEach((sl) => {
        out[sl.vendorCode] = (out[sl.vendorCode] ?? 0) + sl.qty;
      });
      return out;
    }

    // Plain stock has no thread to follow and no vendor to derive, so it opens
    // on nobody. It used to open on the two most recent suppliers, split
    // proportionally -- but one bolt is any bolt, so that split was an
    // invention wearing the clothes of a fact, and the user could not tell
    // which of the two figures had been read off a document. The second step
    // asks instead.
    if (!line.unsourced) return {};
    const ranked = [...line.options].sort((a, b) => {
      const coversA = a.returnableQty >= line.qty ? 1 : 0;
      const coversB = b.returnableQty >= line.qty ? 1 : 0;
      if (coversA !== coversB) return coversB - coversA;
      return (b.lastReceivedDate ?? '').localeCompare(a.lastReceivedDate ?? '');
    }).slice(0, DEFAULT_VENDORS_PER_PART);

    // The quantity is divided between them, in proportion to what each of them
    // actually shipped. Handing the whole line to the first supplier because it
    // happened to be able to cover it left the second row sitting at zero --
    // which reads as a vendor that has been offered and refused, and is not
    // what opening on two suppliers was for. One unit is not a split, so a line
    // that small opens on one.
    const takers = line.qty >= 2 ? ranked.filter((o) => o.returnableQty > 0) : ranked.slice(0, 1);
    const pool = takers.reduce((n, o) => n + o.returnableQty, 0) || 1;

    const out: Record<string, number> = {};
    let left = line.qty;
    takers.forEach((o, i) => {
      const rest = takers.length - 1 - i;
      // The last taker takes whatever is left, so the line is covered even
      // where a supplier's receipts fall short of its share.
      const share = rest === 0
        ? left
        : Math.min(
            o.returnableQty,
            // Never all of it and never none of it: every taker on the row has
            // to leave at least one unit for each of the ones after it, and
            // keep at least one for itself.
            Math.max(1, Math.min(Math.round(line.qty * (o.returnableQty / pool)), left - rest)),
          );
      out[o.vendorCode] = Math.max(0, share);
      left -= Math.max(0, share);
    });
    return out;
  };

  /** The vendors this return actually settles with, once the locked lines are
   *  read and the open ones have been given an answer. This -- not the
   *  placeholder paperwork a line arrived on -- is what decides how many drafts
   *  saving creates, because a return is raised against a vendor. */
  useEffect(() => { resolutionLinesRef.current = resolutionLines; }, [resolutionLines]);

  const returnVendors = useMemo(() => {
    const names = new Map<string, string>();
    resolutionLines.forEach((line) => {
      if (line.locked) {
        line.resolved.forEach((slice) => names.set(slice.vendorCode, slice.vendorName));
        return;
      }
      const given = vendorSplitFor(line);
      line.options.forEach((option) => {
        if ((given[option.vendorCode] ?? 0) > 0) names.set(option.vendorCode, option.vendorName);
      });
    });
    return [...names.entries()].map(([code, name]) => ({ id: code, name }));
  }, [resolutionLines, vendorAllocations]);


  /** The return, grouped the way the returner holds it: one card per part, and
   *  inside it the vendors that part can go back to.
   *
   *  The purchase-order cart groups by vendor because an order has one supplier
   *  and many parts. A return is the other way round -- a part in hand may have
   *  come from any of several suppliers -- so the axes swap. */
  /** Where each named unit of a serialized line came from. The vendor and the
   *  receiver are not asked for on these lines: the serial already carries
   *  them, so the pane reports them rather than offering them. */
  const serialOriginsFor = (sku: string) => {
    const li = lineItems.find((l) => l.sku === sku);
    if (!li) return [];
    // A lot-serialized unit knows its batch and its delivery the same way a
    // plain serial does, so the answer comes from the same place and the
    // steps after this one cannot tell the two apart. The batch is what the
    // user picks; the document falls out of the unit.
    if (trackingModeFor(sku) === 'lot-serialized') {
      const wanted = new Set((lineLots[li.id] ?? []).flatMap((a) => a.serials ?? []));
      if (wanted.size === 0) return [];
      return lotUnitPool(li.sku, li.uom ?? 'EA')
        .filter((u) => wanted.has(u.serial))
        .map((u) => ({
          serial: u.serial,
          vendorCode: u.vendorCode,
          vendorName: u.vendorName,
          poNumber: u.poNumber,
          grnNumber: u.grnNumber,
          origin: 'received' as const,
          date: u.date,
        }));
    }
    const receipts = (li.receipts ?? []).map((r) => ({
      grnNumber: r.grnNumber,
      receivedQty: r.receivedQty,
    }));
    // Only units the user has actually named. `serialsForLine` falls back to
    // the first few of the pool so a row starts out consistent with its
    // count, which is right on the first step and wrong here: it made the
    // second step open already answered, with a vendor and a receiving
    // document nobody had chosen and no sign that a choice had been made for
    // them.
    const origins = serialOrigins(
      li.sku,
      li.id,
      li.receivedQty,
      receipts,
      lineSerials[li.id] ?? [],
    );
    // The receiver's date lives on the provenance record rather than on the
    // line's receipts, and a document reads as a document only once it is
    // dated -- so it is joined on here, where both are to hand.
    const dated = new Map<string, string>();
    [...new Set(origins.map((o) => o.vendorCode))].forEach((code) =>
      receiversFor(li.sku, code).forEach((r) => dated.set(r.grnNumber, r.date)),
    );
    return origins.map((o) => ({ ...o, date: dated.get(o.grnNumber) ?? '' }));
  };

  const itemCards = useMemo(
    () =>
      resolutionLines.map((line) => {
        const given = vendorSplitFor(line);
        const placed = line.locked
          ? line.resolved.reduce((n, sl) => n + sl.qty, 0)
          : Object.values(given).reduce((n, q) => n + q, 0);
        const spare = Math.max(0, Math.round((line.qty - placed) * 100) / 100);

        // Who has actually delivered this part. A row for anybody else is a
        // routing decision rather than a reversal, and has to say so.
        const shippedHere = new Set(vendorsForItem(line.sku).map((o) => o.vendorCode));

        const rows: VendorRow[] = line.locked
          ? line.resolved.map((sl) => ({
              vendorCode: sl.vendorCode,
              vendorName: sl.vendorName,
              qty: sl.qty,
              cap: sl.qty,
              shipped: true,
              locked: true,
              trail: [...sl.poNumbers.slice(0, 2), ...sl.grnNumbers.slice(0, 1)].join(', '),
              unitPrice: lineItems.find((x) => x.sku === line.sku)?.unitPrice ?? 0,
            }))
          // Every vendor the split names, whether or not the candidate list
          // reached them. It is capped at the few most relevant suppliers,
          // which is right for offering a choice and wrong for reporting one
          // already made: a serialized part can trace to any of eighty
          // deliveries across eight vendors, so a share against a vendor
          // outside the top few had no row, went uncounted, and left the line
          // looking short of the figure it had actually placed.
          : Object.keys(given).map((code) => {
              const o = line.options.find((x) => x.vendorCode === code);
              const slice = line.resolved.find((sl) => sl.vendorCode === code);
              return {
                vendorCode: code,
                vendorName:
                  o?.vendorName ??
                  slice?.vendorName ??
                  vendorByCode(code)?.vendorName ??
                  code,
                qty: given[code] ?? 0,
                // What they shipped, stated on the row. Not a ceiling: the
                // figure entered on the first step is where the count starts,
                // not where it stops.
                cap: o?.returnableQty ?? given[code] ?? 0,
                shipped: shippedHere.has(code),
                locked: false,
                trail: o
                  ? [...o.poNumbers.slice(0, 2), ...o.receivings.slice(0, 1)].join(', ')
                  : [...(slice?.poNumbers ?? []).slice(0, 2), ...(slice?.grnNumbers ?? []).slice(0, 1)].join(', '),
                unitPrice: o?.unitPrice ?? lineItems.find((x) => x.sku === line.sku)?.unitPrice ?? 0,
              };
            });

        const addable: AddableVendor[] = line.locked
          ? []
          : Object.keys(given).length >= MAX_VENDORS_PER_PART
            ? []
            : line.unsourced
              // Nobody shipped it, so nothing narrows the list: any partner can
              // agree to take it. The ceiling is the stock itself.
              ? mockVendors
                  .filter((v) => !(v.vendorCode in given))
                  .map((v) => ({ code: v.vendorCode, name: v.vendorName, cap: line.qty }))
              : line.options
                  .filter((o) => !(o.vendorCode in given))
                  .map((o) => ({
                    code: o.vendorCode,
                    name: o.vendorName,
                    // What they shipped. It read "up to 0" when the line was
                    // already placed, which made a list of perfectly good
                    // suppliers look broken.
                    cap: o.returnableQty,
                  }));

        return { line, rows, addable, placed, spare };
      }),
    [resolutionLines, vendorAllocations, lineItems],
  );

  /** The same allocations, read by vendor instead of by line.
   *
   *  The resolution panel asked "for this part, who takes how much"; the cards
   *  ask "for this vendor, what is going back". Same state underneath -- one
   *  question, asked in the shape of the thing being built rather than the
   *  shape of the thing being decided. */
  const vendorLegs = useMemo(() => {
    type Row = { key: string; sku: string; description: string; uom: string; qty: number; cap: number; locked: boolean; trail: string; serialized: boolean };
    type Spare = { key: string; sku: string; description: string; uom: string; headroom: number };
    const byVendor = new Map<string, { vendorCode: string; vendorName: string; rows: Row[]; eligible: Spare[] }>();
    const touch = (code: string, name: string) => {
      let leg = byVendor.get(code);
      if (!leg) { leg = { vendorCode: code, vendorName: name, rows: [], eligible: [] }; byVendor.set(code, leg); }
      return leg;
    };

    resolutionLines.forEach((line) => {
      const base = {
        sku: line.sku,
        description: line.description,
        uom: line.uom,
        serialized: trackingModeFor(line.sku) === 'serialized',
      };

      if (line.locked) {
        line.resolved.forEach((slice) => {
          touch(slice.vendorCode, slice.vendorName).rows.push({
            ...base,
            key: `${line.key}:${slice.vendorCode}`,
            qty: slice.qty,
            cap: slice.qty,
            locked: true,
            trail: [...slice.poNumbers.slice(0, 2), ...slice.grnNumbers.slice(0, 1)].join(', '),
          });
        });
        return;
      }

      const given = vendorSplitFor(line);
      const placed = Object.values(given).reduce((n, q) => n + q, 0);
      const spare = Math.max(0, line.qty - placed);

      // A leg for every vendor the split names, whether or not the candidate
      // list reached them -- it is capped, and a serialized line's units can
      // trace to a vendor well outside the top few. Walking the options alone
      // meant such a share had no leg, so it never reached the confirmation
      // and the return saved half of itself without a word.
      Object.keys(given).forEach((code) => {
        const o = line.options.find((x) => x.vendorCode === code);
        const slice = line.resolved.find((sl) => sl.vendorCode === code);
        const name = o?.vendorName ?? slice?.vendorName ?? vendorByCode(code)?.vendorName ?? code;
        touch(code, name).rows.push({
          ...base,
          key: `${line.key}:${code}`,
          qty: given[code] ?? 0,
          // What they shipped, full stop. It used to be clamped by what the
          // line still had to give, which was harmless while the ceiling was
          // only a hint -- but now that it is enforced, the same vendor read
          // "up to 3" on their own card and accepted 320 on the item's, and
          // the block quoted the second. One number, and it is theirs.
          cap: o?.returnableQty ?? given[code] ?? 0,
          locked: false,
          trail: o
            ? o.poNumbers.length > 0
              ? `PO ${o.poNumbers.slice(0, 2).join(', ')}`
              : ''
            : (slice?.poNumbers ?? []).length > 0
              ? `PO ${(slice?.poNumbers ?? []).slice(0, 2).join(', ')}`
              : '',
        });
      });

      // What is left over, offered to whoever else shipped the part.
      line.options.forEach((o) => {
        if (o.vendorCode in given) return;
        if (spare > 0 && byVendor.has(o.vendorCode)) {
          byVendor.get(o.vendorCode)!.eligible.push({
            ...base,
            key: `${line.key}:${o.vendorCode}`,
            headroom: Math.min(o.returnableQty, spare),
          });
        }
      });
    });

    // A vendor named by hand but not yet given anything, plus the parts they
    // could take. Without this the card would appear and have nothing to offer.
    extraVendors.forEach((code) => {
      const supply = resolutionLines.flatMap((l) => l.options).find((o) => o.vendorCode === code);
      if (supply) touch(code, supply.vendorName);
    });

    // Second pass for eligibility, so a vendor added late still gets offered
    // everything they shipped rather than only the lines walked after them.
    byVendor.forEach((leg) => {
      leg.eligible = [];
      resolutionLines.forEach((line) => {
        if (line.locked) return;
        const given = vendorSplitFor(line);
        if ((given[leg.vendorCode] ?? 0) > 0) return;
        const placed = Object.values(given).reduce((n, q) => n + q, 0);
        const spare = Math.max(0, line.qty - placed);
        if (spare <= 0) return;
        const option = line.options.find((o) => o.vendorCode === leg.vendorCode);
        if (!option) return;
        leg.eligible.push({
          key: `${line.key}:${leg.vendorCode}`,
          sku: line.sku,
          description: line.description,
          uom: line.uom,
          headroom: Math.min(option.returnableQty, spare),
        });
      });
    });

    return [...byVendor.values()];
  }, [resolutionLines, vendorAllocations, extraVendors, lineItems]);

  /** Which of a vendor's own sites the returning goods came from. A purchase
   *  order is placed with one site and its receipts inherit it, so the sites
   *  are read off the receipts carrying these parts rather than guessed. */
  /** What the routing panel needs: who is taking how many parts. One vendor is
   *  one return, so there is nothing else to report. */
  const groupingLegs = useMemo(
    () =>
      vendorLegs
        .map((leg) => {
          const rows = leg.rows.filter((r) => r.qty > 0);
          const skus = new Set(rows.map((r) => r.sku));
          const uoms = new Set(rows.map((r) => r.uom));
          const vendor = mockVendors.find((v) => v.vendorCode === leg.vendorCode);
          return {
            vendorCode: leg.vendorCode,
            vendorName: leg.vendorName,
            partCount: skus.size,
            units: rows.reduce((n, r) => n + r.qty, 0),
            uom: uoms.size === 1 ? [...uoms][0]! : 'units',
            items: rows.map((r) => ({ sku: r.sku, qty: r.qty, uom: r.uom })),
            ...(vendor?.familyCode
              ? { familyCode: vendor.familyCode, familyName: vendor.familyName }
              : {}),
          };
        })
        // A vendor offered on a part but given none of it is not a return.
        // Counting them would promise paperwork nobody raises, and the choice
        // being made here is how many documents come out of this.
        .filter((leg) => leg.units > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendorLegs],
  );

  /* Coming in by vendor answers the vendor question outright: the partner was
   * named before a single part was picked, so every counted line lands on them
   * rather than opening a candidate list that asks again. A serialized line is
   * left alone -- its vendor is read off the units, and the units may well name
   * somebody else. */
  const locked = useRef(new Set<string>());
  useEffect(() => {
    if (!lockedVendor) return;
    lineItems.forEach((li) => {
      if (locked.current.has(li.id)) return;
      // A lot line is answered here too. Its lots are still unasked for -- that
      // picker is not built -- but the vendor is not in question on this route,
      // and leaving it blank blocked the save on a line the user chose out of
      // that vendor's own catalogue.
      if (hasSerials(trackingModeFor(li.sku))) return;
      const qty = Number(li.invoiceQty ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) return;
      locked.current.add(li.id);
      pickCountedVendor(li.sku, li.uom ?? 'EA', qty, lockedVendor);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedVendor, lineItems]);

  /** The second step's groups: every vendor with a share of this return, and
   *  the lines that are theirs. Built off `vendorLegs`, so a serialized line
   *  traced to two vendors appears under both, as two shares. */
  const stepTwoLegs = useMemo(
    () =>
      vendorLegs
        .map((leg) => {
          const vendor = mockVendors.find((v) => v.vendorCode === leg.vendorCode);
          return {
            vendorCode: leg.vendorCode,
            vendorName: leg.vendorName,
            description: vendorDescription(leg.vendorName),
            ...(vendor?.familyCode
              ? { familyCode: vendor.familyCode, familyName: vendor.familyName }
              : {}),
            items: leg.rows
              .filter((r) => r.qty > 0)
              .map((r) => {
                // What the four figures on the card report. A counted share
                // reads its ties; a serialized one reads the documents its
                // units actually came in on.
                const ties = itemTies[lineKey(r.sku, r.uom)]?.[leg.vendorCode]?.ties ?? {};
                const origins = r.serialized
                  ? serialOriginsFor(r.sku).filter((o) => o.vendorCode === leg.vendorCode)
                  : [];
                return {
                  sku: r.sku,
                  description: r.description,
                  uom: r.uom,
                  qty: r.qty,
                  cap: r.cap,
                  tied: r.serialized
                    ? origins.length
                    : Object.values(ties).reduce((n, q) => n + q, 0),
                  docs: r.serialized
                    ? new Set(origins.map((o) => o.grnNumber)).size
                    : Object.keys(ties).length,
                  trackingMode: trackingModeFor(r.sku),
                };
              }),
          };
        })
        .filter((leg) => leg.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendorLegs, itemTies, lineSerials, lineLots],
  );

  /** On the return but nobody named to take them back. They cannot be grouped,
   *  so they do not come to the second step -- said out loud there rather than
   *  dropped without a word. */
  const unnamedLines = useMemo(() => {
    const placed = new Set(stepTwoLegs.flatMap((leg) => leg.items.map((i) => i.sku)));
    return lineItems
      .filter((li) => !placed.has(li.sku))
      // A line with no figure against it is not on the return at all -- it is
      // a part sitting on the rail waiting to be asked about. Flagging those
      // as unanswered turned a vendor's whole catalogue into a warning.
      .filter((li) => Number(li.invoiceQty ?? 0) > 0)
      .map((li) => ({ sku: li.sku, description: li.description }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepTwoLegs, lineItems]);

  /** The vendor half of the line sheet: who is taking it, how much of the
   *  return is theirs, and what it is worth to them. */
  const detailVendor = useMemo(() => {
    if (!vendorSheetCode) return null;
    const leg = vendorLegs.find((v) => v.vendorCode === vendorSheetCode);
    if (!leg) return null;
    const rows = leg.rows.filter((r) => r.qty > 0);
    const uoms = new Set(rows.map((r) => r.uom));
    return {
      vendorCode: leg.vendorCode,
      vendorName: leg.vendorName,
      partCount: rows.length,
      units: rows.reduce((n, r) => n + r.qty, 0),
      uom: uoms.size === 1 ? [...uoms][0]! : 'units',
      value: rows.reduce((sum, r) => {
        const li = lineItems.find((x) => x.sku === r.sku);
        return sum + r.qty * (li?.unitPrice ?? 0);
      }, 0),
    };
  }, [vendorSheetCode, vendorLegs, lineItems]);

  /** How many documents this saves as, under the answers given. */
  /**
   * The drafts saving will actually raise, with what each one carries.
   *
   * The routing panel states a count; this is the same answer in the shape the
   * save needs, so the confirmation before saving and the records that come out
   * of it cannot disagree. A merged family collapses into the branch that took
   * it, exactly as the panel shows it.
   */
  const vendorDrafts = useMemo(() => {
    const holderOf = (vendorCode: string) => {
      if (splitMode !== 'merge') return vendorCode;
      const vendor = mockVendors.find((v) => v.vendorCode === vendorCode);
      const holder = vendor?.familyCode ? mergeInto[vendor.familyCode] : undefined;
      return holder ?? vendorCode;
    };

    const byHolder = new Map<
      string,
      VendorDraft
    >();

    vendorLegs.forEach((leg) => {
      const rows = leg.rows.filter((r) => r.qty > 0);
      if (rows.length === 0) return;
      const holder = holderOf(leg.vendorCode);
      const holderLeg = vendorLegs.find((l) => l.vendorCode === holder) ?? leg;
      const entry = byHolder.get(holder) ?? {
        vendorCode: holder,
        vendorName: holderLeg.vendorName,
        lines: [],
      };
      rows.forEach((r) =>
        entry.lines.push({
          sku: r.sku,
          qty: r.qty,
          uom: r.uom,
          // The ties belong to this vendor's share of the item, not to the
          // item: each vendor's credit unwinds its own deliveries.
          //
          // A counted part is tied by hand, because nothing can derive it. A
          // serialized one is tied by its units: the serial was on a receiver,
          // so the receivers behind this vendor's units are what its credit
          // unwinds, and asking would be asking twice. Without this the
          // serialized draft fell back to every receipt on the invoice and
          // claimed to reverse a hundred documents it never touched.
          // The units behind this vendor's share, so each record carries only
          // what its own vendor sent.
          ...(hasSerials(trackingModeFor(r.sku))
            ? {
                serials: serialOriginsFor(r.sku)
                  .filter((o) => o.vendorCode === leg.vendorCode)
                  .map((o) => o.serial),
              }
            : {}),
          ...(hasSerials(trackingModeFor(r.sku))
            ? {
                ties: (() => {
                  const byGrn = new Map<string, number>();
                  serialOriginsFor(r.sku)
                    .filter((o) => o.vendorCode === leg.vendorCode)
                    .forEach((o) => byGrn.set(o.grnNumber, (byGrn.get(o.grnNumber) ?? 0) + 1));
                  return [...byGrn].map(([grnNumber, qty]) => ({ grnNumber, qty }));
                })(),
              }
            : itemTies[lineKey(r.sku, r.uom)]?.[leg.vendorCode]?.untied
              ? { untied: true, ties: [] }
              : {
                  ties: Object.entries(itemTies[lineKey(r.sku, r.uom)]?.[leg.vendorCode]?.ties ?? {}).map(
                    ([grnNumber, qty]) => ({ grnNumber, qty }),
                  ),
                }),
          // Kept so a merged draft can still say whose goods each line was.
          fromVendorCode: leg.vendorCode,
          fromVendorName: leg.vendorName,
        }),
      );
      byHolder.set(holder, entry);
    });

    return [...byHolder.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorLegs, splitMode, mergeInto, itemTies, lineSerials, lineLots, lineItems]);

  /** One per RMA the save will write, which is one per vendor once the merge
   *  and split step has had its say. What the last step asks its two questions
   *  about, and what a merged pair collapses into. */
  /** What one receipt line was actually paid for. */
  const paidOnReceipt = (sku: string, grnNumber: string): number => {
    for (const v of mockVendors) {
      const grn = v.receivingDocuments.find((g) => g.grnNumber === grnNumber);
      if (!grn) continue;
      const item = grn.items.find((i) => i.sku === sku);
      if (!item) return 0;
      return paidQtyForReceiptLine(
        grnNumber,
        sku,
        Math.min(item.invoicedQty ?? 0, item.quantity),
        item.quantity,
      );
    }
    return 0;
  };

  /** What of this return is tied to a receipt that has already been paid.
   *
   *  Per receipt, not per line: the resolution question exists only where the
   *  money has already gone out, and that is a fact about the document the
   *  credit reverses. Goods never billed credit the accrual on shipment and
   *  goods on an open invoice take a vendor credit against it, both without
   *  anybody choosing and both with a GL impact the user does not assess. */
  /** What the units picked on a numbered line were paid for.
   *
   *  A serial names its own receipt, so these lines never write a tie and the
   *  tie-reading calculation below could not see them: every serialized return
   *  came out with nothing paid and skipped the credit-or-refund step
   *  entirely. Counted per unit, against the document it came in on. */
  const paidFromUnits = (li: (typeof lineItems)[number]) => {
    const out: { vendorCode: string; qty: number; value: number }[] = [];
    const byPair = new Map<string, { vendorCode: string; grnNumber: string; units: number }>();
    serialOriginsFor(li.sku).forEach((o) => {
      const key = `${o.vendorCode}|${o.grnNumber}`;
      const at = byPair.get(key);
      if (at) at.units += 1;
      else byPair.set(key, { vendorCode: o.vendorCode, grnNumber: o.grnNumber, units: 1 });
    });
    byPair.forEach(({ vendorCode, grnNumber, units }) => {
      const paid = paidOnReceipt(li.sku, grnNumber);
      if (paid <= 0) return;
      const take = Math.min(units, paid);
      out.push({
        vendorCode,
        qty: take,
        value: Math.round(take * (li.originalUnitPrice ?? li.unitPrice) * 100) / 100,
      });
    });
    return out;
  };

  /** What a counted line's share was paid for, when nothing has been tied.
   *
   *  Receiving documents are chosen rather than inherited now, so a counted
   *  line reaches the settlement step with no ties behind it and the
   *  tie-reading calculation saw nothing paid -- which is not what is true of
   *  the goods. The share is laid across that vendor's deliveries, newest
   *  first, exactly as a tie would lay it, and what those deliveries were paid
   *  for is what the return is settling. Tie a document and the real figures
   *  take over. */
  const paidFromReceipts = (sku: string, uom: string, vendorCode: string, qty: number) => {
    // The vendor's whole history of the part, not the newest few documents.
    //
    // Laying the return across the most recent deliveries and reading those
    // made the answer depend on which documents happened to be at the top: a
    // part this vendor has largely been paid for came back as nothing paid
    // because its last two receipts were still open, and the settlement step
    // vanished. Their paid share of the part is the honest estimate until the
    // user ties actual documents, and tying any takes over from it.
    const rows = receiversFor(sku, vendorCode).filter((r) => r.uom === uom);
    let received = 0;
    let paid = 0;
    rows.forEach((r) => {
      received += r.qty;
      paid += Math.min(r.qty, paidOnReceipt(sku, r.grnNumber));
    });
    if (received <= 0 || paid <= 0) return 0;
    return Math.min(qty, Math.round(qty * (paid / received) * 100) / 100);
  };

  /** What a counted batch's share was paid for.
   *
   *  A lot line names its vendor by the batch rather than by an allocation, so
   *  the allocation-reading fallback could not see it and a bolt return
   *  finished without ever being asked how it settles. The quantity taken out
   *  of each batch is laid across that batch's own deliveries, which is where
   *  the money went. */
  const paidFromLots = (li: (typeof lineItems)[number]) => {
    const picks = lineLots[li.id] ?? [];
    if (picks.length === 0) return null;
    const blocks = lotBlocksFor(li.sku, li.uom ?? 'EA');
    let vendorCode: string | null = null;
    let paidQty = 0;
    picks.forEach((pick) => {
      const block = blocks.find((b) => b.lot === pick.lot);
      if (!block) return;
      const owner = lotVendorFor(block);
      if (owner && !vendorCode) vendorCode = owner.vendorCode;
      let left = pick.qty;
      block.receipts.forEach((r) => {
        if (left <= 0) return;
        const take = Math.min(left, r.qty);
        paidQty += Math.min(take, paidOnReceipt(li.sku, r.grnNumber));
        left = Math.round((left - take) * 100) / 100;
      });
    });
    return vendorCode ? { vendorCode, qty: Math.round(paidQty * 100) / 100 } : null;
  };

  const paidByVendor = useMemo(() => {
    const out = new Map<string, { qty: number; value: number }>();
    lineItems.forEach((li) => {
      if (li.invoiceQty <= 0) return;
      if (hasSerials(trackingModeFor(li.sku))) {
        paidFromUnits(li).forEach(({ vendorCode, qty, value }) => {
          const at = out.get(vendorCode) ?? { qty: 0, value: 0 };
          at.qty = Math.round((at.qty + qty) * 100) / 100;
          at.value = Math.round((at.value + value) * 100) / 100;
          out.set(vendorCode, at);
        });
        return;
      }
      const uom = li.uom ?? 'EA';
      const entry = itemTies[lineKey(li.sku, uom)] ?? {};
      const tied = Object.values(entry).some(
        (held) => !held.untied && Object.keys(held.ties ?? {}).length > 0,
      );
      if (!tied) {
        // A batch names its own vendor, so a lot line is read off its picks
        // and everything else off the vendor it was placed with.
        const fromLots = paidFromLots(li);
        const vendorCode =
          fromLots?.vendorCode ??
          Object.keys(vendorAllocations[lineKey(li.sku, uom)] ?? {}).find(
            (code) => (vendorAllocations[lineKey(li.sku, uom)]?.[code] ?? 0) > 0,
          );
        if (!vendorCode) return;
        const qty = fromLots ? fromLots.qty : paidFromReceipts(li.sku, uom, vendorCode, li.invoiceQty);
        if (qty <= 0) return;
        const at = out.get(vendorCode) ?? { qty: 0, value: 0 };
        at.qty = Math.round((at.qty + qty) * 100) / 100;
        at.value =
          Math.round((at.value + qty * (li.originalUnitPrice ?? li.unitPrice)) * 100) / 100;
        out.set(vendorCode, at);
        return;
      }
      Object.entries(entry).forEach(([vendorCode, held]) => {
        Object.entries(held.ties ?? {}).forEach(([grnNumber, qty]) => {
          const paid = paidOnReceipt(li.sku, grnNumber);
          if (paid <= 0) return;
          const take = Math.min(qty, paid);
          const at = out.get(vendorCode) ?? { qty: 0, value: 0 };
          at.qty = Math.round((at.qty + take) * 100) / 100;
          at.value =
            Math.round((at.value + take * (li.originalUnitPrice ?? li.unitPrice)) * 100) / 100;
          out.set(vendorCode, at);
        });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems, itemTies, lineSerials, lineLots, vendorAllocations]);

  /** The same figure, held per part rather than per vendor.
   *
   *  The resolution step asks its question of the parts that were paid for,
   *  not of the whole document: a return carrying one paid part and two
   *  unbilled ones has one thing to decide and two that unwind on their own,
   *  and a single vendor-level total said nothing about which was which. */
  const paidByVendorItem = useMemo(() => {
    const out = new Map<string, { qty: number; value: number }>();
    lineItems.forEach((li) => {
      if (li.invoiceQty <= 0) return;
      const uom = li.uom ?? 'EA';
      if (hasSerials(trackingModeFor(li.sku))) {
        paidFromUnits(li).forEach(({ vendorCode, qty, value }) => {
          const key = `${vendorCode}|${li.sku}|${uom}`;
          const at = out.get(key) ?? { qty: 0, value: 0 };
          at.qty = Math.round((at.qty + qty) * 100) / 100;
          at.value = Math.round((at.value + value) * 100) / 100;
          out.set(key, at);
        });
        return;
      }
      const entry = itemTies[lineKey(li.sku, uom)] ?? {};
      const tied = Object.values(entry).some(
        (held) => !held.untied && Object.keys(held.ties ?? {}).length > 0,
      );
      if (!tied) {
        // A batch names its own vendor, so a lot line is read off its picks
        // and everything else off the vendor it was placed with.
        const fromLots = paidFromLots(li);
        const vendorCode =
          fromLots?.vendorCode ??
          Object.keys(vendorAllocations[lineKey(li.sku, uom)] ?? {}).find(
            (code) => (vendorAllocations[lineKey(li.sku, uom)]?.[code] ?? 0) > 0,
          );
        if (!vendorCode) return;
        const qty = fromLots ? fromLots.qty : paidFromReceipts(li.sku, uom, vendorCode, li.invoiceQty);
        if (qty <= 0) return;
        const key = `${vendorCode}|${li.sku}|${uom}`;
        const at = out.get(key) ?? { qty: 0, value: 0 };
        at.qty = Math.round((at.qty + qty) * 100) / 100;
        at.value =
          Math.round((at.value + qty * (li.originalUnitPrice ?? li.unitPrice)) * 100) / 100;
        out.set(key, at);
        return;
      }
      Object.entries(entry).forEach(([vendorCode, held]) => {
        Object.entries(held.ties ?? {}).forEach(([grnNumber, qty]) => {
          const paid = paidOnReceipt(li.sku, grnNumber);
          if (paid <= 0) return;
          const take = Math.min(qty, paid);
          const key = `${vendorCode}|${li.sku}|${uom}`;
          const at = out.get(key) ?? { qty: 0, value: 0 };
          at.qty = Math.round((at.qty + take) * 100) / 100;
          at.value =
            Math.round((at.value + take * (li.originalUnitPrice ?? li.unitPrice)) * 100) / 100;
          out.set(key, at);
        });
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems, itemTies, lineSerials, lineLots, vendorAllocations]);

  const hasPaidValue = useMemo(
    () =>
      [...paidByVendor.values()].some((p) => p.value > 0.004) ||
      // A return with anything on it settles somehow, and how it settles is a
      // question the plan should show from the first screen rather than
      // producing halfway through. Numbered stock is billed in full here and
      // counted stock is billed for most of what it carries, so a line with a
      // quantity on it is a line with money behind it; which vendor it is
      // with, and how much of it they have been paid, is what the steps
      // between here and there work out.
      lineItems.some((li) => li.invoiceQty > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paidByVendor, lineItems],
  );

  /** The currency a vendor's return is already in: the PO currency of any
   *  receipt picked for that vendor, on any line (counted ties and serialized
   *  units both land in itemTies). One return, one currency: a receipt from a PO
   *  in another currency goes on a separate return (step 4 greys it out). */
  const currencyLockFor = (vendorCode: string): string | null => {
    for (const byVendor of Object.values(itemTies)) {
      const entry = byVendor[vendorCode];
      if (!entry) continue;
      for (const [grn, q] of Object.entries(entry.ties)) {
        if (q > 0) {
          const c = receiptCurrency(vendorCode, grn);
          if (c) return c;
        }
      }
    }
    return null;
  };

  /** The PO the return's currency comes from: the first picked receipt's, for
   *  "Return currency GBP · from PO-11151" on step 5 (2026-11-24). */
  const currencyPOFor = (vendorCode: string): string | null => {
    for (const byVendor of Object.values(itemTies)) {
      const entry = byVendor[vendorCode];
      if (!entry) continue;
      for (const [grn, q] of Object.entries(entry.ties)) {
        if (q > 0) {
          const po = receiptPO(vendorCode, grn);
          if (po) return po;
        }
      }
    }
    return null;
  };

  const resolutionTargets = useMemo(
    () =>
      vendorDrafts.map((draft) => {
        const uoms = [...new Set(draft.lines.map((l) => l.uom))];
        return {
          vendorCode: draft.vendorCode,
          vendorName: draft.vendorName,
          // Where they are, not what they do. The address is what tells two
          // partners of the same name apart, and it is the line every other
          // step now shows under a vendor.
          address: vendorAddress(draft.vendorCode),
          lineCount: draft.lines.length,
          units: Math.round(draft.lines.reduce((n, l) => n + l.qty, 0) * 100) / 100,
          // What of this vendor's share has already been paid for. It is the
          // only thing left to ask about: goods never billed unwind their
          // accrual and goods on an open invoice take a vendor credit, both
          // without a decision. Money already out is the one case with two
          // answers in it.
          paidQty: paidByVendor.get(draft.vendorCode)?.qty ?? 0,
          paidValue: paidByVendor.get(draft.vendorCode)?.value ?? 0,
          uom: uoms.length === 1 ? uoms[0]! : 'units',
          // The return's currency: its picked receipts' PO currency, else (a
          // line going back untied) the PO its line item came on, which is the
          // PO the saved return names. Paid, Total and Total Charges read in it
          // on the Credit or refund step.
          currency:
            currencyLockFor(draft.vendorCode) ??
            poCurrency(lineItems.find((li) => draft.lines.some((l) => l.sku === li.sku) && li.poNumber)?.poNumber),
          // Where that currency comes from: "from PO-11151".
          currencyPO:
            currencyPOFor(draft.vendorCode) ??
            ((po) => (po ? `PO-${poKey(po)}` : null))(
              lineItems.find((li) => draft.lines.some((l) => l.sku === li.sku) && li.poNumber)?.poNumber,
            ),
          // What is actually going back to them, so the card can show the
          // parts rather than a count of them, and say on hover what the
          // steps before it settled for each one.
          items: draft.lines.map((l) => {
            const mode = trackingModeFor(l.sku);
            const serials = l.serials ?? [];
            const lots = lineLots[
              currentPOItems.find((i) => i.sku === l.sku)?.id ?? ''
            ] ?? [];
            // `ties` is a list of { grnNumber, qty }, not a map: reading its
            // keys gave the array's indices, so the hover said "0".
            const docs = [...new Set((l.ties ?? []).map((t) => t.grnNumber))];
            // What of this part's share the vendor has already been paid
            // for. Capped at what is going back: a receipt paid in full is
            // still only paid for the units being returned.
            //
            // Numbered stock is billed in full, so when the units have not
            // been named yet -- or were named against a document this map
            // cannot see -- the line is still paid for. Without that fallback
            // the step opened on a serialized return with the question it
            // exists to ask greyed out of it.
            const paidHere = paidByVendorItem.get(`${draft.vendorCode}|${l.sku}|${l.uom}`);
            const numbered = hasSerials(mode);
            const linePrice =
              currentPOItems.find((i) => i.sku === l.sku)?.originalUnitPrice ??
              currentPOItems.find((i) => i.sku === l.sku)?.unitPrice ??
              0;
            const paidQty = paidHere ? Math.min(l.qty, paidHere.qty) : numbered ? l.qty : 0;
            return {
              sku: l.sku,
              description:
                currentPOItems.find((i) => i.sku === l.sku)?.description ?? l.sku,
              qty: l.qty,
              uom: l.uom,
              trackingMode: mode,
              serials: serials.slice(0, 6),
              serialCount: serials.length,
              lots: lots.map((a) => a.lot).slice(0, 4),
              documents: docs.slice(0, 4),
              // Nothing tied behind it, so there is no invoice to check the
              // money against. A refund or a credit stays open to it rather
              // than being ruled out by a payment nobody can look up.
              unlinked: docs.length === 0,
              // What the whole of this line's share is worth, which is what a
              // credit covers when the goods were never billed.
              value: Math.round(l.qty * linePrice * 100) / 100,
              paidQty,
              // The units that were paid for, at the line's own price. It was
              // apportioned off the invoice's recorded total instead, which
              // is a different arithmetic from the one the saved return uses
              // for the same figure: the step offered "$3,635.14 you can get
              // back" and the record it wrote said $3,609.58.
              paidValue:
                (paidHere && paidHere.qty > 0) || numbered
                  ? Math.round(paidQty * linePrice * 100) / 100
                  : 0,
              // Only a part paid for in full has a refund or a credit to ask
              // about. A part half-billed still has an open invoice behind
              // the rest of it, which takes a vendor credit on its own.
              fullyPaid: paidQty >= l.qty - 0.004 && paidQty > 0.004,
            };
          }),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendorDrafts, lineLots, currentPOItems, paidByVendor, paidByVendorItem, itemTies, lineItems],
  );

  /** Every vendor this part was received from, with what they delivered: the
   *  candidates for a return that cannot name its own source. */
  /** Everyone the return could name.
   *
   *  The ones who delivered the part first, with what they delivered, because
   *  that is the judgement the brief asks for. Then everyone else, because a
   *  counted part can go back to somebody who never shipped it: a distributor
   *  taking back what the maker sold, a partner who issued the credit. That
   *  second group was written and never wired, so the choice the flow claimed
   *  to offer could not actually be made. */
  const resolveCandidates = (line: ResolutionLine) => {
    const shipped = vendorsForItem(line.sku).map((o) => ({
      vendorCode: o.vendorCode,
      vendorName: o.vendorName,
      lifetime: o.returnableQty,
      recent: receivedSince(line.sku, o.vendorCode, 30),
      shipped: true,
    }));
    const known = new Set(shipped.map((c) => c.vendorCode));
    const rest = [...mockVendors, ...adHocVendors]
      .filter((v) => !known.has(v.vendorCode))
      .map((v) => ({
        vendorCode: v.vendorCode,
        vendorName: v.vendorName,
        lifetime: 0,
        recent: 0,
        shipped: false,
      }));
    return [...shipped, ...rest];
  };

  /** The chosen vendor's own deliveries of this part. */
  const receiversForLine = (line: ResolutionLine) => {
    const chosen = Object.keys(vendorAllocations[line.key] ?? {})[0];
    return chosen ? receiversInUom(line.sku, chosen, line.uom) : [];
  };

  /** A vendor's deliveries of this part, in the unit the return is written in.
   *
   *  Shelves do not convert here: a pallet is not a number of eaches, it is a
   *  different thing on a different shelf. So a return going back in pallets
   *  cannot be tied to a receipt written in eaches -- the figures would line
   *  up on screen and mean nothing. Where the vendor has nothing in the
   *  return's own unit the share has no delivery to reverse, which is the
   *  state the card already handles: it can only go back untied.
   */
  const receiversInUom = (sku: string, vendorCode: string, uom: string) =>
    receiversFor(sku, vendorCode).filter((r) => r.uom === uom);

  /** Lay a share across a set of deliveries, newest first, none of them taking
   *  more than it brought in.
   *
   *  How much comes off each document is arithmetic, not a decision: the share
   *  is known and each receiver's capacity is known, so the only thing worth
   *  asking is which documents the credit reverses. Asking for the figures as
   *  well made the user do the division and made it possible to claim more of
   *  a delivery than it ever carried.
   *
   *  `chosen` names the documents to use; leaving it out uses all of theirs.
   *  Where the chosen ones cannot cover the share, the rest are drawn on in
   *  order, so removing one never leaves the credit short. */
  const spreadTies = (
    sku: string,
    vendorCode: string,
    qty: number,
    uom: string,
    chosen?: Set<string>,
  ): Record<string, number> => {
    const receivers = receiversInUom(sku, vendorCode, uom);
    const inSet = chosen && chosen.size > 0
      ? [
          ...receivers.filter((r) => chosen.has(r.grnNumber)),
          // Topped up from what is left, so the total always adds up.
          ...receivers.filter((r) => !chosen.has(r.grnNumber)),
        ]
      : receivers;
    const out: Record<string, number> = {};
    let left = qty;
    inSet.forEach((r) => {
      if (left <= 0) return;
      const take = Math.min(left, r.qty);
      if (take > 0) { out[r.grnNumber] = take; left -= take; }
    });
    return out;
  };

  /** Newest first until the return is covered, which is what the flow would
   *  guess anyway -- a return comes off the last delivery far more often than
   *  the first. */
  const defaultTies = (sku: string, vendorCode: string, qty: number, uom: string) =>
    spreadTies(sku, vendorCode, qty, uom);

  /** Which documents the credit reverses, re-laid whenever the set changes. */
  const setTieChosen = (
    sku: string,
    vendorCode: string,
    qty: number,
    uom: string,
    chosen: Set<string>,
  ) =>
    setItemTies((prev) => {
      const forSku = prev[sku] ?? {};
      const entry = forSku[vendorCode] ?? { ties: {}, untied: false };
      return {
        ...prev,
        [sku]: {
          ...forSku,
          [vendorCode]: { ...entry, ties: spreadTies(sku, vendorCode, qty, uom, chosen) },
        },
      };
    });

  /* ── the checklist ──────────────────────────────────────────────────
   *
   * Ported from the count planner's Configure step. Its detail pane lists the
   * locations a count will visit; a return's equivalent is the deliveries its
   * units came in on, so the same list answers it -- and answering it settles
   * the vendor too, because a delivery already knows who sent it. */

  /** Every delivery of this part, whoever sent it, in the unit the return is
   *  written in. Not filtered by vendor: which vendor it is, is the thing
   *  ticking a row decides. */
  const allDeliveries = (sku: string, uom: string) =>
    mockVendors
      .flatMap((v) =>
        receiversFor(sku, v.vendorCode)
          .filter((r) => r.uom === uom)
          .map((r) => ({ ...r, vendorCode: v.vendorCode, vendorName: v.vendorName })),
      )
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  /** Which units a delivery could supply: the line's serial pool cut into the
   *  spans its receipts describe. The inverse of `serialOrigins`, which reads
   *  a unit's position in that pool to name the document it arrived on. */
  const serialPoolFor = (sku: string, grnNumber: string): string[] => {
    const li = lineItems.find((l) => l.sku === sku);
    if (!li) return [];
    const pool = availableSerials(li.sku, li.id, li.receivedQty);
    let cursor = 0;
    for (const r of li.receipts ?? []) {
      const size = Math.max(0, Math.round(r.receivedQty));
      if (r.grnNumber === grnNumber) return pool.slice(cursor, cursor + size);
      cursor += size;
    }
    return [];
  };

  /** The rows for one line. A counted line can point at any delivery of the
   *  part; a serialized one only at the deliveries it actually came in on,
   *  which its own receipts already name. */
  const checklistSources = (line: ResolutionLine): ChecklistSource[] => {
    if (trackingModeFor(line.sku) === 'serialized') {
      const li = lineItems.find((l) => l.sku === line.sku);
      const origins = serialOriginsFor(line.sku);
      const byGrn = new Map(allDeliveries(line.sku, line.uom).map((d) => [d.grnNumber, d]));
      return (li?.receipts ?? [])
        .map((r) => {
          const d = byGrn.get(r.grnNumber);
          const mine = origins.filter((o) => o.grnNumber === r.grnNumber);
          return {
            grnNumber: r.grnNumber,
            poNumber: d?.poNumber ?? mine[0]?.poNumber ?? '',
            date: d?.date ?? '',
            vendorCode: d?.vendorCode ?? mine[0]?.vendorCode ?? '',
            vendorName: d?.vendorName ?? mine[0]?.vendorName ?? 'Not on file',
            available: serialPoolFor(line.sku, r.grnNumber).length,
            taken: mine.length,
            serials: mine.map((o) => o.serial),
          };
        })
        .filter((row) => row.available > 0);
    }
    const ties = itemTies[lineKey(line.sku, line.uom)] ?? {};
    return allDeliveries(line.sku, line.uom).map((d) => ({
      grnNumber: d.grnNumber,
      poNumber: d.poNumber,
      date: d.date,
      vendorCode: d.vendorCode,
      vendorName: d.vendorName,
      available: d.qty,
      taken: ties[d.vendorCode]?.ties?.[d.grnNumber] ?? 0,
    }));
  };

  /** Lay the return across the ticked deliveries, newest first, none of them
   *  giving up more than it brought in -- then read the vendors off the
   *  result. This is the whole of a counted line's answer. */
  const applySources = (line: ResolutionLine, chosen: Set<string>) => {
    const order = allDeliveries(line.sku, line.uom).filter((d) => chosen.has(d.grnNumber));
    const perVendor: Record<string, number> = {};
    const tiesFor: Record<string, Record<string, number>> = {};
    let left = line.qty;
    order.forEach((d) => {
      if (left <= 0) return;
      const take = Math.min(left, d.qty);
      if (take <= 0) return;
      left = Math.round((left - take) * 100) / 100;
      perVendor[d.vendorCode] = Math.round(((perVendor[d.vendorCode] ?? 0) + take) * 100) / 100;
      tiesFor[d.vendorCode] = { ...(tiesFor[d.vendorCode] ?? {}), [d.grnNumber]: take };
    });
    setVendorAllocations((prev) => ({ ...prev, [line.key]: perVendor }));
    setItemTies((prev) => ({
      ...prev,
      [lineKey(line.sku, line.uom)]: Object.fromEntries(
        Object.keys(perVendor).map((code) => [code, { ties: tiesFor[code] ?? {}, untied: false }]),
      ),
    }));
    setExtraVendors((prev) => [...new Set([...prev, ...Object.keys(perVendor)])]);
  };

  /** The focused part's deliveries, in the shape the table reads them. */
  const configureDeliveries = (sku: string, uom: string): DeliveryRow[] => {
    const serialized = hasSerials(trackingModeFor(sku));
    const origins = serialized ? serialOriginsFor(sku) : [];
    const taken = new Map<string, number>();
    Object.values(itemTies[lineKey(sku, uom)] ?? {}).forEach((entry) =>
      Object.entries(entry.ties).forEach(([grn, q]) => taken.set(grn, q)),
    );
    // This vendor's deliveries of the part, and nobody else's.
    //
    // It listed every delivery from every supplier, which made sense while a
    // return could be spread across several of them. It cannot: one return
    // goes back to one vendor, and a credit can only reverse a receipt that
    // vendor raised. A hundred and twenty-five documents, of which four are
    // selectable, is a list to search rather than a list to choose from.
    // Read off the line itself rather than the return's lock, which is
    // declared further down and is not available while this runs.
    const settleWith =
      countedVendorFor(sku, uom) ?? origins[0]?.vendorCode ?? lockedVendor ?? null;
    return allDeliveries(sku, uom)
      .filter((d) => !settleWith || d.vendorCode === settleWith)
      .map((d) => ({
        grnNumber: d.grnNumber,
        poNumber: d.poNumber,
        date: d.date,
        vendorCode: d.vendorCode,
        vendorName: d.vendorName,
        received: d.qty,
        coming: serialized
          ? origins.filter((o) => o.grnNumber === d.grnNumber).length
          : taken.get(d.grnNumber) ?? 0,
        originName: originNameFor(d.vendorCode, d.originId),
        originId: d.originId,
        ...(serialized ? { units: serialPoolFor(sku, d.grnNumber).length } : {}),
      }));
  };




  /** What is on one shelf of a part. The base unit holds the returnable total;
   *  an alternative unit is its own count, since a pallet figure has no
   *  arithmetic relationship to an each figure in the same building. */
  const shelfQty = (sku: string, uom: string) => {
    const item = returnableItems().find((i) => i.sku === sku);
    if (!item) return 0;
    if (uom === item.uom) return item.returnableQty;
    return item.stock.find((sh) => sh.uom === uom)?.qty ?? item.returnableQty;
  };

  /** Every delivery of a part from one vendor, whoever the line is currently
   *  pointed at. What a vendor row on the counted panel opens onto: a vendor
   *  has many receiving documents, and reading what they shipped this on is
   *  how you tell whether they are the right vendor before choosing them. The
   *  rows are read-only there, so nothing comes back on them. */
  /** Which units a part has actually been received in, and how much of each.
   *
   *  A line written in a unit nothing ever arrived in has no receiving
   *  document to tie, and the screen could say so without ever saying which
   *  unit would have worked. Scoped to the vendor once one is named, because
   *  what some other supplier shipped is not a way out of this line.
   *
   *  Cased on the part rather than the line: the question is what exists,
   *  and the line's own unit is the thing being questioned. */
  const unitsReceivedFor = (sku: string, vendorCode: string | null) => {
    const totals = new Map<string, { uom: string; qty: number; docs: number }>();
    mockVendors
      .filter((v) => !vendorCode || v.vendorCode === vendorCode)
      .forEach((v) =>
        receiversFor(sku, v.vendorCode).forEach((r) => {
          const row = totals.get(r.uom) ?? { uom: r.uom, qty: 0, docs: 0 };
          row.qty = Math.round((row.qty + r.qty) * 100) / 100;
          row.docs += 1;
          totals.set(r.uom, row);
        }),
      );
    return [...totals.values()].sort((a, b) => b.qty - a.qty);
  };

  /** The parts the return can take, as the configure step shows them. On a
   *  return started from one vendor, each unit's available figure is capped
   *  at what that vendor delivered (ERP-8721 AC3.2): Calderon showed the
   *  1,798 BOX held across every vendor when its own receipts came to 142. */
  const rmaCatalogue = useMemo(() => {
    const all = returnableItems();
    if (startMode !== 'vendor' || !lockedVendor) return all;
    return all.map((item) => {
      const received = unitsReceivedFor(item.sku, lockedVendor);
      return {
        ...item,
        stock: item.stock.map((sh) => {
          const fromVendor = received.find((u) => u.uom === sh.uom)?.qty ?? 0;
          return {
            ...sh,
            split: {
              ...sh.split,
              available: Math.min(sh.split.available, fromVendor),
              receivedFromVendor: fromVendor,
            },
          };
        }),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMode, lockedVendor]);

  const vendorDeliveries = (sku: string, uom: string, vendorCode: string): DeliveryRow[] =>
    allDeliveries(sku, uom)
      .filter((d) => d.vendorCode === vendorCode)
      .map((d) => ({
        grnNumber: d.grnNumber,
        poNumber: d.poNumber,
        date: d.date,
        vendorCode: d.vendorCode,
        vendorName: d.vendorName,
        received: d.qty,
        coming: 0,
        originName: originNameFor(d.vendorCode, d.originId),
        originId: d.originId,
      }));

  /** Hold a serialized line to at most five vendors.
   *
   *  Which vendor a unit belongs to is read off the receipt its serial falls
   *  in, so the only way to have fewer vendors is to name fewer units. The five
   *  carrying the most are kept and the rest of the named units go with their
   *  suppliers -- keeping a unit whose vendor has been dropped would put goods
   *  on a return with nobody to credit them. */
  const capVendors = (sku: string, serials: string[]) => {
    if (sku === '' || serials.length === 0) {
      return { serials, dropped: 0, vendors: 0 };
    }
    const li = lineItems.find((l) => l.sku === sku);
    if (!li) return { serials, dropped: 0, vendors: 0 };
    // The same reading the panel uses, so the cap counts the vendors the user
    // is actually shown rather than a second guess at them.
    const origins = serialOrigins(
      li.sku,
      li.id,
      li.receivedQty,
      (li.receipts ?? []).map((r) => ({ grnNumber: r.grnNumber, receivedQty: r.receivedQty })),
      serials,
    );
    const owner = new Map(origins.map((o) => [o.serial, o.vendorCode]));
    const counts = new Map<string, number>();
    serials.forEach((serial) => {
      const code = owner.get(serial);
      if (!code) return;
      counts.set(code, (counts.get(code) ?? 0) + 1);
    });
    if (counts.size <= MAX_VENDORS_PER_PART) {
      return { serials, dropped: 0, vendors: counts.size };
    }
    const keep = new Set(
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_VENDORS_PER_PART)
        .map(([code]) => code),
    );
    const kept = serials.filter((serial) => {
      const code = owner.get(serial);
      return code !== undefined && keep.has(code);
    });
    return { serials: kept, dropped: serials.length - kept.length, vendors: counts.size };
  };

  /** The one vendor a counted line is going back to. One RMA, one vendor. */
  const countedVendorFor = (sku: string, uom: string) => {
    const given = vendorAllocations[lineKey(sku, uom)] ?? {};
    return Object.keys(given).find((code) => (given[code] ?? 0) > 0) ?? null;
  };

  /** The vendor site a delivery physically came from. */
  const originNameFor = (vendorCode: string, originId: string) =>
    mockVendors.find((v) => v.vendorCode === vendorCode)?.locations.find((l) => l.id === originId)
      ?.name ?? '';

  /** Send the whole line to one vendor, with nothing tied yet.
   *
   *  The ties used to open on that vendor's most recent deliveries, on the
   *  theory that a guess is easier to correct than a blank. It is not: a
   *  pre-filled receipt reads as an answer somebody gave, and the quantity it
   *  carries is the one figure on this step nobody should inherit. The step
   *  asks, the user selects, and the quantity checks still hold. */
  const pickCountedVendor = (sku: string, uom: string, qty: number, vendorCode: string) => {
    setVendorAllocations((prev) => ({ ...prev, [lineKey(sku, uom)]: { [vendorCode]: qty } }));
    setItemTies((prev) => ({
      ...prev,
      [lineKey(sku, uom)]: {
        [vendorCode]: { ties: {}, untied: false },
      },
    }));
    setExtraVendors((prev) => (prev.includes(vendorCode) ? prev : [...prev, vendorCode]));
  };

  /** How much of one part is coming back.
   *
   *  Written by part rather than by whatever is in focus, because the quantity
   *  step puts a field on every row at once and the steps after it keep one on
   *  the row in focus. A figure that could only be changed on the step that
   *  first asked for it was a figure you had to go back for. */
  const declareFor = (sku: string, uom: string, qty: number) => {
    // By part and unit. Found by part alone, every one of a helmet's three
    // fields wrote to whichever of its lines happened to be first.
    const line = lineItems.find((li) => lineKey(li.sku, li.uom ?? 'EA') === lineKey(sku, uom));
    if (!line) return;
    updateLineItem(line.id, 'invoiceQty', qty);
    // A counted line already pointed at a vendor keeps pointing at them, with
    // the ties re-laid across the new figure -- a share cut to 40 was still
    // claiming to unwind 300 otherwise.
    const already = countedVendorFor(sku, uom);
    if (already && trackingModeFor(sku) !== 'serialized') {
      pickCountedVendor(sku, uom, qty, already);
    }
  };

  /** Rewrite a line on another shelf.
   *
   *  A different unit is a different shelf, so the line is rebuilt on it rather
   *  than relabelled, and whatever was tied to the old unit's deliveries goes
   *  with it: those documents are not this line's any more. */
  const rewriteUom = (sku: string, from: string, uom: string) => {
    const line = lineItems.find((li) => lineKey(li.sku, li.uom ?? 'EA') === lineKey(sku, from));
    if (!line) return;
    const qty = Math.min(line.invoiceQty, shelfQty(sku, uom));
    // The old shelf's answers go with the old shelf: those documents are not
    // this line's any more.
    const was = lineKey(sku, from);
    setItemTies((prev) => {
      const next = { ...prev };
      delete next[was];
      return next;
    });
    setVendorAllocations((prev) => {
      const next = { ...prev };
      delete next[was];
      return next;
    });
    setCurrentPOsData((prev) => {
      const stripped = prev
        .map((po) => ({
          ...po,
          // Only the line being rewritten. Stripping by part took its sibling
          // units off the return along with it; stripping by the built line id
          // matched nothing at all, and left the old unit on the return with
          // the new one added beside it.
          items: po.items.filter((li) => !lineOwnsItem(line.id, po.poNumber, li.id)),
          ...(po.selectedItemIds === undefined
            ? {}
            : {
                selectedItemIds: po.selectedItemIds.filter(
                  (id) => !lineOwnsItem(line.id, po.poNumber, id),
                ),
              }),
        }))
        .filter((po) => po.items.length > 0);
      return [...stripped, ...selectionFromItems([{ sku, qty, uom }])];
    });
    setConfigureSku(lineKey(sku, uom));
  };

  /** How much comes off one of their deliveries. The line's own figure was
   *  given on the first stage and is not touched here: what these add up to is
   *  measured against it rather than replacing it. */
  const setTieQty = (sku: string, uom: string, grnNumber: string, qty: number) => {
    // Whose document this is, rather than whichever vendor the line happens
    // to name first: the table lists every delivery of the part now, so a tie
    // has to be written against the supplier that actually sent it.
    const vendorCode =
      allDeliveries(sku, uom).find((d) => d.grnNumber === grnNumber)?.vendorCode ??
      countedVendorFor(sku, uom);
    if (!vendorCode) return;
    // A receipt from a PO in another currency can't join this return.
    const lock = currencyLockFor(vendorCode);
    const docCurrency = receiptCurrency(vendorCode, grnNumber);
    if (qty > 0 && lock && docCurrency && docCurrency !== lock) {
      toast.error(otherCurrencyReason(docCurrency));
      return;
    }
    const key = lineKey(sku, uom);
    setItemTies((prev) => {
      const forSku = prev[key] ?? {};
      const entry = forSku[vendorCode] ?? { ties: {}, untied: false };
      const ties = { ...entry.ties };
      if (qty > 0) ties[grnNumber] = qty;
      else delete ties[grnNumber];
      return { ...prev, [key]: { ...forSku, [vendorCode]: { ties, untied: false } } };
    });
  };

  const setAllTies = (sku: string, uom: string, on: boolean) => {
    const vendorCode = countedVendorFor(sku, uom);
    if (!vendorCode) return;
    // Every receipt in the return's currency: the one already picked, else
    // the first receipt's. The rest stay greyed out for a separate return.
    const rows = receiversInUom(sku, vendorCode, uom);
    const currency = currencyLockFor(vendorCode) ?? (rows[0] ? poCurrency(rows[0].poNumber) : null);
    const ties = on
      ? Object.fromEntries(rows.filter((r) => !currency || poCurrency(r.poNumber) === currency).map((r) => [r.grnNumber, r.qty]))
      : {};
    setItemTies((prev) => ({
      ...prev,
      [lineKey(sku, uom)]: {
        ...(prev[lineKey(sku, uom)] ?? {}),
        [vendorCode]: { ties, untied: false },
      },
    }));
  };

  /** Write a set of per-delivery figures back.
   *
   *  The table is the only place a quantity is typed, so the line's own figure
   *  is whatever its rows come to -- there is no separate count to keep in
   *  step, and no way for the two to disagree. The vendors fall out of the
   *  same pass, since a delivery knows who sent it. */
  const writeDeliveryQtys = (sku: string, uom: string, figures: Map<string, number>) => {
    const li = lineItems.find((l) => l.sku === sku);
    if (!li) return;
    const perVendor: Record<string, number> = {};
    const tiesFor: Record<string, Record<string, number>> = {};
    allDeliveries(sku, uom).forEach((d) => {
      const take = figures.get(d.grnNumber) ?? 0;
      if (take <= 0) return;
      perVendor[d.vendorCode] = Math.round(((perVendor[d.vendorCode] ?? 0) + take) * 100) / 100;
      tiesFor[d.vendorCode] = { ...(tiesFor[d.vendorCode] ?? {}), [d.grnNumber]: take };
    });
    const total = Math.round(Object.values(perVendor).reduce((n, q) => n + q, 0) * 100) / 100;
    updateLineItem(li.id, 'invoiceQty', total);
    setVendorAllocations((prev) => ({ ...prev, [lineKey(sku, uom)]: perVendor }));
    setItemTies((prev) => ({
      ...prev,
      [lineKey(sku, uom)]: Object.fromEntries(
        Object.keys(perVendor).map((code) => [code, { ties: tiesFor[code] ?? {}, untied: false }]),
      ),
    }));
    setExtraVendors((prev) => [...new Set([...prev, ...Object.keys(perVendor)])]);
  };

  const setDeliveryQty = (sku: string, uom: string, grnNumber: string, qty: number) => {
    const figures = new Map<string, number>();
    Object.values(itemTies[sku] ?? {}).forEach((entry) =>
      Object.entries(entry.ties).forEach(([grn, q]) => figures.set(grn, q)),
    );
    if (qty > 0) figures.set(grnNumber, qty);
    else figures.delete(grnNumber);
    writeDeliveryQtys(sku, uom, figures);
  };

  /** Every delivery gives back what it brought in, or none of them do. */
  const setAllDeliveries = (sku: string, uom: string, on: boolean) =>
    writeDeliveryQtys(
      sku,
      uom,
      on
        ? new Map(allDeliveries(sku, uom).map((d) => [d.grnNumber, d.qty]))
        : new Map<string, number>(),
    );

  /** A line going back with nothing to unwind still has to name who is taking
   *  it, so untied is a state of a vendor rather than of the line. */
  const untiedFor = (line: ResolutionLine) =>
    Object.values(itemTies[lineKey(line.sku, line.uom)] ?? {}).some((e) => e.untied);

  const setUntied = (line: ResolutionLine, next: boolean) => {
    const vendors = Object.keys(vendorAllocations[line.key] ?? {}).filter(
      (code) => (vendorAllocations[line.key]?.[code] ?? 0) > 0,
    );
    if (next && vendors.length === 0) return;
    if (!next) {
      applySources(line, new Set());
      return;
    }
    setItemTies((prev) => ({
      ...prev,
      [lineKey(line.sku, line.uom)]: Object.fromEntries(
        vendors.map((code) => [code, { ties: {}, untied: true }]),
      ),
    }));
  };

  /** The vendor split, in the shape the confirmation edits it.
   *
   *  Counted stock answers everything else on the first step, so the
   *  confirmation is the only place its vendors are seen or changed. Named
   *  units come with their vendor attached and are listed rather than offered. */
  const splitItems = useMemo(
    () =>
      itemCards.map((card) => ({
        sku: card.line.sku,
        uom: card.line.uom,
        trackingMode: trackingModeFor(card.line.sku),
        qty: card.line.qty,
        // Named units carry their own vendor: the receiving doc behind the
        // serial says who shipped it, so the modal states it. Which units go
        // to whom is changed by changing the units, not by typing a different
        // number here -- a figure with no serials behind it is a return the
        // warehouse cannot pick.
        derived: card.line.locked || trackingModeFor(card.line.sku) !== 'none',
        vendors: card.rows.map((row) => ({
          vendorCode: row.vendorCode,
          vendorName: row.vendorName,
          qty: row.qty,
          cap: row.cap,
        })),
        addable: card.addable,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemCards],
  );

  /** Items whose figure is not fully with a vendor yet. The confirmation is
   *  where counted stock names its vendor, so it opens before that is answered
   *  and cannot write drafts until it is. */
  const unplacedItems = useMemo(
    () =>
      splitItems.flatMap((item) => {
        const placed = item.vendors.reduce((n, v) => n + v.qty, 0);
        const short = Math.round((item.qty - placed) * 100) / 100;
        return short > 0 ? [{ sku: item.sku, uom: item.uom, short, none: placed === 0 }] : [];
      }),
    [splitItems],
  );

  /** One vendor, one return, unless a group is absorbing its siblings. */
  // What the save will actually write, which is one document per draft. The
  // old count assumed a family merged whole or not at all, so it was wrong the
  // moment two of four branches travelled together.
  const rmaCount = vendorDrafts.length;

  /** What is still nobody's. Stated once above the cards rather than as a
   *  warning inside every line that has some left. */
  const unplacedUnits = useMemo(
    () =>
      resolutionLines.flatMap((line) => {
        if (line.locked) return [];
        const given = vendorSplitFor(line);
        const placed = Object.values(given).reduce((n, q) => n + q, 0);
        const spare = Math.round((line.qty - placed) * 100) / 100;
        return spare > 0 ? [{ sku: line.sku, qty: spare, uom: line.uom }] : [];
      }),
    [resolutionLines, vendorAllocations],
  );

  /** Vendors that shipped something still unplaced and are not on the return
   *  yet. Anyone else would be a card with nothing it could ever hold. */
  const addableVendors = useMemo(() => {
    const onIt = new Set(vendorLegs.map((l) => l.vendorCode));
    const out = new Map<string, string>();
    resolutionLines.forEach((line) => {
      if (line.locked) return;
      const given = vendorSplitFor(line);
      const placed = Object.values(given).reduce((n, q) => n + q, 0);
      if (line.qty - placed <= 0) return;
      line.options.forEach((o) => {
        if (!onIt.has(o.vendorCode)) out.set(o.vendorCode, o.vendorName);
      });
    });
    return [...out.entries()].map(([code, name]) => ({ code, name }));
  }, [resolutionLines, vendorAllocations, vendorLegs]);

  /** Lines whose quantity is whatever their named units come to, rather than a
   *  figure somebody typed.
   *
   *  The picker holds a line to its count so that ticking fourteen of fifteen
   *  is stopped rather than silently accepted. That is right for a line that
   *  was given a count, and impossible for one that was not: a serialized part
   *  gets onto the return only by naming units, so on the way in there is no
   *  count yet and every tick would fail its own check. Reading it off the
   *  quantity does not work either -- the first tick writes 1, and the line
   *  then looks declared and freezes there. So it is recorded when the line is
   *  created and asked about afterwards. */
  const [unitsSetCount, setUnitsSetCount] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!pendingSerialSku) return;
    const line = lineItems.find((l) => l.sku === pendingSerialSku);
    if (!line) return;
    setSerialModalLineId(line.id);
    setUnitsSetCount((prev) => (prev.has(line.id) ? prev : new Set(prev).add(line.id)));
    setPendingSerialSku(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSerialSku, lineItems]);

  /** Naming the units is how a serialized part gets on the return, so Add opens
   *  the picker rather than a field. If the part is not on the return yet it
   *  joins first at nothing, and the units picked become its quantity. */
  const pickSerialsFor = (sku: string) => {
    const existing = lineItems.find((l) => l.sku === sku);
    if (existing) { setSerialModalLineId(existing.id); return; }
    handleAddPOs(selectionFromItems([{ sku, qty: 0 }]));
    setPendingSerialSku(sku);
  };

  /** A row's key is `line:vendor`; writing it goes back to the same allocation
   *  the resolution panel wrote. */
  const writeLegQty = (rowKey: string, qty: number) => {
    const cut = rowKey.lastIndexOf(':');
    if (cut < 0) return;
    allocateVendor(rowKey.slice(0, cut), rowKey.slice(cut + 1), qty);
  };

  /** The vendor to speak about when the screen needs one name. On a return
   *  that settles with several this is the first of them; the per-vendor
   *  cards say the rest. */
  const settledVendorName = returnVendors[0]?.name ?? '';


  // Starting from the item, a part that several vendors ship arrives here with
  // no vendor on it yet -- that is the next step's question. The line has to
  // know, because a return's paperwork belongs to a vendor, and there is none
  // to name until one is chosen.
  const unresolvedVendorSkus = useMemo(() => {
    const out = new Set<string>();
    currentPOsData.forEach((po) => {
      // The flag says so outright; an empty vendor name says so by omission,
      // which is what survives a merge when more parts are added later.
      const unresolved = (po as { vendorUnresolved?: boolean }).vendorUnresolved || !po.vendorName;
      if (!unresolved) return;
      po.items.forEach((li) => out.add(li.sku));
    });
    return out;
  }, [currentPOsData]);

  // The vendors this item was actually picked from. An item can be selected
  // against several vendors while building the return, and each of those is
  // its own line, so this reads the return's own lines rather than the
  // catalogue -- the catalogue would list every vendor who could supply it,
  // which is not what the return is settling with.
  // Terms come off the supplying vendor's own record rather than the
  // document-level terms, because a return that spans vendors settles with
  // each on their own.
  const paymentTermsForVendor = (vendorName: string) =>
    vendorPaymentTerms[vendorName] ??
    mockVendors.find((v) => v.vendorName === vendorName)?.paymentTerms ??
    '';

  // Vendor records carry short labels ("Net 45") while the catalogue names
  // them by trigger ("Net 45 Post Delivery"), so an exact match misses and
  // the card would render invented copy. Fall back to the net preset with
  // the same duration, which is the same term under its catalogue name.
  const resolvePaymentPreset = (label: string) =>
    findPresetByLabel(label) ??
    (() => {
      const days = String(parseInt(label.replace(/\D/g, ''), 10) || '');
      return days
        ? PAYMENT_TERM_PRESETS.find((t) => t.category === 'net' && t.duration === days)
        : undefined;
    })();

  // The A/P account a vendor books against, mapped from their category the
  // same way the document-level one is -- so each leg shows the account it
  // will actually post to rather than the first vendor's.
  const apAccountForVendor = (vendorName: string) => {
    const category = mockVendors.find((v) => v.vendorName === vendorName)?.category ?? '';
    return VENDOR_AP_MAPPING[category] || VENDOR_AP_MAPPING['default'] || '';
  };

  const payToForVendor = (vendorName: string) =>
    vendorPayToIds[vendorName] ?? payFromId;

  const openPayToForVendor = (vendorName: string) => {
    setPayToTargetVendor(vendorName);
    setPayFromModalOpen(true);
  };

  // The date is a forecast the user can move -- terms give the default, but
  // a vendor can agree something else -- so an override is held per line.
  const [lineExpectedResolution, setLineExpectedResolution] = useState<Record<string, string>>({});

  /** Same rule, as an ISO date the date input can hold. */
  const expectedResolutionISO = (terms: string) => {
    const date = new Date(invoiceDate || new Date().toISOString().split('T')[0]!);
    if (terms !== 'Due on Receipt') {
      const preset = findPresetByLabel(terms);
      const days = preset ? daysForPreset(preset) : parseInt(terms.replace(/\D/g, '')) || 0;
      date.setDate(date.getDate() + days);
    }
    return date.toISOString().split('T')[0]!;
  };

  const resolutionDateFor = (lineId: string, poNumber: string) =>
    lineExpectedResolution[lineId] ??
    expectedResolutionISO(paymentTermsForVendor(vendorForPO(poNumber)) || paymentTerms);

  const vendorsForSku = (sku: string) => {
    const seen = new Map<string, { name: string; poNumbers: string[]; qty: number; uom: string }>();
    lineItems
      .filter((l) => l.sku === sku)
      .forEach((l) => {
        const name = vendorForPO(l.poNumber);
        if (!name) return;
        const entry = seen.get(name);
        if (entry) {
          if (!entry.poNumbers.includes(l.poNumber)) entry.poNumbers.push(l.poNumber);
          entry.qty += l.invoiceQty;
        } else {
          seen.set(name, { name, poNumbers: [l.poNumber], qty: l.invoiceQty, uom: l.uom });
        }
      });
    return Array.from(seen.values());
  };

  // Where the goods on a line physically travel. Origin is a property of the
  // receipt and destination is read off the vendor's partner record, so the two
  // live in different parts of the form and meet on the line they belong to.
  // Destination mirrors returnLegs: a consolidated multi-site return has one
  // for everything, returning to origin gives each site its own.
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
  const total = subtotal + freightAmount + additionalChargesTotal;

  // ─── Return wizard ───────────────────────────────────────────────
  // A return is built in steps rather than on one page, the way a shipment
  // is: pick what goes back, settle anything the receipts left ambiguous,
  // then state the paperwork. Steps are computed from the data, so the
  // routing step only exists on the returns that actually need it.
  /** Whether anything on the return is named unit by unit. */
  const hasTrackedLines = useMemo(
    () =>
      lineItems.some(
        (l) => l.invoiceQty > 0 && trackingModeFor(l.sku) !== 'none',
      ),
    [lineItems],
  );

  /** Lines whose vendor cannot be read off the goods. A serialized or lot unit
   *  arrived on a receiver and the receiver names the vendor, so the answer is
   *  already there. Plain stock has no such thread -- one washer is any washer
   *  -- so somebody has to choose, unless the route named the vendor up front. */
  /** A line whose receipts have to be chosen rather than read.
   *
   *  A serial names the document it arrived on, so a return made entirely of
   *  serialized or lot-serialized lines has nothing to ask on the receipts
   *  step: every tie is already known. The step exists for stock that cannot
   *  say where it came from. */
  const hasCountedLines = useMemo(
    () =>
      lineItems.some((l) => l.invoiceQty > 0 && !hasSerials(trackingModeFor(l.sku))),
    [lineItems],
  );

  const needsVendorChoice = useMemo(
    () =>
      !lockedVendor &&
      // Serialized units name their vendor and nothing else does. A lot code
      // is not a unit: the batch says what arrived, not who sent it, so a
      // lot-tracked line is asked the same question a counted one is. Leaving
      // it out of this step left those lines with no vendor at all, and a
      // return with no vendor saves as nothing.
      lineItems.some((l) => l.invoiceQty > 0 && trackingModeFor(l.sku) !== 'serialized'),
    [lineItems, lockedVendor],
  );

  /** The sites this return is coming off, read from the receipts the credit
   *  unwinds rather than from the orders.
   *
   *  `returnOrigins` groups by vendor name, which made "origin" mean "vendor"
   *  and left the site question with nothing behind it. A site is a property
   *  of the receipt: one vendor ships the same part out of Newark, Atlanta and
   *  their main warehouse, and goods go back to the one they left. This reads
   *  the picked receipts and groups them.
   *
   *  Declared after `configureDeliveries` because it reads it. */
  const returnSites = useMemo(() => {
    const sites = new Map<
      string,
      { id: string; name: string; vendorName: string; docs: string[]; skus: Set<string>; units: number }
    >();
    lineItems
      .filter((l) => l.invoiceQty > 0)
      .forEach((l) => {
        configureDeliveries(l.sku, l.uom ?? 'EA').forEach((d) => {
          if (d.coming <= 0) return;
          const id = d.originId || d.vendorCode;
          const found = sites.get(id) ?? {
            id,
            name: d.originName || d.vendorName,
            vendorName: d.vendorName,
            docs: [],
            skus: new Set<string>(),
            units: 0,
          };
          if (!found.docs.includes(d.grnNumber)) found.docs.push(d.grnNumber);
          found.skus.add(l.sku);
          found.units = Math.round((found.units + d.coming) * 100) / 100;
          sites.set(id, found);
        });
      });
    return [...sites.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems, itemTies, lineSerials, lineLots, vendorAllocations]);

  /** Outbound shipments this return creates.
   *
   *  One site is one physical shipment: the goods go back to the dock they
   *  left. Consolidating overrides that and sends the whole return to a single
   *  address the vendor nominated, which is the common exception and the one
   *  the merge and split step asks about.
   *
   *  It grouped by vendor before, so a vendor shipping out of three sites was
   *  one leg and the site question had nothing to act on. `originIds` carry
   *  real site ids now, which is also what `invoiceToRMAs` matches its orders
   *  against.
   */
  const returnLegs: RMAReturnLeg[] = useMemo(() => {
    if (!isRma) return [];
    const sites = returnSites;
    if (sites.length === 0) {
      // Nothing tied yet. Fall back to the vendor the return is against, so a
      // draft saved early still names where it ships.
      return returnOrigins.length === 0
        ? []
        : [{
            originIds: returnOrigins.map((o) => o.id),
            shipTo: shipToName,
            shipToPartner: shipToPartnerName,
            receivingNumbers: returnOrigins.flatMap((o) => receiptsForOrigin(o.id)),
          }];
    }
    if (sites.length === 1 || returnRouting === 'consolidated') {
      return [{
        originIds: sites.map((site) => site.id),
        shipTo: shipToName,
        shipToPartner: shipToPartnerName,
        receivingNumbers: [...new Set(sites.flatMap((site) => site.docs))],
      }];
    }
    return sites.map((site) => ({
      originIds: [site.id],
      shipTo: originShipTo[site.id] ?? returnShipToOptions(site.name)[0] ?? site.name,
      shipToPartner: site.vendorName,
      receivingNumbers: site.docs,
      ...(findCarrierById(originCarrierId[site.id])
        ? { carrier: findCarrierById(originCarrierId[site.id])!.name }
        : {}),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRma, returnSites, returnOrigins, returnRouting, originShipTo, originCarrierId, shipToName, shipToPartnerName, currentPOsData]);

  /** The sites that are actually a choice.
   *
   *  Two vendors is two RMAs and two shipments whatever anybody says, so two
   *  sites belonging to two different vendors are not a question. One vendor
   *  shipping out of three of their own docks is: those three can travel back
   *  separately or arrive together at one address. */
  const splitableSites = useMemo(() => {
    const byVendor = new Map<string, number>();
    returnSites.forEach((site) =>
      byVendor.set(site.vendorName, (byVendor.get(site.vendorName) ?? 0) + 1),
    );
    return returnSites.filter((site) => (byVendor.get(site.vendorName) ?? 0) > 1);
  }, [returnSites]);

  /** Whether the merge and split step has a question on it.
   *
   *  Two unrelated vendors is two RMAs and there is nothing to decide: it is
   *  forced, the confirmation says how many documents the save writes, and a
   *  step that reviews it is a step with no answer on it. The step earns its
   *  place only when two branches of one company could travel together.
   *
   *  A vendor's goods coming off several of their own docks used to qualify
   *  it too, because the step also asked where each dock's shipment went.
   *  That question is off this step -- the docks are not a grouping decision
   *  and listing them beside the branches named the same vendor twice -- so
   *  it no longer brings a step with it. */
  const hasGroupingChoice = useMemo(
    () => mergeableFamilies(groupingLegs).length > 0,
    [groupingLegs],
  );

  const stepPlan = useMemo(() => {
    // A step is in the plan when its question applies to this return, not when
    // it has been answered. Only the two tracked-stock steps are conditional:
    // units drops out for plain stock, and the vendor step drops out when the
    // goods name their own supplier.
    const all: { key: RmaStepKey; label: string; skip: boolean }[] = [
      // Who it settles with, when that is the route taken. It is the only
      // thing the by-vendor route knows before anything is picked, and
      // knowing it takes the Vendor step out of the plan entirely: one
      // question asked once, at the front, instead of once per line in the
      // middle.
      { key: 'partner', label: 'Vendor', skip: startMode !== 'vendor' },
      // What is coming back and how much of it, on one screen. They were two
      // steps for a day: the same rail read twice, once for the parts and once
      // for the figures, which is two Continues for one question.
      { key: 'lines', label: 'Items and quantity', skip: false },
      // One step for who takes it back and which units go, whatever the part
      // is tracked by.
      //
      // A serialized unit names its own vendor, so for those two types the
      // step reads the answer off the picks. A lot or a plain count cannot --
      // one bolt is any bolt -- so for those it asks, on the same card, in the
      // same shape. Which is why the vendor step is gone: its question moved
      // here rather than being answered somewhere else.
      { key: 'units', label: 'Vendor and units', skip: false },
      { key: 'receivers', label: 'Receiving documents', skip: !hasCountedLines },
      { key: 'routing', label: 'Merge and split', skip: !hasGroupingChoice },
      // Skipped where nothing has been paid for. An unbilled return unwinds
      // its accrual and a billed one takes a vendor credit, both on their
      // own: a step that asks a question with one possible answer is a step
      // that should not be there.
      { key: 'resolution', label: 'Credit or refund', skip: !hasPaidValue },
    ];
    return all.filter((step) => !step.skip);
  }, [
    hasTrackedLines,
    needsVendorChoice,
    hasGroupingChoice,
    hasCountedLines,
    startMode,
    hasPaidValue,
  ]);

  const [activeStep, setActiveStep] = useState<RmaStepKey>(
    startMode === 'vendor' && isRma ? 'partner' : 'lines',
  );
  const onStubStep = STUB_STEPS.includes(activeStep);
  const currentStepIndex = Math.max(0, stepPlan.findIndex((s) => s.key === activeStep));
  const isFinalStep = currentStepIndex === stepPlan.length - 1;

  // Dropping the last multi-site line while standing on the routing step
  // takes that step away underneath the user, so fall back to whatever now
  // occupies the position they were on rather than rendering nothing.
  const priorStepRef = useRef<{ key: RmaStepKey; index: number }>({ key: 'lines', index: 0 });
  useEffect(() => {
    const idx = stepPlan.findIndex((s) => s.key === activeStep);
    if (idx !== -1) {
      priorStepRef.current = { key: activeStep, index: idx };
      return;
    }
    const target = stepPlan[Math.min(priorStepRef.current.index, stepPlan.length - 1)] ?? stepPlan[0];
    if (target) setActiveStep(target.key);
  }, [stepPlan, activeStep]);

  /** Arriving on the units step opens on the line that has to answer first.
   *
   *  The panel opened on whatever was added last, which after the reorder
   *  meant standing on a plain line that is held, with the serialized line
   *  that unblocks it further up the rail. The step is ordered now, so it
   *  opens in order. Only on arrival: clicking a held line afterwards is a
   *  deliberate look at why it is held. */
  const arrivedAt = useRef<RmaStepKey | null>(null);
  useEffect(() => {
    if (activeStep === arrivedAt.current) return;
    arrivedAt.current = activeStep;
    if (activeStep !== 'units') return;
    const first = unanswered[0] ?? controlledLines()[0];
    if (first) setConfigureSku(lineKey(first.sku, first.uom ?? 'EA'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep]);

  const returnableLines = lineItems.filter((i) => i.invoiceQty > 0);
  const overReturnedLines = lineItems.filter((i) => i.invoiceQty > i.remainingQty);

  /**
   * Rows asking a vendor for more than that vendor ever shipped.
   *
   * The line's own total is deliberately uncapped -- a part added as four can
   * turn out to be four hundred, and the second step is where that is found
   * out. What cannot stretch is a single vendor's share: a vendor credits what
   * they sold, so asking one for 9,999 of something they shipped 163 of is a
   * return they will reject. The row said the ceiling all along; nothing made
   * it matter. Now it does, and the way out is either fewer units or another
   * vendor to carry the balance.
   */
  const overVendorRows = useMemo(
    () =>
      itemCards.flatMap((card) =>
        card.rows
          // A vendor who never delivered the part has no figure of theirs to
          // exceed, so the ceiling does not apply to them. What stops that
          // row is having no delivery to tie to, which the tie check catches.
          .filter((row) => !row.locked && row.shipped !== false && row.qty > row.cap)
          .map((row) => ({
            sku: card.line.sku,
            uom: card.line.uom,
            vendorName: row.vendorName,
            cap: row.cap,
            over: Math.round((row.qty - row.cap) * 100) / 100,
          })),
      ),
    [itemCards],
  );

  /** Which part the resolve pane is showing. The step used to stack every
   *  part's card down one column; five parts made a page that had to be
   *  scrolled past four answers to reach the fifth. */
  const [resolveSku, setResolveSku] = useState<string | null>(null);
  /** The part the Configure Items table is answering.
   *
   *  Not the resolving step's selection: that one is re-seeded by an effect
   *  onto the first unanswered line, and a part just added has nothing
   *  answered on it yet, so the focus jumped straight back off it. */
  const [configureSku, setConfigureSku] = useState<string | null>(null);
  /** Whether a counted line whose ties reach several of one vendor's sites
   *  goes back on one document or one per site. Merged unless said otherwise:
   *  a vendor settling between their own branches is the ordinary case. */
  const [siteMerge, setSiteMerge] = useState<Record<string, boolean>>({});

  /** Ties that claim more than the delivery they point at brought in.
   *
   *  The receiver is the ceiling: a credit cannot unwind more of a document
   *  than that document ever carried. The field turns red as it is typed, and
   *  this is what makes the red mean something -- a warning the save ignores
   *  is not a rule, it is decoration. */
  const overTieRows = useMemo(() => {
    const out: { sku: string; vendorName: string; grnNumber: string; over: number; cap: number; uom: string }[] = [];
    resolutionLines.forEach((line) => {
      if (hasSerials(trackingModeFor(line.sku))) return;
      Object.entries(itemTies[lineKey(line.sku, line.uom)] ?? {}).forEach(([vendorCode, entry]) => {
        if (entry.untied) return;
        const byGrn = new Map(
          receiversInUom(line.sku, vendorCode, line.uom).map((r) => [r.grnNumber, r]),
        );
        Object.entries(entry.ties).forEach(([grnNumber, qty]) => {
          const r = byGrn.get(grnNumber);
          if (!r || qty <= r.qty) return;
          out.push({
            sku: line.sku,
            vendorName: vendorByCode(vendorCode)?.vendorName ?? vendorCode,
            grnNumber,
            over: Math.round((qty - r.qty) * 100) / 100,
            cap: r.qty,
            uom: r.uom,
          });
        });
      });
    });
    return out;
  }, [resolutionLines, itemTies, vendorByCode]);

  /** Counted lines whose vendor or ties are unanswered. A tie is what the
   *  credit unwinds, so a return that is neither tied nor deliberately untied
   *  is a document nobody can settle. */
  const unresolvedCounted = useMemo<
    { sku: string; reason: 'vendor' | 'ties'; short: number; uom: string }[]
  >(
    () =>
      resolutionLines.flatMap<{ sku: string; reason: 'vendor' | 'ties'; short: number; uom: string }>(
        (line) => {
          if (hasSerials(trackingModeFor(line.sku))) return [];
          const vendorCode = Object.keys(vendorSplitFor(line))[0];
          const given = vendorSplitFor(line);
          const shares = Object.entries(given).filter(([, q]) => q > 0);
          if (shares.length === 0) {
            return [{ sku: line.sku, reason: 'vendor', short: 0, uom: line.uom }];
          }
          // The shares have to add up to the return, and each share has to be
          // tied to that vendor's own deliveries or deliberately tied to none.
          const placed = shares.reduce((n, [, q]) => n + q, 0);
          const unplaced = Math.round((line.qty - placed) * 100) / 100;
          if (unplaced !== 0) {
            return [{ sku: line.sku, reason: 'vendor', short: unplaced, uom: line.uom }];
          }
          const untiedShare = shares.find(([code, q]) => {
            const entry = itemTies[lineKey(line.sku, line.uom)]?.[code];
            if (entry?.untied) return false;
            const tied = Object.values(entry?.ties ?? {}).reduce((n, v) => n + v, 0);
            return Math.round((q - tied) * 100) / 100 !== 0;
          });
          if (!untiedShare) return [];
          const entry = itemTies[lineKey(line.sku, line.uom)]?.[untiedShare[0]];
          const tied = Object.values(entry?.ties ?? {}).reduce((n, v) => n + v, 0);
          return [
            {
              sku: line.sku,
              reason: 'ties',
              short: Math.round((untiedShare[1] - tied) * 100) / 100,
              uom: line.uom,
            },
          ];
        },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolutionLines, vendorAllocations, itemTies],
  );

  /** One row per part: what it still needs, or who it settled with. The rail
   *  is the only thing read five times, so it carries state and nothing else. */
  const resolveRail = useMemo<ResolveRailItem[]>(
    () =>
      itemCards.map((card) => {
        const line = card.line;
        const mode = trackingModeFor(line.sku);
        const base = {
          sku: line.sku,
          description: line.description,
          uom: line.uom,
          trackingMode: mode,
          unitPrice: lineItems.find((l) => l.sku === line.sku)?.unitPrice ?? 0,
          qty: line.qty,
        };

        if (hasSerials(mode)) {
          const origins = serialOriginsFor(line.sku);
          const short = Math.round((line.qty - origins.length) * 100) / 100;
          if (origins.length === 0) return { ...base, status: 'Choose the units', done: false };
          if (short !== 0) {
            return {
              ...base,
              status: `${formatQty(Math.abs(short))} ${line.uom} still to name`,
              done: false,
            };
          }
          const names = [...new Set(origins.map((o) => o.vendorName))];
          return { ...base, status: names.join(', '), done: true };
        }

        const rows = card.rows.filter((r) => r.qty > 0);
        if (rows.length === 0) return { ...base, status: 'Needs a vendor', done: false };
        const placed = rows.reduce((n, r) => n + r.qty, 0);
        const unplaced = Math.round((line.qty - placed) * 100) / 100;
        if (unplaced !== 0) {
          return {
            ...base,
            status:
              unplaced > 0
                ? `${formatQty(unplaced)} ${line.uom} without a vendor`
                : `${formatQty(-unplaced)} ${line.uom} over`,
            done: false,
          };
        }
        if (mode === 'none') {
          const short = rows.reduce((n, r) => {
            const entry = itemTies[lineKey(line.sku, line.uom)]?.[r.vendorCode];
            if (entry?.untied) return n;
            const tied = Object.values(entry?.ties ?? {}).reduce((m, v) => m + v, 0);
            return n + Math.max(0, Math.round((r.qty - tied) * 100) / 100);
          }, 0);
          if (short > 0) {
            return { ...base, status: `${formatQty(short)} ${line.uom} not tied yet`, done: false };
          }
        }
        return { ...base, status: rows.map((r) => r.vendorName).join(', '), done: true };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemCards, itemTies, lineItems, lineSerials, lineLots],
  );

  /** The part the pane is answering. */
  const resolveCard = useMemo(
    () => itemCards.find((c) => c.line.sku === resolveSku),
    [resolveSku, itemCards],
  );

  /** Land on work rather than on whatever came first -- but only when there is
   *  nothing selected, or what was selected has left the return. Recomputing
   *  it every render moved the pane off a line the moment it was answered,
   *  which took the screen away mid-gesture. */
  useEffect(() => {
    if (itemCards.length === 0) {
      if (resolveSku !== null) setResolveSku(null);
      return;
    }
    if (resolveSku && itemCards.some((c) => c.line.sku === resolveSku)) return;
    const firstOpen = resolveRail.find((r) => !r.done);
    setResolveSku(firstOpen?.sku ?? itemCards[0]!.line.sku);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCards, resolveSku]);

  /** Serialized lines whose answer is not finished, or whose units turn out to
   *  reach more than one vendor.
   *
   *  Nothing checked these at all: the step's guard walked counted lines and
   *  returned early for everything else, so a serialized line could reach the
   *  confirmation with no units named and no vendor -- and a set of serials
   *  spanning two suppliers became two documents with nothing said about it
   *  until the save. Two vendors is a legitimate answer; it is not one to
   *  discover afterwards. */
  const serialConflicts = useMemo<
    { sku: string; reason: 'units' | 'short' | 'vendors'; short: number; uom: string; vendors: string[] }[]
  >(
    () =>
      resolutionLines.flatMap<{
        sku: string;
        reason: 'units' | 'short' | 'vendors';
        short: number;
        uom: string;
        vendors: string[];
      }>((line) => {
        if (!hasSerials(trackingModeFor(line.sku))) return [];
        const origins = serialOriginsFor(line.sku);
        if (origins.length === 0) {
          return [{ sku: line.sku, reason: 'units' as const, short: line.qty, uom: line.uom, vendors: [] }];
        }
        const short = Math.round((line.qty - origins.length) * 100) / 100;
        if (short !== 0) {
          return [{ sku: line.sku, reason: 'short' as const, short, uom: line.uom, vendors: [] }];
        }
        const vendors = [...new Set(origins.map((o) => o.vendorName))];
        if (vendors.length > 1) {
          return [{ sku: line.sku, reason: 'vendors' as const, short: 0, uom: line.uom, vendors }];
        }
        return [];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolutionLines, lineSerials, lineLots, lineItems],
  );

  /** A split the user has been told about and accepted. Keyed by part and by
   *  the vendors involved, so changing the units asks again. */
  /** The split being put to the user, while they answer it. */
  /** How each RMA settles, and why, keyed by the vendor that raises it.
   *
   *  One resolution per RMA, asked once, defaulted never: a draft used to open
   *  already saying `Replacement / Failed inspection` because nothing on the
   *  way in had asked (brief 8.1, 8.5). One RMA is one vendor, so a return
   *  that becomes three documents is three answers -- asking once for the
   *  whole return wrote one vendor's remedy onto another vendor's credit. */
  const [resolutions, setResolutions] = useState<
    Record<
      string,
      {
        returnType: ReturnType | null;
        reason: ReturnReason | null;
        note: string;
        /** Why each part is going back, keyed by SKU. A return can carry a
         *  damaged pump and a wrong-part bracket, and one reason for the
         *  document was wrong about one of them. */
        reasons?: Record<string, ReturnReason> | undefined;
        /** What Other means, per part. */
        notes?: Record<string, string> | undefined;
        /** Money back or a credit on the account, where the goods were paid
         *  for. The only thing the last step still asks. */
        settlement?: 'Refund' | 'Credit' | null;
        /** The vendor's own number for the return, where given. */
        vendorRMANumber?: string | undefined;
        /** The date the vendor said the refund would arrive by. */
        refundExpectedDate?: string | undefined;
      }
    >
  >({});


  /** A receipt whose quantity is larger than the line says is going back.
   *
   *  Ticking it is a claim about the document, not about the line, so the two
   *  disagree the moment it is ticked: the line says four and the document
   *  carried ten. Raising the line quietly would change a figure the user
   *  typed on the first step, so it is put to them instead, with the smaller
   *  tie as the other way out. */
  const [tieRaise, setTieRaise] = useState<{
    sku: string;
    uom: string;
    grnNumber: string;
    docQty: number;
    declared: number;
    fits: number;
    lineId: string;
  } | null>(null);

  /** How narrow a line's definition of itself is. The narrowest answers
   *  first, and its answer is then the whole return's: a serial names one
   *  unit and one vendor, a batch names a delivery, and plain stock names
   *  nothing at all, so plain stock cannot be allowed to settle a question
   *  the serials are about to answer differently. */
  const narrowness = (sku: string) => {
    const mode = trackingModeFor(sku);
    if (mode === 'serialized') return 0;
    if (mode === 'lot-serialized') return 1;
    if (mode === 'lot') return 2;
    return 3;
  };

  /** Every line that names its own vendor, narrowest first. */
  const controlledLines = () =>
    lineItems
      .filter((li) => li.invoiceQty > 0 && trackingModeFor(li.sku) !== 'none')
      .sort((a, b) => narrowness(a.sku) - narrowness(b.sku));

  /** Whether a controlled line has been answered: a unit picked, or a batch. */
  const controlledVendor = (li: (typeof lineItems)[number]): string | null => {
    const mode = trackingModeFor(li.sku);
    if (mode === 'serialized' || mode === 'lot-serialized') {
      return serialOriginsFor(li.sku)[0]?.vendorCode ?? null;
    }
    // A batch comes in from one supplier, so picking a batch names them the
    // way picking a serial does. It used to be asked underneath the picker,
    // because a lot was modelled as several suppliers' stock in one bin --
    // which is not what a lot is.
    if (mode === 'lot') {
      const picked = lineLots[li.id] ?? [];
      if (picked.length > 0) {
        const blocks = lotBlocksFor(li.sku, li.uom ?? 'EA');
        for (const pick of picked) {
          if (pick.qty <= 0) continue;
          const block = blocks.find((b) => b.lot === pick.lot);
          const owner = block ? lotVendorFor(block) : null;
          if (owner) return owner.vendorCode;
        }
      }
    }
    return countedVendorFor(li.sku, li.uom ?? 'EA');
  };

  /** The one vendor this whole return is with.
   *
   *  A serial carries its receipt and a receipt carries its supplier, so
   *  picking the first unit settles who the return is with. One RMA is raised
   *  against one vendor and credited by them, so units from two suppliers on
   *  one return is a mistake rather than a case the flow should support.
   *
   *  It used to be a serialized line's business alone, with every other line
   *  choosing for itself. It is the return's now, narrowest definition first:
   *  the serials and the batches answer, and what they answer is what the
   *  plain lines are returned to. A plain line can still set it, but only
   *  when there is no controlled line on the return to say otherwise. */
  /** The lock as the controlled lines set it, and nothing else.
   *
   *  What the narrowest definition has actually said. A plain line's vendor
   *  is a choice somebody made about stock that carries no receipt, so it
   *  cannot close a serial's units or make a lot line impossible: a serial
   *  overrules it, and until one is picked it has nothing to overrule. The
   *  controlled lines read this; everything else reads the lock below. */
  const controlledLock = useMemo<string | null>(() => {
    for (const li of controlledLines()) {
      const code = controlledVendor(li);
      if (code) return code;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems, lineSerials, lineLots, vendorAllocations]);

  const rmaVendorLock = useMemo<string | null>(() => {
    if (controlledLock) return controlledLock;
    for (const li of lineItems) {
      if (li.invoiceQty <= 0) continue;
      const code = countedVendorFor(li.sku, li.uom ?? 'EA');
      if (code) return code;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledLock, lineItems, lineSerials, lineLots, vendorAllocations]);

  /** The vendor a picker holds this line to: the return's, whoever named them.
   *
   *  Once a vendor is established every later pick is constrained to it, in
   *  both directions -- a serial names the vendor for the plain lines, and a
   *  vendor chosen on a plain line decides which serials and batches can be
   *  taken. It used to yield when the vendor had nothing on the line being
   *  read, which is how a return whose vendor was already chosen could still
   *  take somebody else's units. The line that cannot be matched is the plain
   *  one, and it is answered by going back untied rather than by unlocking
   *  the picker. */
  const lockForLine = (_sku: string, _uom: string): string | null => rmaVendorLock;

  /** Where the return's vendor came from, as a clause that can follow their
   *  name: "…, chosen on STEEL-001." A picker refusing everything else has to
   *  be able to say what made the choice, and the answer is often a different
   *  line from the one being read. */
  const lockOrigin = (): string | null => {
    if (lockedVendor) return 'the return was started from them';
    if (!rmaVendorLock) return null;
    const by = controlledLines().find((li) => controlledVendor(li));
    if (!by) {
      const plain = lineItems.find(
        (li) => li.invoiceQty > 0 && countedVendorFor(li.sku, li.uom ?? 'EA') === rmaVendorLock,
      );
      return plain ? `chosen on ${plain.sku}` : null;
    }
    return trackingModeFor(by.sku) === 'lot'
      ? `named by the lots on ${by.sku}`
      : `named by the serial numbers on ${by.sku}`;
  };

  /** Plain lines follow the lock, rather than being asked about it.
   *
   *  One RMA is one vendor: once a serial, a batch or another line has settled
   *  who this return is with, a counted line's vendor is not a question any
   *  more. It was still being asked -- the line sat outstanding with "select
   *  the vendor to return it to" against an answer the return had already
   *  given -- so it is written instead, for every line that vendor has
   *  actually shipped. A line they have never shipped is the one case left,
   *  and it is answered on its own card rather than here. */
  useEffect(() => {
    if (!isRma || !rmaVendorLock) return;
    currentPOItems.forEach((li) => {
      if (li.invoiceQty <= 0) return;
      const uom = li.uom ?? 'EA';
      if (trackingModeFor(li.sku) !== 'none') return;
      if (countedVendorFor(li.sku, uom)) return;
      const line = resolutionLines.find((l) => l.sku === li.sku && l.uom === uom);
      const shipped = line
        ? resolveCandidates(line).some((c) => c.shipped && c.vendorCode === rmaVendorLock)
        : false;
      if (!shipped) return;
      markAnswered('vendor', lineKey(li.sku, uom));
      markAnswered('units', lineKey(li.sku, uom));
      pickCountedVendor(li.sku, uom, li.invoiceQty, rmaVendorLock);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRma, rmaVendorLock, currentPOItems]);

  /** Plain lines the return's vendor has never shipped.
   *
   *  The one case the lock cannot settle by itself: the goods are going back
   *  to a vendor with no receipt for them. They can still go back -- one bolt
   *  is any bolt -- but as an untied return, with nothing on the invoicing
   *  side to reverse. Each card says so on its own; this is what lets the
   *  whole set be answered at once from the step's own strip. */
  const unmatchedPlain = useMemo(() => {
    if (!rmaVendorLock) return [];
    return currentPOItems.filter((li) => {
      if (li.invoiceQty <= 0) return false;
      const uom = li.uom ?? 'EA';
      if (trackingModeFor(li.sku) !== 'none') return false;
      if (countedVendorFor(li.sku, uom)) return false;
      const line = resolutionLines.find((l) => l.sku === li.sku && l.uom === uom);
      return line
        ? !resolveCandidates(line).some((c) => c.shipped && c.vendorCode === rmaVendorLock)
        : false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rmaVendorLock, currentPOItems, vendorAllocations, resolutionLines]);

  /** Send every one of them back to the return's vendor, untied. */
  const resolveUnmatchedPlain = () => {
    if (!rmaVendorLock) return;
    unmatchedPlain.forEach((li) => {
      const uom = li.uom ?? 'EA';
      markAnswered('vendor', lineKey(li.sku, uom));
      markAnswered('units', lineKey(li.sku, uom));
      pickCountedVendor(li.sku, uom, li.invoiceQty, rmaVendorLock);
      setItemTies((prev) => ({
        ...prev,
        [lineKey(li.sku, uom)]: { [rmaVendorLock]: { ties: {}, untied: true } },
      }));
    });
  };

  /** What named the vendor this return is with. The header states it, and a
   *  line being told it cannot choose for itself has to be able to say where
   *  that decision came from. */
  const lockReason = (): string | null => {
    if (lockedVendor) return 'the return was started from them';
    if (!rmaVendorLock) return null;
    const by = controlledLines().find((li) => controlledVendor(li));
    if (!by) {
      const plain = lineItems.find(
        (li) => li.invoiceQty > 0 && countedVendorFor(li.sku, li.uom ?? 'EA') === rmaVendorLock,
      );
      return plain ? `the vendor chosen on ${plain.sku}` : null;
    }
    return trackingModeFor(by.sku) === 'lot'
      ? `the lots selected on ${by.sku}`
      : `the serial numbers on ${by.sku}`;
  };

  /** A line that cannot go back to the vendor this return is with.
   *
   *  Narrow scope, deliberately. It is only a conflict when the line's whole
   *  provenance is known and none of it leads to the locked vendor: a single
   *  unit that arrived without a receiver means the stock could have come
   *  from anybody, so it can go back to anybody and there is nothing to
   *  refuse. Plain stock is that case by definition and is never in conflict.
   *
   *  There is no second draft and no split. The return is with one vendor,
   *  and a line that cannot be part of it is taken off or raised on its own
   *  RMA, which is the user's call rather than the flow's. */
  const vendorConflict = (sku: string): { owners: string[] } | null => {
    // Against the controlled lock, not the return's. A plain line's vendor
    // is a choice, and a choice cannot make a serialized line impossible:
    // the serials overrule it the moment they are picked.
    if (!controlledLock) return null;
    if (trackingModeFor(sku) === 'none') return null;
    if (untracedStockFor(sku)) return null;
    const owners = vendorsForItem(sku)
      .filter((v) => v.returnableQty > 0)
      .map((v) => v.vendorCode);
    if (owners.length === 0 || owners.includes(controlledLock)) return null;
    return { owners };
  };

  /** The most the vendor this return is with can take back of one line.
   *
   *  The quantity is typed on the first step, before anybody knows who the
   *  return is with. A serial or a lot then names them, and the line can be
   *  asking for more than that vendor ever sent: no amount of picking closes
   *  it, because the units are not there. Null where there is no ceiling to
   *  read, which is no vendor yet, or plain stock they have no receipt for
   *  and can therefore take back in any quantity. */
  const vendorCapFor = (li: (typeof lineItems)[number]): number | null => {
    const lock = rmaVendorLock;
    if (!lock) return null;
    const uom = li.uom ?? 'EA';
    const mode = trackingModeFor(li.sku);
    if (mode === 'serialized') {
      const pool = availableSerials(li.sku, li.id, li.receivedQty);
      const receipts = (li.receipts ?? []).map((r) => ({
        grnNumber: r.grnNumber,
        receivedQty: r.receivedQty,
      }));
      const origins = serialOrigins(li.sku, li.id, li.receivedQty, receipts, pool);
      const states = unitStatesFor(li.sku, pool);
      return origins.filter(
        (o) => o.vendorCode === lock && states.get(o.serial) !== 'allocated',
      ).length;
    }
    if (mode === 'lot-serialized') {
      const units = lotUnitPool(li.sku, uom).filter((u) => u.vendorCode === lock);
      const states = unitStatesFor(
        li.sku,
        units.map((u) => u.serial),
      );
      return units.filter((u) => states.get(u.serial) !== 'allocated').length;
    }
    if (mode === 'lot') {
      const qty = lotBlocksFor(li.sku, uom).reduce(
        (n, b) =>
          n + b.receipts.filter((r) => r.vendorCode === lock).reduce((m, r) => m + r.qty, 0),
        0,
      );
      return Math.round(qty * 100) / 100;
    }
    const line = resolutionLines.find((l) => l.sku === li.sku);
    const theirs = line
      ? resolveCandidates(line).find((c) => c.vendorCode === lock && c.shipped)
      : undefined;
    return theirs ? theirs.lifetime : null;
  };

  /** Everything the locked vendor has of a line, picked, with the figure on
   *  the line brought down to match. What the shortfall band offers, once the
   *  user has agreed to it. */
  const fitLineToVendor = (lineId: string) => {
    const li = currentPOItems.find((i) => i.id === lineId);
    const lock = rmaVendorLock;
    if (!li || !lock) return;
    const uom = li.uom ?? 'EA';
    const mode = trackingModeFor(li.sku);
    if (mode === 'serialized') {
      const pool = availableSerials(li.sku, li.id, li.receivedQty);
      const receipts = (li.receipts ?? []).map((r) => ({
        grnNumber: r.grnNumber,
        receivedQty: r.receivedQty,
      }));
      const origins = serialOrigins(li.sku, li.id, li.receivedQty, receipts, pool);
      const states = unitStatesFor(li.sku, pool);
      const theirs = origins
        .filter((o) => o.vendorCode === lock && states.get(o.serial) !== 'allocated')
        .map((o) => o.serial);
      setSerialsForLine(li, theirs, true);
      updateLineItem(li.id, 'invoiceQty', String(theirs.length));
    } else if (isLotMode(mode)) {
      const blocks = lotBlocksFor(li.sku, uom);
      const picks =
        mode === 'lot-serialized'
          ? (() => {
              const units = lotUnitPool(li.sku, uom).filter((u) => u.vendorCode === lock);
              const states = unitStatesFor(
                li.sku,
                units.map((u) => u.serial),
              );
              const free = units.filter((u) => states.get(u.serial) !== 'allocated');
              return blocks
                .map((b) => {
                  const serials = free.filter((u) => u.lot === b.lot).map((u) => u.serial);
                  return { lot: b.lot, qty: serials.length, serials };
                })
                .filter((a) => a.qty > 0);
            })()
          : blocks
              .map((b) => ({
                lot: b.lot,
                qty:
                  Math.round(
                    b.receipts
                      .filter((r) => r.vendorCode === lock)
                      .reduce((m, r) => m + r.qty, 0) * 100,
                  ) / 100,
              }))
              .filter((a) => a.qty > 0);
      const total = Math.round(picks.reduce((n, a) => n + a.qty, 0) * 100) / 100;
      setLineLots((prev) => ({ ...prev, [li.id]: picks }));
      updateLineItem(li.id, 'invoiceQty', String(total));
      if (mode === 'lot') pickCountedVendor(li.sku, uom, total, lock);
    } else {
      const cap = vendorCapFor(li) ?? li.invoiceQty;
      updateLineItem(li.id, 'invoiceQty', String(cap));
      pickCountedVendor(li.sku, uom, cap, lock);
    }
    markAnswered('units', lineKey(li.sku, uom));
    markAnswered('vendor', lineKey(li.sku, uom));
  };

  /** Controlled lines still waiting for their first pick. While any of them
   *  stands here, the plain lines cannot be answered: their vendor is the one
   *  these are about to name. */
  const unanswered = useMemo(
    () =>
      controlledLines().filter(
        // A line that cannot go back to this vendor at all is not one the
        // plain lines are waiting on: it is never going to answer, and
        // holding them behind it made the return unfinishable until the user
        // found the one card that says why.
        (li) => !controlledVendor(li) && !vendorConflict(li.sku),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lineItems, lineSerials, lineLots, vendorAllocations],
  );

  /** Which lines the user has answered with their own hands, per step.
   *
   *  Not the same question as whether a line has an answer. Picking a vendor
   *  pulls every other line that vendor also shipped onto the same RMA, which
   *  is a convenience and not a decision anybody made about those lines, so
   *  the rail keeps marking them until they have been looked at. The mark is
   *  about this item, and clears for this item. */
  const [answeredByHand, setAnsweredByHand] = useState<{ units: string[]; vendor: string[] }>({
    units: [],
    vendor: [],
  });
  const markAnswered = (step: 'units' | 'vendor', key: string) =>
    setAnsweredByHand((prev) =>
      prev[step].includes(key) ? prev : { ...prev, [step]: [...prev[step], key] },
    );

  /** What this step is still missing, in rail order.
   *
   *  The step decides what counts. A line with no vendor is not a problem on
   *  the step that asks for a quantity, and it is the whole problem on the one
   *  that asks for a vendor -- which is the finding: Continue walked straight
   *  past a line nobody had chosen a vendor for, because the only gate was a
   *  general one on the first step.
   *
   *  Each blocker names the line it is about, so pressing Continue can take
   *  the user to it rather than telling them something is wrong somewhere. */
  /** What is still missing, and which line to open to fix it.
   *
   *  `sku` carries the line's key rather than its part number, because a part
   *  on the return in two units is two lines and the jump has to land on the
   *  right one. The messages name the part, which is what the user reads. */
  /** Why a line reads as empty after a figure was typed into it.
   *
   *  A quantity box takes whole units only, so a fraction is refused and the
   *  line is left at zero. The blocker then said only "has no quantity",
   *  which is true but not the reason: the user typed 2.5 and the step
   *  answered as though they had typed nothing. */
  const wholeUnitHint = (sku: string, uom: string): string =>
    hasSerials(trackingModeFor(sku))
      ? `${sku} is serial-numbered, so enter a whole number of ${uom}.`
      : `Enter how many ${uom} go back.`;

  const stepBlockers = useMemo<{ sku: string | null; message: string }[]>(() => {
    if (!isRma) return [];

    const onQuantities = (): { sku: string | null; message: string }[] => {
      const out: { sku: string | null; message: string }[] = [];
      if (showRowErrors) {
        tickedEmpty.forEach((sku) => {
          const uom = currentPOItems.find((l) => l.sku === sku)?.uom ?? 'EA';
          out.push({
            sku: lineKey(sku, uom),
            message: `${sku} has no quantity. ${wholeUnitHint(sku, uom) ?? 'Enter the quantity to return, or clear the selection.'}`,
          });
        });
      }
      overReturnedLines.forEach((l) =>
        out.push({
          sku: lineKey(l.sku, l.uom ?? 'EA'),
          message: `${l.sku}: ${formatQty(l.invoiceQty)} is more than the ${formatQty(l.remainingQty)} ${l.uom} available to return, which is what is left once allocated stock is set aside. Lower the quantity to continue.`,
        }),
      );
      // Above what is on hand in that unit. The box now keeps the figure as
      // typed rather than zeroing it, so the step has to be the one to refuse
      // it, with the same words the box shows.
      if (startMode !== 'vendor') {
        currentPOItems.forEach((l) => {
          const uom = l.uom ?? 'EA';
          if (overReturnedLines.some((o) => o.id === l.id)) return;
          const onHand = returnableItems()
            .find((i) => i.sku === l.sku)
            ?.stock.find((sh) => sh.uom === uom)?.qty;
          if (onHand === undefined || l.invoiceQty <= onHand) return;
          out.push({
            sku: lineKey(l.sku, uom),
            message: `${l.sku}: only ${formatQty(onHand)} ${uom.toUpperCase()} available to return. Lower the quantity to continue.`,
          });
        });
      }
      // A line carrying no figure is the question this step exists to ask. It
      // used to pass straight through and quietly not come back, which is how
      // the footer came to say two lines were ready while the panel said one
      // of them was not coming.
      //
      // Unless the line was not added by hand. The vendor route puts the whole
      // of that vendor's book on the rail, so a row at zero is the answer
      // "not this one" rather than an answer missing -- blocking on them would
      // mean typing a figure against twenty-six parts to return two.
      (startMode === 'vendor' ? [] : currentPOItems)
        .filter((l) => l.invoiceQty <= 0 && !tickedEmpty.includes(l.sku))
        .forEach((l) =>
          out.push({
            sku: lineKey(l.sku, l.uom ?? 'EA'),
            message: `${l.sku} has no quantity. ${wholeUnitHint(l.sku, l.uom ?? 'EA') ?? 'Enter the quantity to return, or remove it from this return.'}`,
          }),
        );
      // An empty return is the state the step opens in rather than a mistake,
      // so it is the one blocker that does not name a line.
      if (currentPOItems.length === 0) {
        return [{ sku: null, message: 'Search for a part and add it before continuing.' }];
      }
      if (returnableLines.length === 0 && out.length === 0) {
        out.push({ sku: null, message: 'Enter a return quantity on at least one line before continuing.' });
      }
      return out;
    };

    const onUnits = (): { sku: string | null; message: string }[] =>
      serialConflicts
        .filter((c) => c.reason !== 'vendors')
        .map((c) => ({
          sku: lineKey(c.sku, c.uom),
          message:
            c.reason === 'units'
              ? `${c.sku} is serialized. Select ${formatQty(c.short)} ${c.uom} of serial numbers to return.`
              : c.short > 0
                ? `${c.sku}: ${formatQty(c.short)} ${c.uom} has no serial numbers selected. Select them, or lower the quantity.`
                : `${c.sku}: ${formatQty(-c.short)} ${c.uom} more is selected than the quantity to return.`,
        }));

    const onVendors = (): { sku: string | null; message: string }[] => {
      const out: { sku: string | null; message: string }[] = [];
      unresolvedCounted
        .filter((u) => u.reason === 'vendor')
        .forEach((u) => {
          out.push({
            sku: lineKey(u.sku, u.uom),
            message:
              u.short === 0
                ? `${u.sku} has no vendor. Select the vendor to return it to.`
                : `${formatQty(Math.abs(u.short))} ${u.uom} of ${u.sku} is ${u.short > 0 ? 'not assigned to a vendor' : 'assigned beyond the quantity to return'}.`,
          });
        });
      overVendorRows.forEach((r) =>
        out.push({
          sku: lineKey(r.sku, r.uom),
          message: `${r.vendorName} only shipped ${formatQty(r.cap)} ${r.uom} of ${r.sku}. Take ${formatQty(r.over)} ${r.uom} off that row, or move the balance to another vendor.`,
        }),
      );
      return out;
    };

    const onReceivers = (): { sku: string | null; message: string }[] => {
      const out: { sku: string | null; message: string }[] = [];
      // Quantity with no document behind it does not stop the return.
      //
      // It is a real cost, and the step says so where the quantity is: the
      // credit has nothing to reverse, so it lands unapplied and somebody
      // matches it by hand later. That is a decision a person is allowed to
      // make, and returns get raised against goods whose paperwork is not to
      // hand. What is still refused is a tie that claims more than its
      // document carried, which is not a decision but an impossibility.
      overTieRows.forEach((r) =>
        out.push({
          sku: lineKey(r.sku, r.uom),
          message: `${r.grnNumber} only brought in ${formatQty(r.cap)} ${r.uom} of ${r.sku}. A credit cannot reverse more than the document carried, so take ${formatQty(r.over)} ${r.uom} off it.`,
        }),
      );
      return out;
    };

    /** Lines that cannot be part of this return at all, and the plain lines
     *  that are waiting on a serial or a batch to say who the return is with.
     *  Both are about the order the questions are asked in, so both belong to
     *  the step that asks them. */
    const onOrder = (): { sku: string | null; message: string }[] => {
      const out: { sku: string | null; message: string }[] = [];
      const nameOf = (code: string) =>
        mockVendors.find((v) => v.vendorCode === code)?.vendorName ?? code;
      currentPOItems
        .filter((li) => li.invoiceQty > 0)
        .forEach((li) => {
          const clash = vendorConflict(li.sku);
          if (!clash || !controlledLock) return;
          // Two names and a count. Eleven of them ran past the end of the
          // band and buried the sentence that says what to do.
          const names = clash.owners.map(nameOf);
          const who =
            names.length <= 2
              ? names.join(' and ')
              : `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`;
          out.push({
            sku: lineKey(li.sku, li.uom ?? 'EA'),
            message: `${li.sku} traces to ${who}, and this return is with ${nameOf(controlledLock)}. Remove it from this return, or return it on a separate RMA.`,
          });
        });
      // Plain stock pointed at somebody else. It is allowed to be asked
      // before the serials are, so it is allowed to be overtaken by them:
      // the return is with one vendor, and this line is not on them yet.
      if (rmaVendorLock) {
        currentPOItems
          .filter((li) => li.invoiceQty > 0 && trackingModeFor(li.sku) === 'none')
          .forEach((li) => {
            const chosen = countedVendorFor(li.sku, li.uom ?? 'EA');
            if (!chosen || chosen === rmaVendorLock) return;
            out.push({
              sku: lineKey(li.sku, li.uom ?? 'EA'),
              message: `${li.sku} is going back to ${nameOf(chosen)}, and this return is with ${nameOf(rmaVendorLock)}. Move it to ${nameOf(rmaVendorLock)}, or remove it from this return.`,
            });
          });
      }
      return out;
    };

    switch (activeStep) {
      case 'lines':
        return onQuantities();
      // Units and vendor are one step now, so it is held to both: a
      // serialized line has to name its units, and a counted one has to name
      // whose they are.
      case 'units':
        return [...onOrder(), ...onUnits(), ...onVendors()];
      case 'receivers':
        return onReceivers();
      // The last step writes the documents, so it answers for all of them. A
      // step that was skipped has nothing to report anyway -- and its own two
      // questions come first, because they are the ones on screen.
      case 'resolution': {
        // Both answers on this step are required before a draft exists.
        //
        // They were optional, on the reasoning that a vendor or a reviewer
        // could supply them later and that blocking on two dropdowns held a
        // complete return hostage. Reversed on Oct 9: a return saved without
        // them is a return nobody can act on, and the gap was being found
        // downstream rather than here.
        const out: { sku: string | null; message: string }[] = [];
        resolutionTargets.forEach((target) => {
          const answer = resolutions[target.vendorCode];
          const items = target.items ?? [];
          // Asked only where there is a choice to make. Goods never billed
          // unwind their accrual and goods on an open invoice take a credit,
          // both without anybody deciding, so there is nothing to withhold a
          // draft over.
          //
          // Worked out exactly as the step works it out. Reading only the
          // vendor-level figure let a return whose paid value sits on the
          // items but not on the target be asked the question on screen and
          // not be held to it on save.
          const unlinked = items.filter((i) => i.unlinked).length;
          const paidTotal =
            Math.round(items.reduce((n, i) => n + (i.paidValue ?? 0), 0) * 100) / 100 ||
            (target.paidValue ?? 0);
          const canSettle = paidTotal > 0.004 || unlinked > 0;
          if (canSettle && !answer?.settlement) {
            out.push({
              sku: null,
              message: `Choose a refund or a credit for ${target.vendorName} before saving.`,
            });
          }
          items.forEach((item) => {
            if (!answer?.reasons?.[item.sku]) {
              out.push({
                sku: lineKey(item.sku, item.uom),
                message: `${item.sku} has no reason. Say why it is going back before saving.`,
              });
            }
          });
        });
        return [
          ...onQuantities(),
          ...onOrder(),
          ...onUnits(),
          ...onVendors(),
          ...onReceivers(),
          ...out,
        ];
      }
      default:
        return [];
    }
  }, [
    isRma,
    activeStep,
    showRowErrors,
    tickedEmpty,
    returnableLines.length,
    currentPOItems,
    overReturnedLines,
    serialConflicts,
    unresolvedCounted,
    overVendorRows,
    overTieRows,
    resolutionTargets,
    resolutions,
    rmaVendorLock,
    controlledLock,
    unanswered,
  ]);

  const canAdvance = stepBlockers.length === 0;

  /** The step's blockers as the banner reads them: one entry per line, each
   *  carrying the line it is about so Review can open it. Deduplicated,
   *  because two blockers on one line are one thing to go and look at. */
  const rmaIssues = useMemo(() => {
    const seen = new Set<string>();
    return stepBlockers.flatMap((b, i) => {
      const key = `${b.sku ?? 'return'}:${b.message}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ key: `${key}:${i}`, sku: b.sku, message: b.message }];
    });
  }, [stepBlockers]);

  /** Whether the strip above the footer is showing.
   *
   *  Every step but the first says what it is missing on arrival. The first
   *  waits for Continue, because what it is missing there is a figure nobody
   *  has had the chance to type yet, and an empty return is the state the flow
   *  opens in rather than a mistake. After that the user has answered one
   *  question and is being asked another, so what the step still needs is
   *  information rather than a telling-off. */
  const showIssuesBand =
    isRma && rmaIssues.length > 0 && (showRowErrors || activeStep !== 'lines');

  /** The line an issue was just clicked for, read once the menu has closed. */
  const issueJump = useRef<string | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(false);
  /** Review, drawn the way the payment run's issue strip draws it.
   *
   *  Same control, same popover: an underlined amber link with a chevron that
   *  turns over, a 400px card headed "Needs attention", and one row per issue
   *  with the thing it is about on top, what to do under it, and a chevron at
   *  the right saying the row goes somewhere. Ported from
   *  `RunProposalStage.tsx` in the vendor invoicing repo. */
  const renderIssuesReview = () => (
    <IssuesPopover open={issuesOpen} onOpenChange={setIssuesOpen}>
      <IssuesPopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Review ${rmaIssues.length} ${rmaIssues.length === 1 ? 'issue' : 'issues'}`}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-amber-300 bg-white text-[12px] text-amber-800 hover:border-amber-400 hover:text-amber-900 hover:bg-amber-50/60 transition-colors cursor-pointer"
          style={{ fontWeight: 600 }}
        >
          Review
          <ChevronDown className={`w-3 h-3 transition-transform ${issuesOpen ? 'rotate-180' : ''}`} />
        </button>
      </IssuesPopoverTrigger>
      <IssuesPopoverContent
        align="end"
        sideOffset={6}
        className="w-[400px] p-0 bg-white border border-border rounded-xl overflow-hidden z-[400]"
        style={{ boxShadow: '0 12px 32px -8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)' }}
      >
        <div className="px-4 pt-3 pb-1">
          <p className="text-[12px] text-slate-500" style={{ fontWeight: 600 }}>
            Needs attention
          </p>
        </div>
        <div className="px-2 pb-2 max-h-[320px] overflow-y-auto">
          {rmaIssues.map((issue) => {
            // The first sentence names the thing, the rest says what to do
            // about it. That is the shape the payment run's rows are written
            // in, and our blockers are already written that way.
            const cut = issue.message.indexOf('. ');
            const title = cut > 0 ? issue.message.slice(0, cut + 1) : issue.message;
            const detail = cut > 0 ? issue.message.slice(cut + 2) : '';
            return (
              <button
                key={issue.key}
                type="button"
                onClick={() => {
                  setIssuesOpen(false);
                  if (!issue.sku) return;
                  setConfigureSku(issue.sku);
                  issueJump.current = issue.sku;
                  // The popover returns focus to its trigger as it closes, so
                  // the field is claimed after that rather than against it.
                  setTimeout(() => {
                    const el = document.getElementById(`qty-${issue.sku}`);
                    if (el instanceof HTMLInputElement) {
                      el.focus();
                      el.select();
                    }
                  }, 160);
                }}
                className="w-full flex items-start gap-2.5 px-2 py-2 rounded-md hover:bg-slate-50 text-left transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-slate-700 leading-snug" style={{ fontWeight: 600 }}>
                    {title}
                  </p>
                  {detail && (
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5 truncate">
                      {detail}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
              </button>
            );
          })}
        </div>
      </IssuesPopoverContent>
    </IssuesPopover>
  );

  const blockReason: string | null =
    !isRma || canAdvance
      ? null
      : // An empty return on the way in is not a mistake, it is the state the
        // flow opens in. Saying so before the user has touched anything told
        // them off for arriving. Continue is still held; the band waits until
        // they press it.
        activeStep === 'lines' && currentPOItems.length === 0 && !showRowErrors
        ? null
        : (stepBlockers[0]?.message ?? null);

  // Snapshot on the way into a step, so what is on the rail stays on the rail
  // while the step is being answered.
  useEffect(() => {
    if (activeStep === 'lines') {
      setRailHold([]);
      return;
    }
    setRailHold(
      lineItems.filter((l) => l.invoiceQty > 0).map((l) => lineKey(l.sku, l.uom ?? 'EA')),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep]);

  const goNext = () => {
    // Trying to leave the step is the deliberate act the rows were waiting
    // for. The button is never disabled for it: pressing Continue is how the
    // user asks what is missing, and greying it out answers a question they
    // have not asked yet, then leaves them hunting for the reason.
    //
    // So the answer comes back as a jump. The first thing this step is still
    // missing gets the focus, its row lights up, and the band above the footer
    // says what it needs. Validate everything, go to the first problem.
    setShowRowErrors(true);
    // `stepBlockers` was computed before the click, when row errors were still
    // being held back, so the ticked-but-empty rows it will pick up on the next
    // render are checked here directly.
    const blocker =
      stepBlockers[0] ??
      (activeStep === 'lines' && tickedEmpty.length > 0
        ? {
            sku: lineKey(
              tickedEmpty[0]!,
              currentPOItems.find((l) => l.sku === tickedEmpty[0])?.uom ?? 'EA',
            ),
            message: '',
          }
        : undefined);
    if (blocker) {
      if (blocker.sku) setConfigureSku(blocker.sku);
      return;
    }
    // Units spanning two suppliers used to stop Continue with a dialog on the
    // way out of the Merge and split step. That step is the whole statement
    // already: every vendor the return becomes is a card on it, named and
    // counted, with the merge question asked in the open. A modal repeating
    // it interrupted the one screen that had just shown it.
    if (isFinalStep) {
      handleSubmit();
      return;
    }
    const next = stepPlan[currentStepIndex + 1];
    // Leaving a step clean puts the flag down again. It was raised on the
    // first Continue and never lowered, so every step after it opened with
    // its own answers already marked missing -- the credit step worst of all,
    // where two red bands and a red counter greeted a question nobody had
    // been asked yet.
    if (next) {
      setShowRowErrors(false);
      setActiveStep(next.key);
    }
  };
  const goBack = () => {
    const prev = stepPlan[currentStepIndex - 1];
    if (prev) {
      setShowRowErrors(false);
      setActiveStep(prev.key);
    }
  };

  const activePOOriginalData = useMemo(() => {
    if (!activePOTab) return null;
    for (const vendor of mockVendors) {
      const po = vendor.purchaseOrders.find(p => p.poNumber === activePOTab);
      if (po) return po;
    }
    return null;
  }, [activePOTab]);

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

  const handleRemovePO = () => {
    if (!poToRemove) return;
    
    const nextPOs = currentPOsData.filter(po => po.poNumber !== poToRemove);
    setCurrentPOsData(nextPOs);
    
    if (activePOTab === poToRemove) {
      setActivePOTab(nextPOs[0]?.poNumber || '');
    }
    
    setPoToRemove(null);
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

          // An absent receipt-item filter means "everything on these receipts",
          // and the line builder reads it that way. Merging two selections that
          // both had none produced an empty array instead -- present, and
          // therefore read as "nothing is selected" -- so the merged entry
          // silently built no lines at all. Adding a third part to a return
          // deleted the first, whenever the two shared a purchase order.
          mergedMap.set(newPo.poNumber, {
            ...existing,
            relatedGRNs: mergedGRNs,
            ...(mergedGRNItemIds.length > 0
              ? { selectedGRNItemIds: mergedGRNItemIds }
              : existing.selectedGRNItemIds || newPo.selectedGRNItemIds
                ? { selectedGRNItemIds: mergedGRNItemIds }
                : {}),
            items: mergedItems,
            // Absent means "every item on this PO", the same as it does for
            // the receipts above. An entry that had no list and is handed one
            // by the next add must not be narrowed to it: that turns "all of
            // this vendor's book" into "the one part just added" and takes
            // every line already on the return, and the figures typed against
            // them, off the screen.
            ...(existing.selectedItemIds === undefined
              ? {}
              : { selectedItemIds: mergedSelectedItemIds }),
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

  // 2-way matching: receiving (GRN) is NOT considered. An invoice with
  // no/partial receiving is a legitimate pre-invoice — a payment made
  // against it is treated as a pre-payment downstream. So invoiceQty
  // exceeding receivedQty is allowed and does NOT require an Exception
  // flag before submitting.

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

  // Click handler on the footer Submit button. Runs field-level + cross-
  // field validation first; if everything is OK and the invoice carries
  // an Exception or Payment Hold flag, open the amber warning modal so
  // the user explicitly acknowledges the holding state. Otherwise submit
  // directly via performSubmit.
  /** The restocking fees about to be saved that differ from what their vendor
   *  is on file for.
   *
   *  A charge is typed in dollars and a vendor profile holds a percentage, so
   *  the two meet through the base a fee is charged on: the full return
   *  value, every part going back to that vendor at its line price, invoiced
   *  or not. The same base the approval and the detail page use, so a fee
   *  pushed to the profile from here reads the same percentage there.
   */
  const restockingScopeAsks = () =>
    resolutionTargets.flatMap((target) => {
      const fee =
        Math.round(
          (resolutionCharges[target.vendorCode] ?? [])
            .filter((c) => c.type === 'Restocking fee')
            .reduce((n, c) => n + (c.amount || 0), 0) * 100,
        ) / 100;
      if (fee <= 0.004) return [];
      const base =
        Math.round(
          (target.items ?? []).reduce(
            (n, i) => n + (i.value ?? 0),
            0,
          ) * 100,
        ) / 100;
      if (base <= 0.004) return [];
      const pct = Math.round((fee / base) * 1000) / 10;
      const currentPct = restockingStandardFor(target.vendorName);
      if (currentPct === pct) return [];
      if (feeScopeAnswered[target.vendorCode] === pct) return [];
      return [
        { vendorCode: target.vendorCode, vendorName: target.vendorName, pct, amount: fee, currentPct },
      ];
    });

  /** Answers the fee at the head of the queue and moves to the next, saving
   *  once the last one is answered. The save was held back for this: the
   *  question is about what the return is being created with, so it is asked
   *  before the drafts exist rather than after. */
  const answerFeeScope = (scope: 'return' | 'vendor') => {
    const head = feeScopeQueue[0];
    if (!head) return;
    feeScopeAnswering.current = true;
    if (scope === 'vendor') setRestockingStandard(head.vendorName, head.pct);
    setFeeScopeAnswered((prev) => ({ ...prev, [head.vendorCode]: head.pct }));
    commitVendorCharges(head.vendorCode);
    const rest = feeScopeQueue.slice(1);
    setFeeScopeQueue(rest);
    if (rest.length === 0 && feeScopeIntent === 'submit') performSubmit();
  };

  /** Takes this vendor's charges as they stand, which is what Discard will go
   *  back to and what makes the Save pair stand down. */
  const commitVendorCharges = (vendorCode: string) => {
    setResolutionChargesSaved((prev) => ({
      ...prev,
      [vendorCode]: resolutionCharges[vendorCode] ?? [],
    }));
  };

  /** The Save charges button on the last step, which is the detail page's
   *  button and asks the detail page's question. */
  const saveVendorCharges = (vendorCode: string) => {
    const asks = restockingScopeAsks().filter((a) => a.vendorCode === vendorCode);
    if (asks.length > 0) {
      setFeeScopeIntent('charges');
      setFeeScopeQueue(asks);
      return;
    }
    commitVendorCharges(vendorCode);
  };

  const handleSubmit = () => {
    if (!onInvoicesCreated) return;

    // Field-level validation — collect EVERY missing required field,
    // highlight it (red border + helper, same recipe as the vendor
    // invoice number), make sure its section is expanded, and scroll
    // the first offender into view. The CTA itself never disables.
    const missingFieldTargets: string[] = [];
    // RMA mode: the vendor issues its RMA number in response to the
    // request, so it usually isn't known at creation time — optional here,
    // still mandatory on an invoice.
    if (!isRma && !vendorInvoiceNumber.trim()) {
      setVendorInvoiceNumberError(true);
      missingFieldTargets.push('vendor-invoice-number-field');
    }
    // Duplicate per-vendor number blocks submit exactly like a missing one.
    if (vendorInvoiceNumberDuplicate) {
      missingFieldTargets.push('vendor-invoice-number-field');
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
    if (isStandalone && standaloneItems.some((item) => !item.glAccount || !item.glAccount.trim())) {
      setGlMissingError(true);
      missingFieldTargets.push('standalone-line-items');
    } else {
      setGlMissingError(false);
    }
    if (missingFieldTargets.length > 0) {
      toast.error(copy.blockedTitle, {
        description: 'Fill in the highlighted required fields.',
      });
      // Let the section expand before scrolling to it.
      setTimeout(() => {
        document.getElementById(missingFieldTargets[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
      return;
    }

    // Over-billed lines block submission (design feedback 7/13/26):
    // invoicing BELOW the remaining quantity is fine (the rest stays open),
    // invoicing ABOVE it never is. The offending qty field is already
    // red-highlighted; switch to its PO tab and scroll it into view.
    // A serialized line with no units picked is left alone: a draft is a
    // work-in-progress, so picking the units is finished before the return is
    // sent rather than before it is saved.

    if (!isStandalone) {
      const overBilled = lineItems.filter((i) => i.invoiceQty > i.remainingQty);
      if (overBilled.length > 0) {
        const first = overBilled[0];
        if (first.poNumber !== activePOTab) setActivePOTab(first.poNumber);
        toast.error(copy.blockedTitle, {
          description: isRma
            ? `Return quantity exceeds the quantity available to return on ${overBilled.length === 1 ? '1 line' : `${overBilled.length} lines`}. Lower it first.`
            : `Invoice quantity exceeds the remaining quantity on ${overBilled.length === 1 ? '1 line' : `${overBilled.length} lines`}. Lower it to the remaining quantity first.`,
        });
        // Let the PO tab switch render before scrolling to the field,
        // then flash it so the eye lands on the offending line (meeting
        // feedback 7/17/26).
        setTimeout(() => {
          const el = document.getElementById(`line-qty-${first.id}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el?.animate(
            [
              { backgroundColor: 'rgba(239, 68, 68, 0.16)' },
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
      toast.error(copy.blockedTitle, { description: check.message });
      return;
    }

    // RMA mode saves a Draft — nothing posts to the GL and nothing
    // goes to an approver, so there are no implications to confirm.
    // Save straight through and let the caller route to the detail page.
    if (isRma) {
      // No confirmation. A draft posts nothing and goes to nobody, and the
      // step before this one already shows what the save will write, so a
      // dialog that repeats it is a click between the user and their own
      // document. The three things the dialog used to block on are still
      // blocked, as the flagged fields they already are.
      if (unplacedItems.length > 0) {
        toast.error(copy.blockedTitle, {
          description:
            unplacedItems.length === 1
              ? 'One item is not fully with a vendor yet. Assign the rest before saving.'
              : `${unplacedItems.length} items are not fully with a vendor yet. Assign the rest before saving.`,
        });
        return;
      }
      if (overVendorRows.length > 0 || overTieRows.length > 0) {
        toast.error(copy.blockedTitle, {
          description:
            'A return quantity is above what that vendor delivered. Lower the highlighted figures first.',
        });
        return;
      }
      // A restocking fee nobody has recorded against this vendor before, or
      // one that is not the fee on their profile, is a fact worth keeping.
      // The purchase order asks the same question when an item is ordered
      // from a vendor it is not qualified against: use it here, or put it on
      // the partner.
      const asks = restockingScopeAsks();
      if (asks.length > 0) {
        setFeeScopeIntent('submit');
        setFeeScopeQueue(asks);
        return;
      }
      performSubmit();
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

  // Actual submit -- consumed by handleSubmit (clean case) and by the
  // warning modal's confirm button (exception / payment-hold case).
  const performSubmit = () => {
    if (!onInvoicesCreated) return;

    const newInvoices: Invoice[] = [];
    const timestamp = Date.now();
    const vendorName = vendorData?.vendorName || standaloneVendor?.vendorName || 'Global Logistics Partners';
    const currentDate = new Date().toISOString().split('T')[0];

    // Standalone invoice submission
    if (isStandalone) {
      const standaloneInvoice: Invoice = {
        id: `inv-${timestamp}-sa`,
        invoiceNumber: vendorInvoiceNumber || invoiceNumber,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: 'Standalone' as any,
        amount: total,
        outstandingBalance: total,
        currency: vendorData?.currency || standaloneVendor?.currency || 'USD',
        date: currentDate,
        invoiceDate: invoiceDate,
        createdDate: currentDate,
        dueDate: dueDate,
        status: submitStatus,
        is_payment_held: submitPaymentHeld,
        is_exception: submitIsException,
        createdBy: 'Ahtisham Ahmad',
        apAccount: apAccount,
        description: description || `Standalone invoice for ${vendorName}`,
        linkedPOs: [],
        linkedGRNs: [],
        reference: vendorInvoiceNumber
      };
      newInvoices.push(standaloneInvoice);

      // Promote the most-used expense account to this vendor's default going
      // forward, if the user opted in via the submit modal.
      if (glDefaultChoice === 'default' && currentVendorId && mostUsedGl) {
        setVendorDefaultExpenseAccount(currentVendorId, mostUsedGl);
        toast.success('Default expense account updated', {
          description: `${mostUsedGl} is now ${possessive(vendorName)} default for new standalone invoices.`,
        });
      }

      toast.success('Standalone invoice submitted', {
        description: `Invoice ${vendorInvoiceNumber || invoiceNumber} has been created for ${vendorName}.`
      });

      onInvoicesCreated(newInvoices);
      onClose();
      return;
    }
    
    // Check if we have pre-invoice items
    const preInvoiceItems = lineItems.filter(item => item.isPreInvoice);
    const standardInvoiceItems = lineItems.filter(item => !item.isPreInvoice);
    
    const hasPre = preInvoiceItems.length > 0;
    const hasStandard = standardInvoiceItems.length > 0;

    // A return is raised against goods, not billed in stages, so the
    // pre/standard split stays on the invoice side. Splitting here would
    // hand the RMA a parent carrying no receipts at all.
    if (!isRma && hasPre && hasStandard) {
      // Split scenario: One Pre-Invoice (Parent) and one Standard Invoice (Child)
      
      // 1. Parent Pre-Invoice (Matches full amount)
      const parentInvoice: Invoice = {
        id: `inv-${timestamp}-pre`,
        invoiceNumber: `${vendorInvoiceNumber}-PRE`,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: 'Pre-Invoice',
        amount: total,
        outstandingBalance: total,
        currency: 'USD',
        date: currentDate,
        invoiceDate: currentDate,
        createdDate: currentDate,
        dueDate: dueDate,
        status: submitStatus,
        is_payment_held: submitPaymentHeld,
        is_exception: submitIsException,
        createdBy: 'Current User',
        apAccount: apAccount,
        description: description || `Pre-Invoice for PO(s): ${uniquePONumbers.join(', ')}`,
        linkedPOs: uniquePONumbers,
        linkedGRNs: [],
        reference: uniquePONumbers[0]
      };
      newInvoices.push(parentInvoice);

      // 2. Child Standard Invoice (Offsetting for received items)
      // The amount here represents the goods already received
      const standardAmount = standardInvoiceItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const childInvoice: Invoice = {
        id: `inv-${timestamp}-std`,
        invoiceNumber: `${vendorInvoiceNumber}-STD`,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: 'Receiving-based',
        amount: standardAmount,
        outstandingBalance: standardAmount,
        currency: 'USD',
        date: currentDate,
        invoiceDate: currentDate,
        createdDate: currentDate,
        dueDate: dueDate,
        status: submitStatus,
        is_payment_held: submitPaymentHeld,
        is_exception: submitIsException,
        createdBy: 'Current User',
        apAccount: apAccount,
        description: description || `Standard Invoice for received items from PO(s): ${uniquePONumbers.join(', ')}`,
        linkedPOs: uniquePONumbers,
        linkedGRNs: Array.from(new Set(standardInvoiceItems.flatMap(i => i.grnNumbers))),
        reference: uniquePONumbers[0]
      };
      newInvoices.push(childInvoice);
      
      toast.success('Invoices submitted successfully', {
        description: `Automated split: 1 Pre-Invoice and 1 Standard Invoice have been created.`
      });
    } else {
      // Single invoice scenario
      const finalType = hasPre ? 'Pre-Invoice' : 'PO-based';
      const singleInvoice: Invoice = {
        id: `inv-${timestamp}`,
        invoiceNumber: vendorInvoiceNumber,
        vendorInvoiceNumber: vendorInvoiceNumber,
        vendor: vendorName,
        type: finalType as any,
        amount: total,
        outstandingBalance: total,
        currency: 'USD',
        date: currentDate,
        invoiceDate: currentDate,
        createdDate: currentDate,
        dueDate: dueDate,
        status: submitStatus,
        is_payment_held: submitPaymentHeld,
        is_exception: submitIsException,
        createdBy: 'Current User',
        apAccount: apAccount,
        description: isRma
          ? description
          : description || `${finalType} for PO(s): ${uniquePONumbers.join(', ')}`,
        linkedPOs: uniquePONumbers,
        linkedGRNs: Array.from(new Set(lineItems.flatMap(i => i.grnNumbers))),
        reference: uniquePONumbers[0]
      };
      newInvoices.push(singleInvoice);
      
      // A return names the vendors its drafts were raised for. `vendorName` is
      // the invoice side's, which on a return started from an item fell
      // through to a placeholder vendor nobody picked.
      const rmaVendors = [...new Set(vendorDrafts.map((d) => d.vendorName))];
      toast.success(
        isRma
          ? rmaVendors.length > 1
            ? `${rmaVendors.length} RMAs saved as draft`
            : 'RMA saved as draft'
          : 'Invoice submitted successfully',
        {
          description: isRma
            ? rmaVendors.length > 1
              ? `Returns for ${rmaVendors.join(', ')} are ready to send.`
              : `Return for ${rmaVendors[0] ?? vendorName} is ready to send.`
            : `Invoice ${vendorInvoiceNumber} has been created for ${vendorName}.`,
        },
      );
    }

    // Send the effective units for every serialized line, not just the ones
    // the user opened — an untouched line still has an implied selection
    // (the first `qty` units) and the RMA has to record the same ones the
    // grid was showing.
    const effectiveSerials: Record<string, string[]> = {};
    // Same reasoning for type and reason: a line the user never opened still
    // settles under the document-level default, so the RMA records that rather
    // than an empty map.
    const effectiveReturnTypes: Record<string, string> = {};
    const effectiveReasons: Record<string, string> = {};
    // A line whose goods sat in several invoice states settles several ways at
    // once, and the single reason/type/price above can only state the largest.
    // The breakdown travels alongside so nothing the user set is dropped.
    const effectiveSettlements: Record<string, RMALineSettlement[]> = {};
    if (isRma) {
      lineItems.forEach((li) => {
        // Lines with an invoice split answer per state, but the record holds one
        // reason and one type per line, so it takes the state covering the most
        // units.
        const allocation = allocationFor(li.id, li.invoiceQty, li.invoiceSplit);
        const lead = bucketCount(li.invoiceSplit) > 0 ? bucketsByShare(allocation)[0] : undefined;
        if (lead) {
          const reason = bucketReasonFor(li.id, lead);
          effectiveReasons[li.id] = reason;
          effectiveReturnTypes[li.id] = bucketTypeFor(li.id, lead, reason as ReturnReason, allocation[lead]);
          const settled = RETURN_BUCKETS.filter((b) => allocation[b] > 0.004);
          if (settled.length > 1) {
            effectiveSettlements[li.id] = settled.map((b) => {
              const bReason = bucketReasonFor(li.id, b) as ReturnReason;
              return {
                state: b,
                qty: allocation[b],
                unitPrice: bucketPriceFor(li.id, b, li.originalUnitPrice),
                reason: bReason,
                returnType: bucketTypeFor(li.id, b, bReason, allocation[b]) as ReturnType,
              };
            });
          }
        } else {
          effectiveReasons[li.id] = returnReasonFor(li.id);
          effectiveReturnTypes[li.id] = returnTypeFor(li.id, li.invoiceSplit);
        }
        if (trackingModeFor(li.sku) !== 'serialized') return;
        effectiveSerials[li.id] = serialsForLine(li.id, li.sku, li.id, li.receivedQty, li.invoiceQty);
      });

    }

    onInvoicesCreated(newInvoices, isRma ? {
      lineReasons: effectiveReasons,
      lineReturnTypes: effectiveReturnTypes,
      // What the last step answered, per vendor. A line's own reason and type
      // cannot carry this: a part split between two vendors is one line and
      // two credits, so the answer belongs to the document, not the row.
      resolutionsByVendor: Object.fromEntries(
        resolutionTargets
          .map((target) => [target.vendorCode, resolutions[target.vendorCode]] as const)
          // A reason or a settlement is enough. The return type is no longer
          // asked: the system decides it per invoice state, and the only
          // choice left on the step is money back against credit.
          // Notes and files are answers too: a return whose only answer is
          // the photograph of the damage still has to carry it.
          .filter(
            ([code, answer]) =>
              answer?.reason ||
              answer?.settlement ||
              answer?.vendorRMANumber?.trim() ||
              answer?.refundExpectedDate ||
              answer?.note.trim() ||
              (resolutionFiles[code] ?? []).length > 0 ||
              (resolutionTags[code] ?? []).length > 0 ||
              (resolutionCharges[code] ?? []).length > 0,
          )
          // A vendor can reach the save with no answer of its own: a charge
          // or a photograph is enough to keep it, and neither touches the
          // resolution. Reading the answer as given threw on exactly that.
          .map(([code, answer]) => [
            code,
            {
              returnType: (answer?.settlement ? 'Refund/Credit' : answer?.returnType) ?? null,
              reason: answer?.reason ?? null,
              note: answer?.note.trim() ?? '',
              ...(answer?.settlement ? { settlement: answer.settlement } : {}),
              attachments: (resolutionFiles[code] ?? []).map((f) => ({ name: String(f.name) })),
              tags: resolutionTags[code] ?? [],
              charges: resolutionCharges[code] ?? [],
              reasons: answer?.reasons ?? {},
              reasonNotes: answer?.notes ?? {},
              ...(answer?.vendorRMANumber?.trim()
                ? { vendorRMANumber: answer.vendorRMANumber.trim() }
                : {}),
              ...(answer?.refundExpectedDate ? { refundExpectedDate: answer.refundExpectedDate } : {}),
              paidQtyByItem: Object.fromEntries(
                (resolutionTargets.find((t) => t.vendorCode === code)?.items ?? []).map(
                  (i) => [`${i.sku}|${i.uom}`, i.paidQty] as const,
                ),
              ),
            },
          ]),
      ),
      shippingInstruction: shippingInstruction.trim(),
      returnShipTo: shipToName,
      returnShipToPartner: shipToPartnerName,
      carrier: selectedCarrier?.name ?? '',
      lineSerials: effectiveSerials,
      lineLots,
      lineSettlements: effectiveSettlements,
      // Sites, not vendors. `isMultiOrigin` counts vendors, so a return off
      // three sites of one vendor was forced back to 'origin' however the
      // merge and split step was answered.
      returnRouting: returnSites.length > 1 ? returnRouting : 'origin',
      returnLegs,
      selectedPOs: currentPOsData,
      // The second step's answer, in the shape the fan-out reads. Without it
      // the drafts came out per vendor site, which is the model the flow no
      // longer has: a branch is its own vendor, and the panel says so.
      vendorDrafts,
      lineQuantities: Object.fromEntries(lineItems.map((li) => [li.id, li.invoiceQty])),
      lineUnitPrices: Object.fromEntries(lineItems.map((li) => [li.id, li.unitPrice])),
      lineOriginalPrices: Object.fromEntries(lineItems.map((li) => [li.id, li.originalUnitPrice])),
      lineNotes,
      lineAttachments,
      lineReceivedQty: Object.fromEntries(lineItems.map((li) => [li.id, li.receivedQty])),
      vendorRMANumber: vendorInvoiceNumber.trim(),
      expectedResolutionDate: (() => {
        const first = lineItems[0];
        return first ? resolutionDateFor(first.id, first.poNumber) : invoiceDate ?? '';
      })(),
      headerAttachments: invoiceAttachments.map((f) => ({ name: String(f.name) })),
      payToAccountId: payFromId,
    } : undefined);
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
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-3.5 py-3 relative overflow-hidden">
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
              <span className="text-white/60">PO#</span> {poNum}
            </a>
          </div>
          <span
            className={`inline-flex items-center px-1.5 py-px rounded border text-[10px] uppercase tracking-wider shrink-0 ${
              poData?.isPreInvoice
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
            style={{ fontWeight: 700 }}
          >
            {isRma ? 'Return' : poData?.isPreInvoice ? 'Pre-invoice' : 'Invoice'}
          </span>
        </div>
        <p className="text-[11px] text-white/50 mt-1" style={{ fontWeight: 400 }}>
          Issued {poData?.poDate}
        </p>
        {/* The chip only has room for the branch, so the full site name
            reads here alongside the PO's other identifying facts. */}
        {isMultiOrigin && poData && (
          <p className="flex items-center gap-1 text-[11px] text-white/50 mt-0.5 relative" style={{ fontWeight: 400 }}>
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">Received from {poData.originName}</span>
          </p>
        )}
      </div>
      <div className="px-3.5 py-3 space-y-2.5 bg-white">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
            {isRma ? 'Items being returned' : 'Billed items'} <span className="text-slate-400">·</span> <span className="text-slate-700" style={{ fontWeight: 600 }}>{items.length}</span>
          </span>
          {/* Match level is an AP-matching concept — a return isn't matched
              2-way or 3-way against anything, so the chip is invoice-only. */}
          {!isRma && (
          <span className={`inline-flex items-center gap-1 text-[11px] ${poData?.isPreInvoice ? 'text-warning' : 'text-success'}`} style={{ fontWeight: 600 }}>
            <span className={`w-1.5 h-1.5 rounded-full ${poData?.isPreInvoice ? 'bg-warning' : 'bg-success'}`} />
            {poData?.isPreInvoice ? '2-way match' : '3-way match'}
          </span>
          )}
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
                <p className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>${item.unitPrice.toLocaleString()}/unit</p>
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
              <p className="text-[10px] text-slate-400 leading-none" style={{ fontWeight: 500 }}>Line items total</p>
              <p className="text-[14px] text-slate-800 mt-0.5" style={{ fontWeight: 600 }}>${items.reduce((sum, i) => sum + i.lineTotal, 0).toLocaleString()}</p>
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] text-slate-600 bg-slate-50 border border-slate-200" style={{ fontWeight: 600 }}>
            {poData?.currency}
          </span>
        </div>
      </div>
    </HoverCardContent>
  );

  // The details card renders in the 30% panel on a return, so its type scale
  // and control heights step down to match Return Logistics instead of the
  // wider left canvas.
  const detailLabel = isRma ? 'text-[11px] text-slate-500' : 'text-xs sm:text-[13px] text-foreground';
  const detailHint = isRma ? 'text-[10px] text-slate-400' : 'text-[11px] text-slate-400';
  const detailError = isRma ? 'text-[10px] text-red-500' : 'text-[11px] text-red-500';
  const detailField = isRma ? '!h-9 text-[12px] rounded-md' : '!h-10 text-sm rounded-lg';

  // Details card, patterned after the Partner Management "Partner Details"
  // card: outer rounded shell + a slate-tinted header bar with section icon,
  // title, and a Required eyebrow, then a clean body block for the fields.
  // Keeps font + color tokens identical to the partner module so the two
  // products feel like one.
  //
  // In RMA mode it renders in the 30% panel instead of the left canvas, which
  // leaves the canvas for the site/PO switcher and the return lines. Built
  // once so both placements stay the same card.
  // The fields themselves, lifted out of the card shell so a return can
  // render them as a collapsed sidebar section while an invoice keeps them
  // on the canvas in the bordered card below.
  const detailsFields = (
    <>

        {/* Row 1: Vendor Invoice Number & Vendor Invoice Date.
            Labels + inputs adopt the partner module's recipe:
            sentence-case `text-foreground` 13px label, `mt-1
            h-10 rounded-lg` input with primary focus ring.

            RMA mode: Posting Date is relocated out of this row, but
            the Vendor RMA Number reads here alongside Expected
            Resolution Date since both identify the return itself. */}
        <div className={`grid gap-4 ${isRma ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div id="vendor-invoice-number-field">
            <Label className={detailLabel} style={{ fontWeight: 500 }}>
              {/* A vendor only issues an RMA number once it has
                  authorized the return, so it cannot be required at
                  creation the way an invoice number is. */}
              {copy.vendorDocLabel}{!isRma && <span className="text-red-500">*</span>}
            </Label>
            <Input
              value={vendorInvoiceNumber}
              onChange={(e) => {
                setVendorInvoiceNumber(e.target.value);
                if (vendorInvoiceNumberError && e.target.value.trim()) setVendorInvoiceNumberError(false);
              }}
              placeholder="VEN-98231"
              className={`mt-1 ${detailField} text-foreground placeholder:text-slate-400 bg-white ${
                vendorInvoiceNumberError || vendorInvoiceNumberDuplicate
                  ? 'border-red-400 ring-2 ring-red-100 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                  : 'border-border focus:border-primary focus:ring-1 focus:ring-primary/20'
              }`}
            />
            {vendorInvoiceNumberDuplicate ? (
              <p className={`${detailError} mt-1`} style={{ fontWeight: 500 }}>
                {isRma ? (
                  /* The duplicate check reads the invoice ledger, so
                     on a return it can only report the clash, not
                     link out to it. */
                  <>Duplicate, {vendorName} already has this number.</>
                ) : (
                  <>
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
                  </>
                )}
              </p>
            ) : vendorInvoiceNumberError ? (
              <p className={`${detailError} mt-1`} style={{ fontWeight: 500 }}>Vendor invoice number is required.</p>
            ) : (
              <p className={`${detailHint} mt-1`}>
                {isRma
                  ? 'Optional, add it once the vendor issues one.'
                  : "Vendor's reference document number. Must be unique for this vendor."}
              </p>
            )}
          </div>
          <div>
            <Label className={detailLabel} style={{ fontWeight: 500 }}>
              {/* A return's resolution date is a forecast, not a
                  document date the vendor issued, so it carries no
                  required marker. */}
              {copy.vendorDocDateLabel}{!isRma && <span className="text-red-500">*</span>}
            </Label>
            <DatePicker
              value={invoiceDate}
              onChange={setInvoiceDate}
              placeholder={copy.vendorDocDatePlaceholder}
              className={`mt-1 ${isRma ? 'h-9 text-[12px] rounded-md' : ''}`}
            />
            <p className={`${detailHint} mt-1`}>{copy.vendorDocDateHint}</p>
          </div>
          {/* RMA mode: Description sits on the same row as Return
              Date, since Posting Date has been lifted out to the
              sidebar. */}
          {isRma && (
          <div>
            <Label className={detailLabel} style={{ fontWeight: 500 }}>Description</Label>
            <div className="mt-1">
              <ExpandableTextarea
                value={description}
                onChange={setDescription}
                placeholder="Brief summary of return purpose or context."
                expandMode="full"
                collapsedHeight={60}
              />
            </div>
          </div>
          )}
        </div>

        {/* Row 2: Posting Date & Description — invoice mode only.
            RMA mode renders Description inside Row 1 above and
            relocates Posting Date to the General Information
            sidebar. */}
        {!isRma && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs sm:text-[13px] text-foreground flex items-center gap-1.5" style={{ fontWeight: 500 }}>
              Posting Date
              {!isStandalone && <Lock className="w-3 h-3 text-slate-300" />}
            </Label>
            {(() => {
              // BA UX feedback, visual cue when posting date
              // isn't today's date. The input itself keeps the
              // SAME shape as the other fields on the row
              // (no left accent stripe, the amber border
              // made the field look inconsistent with the
              // siblings). The "not today" warning now lives
              // exclusively in the helper text below: amber
              // copy + AlertCircle icon when the date is
              // back-dated, default slate-400 hint otherwise.
              const todayIso = new Date().toISOString().slice(0, 10);
              const activeDate = isStandalone ? standalonePostingDate : postingDate;
              const notToday = !!activeDate && activeDate !== todayIso;
              return (
                <>
                  {isStandalone ? (
                    <DatePicker
                      value={standalonePostingDate}
                      onChange={setStandalonePostingDate}
                      placeholder="Select posting date"
                      className="mt-1"
                    />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* Wrapper picks up hover even though the
                            input itself is disabled. */}
                        <span className="mt-1 inline-block w-full cursor-not-allowed">
                          <Input
                            type="text"
                            value={formatDateDisplay(postingDate)}
                            placeholder="Set on receiving"
                            readOnly
                            aria-disabled="true"
                            className="rounded-lg border-slate-200 bg-slate-50 !h-10 text-sm text-slate-500 cursor-not-allowed pointer-events-none w-full disabled:opacity-100 placeholder:text-slate-400"
                            style={{ fontWeight: 500 }}
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                        {postingDate ? (
                          <>
                            <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Auto-set from receiving</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Posting date is derived from the linked receiving document(s) for receiving-based invoices, so it can't be edited here.</p>
                          </>
                        ) : (
                          <>
                            <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Assigned when goods are received</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Nothing has been received yet, so this pre-invoice has no posting date. It posts to the GL when the goods arrive.</p>
                          </>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <div className="text-[11px] mt-1 flex items-center gap-1" style={{ color: notToday ? '#B45309' : 'rgb(148 163 184)' }}>
                    {notToday && <AlertCircle className="w-3 h-3 shrink-0" />}
                    <span>
                      {notToday
                        ? `Posting on ${activeDate}, not today's date`
                        : isStandalone
                          ? 'Select the GL posting date.'
                          : postingDate
                            ? 'Based on receiving date.'
                            : 'Posting date is set when goods are received.'}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
          <div>
            <Label className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 500 }}>Description</Label>
            <div className="mt-1">
              <ExpandableTextarea
                value={description}
                onChange={setDescription}
                placeholder="Brief summary of invoice purpose or context."
                expandMode="full"
              />
            </div>
          </div>
        </div>
        )}
    </>
  );

  const detailsCard = (
    <section className="space-y-3 shrink-0">
      <div className="rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#EEF2F6] bg-[#FAFBFC] rounded-t-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-6 h-6 rounded-md bg-primary/[0.08] flex items-center justify-center shrink-0">
              <ReceiptText className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>{copy.detailsSection}</span>
            <span className="text-[10px] sm:text-[10px] text-slate-400 tracking-wider uppercase hidden min-[480px]:inline" style={{ fontWeight: 500 }}>Required</span>
          </div>

          {!isStandalone && currentPOsData.find(p => p.poNumber === activePOTab)?.isPreInvoice && (
            <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] border bg-amber-50 text-amber-700 border-amber-200 uppercase tracking-wider" style={{ fontWeight: 700 }}>
              {isRma ? 'Not received' : 'Pre-invoice'}
            </span>
          )}
        </div>

        {/* Body — fields live on the white surface below the
            slate-tinted header bar, matching the partner card. */}
        <div className="px-3 sm:px-4 py-3 space-y-3">
          {detailsFields}
        </div>{/* /Body */}
      </div>
    </section>
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
                  aria-label="Back to previous step"
                  title="Back"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-500" />
                </button>
              )}
              <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] sm:text-[17px] text-foreground truncate" style={{ fontWeight: 700 }}>
                  {isResubmit ? copy.editResubmitTitle : isStandalone ? copy.createStandaloneTitle : copy.createTitle}
                </h3>
                {/* No record-type pill. "Create New RMA" already says what is
                    being created, so a Return chip beside it labelled the title
                    with the title. */}
                {/* Vendor pill — inventory flow only. The standalone
                    flow surfaces the same vendor identity inside the
                    purple Manual Expense Entry banner just below, so
                    keeping it in the header too would be redundant. A
                    return can span vendors, so a single name in the header
                    would speak for lines it does not own; there the vendor
                    is stated per line instead. */}
                {vendorData && !isStandalone && !isRma && (
                  <HoverCard openDelay={300}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/[0.08] border border-primary/15 rounded-full hover:bg-primary/[0.12] hover:border-primary/25 transition-colors cursor-help shrink-0"
                      >
                        <div className="w-4 h-4 rounded-full overflow-hidden border border-white bg-white">
                          <ImageWithFallback
                            src={vendorData.imageUrl || ''}
                            alt={vendorData.vendorName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[11px] text-primary max-w-[160px] truncate" style={{ fontWeight: 600 }}>
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
                          {vendorData.category}, {vendorData.type}.{isRma ? " Returns ship to the vendor's RMA receiving address." : <> Net terms {vendorData.paymentTerms}, settled in {vendorData.currency}.</>}
                        </p>
                        <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {getVendorStats(vendorData.vendorName).addressLine}, {getVendorStats(vendorData.vendorName).city}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="tabular-nums">{getVendorStats(vendorData.vendorName).phone}</span>
                        </div>
                      </div>
                      {/* Footer — "Go to Vendor" opens the partner master
                          (meeting feedback 7/17/26). */}
                      <div className="bg-slate-50/60 border-t border-border/40 px-4 py-2 flex items-center justify-end">
                        <a
                          href={VENDOR_DETAIL_URL}
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
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate" style={{ fontWeight: 400 }}>
                {isResubmit
                  ? copy.editResubmitSubtitle
                  : isStandalone
                    ? copy.createStandaloneSubtitle
                    : copy.createSubtitle}
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
                {isFullScreen ? 'Exit full' : 'Full view'}
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

        {/* Step tabs, mirrored from the shipment wizard: numbered circle,
            emerald once done, and an underline stroke under the cells that
            have been reached. Only steps already reached are clickable, so
            the tabs navigate backwards but never skip validation forwards. */}
        {isRma && (
          <div className="shrink-0 bg-white border-b border-[#EEF2F6] px-3 sm:px-4 lg:px-5">
            <div className="flex items-center gap-4 sm:gap-6 pt-3 overflow-x-auto -mb-px">
              {/* Start was drawn here as a completed step that could not be
                  returned to, because it was a modal in front of the flow.
                  There is no modal now: the flow opens on Items with an empty
                  search, which is where the search-and-add loop lives. A step
                  nobody stands on and cannot go back to was never a step. */}
              {stepPlan.map((step, displayIdx) => {
                const idx = displayIdx;
                const isCurrent = idx === currentStepIndex;
                const isCompleted = idx < currentStepIndex;
                const isReachable = idx <= currentStepIndex;
                return (
                  <div
                    key={step.key}
                    className={`relative flex items-center gap-2 pb-2.5 sm:pb-3 ${
                      isReachable ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    onClick={() => {
                      if (isReachable) setActiveStep(step.key);
                    }}
                  >
                    <div
                      className={`w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-[12px] shrink-0 tabular-nums transition-all duration-200 ${
                        isCompleted
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                            ? 'bg-primary text-white'
                            : 'border-[1.5px] border-slate-300 text-slate-500 bg-white'
                      }`}
                      style={{ fontWeight: 600 }}
                    >
                      {isCompleted ? <Check className="w-3 h-3" /> : displayIdx + 1}
                    </div>
                    <span
                      className={`text-[12px] sm:text-[13px] whitespace-nowrap transition-colors ${
                        isCurrent ? 'text-primary' : isCompleted ? 'text-emerald-500' : 'text-slate-700'
                      }`}
                      style={{ fontWeight: isCurrent || isCompleted ? 600 : 500 }}
                    >
                      {step.label}
                    </span>
                    {(isCurrent || isCompleted) && (
                      <div
                        className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full ${
                          isCompleted ? 'bg-emerald-500' : 'bg-primary'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Standalone: Manual Expense Entry banner — single purple strip
            that absorbs the vendor identity card that used to sit just
            below the header. Vendor avatar (HoverCard with the rich
            quick-card) + name + code + category appear inline with the
            Manual-Expense copy, so the user gets one consolidated row
            instead of header pill + banner + vendor card all repeating
            the same identity. Purple palette complements the existing
            Standalone violet identity. */}
        {isStandalone && (
          <div className="shrink-0 border-b border-violet-100 px-4 py-2 flex items-center gap-2.5 bg-violet-50/60">
            {vendorData ? (
              <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    className="w-6 h-6 rounded-md overflow-hidden border border-violet-200 bg-white shrink-0 cursor-help transition-shadow hover:shadow-[0_2px_8px_-2px_rgba(109,40,217,0.25)]"
                  >
                    {vendorData.imageUrl ? (
                      <ImageWithFallback
                        src={vendorData.imageUrl}
                        alt={vendorData.vendorName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-violet-500 m-auto mt-[5px]" />
                    )}
                  </button>
                </HoverCardTrigger>
                <HoverCardContent
                  side="bottom"
                  align="start"
                  className="w-[280px] p-0 rounded-xl border-0 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
                >
                  <div className="bg-gradient-to-br from-violet-700 to-violet-900 px-4 py-3 relative overflow-hidden">
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
                        <p className="text-[14px] text-white truncate" style={{ fontWeight: 600 }}>{vendorData.vendorName}</p>
                        <p className="text-[11px] text-violet-200 truncate">Vendor · {getVendorStats(vendorData.vendorName).city}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white px-4 py-3 space-y-2">
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {vendorData.category}, {vendorData.type}.{isRma ? " Returns ship to the vendor's RMA receiving address." : <> Net terms {vendorData.paymentTerms}, settled in {vendorData.currency}.</>}
                    </p>
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {getVendorStats(vendorData.vendorName).addressLine}, {getVendorStats(vendorData.vendorName).city}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-[12px] text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="tabular-nums">{getVendorStats(vendorData.vendorName).phone}</span>
                    </div>
                  </div>
                  <div className="bg-violet-50/40 border-t border-border/40 px-4 py-2 flex items-center justify-end">
                    <a
                      href={VENDOR_DETAIL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-violet-700 hover:underline cursor-pointer"
                      style={{ fontWeight: 500 }}
                    >
                      Go to Vendor
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </HoverCardContent>
              </HoverCard>
            ) : (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-violet-200 text-violet-700 shrink-0">
                <Info className="w-3.5 h-3.5" />
              </span>
            )}
            <p className="text-[11px] min-w-0 flex-1 text-slate-700 truncate" style={{ fontWeight: 500 }}>
              {vendorData ? (
                <>
                  <span className="text-violet-800" style={{ fontWeight: 700 }}>{vendorData.vendorName}</span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  <span className="text-slate-500" style={{ fontWeight: 500 }}>{vendorData.category}</span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  <span className="text-slate-600">Standalone invoice. Each line item debits an expense GL account.</span>
                </>
              ) : (
                <>
                  <span className="text-violet-800" style={{ fontWeight: 700 }}>Manual Expense Entry</span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  Standalone invoice; each line item debits an expense GL account.
                </>
              )}
            </p>
          </div>
        )}

        {/* Automated Splitting Alert — accent-blue banner. The two key
            terms (Pre-invoice / Invoice) become hover-card triggers so
            the user can read the definition + 2-way / 3-way match
            example inline. Pre-invoice uses the warning (amber-600) and
            Invoice uses the success (emerald-600) semantic tokens, both
            sourced from src/styles/tokens.css. */}
        {/* Edit-and-resubmit — full-bleed strip under the header replaying
            WHY the invoice was rejected / flagged, so the fix happens in
            context. Rejection reads red, exception amber (7/15/26). */}
        {isResubmit && (() => {
          const isExceptionResubmit = resubmitInvoice?.status === 'Exception';
          return (
            <div className={`shrink-0 border-b px-4 py-2 flex items-center gap-2.5 ${isExceptionResubmit ? 'bg-amber-50/70 border-amber-200' : 'bg-red-50/70 border-red-200'}`}>
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border shrink-0 ${isExceptionResubmit ? 'border-amber-200 text-amber-600' : 'border-red-200 text-red-600'}`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </span>
              <p className={`text-[11px] min-w-0 flex-1 ${isExceptionResubmit ? 'text-amber-900' : 'text-red-900'}`} style={{ fontWeight: 500 }}>
                <span style={{ fontWeight: 700 }}>{isExceptionResubmit ? 'Exception' : 'Rejected'}</span>
                {' · '}
                {resubmitReason || `No reason was recorded when this invoice was ${isExceptionResubmit ? 'flagged' : 'rejected'}.`}
                {' '}Fix the details below, then resubmit for approval.
              </p>
            </div>
          );
        })()}
        {/* Invoice-only: the banner explains AP's pre-invoice / invoice
            document split and its 2-way vs 3-way match theory. A return
            produces one RMA regardless of receiving status, so in RMA mode
            the whole explainer is not just wrong vocabulary but wrong. */}
        {!isStandalone && !isRma && hasMixedInvoiceTypes && (
          <div className="shrink-0 border-b px-4 py-2 flex items-center gap-2.5 bg-accent/40 border-primary/10">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-white border border-primary/20 text-primary shrink-0">
              <Info className="w-3.5 h-3.5" />
            </span>
            <p className="text-[11px] min-w-0 flex-1 text-slate-700" style={{ fontWeight: 500 }}>
              <span className="text-primary" style={{ fontWeight: 700 }}>Automated invoice splitting</span>
              {' · '}
              Mixed document status detected. System will generate separate{' '}
              <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>
                  <span
                    className="cursor-help underline decoration-dotted decoration-warning/50 underline-offset-2 text-warning"
                    style={{ fontWeight: 700 }}
                  >
                    Pre-invoice
                  </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 p-0 overflow-hidden rounded-xl border border-warning/20 shadow-xl z-[300]" align="start" side="bottom">
                  <div className="bg-warning/[0.08] border-b border-warning/20 px-3.5 py-2.5 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-white border border-warning/30 flex items-center justify-center shrink-0">
                      <FileText className="w-3.5 h-3.5 text-warning" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] text-warning" style={{ fontWeight: 700 }}>Pre-invoice</p>
                      <p className="text-[10px] text-warning/80" style={{ fontWeight: 500 }}>2-way match · No receiving required</p>
                    </div>
                  </div>
                  <div className="px-3.5 py-3 space-y-2 bg-white">
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Generated when a PO is billed before goods are received. The invoice is matched against the <b className="text-slate-800">PO line</b> alone, no GRN required.
                    </p>
                    <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-md px-2.5 py-2 leading-snug">
                      <span className="text-slate-700" style={{ fontWeight: 600 }}>Example:</span> Vendor invoices 100 EA before shipment. Posted as Pre-invoice; AP debits a prepayment GL until the receiving arrives and reconciles.
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              {' and '}
              <HoverCard openDelay={300}>
                <HoverCardTrigger asChild>
                  <span
                    className="cursor-help underline decoration-dotted decoration-success/50 underline-offset-2 text-success"
                    style={{ fontWeight: 700 }}
                  >
                    Invoice
                  </span>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 p-0 overflow-hidden rounded-xl border border-success/20 shadow-xl z-[300]" align="start" side="bottom">
                  <div className="bg-success/[0.08] border-b border-success/20 px-3.5 py-2.5 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-white border border-success/30 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12px] text-success" style={{ fontWeight: 700 }}>Invoice</p>
                      <p className="text-[10px] text-success/80" style={{ fontWeight: 500 }}>3-way match · PO + Receiving + Invoice</p>
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

        {/* A return stacks its step body over one footer, so the two
            columns only exist on an invoice. */}
        <div className={`flex flex-1 overflow-hidden ${isRma ? 'flex-col' : ''}`}>

          {/* LEFT SECTION (70%) — slate-tinted canvas (#FAFBFC) so the
              white section cards lift off the surface, matching the
              Create Partner modal body. On a return this is the first
              step and takes the full width. */}
          {/* Who this return settles with, asked before anything is picked.
              Its own body because the panel below answers per line and this
              answers for the whole return -- and because knowing it is what
              takes the per-line Vendor step out of the plan. */}
          {isRma && activeStep === 'partner' && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#FAFBFC]">
              <div className="flex shrink-0 items-center gap-2.5 border-b border-border bg-white px-4 py-3">
                <span className="inline-flex w-8 h-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  <Building2 className="w-[18px] h-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                    Select a vendor
                  </p>
                  <p className="mt-px text-[12px] text-slate-500">
                    Each RMA settles with one vendor. Select the vendor this return is for.
                  </p>
                </div>
              </div>
              {/* The list scrolls, the step does not. Letting the canvas
                  scroll took the search field and the one-vendor rule off
                  screen the moment a result was clicked, which is the half of
                  the card that says what the step is. */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 w-full flex-1 flex-col">
                  <ReturnPartnerStep
                    chosen={lockedVendor}
                    onChoose={(v) => {
                      if (v.vendorCode === lockedVendor) return;
                      setLockedVendor(v.vendorCode);
                      // Their whole book onto the rail, with no figure against
                      // any of it. Naming the vendor is what this route knows,
                      // and what it buys is not searching for parts you already
                      // know they sent you: they are listed, and the ones going
                      // back are the ones you count. The next step's search
                      // still reaches everything else.
                      //
                      // Replaced rather than merged, because changing the
                      // answer here changes who the return is with, and the
                      // previous vendor's book is not theirs to take back.
                      const picks = itemsForVendor(v.vendorCode).map((i) => ({
                        sku: i.sku,
                        qty: 0,
                      }));
                      setCurrentPOsData(selectionFromVendorItems(v.vendorCode, picks));
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {(!isRma || CONFIGURE_STEPS.includes(activeStep)) && (
          <div className={`flex-1 min-w-0 flex flex-col overflow-hidden bg-[#FAFBFC] ${isRma ? '' : 'border-r border-border/60'}`}>
            <div className={`flex-1 min-h-0 ${isRma ? 'px-0 pt-0 pb-0 space-y-0' : 'px-4 pt-3 pb-4 space-y-4'} ${isStandalone ? 'overflow-y-auto custom-scrollbar' : 'flex flex-col overflow-hidden'}`}>

              {/* PO Tabs — chips scroll horizontally inside their own
                  flex container; the "Add more POs" CTA sits outside that
                  scroller so it stays pinned to the right edge even when
                  the chip strip overflows. Invoicing only: a return lists
                  every line at once, with the PO on the line itself. */}
              {!isStandalone && !isRma && <div className="flex items-center gap-1.5 shrink-0">
                {/* Site-grouped PO tabs, the Purchase Order planner's tab-group
                    strip: a coloured site tag carrying the group's baseline
                    line, then that site's PO tabs flush on the line, with the
                    active tab raised and arching over it. One strip instead of
                    a site row above a chip row, and a PO is never shown without
                    the site it came in at. */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide flex-1 min-w-0 items-center">
                {uniquePONumbers.map(po => {
                  const itemsForThisPO = lineItems.filter(li => li.poNumber === po);
                  return (
                    <div
                      key={po}
                      className={`group flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg border transition-all whitespace-nowrap ${
                        activePOTab === po
                          ? 'bg-accent text-primary border-primary/30'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <button
                        onClick={() => setActivePOTab(po)}
                        className="flex items-center gap-1.5 text-[12px]"
                        style={{ fontWeight: 500 }}
                      >
                        <ShoppingCart className={`w-3 h-3 ${activePOTab === po ? 'text-primary/70' : 'text-slate-400'}`} />
                        {/* Hard-coded "PO#" label so the value is
                            unambiguously a PO number without relying on
                            the icon or a fake "PO-" value prefix. */}
                        <span><span className="text-slate-400" style={{ fontWeight: 600 }}>PO#</span> {po}</span>
                        <span className="text-slate-300">·</span>
                        <span className={`${activePOTab === po ? 'text-primary/70' : 'text-slate-400'}`}>{itemsForThisPO.length}</span>
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
                  );
                })}
                </div>

                {/* Add more POs CTA — primary-tinted "Configure" recipe
                    (white BG, soft blue border, primary blue text) from
                    the Partner Management module so the affordance reads
                    as a friendly call-to-action without competing with
                    the page's primary Submit button. The grouped strip
                    carries the inline "+" instead. */}
                <button
                  type="button"
                  onClick={() => setIsAddPOOpen(true)}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white border border-primary text-primary text-[11px] hover:bg-primary/5 hover:shadow-sm transition-all duration-150"
                  style={{ fontWeight: 500 }}
                >
                  <Plus className="w-3 h-3" />
                  {addPOLabel}
                </button>
              </div>}

              {/* Standalone Vendor Badge removed -- vendor identity is
                  now folded into the purple Manual Expense Entry banner
                  at the top of the screen, so we no longer carry a
                  separate card here. */}

              {/* Invoice mode keeps the details card on the left canvas; a
                  return reads it in the right panel. */}
              {!isRma && detailsCard}

              {/* Standalone Line Items - Simplified Table */}
              {isStandalone && (
                <section id="standalone-line-items" className="space-y-3 scroll-mt-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <h2 className="text-[13px] text-slate-700 tracking-tight" style={{ fontWeight: 600 }}>{copy.lineItemsSection}</h2>
                      <span className="text-[10px] text-primary px-1.5 py-0.5 rounded-full bg-accent" style={{ fontWeight: 600 }}>{standaloneItems.length}</span>
                      <span className="px-2 py-0.5 rounded-full border text-[10px] bg-accent border-primary/20 text-primary" style={{ fontWeight: 600 }}>Manual entry</span>
                    </div>
                    {/* Add / Clear actions live only at the bottom of the
                        table (below the rows) — having them in the header too
                        was repetitive. */}
                  </div>

                  <div className="border border-border/60 rounded-xl shadow-sm bg-white overflow-x-auto relative">
                    <table className="w-full text-left border-collapse min-w-[650px]">
                      <thead
                        className="bg-[#f8fafc] border-b border-gray-100 text-slate-500 text-[11px] [&>tr>th]:h-8 [&>tr>th]:py-0"
                        style={{ fontWeight: 500 }}
                      >
                        <tr>
                          <th className="px-1.5 py-3 w-[36px] text-center" style={{ fontWeight: 500 }}>#</th>
                          <th className="px-1.5 py-3 w-[180px]" style={{ fontWeight: 500 }}>
                            <span className="inline-flex items-center gap-1.5">
                              GL Account
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center justify-center cursor-help">
                                    <Info className="w-3 h-3 text-slate-300 hover:text-slate-500 transition-colors" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[280px]">
                                  <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Expense account</p>
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
                          <th className="px-1.5 py-3" style={{ fontWeight: 500 }}>Description</th>
                          <th className="px-1.5 py-3 w-[150px] text-right" style={{ fontWeight: 500 }}>Amount</th>
                          <th className="px-1.5 py-3 w-9 text-center" style={{ fontWeight: 500 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {standaloneItems.map((item, index) => (
                          <tr key={item.id} className="bg-white hover:bg-[#F0F7FF] transition-colors group [&>td]:py-1.5">
                            <td className="px-1.5 py-2 text-center">
                              <span className="text-[11px] font-bold text-blue-600">{index + 1}</span>
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
                                <span className={`truncate tabular-nums ${item.glAccount ? '' : glMissing ? 'italic' : 'italic text-slate-400'}`}>
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
                              <ExpandableTextarea
                                value={item.description}
                                onChange={(val) => updateStandaloneItem(item.id, 'description', val)}
                                placeholder="Enter description..."
                                expandMode="full"
                                collapsedHeight={32}
                                portalExpand
                              />
                            </td>
                            {/* Amount — $ prefix + right-aligned value, matching
                                the inventory invoice's Unit Price input. */}
                            <td className="px-1.5 py-1.5">
                              <div className="relative w-full">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>$</span>
                                <Input
                                  type="number"
                                  value={item.amount || ''}
                                  onChange={(e) => updateStandaloneItem(item.id, 'amount', Number(e.target.value))}
                                  placeholder="0.00"
                                  className="h-8 pl-5 pr-2 text-right font-bold text-[11px] bg-white border-border shadow-none rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-1 focus-visible:ring-blue-100"
                                />
                              </div>
                            </td>
                            {/* Delete */}
                            <td className="px-1.5 py-1.5 text-center">
                              <button 
                                onClick={() => removeStandaloneItem(item.id)}
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

                  {/* Footer row — same CTAs as the header (so users
                      can add another row right where they finished
                      typing) + a right-aligned subtotal. */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={addStandaloneItem}
                        className="inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white border border-primary text-primary text-[11px] hover:bg-primary/5 hover:shadow-sm transition-all duration-150"
                        style={{ fontWeight: 500 }}
                      >
                        <Plus className="w-3 h-3" />
                        Add more items
                      </button>
                      {standaloneItems.length > 1 && (
                        <button
                          type="button"
                          onClick={clearAllStandaloneItems}
                          className="inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white border border-slate-200 text-slate-500 text-[11px] hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all duration-150"
                          style={{ fontWeight: 500 }}
                        >
                          <X className="w-3 h-3" />
                          Clear all
                        </button>
                      )}
                    </div>
                    <div className="text-right flex items-baseline gap-2">
                      <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Subtotal</span>
                      <span className="text-[16px] text-foreground tabular-nums leading-none tracking-tight" style={{ fontWeight: 700 }}>
                        ${standaloneSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* PO-based Invoice Line Items — wrapped in the same boxed
                  card recipe as the Invoice details section above, so the
                  page reads as a consistent stack of titled cards. The
                  header bar holds the icon tile, title, match-status
                  pill, item count, and the Add more / Remove N CTAs. */}
              {!isStandalone && <section className={`min-h-0 flex flex-col ${isRma ? 'flex-1' : ''}`}>
                {/* Click-away backdrop while the table is expanded —
                    fades in on open, out on close. */}
                {lineItemsExpanded && (
                  <div
                    className={`fixed inset-0 z-[140] bg-black/50 ${
                      lineItemsClosing
                        ? 'animate-modal-overlay-out'
                        : 'animate-modal-overlay-in'
                    }`}
                    onClick={collapseLineItems}
                  />
                )}
                <div className={
                  lineItemsExpanded
                    ? `fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[150] w-[calc(100vw-3rem)] max-w-[1380px] h-[calc(100vh-4rem)] max-h-[88vh] rounded-xl border border-border bg-white shadow-2xl overflow-hidden flex flex-col ${
                        lineItemsClosing ? 'animate-modal-out' : 'animate-modal-in'
                      }`
                    : isRma
                      ? 'min-h-0 flex flex-col bg-[#F7F9FC] overflow-hidden flex-1'
                      : 'min-h-0 flex flex-col rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden'
                } style={lineItemsExpanded ? { animationFillMode: 'both' } : undefined}>
                  {/* Title, filter and count. Both steps carry their own search
                      and their own count now -- "On this return, N parts" or
                      "N vendors" -- so this row restated both and added a second
                      field that filtered the list the first one was building.
                      It only survived on the by-vendor route because that
                      route's way of adding a part hung off it, and it no longer
                      does. */}
                  {!isRma && (
                  <div className={`${isRma ? 'px-3' : 'px-3 sm:px-4'} py-2 sm:py-2.5 border-b border-[#EEF2F6] bg-white flex items-center justify-between gap-3 shrink-0`}>
                  {/* The title block takes the slack so the search stays with
                      the count and the CTA. Left to justify-between it drifts
                      into the middle of the bar, attached to neither side. */}
                  <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                    {/* Title leads the header, followed by the active-PO
                        pill and the match-status pill. */}
                    <span className="text-xs sm:text-[13px] text-foreground" style={{ fontWeight: 600 }}>{copy.lineItemsSection}</span>
                    {/* Active-PO pill — same "PO#" chip recipe as the tab
                        strip, with the same hover breakdown popover. Keeps
                        the user anchored to which PO's items they're
                        editing, especially once the table is expanded (the
                        tab strip is hidden). */}
                    {/* Invoice-only: on a return the receipts above already
                        say what is being returned, and the source PO is on the
                        header. */}
                    {!isRma && activePOTab && (
                      <HoverCard openDelay={300}>
                        <HoverCardTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap cursor-help shrink-0 bg-primary/[0.06] border border-primary/15 text-primary"
                            style={{ fontWeight: 600 }}
                          >
                            <ShoppingCart className="w-3 h-3 text-primary/70" />
                            <span className="text-primary/60">PO#</span> {activePOTab}
                          </button>
                        </HoverCardTrigger>
                        {renderPoBreakdownContent(activePOTab, currentPOsData.find(p => p.poNumber === activePOTab), currentPOItems)}
                      </HoverCard>
                    )}
                    {/* Match-status pill is an invoice concept: a return is
                        never AP-matched, and the per-line quantity warnings
                        already flag anything over what was received. */}
                    {!isRma && (() => {
                      const activePO = currentPOsData.find(p => p.poNumber === activePOTab);
                      const isPre = activePO?.isPreInvoice;
                      const hasIssue = !isPre && currentPOItems.some(item => item.invoiceQty > item.receivedQty);

                      const statusColor = hasIssue
                        ? 'bg-destructive/10 border-destructive/20 text-destructive'
                        : isPre
                          ? 'bg-warning/[0.08] border-warning/20 text-warning'
                          : 'bg-success/[0.08] border-success/20 text-success';

                      const dotColor = hasIssue ? 'bg-destructive' : isPre ? 'bg-warning' : 'bg-success';
                      // A return isn't AP-matched, so the RMA pill reports
                      // what the receiving record says about the line
                      // instead of a 2-way / 3-way match level.
                      const label = isRma
                        ? (hasIssue ? 'Quantity exceeds received' : isPre ? 'Not received' : 'Received & verified')
                        : hasIssue ? '3-way match issue' : isPre ? '2-way match (Pre-invoice)' : '3-way match (Invoice)';

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
                              {isRma
                                ? (hasIssue ? 'Quantity discrepancy' : isPre ? 'Not received' : 'Received & verified')
                                : hasIssue ? 'Matching discrepancy' : isPre ? 'Pre-invoice' : '3-way match'}
                            </p>
                            <p className="text-[11px] text-slate-500 leading-relaxed mt-1.5" style={{ fontWeight: 400 }}>
                              {isRma
                                ? (hasIssue
                                  ? 'Return quantity exceeds the quantity received into the warehouse (GRN). Lower it before saving the RMA.'
                                  : isPre
                                    ? 'This PO line has no receiving on file. Nothing was physically received to return.'
                                    : 'Quantities are validated against the linked receiving documents (GRNs) so you can only return what was actually received.')
                                : hasIssue
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
                  {/* Search — lives in the header row, between the title/pills
                      and the actions, filtering rows by item number or description. */}
                  <div className="relative flex-1 min-w-0 max-w-[300px] hidden sm:block">
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
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
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
                            description: "This action can be undone within 30 seconds.",
                            action: {
                              label: "Undo (30s)",
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
                        onClick={() => {
                          const previousData = JSON.parse(JSON.stringify(currentPOsData));
                          const count = selectedIds.size;
                          const idsToRemove = new Set(selectedIds);
                          
                          setCurrentPOsData(prev => prev.map(po => {
                            if (po.poNumber === activePOTab) {
                              return {
                                ...po,
                                items: po.items.filter(pItem => {
                                  const isSelected = Array.from(idsToRemove).some(selectedId => selectedId.endsWith(pItem.id));
                                  return !isSelected;
                                })
                              };
                            }
                            return po;
                          }));
                          
                          setSelectedIds(new Set());
                          
                          toast(`${count} item${count === 1 ? '' : 's'} removed from PO ${activePOTab}`, {
                            description: "This action can be undone within 30 seconds.",
                            action: {
                              label: "Undo (30s)",
                              onClick: () => {
                                setCurrentPOsData(previousData);
                                setSelectedIds(idsToRemove);
                              },
                            },
                            duration: 30000,
                          });
                        }}
                        className="h-7 px-2.5 text-[10px] font-bold bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white shadow-none rounded-md tracking-wider gap-1.5 border transition-all animate-in fade-in slide-in-from-right-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove {selectedIds.size} item{selectedIds.size === 1 ? '' : 's'}
                      </Button>
                      </>
                    ) : (
                      // Item count — plain muted text, no pill. Reflects the
                      // active search filter when one is applied.
                      <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>
                        {lineItemQuery
                          ? `${displayedPOItems.length} of ${currentPOItems.length} items`
                          : `${currentPOItems.length} ${currentPOItems.length === 1 ? 'item' : 'items'}`}
                      </span>
                    )}
                    {/* Full view — same labeled CTA as the modal header;
                        pops the table into a larger floating panel
                        (capped to the modal). Only shown while collapsed;
                        once expanded, the X on the far right closes it.
                        A return's grid carries reason, settlement and serials
                        per line, so it reads expanded already and the wider
                        panel adds a step to nothing. */}
                    {!isRma && !lineItemsExpanded && (
                      <button
                        type="button"
                        onClick={openLineItems}
                        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs text-muted-foreground hover:bg-slate-50 hover:border-slate-300 transition-all shrink-0"
                        style={{ fontWeight: 500 }}
                        title="Full view"
                        aria-label="Full view"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        Full view
                      </button>
                    )}
                    {/* Add more — only when nothing is selected, and only where
                        the step does not already carry a search of its own. */}
                    {selectedIds.size === 0 && !isRma && (
                      <button
                        type="button"
                        onClick={() => setIsAddPOOpen(true)}
                        className="inline-flex items-center gap-1 px-2 py-[5px] rounded-md bg-white border border-primary text-primary text-[11px] hover:bg-primary/5 hover:shadow-sm transition-all duration-150"
                        style={{ fontWeight: 500 }}
                      >
                        <Plus className="w-3 h-3" />
                        Add more items
                      </button>
                    )}
                    {/* Close — rightmost, expanded panel only. Collapses the
                        floating table back into the in-flow card. */}
                    {lineItemsExpanded && (
                      <button
                        type="button"
                        onClick={() => (!lineItemsClosing ? collapseLineItems() : undefined)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-muted transition-all shrink-0"
                        title="Close"
                        aria-label="Close full view"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                  )}

                {/* Table body — sits inside the same card as the header
                    bar above so the section reads as a single titled
                    container. Horizontal scroll lives on this inner div;
                    when expanded it flexes + scrolls within the panel. */}
                {!isRma && (
                  <div className="min-h-0 overflow-y-scroll overflow-x-auto items-scroll pb-4">
                    <table className="w-full table-fixed text-left border-collapse text-[11px]">
                      {/* Full view stretches to fill the modal — proportional
                          widths with Items at 40%. Inline view keeps the fixed
                          layout tuned to fit without horizontal scroll, except
                          in RMA mode: the extra return columns get their own
                          room and Items keeps its width, so the row scrolls
                          sideways between the pinned select and action cells. */}
                      <colgroup>
                        {lineItemsExpanded ? (
                          <>
                            <col className="w-[4%]" />
                            <col className="w-[40%]" />
                            <col className="w-[8%]" />
                            <col className="w-[10%]" />
                            <col className="w-[10%]" />
                            <col className="w-[8%]" />
                            <col className="w-[15%]" />
                            <col className="w-[4%]" />
                          </>
                        ) : (
                          <>
                            <col className="w-[30px]" />
                            <col />
                            <col className="w-[98px]" />
                            <col className="w-[146px]" />
                            <col className="w-[124px]" />
                            <col className="w-[98px]" />
                            <col className="w-[150px]" />
                            <col className="w-[28px]" />
                          </>
                        )}
                      </colgroup>
                      <thead className="sticky top-0 z-30 bg-[#f8fafc] border-b border-gray-100 text-slate-500 text-[11px] [&>tr>th]:h-8 [&>tr>th]:py-0" style={{ fontWeight: 500 }}>
                        <tr>
                          <th className="px-0 py-3 sticky left-0 bg-gray-50 z-20 shadow-[inset_-1px_0_0_0_#E2E8F0,3px_0_6px_-2px_rgba(15,23,42,0.10)]">
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
                          <th className="px-4 py-3">Items</th>
                          <th className="px-2 py-3 text-right leading-tight">Received / Ordered</th>
                          <th className="px-3 py-3 text-right whitespace-nowrap">Price Per Unit</th>
                          <th className="px-3 py-3 text-right bg-emerald-50/40 text-emerald-700 leading-tight whitespace-nowrap">{copy.qtyColumn}</th>
                          <th className="px-3 py-3 text-right whitespace-nowrap">Total</th>
                          <th className="px-3 py-3">GL Account</th>
                          {/* Action column always rendered so the rest of
                              the columns don't reflow when bulk-select
                              kicks in. The body cell conditionally hides
                              the per-row delete button instead. */}
                          <th className="px-0 py-3 text-center sticky right-0 bg-[#f8fafc] shadow-[inset_1px_0_0_0_#E2E8F0,-3px_0_6px_-2px_rgba(15,23,42,0.10)] z-20 whitespace-nowrap">
                            {lineItemsExpanded && selectedIds.size === 0 ? 'Action' : <span aria-hidden>&nbsp;</span>}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {displayedPOItems.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-[12px] text-slate-400" style={{ fontWeight: 500 }}>
                              No line items match “{lineItemSearch}”.
                            </td>
                          </tr>
                        )}
                        {displayedPOItems.map(item => {
                          const isOverBilled = item.invoiceQty > item.remainingQty;
                          const lineTotal = item.invoiceQty * item.unitPrice;
                          const priceDraft = moneyDraft(item.id, 'unitPrice');
                          const totalDraft = moneyDraft(item.id, 'lineTotal');
                          const priceEmpty = priceDraft?.trim() === '' || totalDraft?.trim() === '';
                          const priceValue = priceDraft ?? (priceEmpty ? '' : String(item.unitPrice));
                          const totalValue = totalDraft ?? (priceEmpty ? '' : String(Number(lineTotal.toFixed(2))));
                          const isSelected = selectedIds.has(item.id);
                          // Change-warning tiers (design review 7/9/26): red =
                          // invoicing more than received (blocking-grade),
                          // amber = any price change or under-invoicing
                          // (deliberate but worth flagging). Each carries a
                          // hover tooltip with the original value as a blue
                          // click-to-revert.
                          const priceChanged = !priceEmpty && Math.abs(item.unitPrice - item.originalUnitPrice) > 0.004;
                          const isUnderBilled = !isOverBilled && item.invoiceQty > 0 && item.invoiceQty < item.remainingQty;
                          const longDescription = longDescriptionFor(item.sku, item.description);

                          return (
                            <tr key={item.id} className={`transition-colors group [&>td]:py-1.5 ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-[#F0F7FF]'}`}>
                              <td className={`px-0 py-2 sticky left-0 z-10 shadow-[inset_-1px_0_0_0_#E2E8F0,3px_0_6px_-2px_rgba(15,23,42,0.10)] transition-colors ${isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-[#F5F9FF]'}`}>
                                <div className="flex items-center justify-center">
                                  <Checkbox
                                    checked={isSelected}
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
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <a
                                      href={ITEMS_MODULE_URL}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="block truncate whitespace-nowrap text-gray-900 hover:text-primary hover:underline decoration-primary/60 underline-offset-2 transition-colors"
                                      style={{ fontWeight: 600 }}
                                    >
                                      {highlightQuery(item.sku, lineItemSearch)}
                                    </a>
                                  </div>
                                  <LineItemDescription description={longDescription} query={lineItemSearch} />
                                </div>
                              </div>
                            </td>
                              {/* Received / Ordered — combined as received-of-
                                  ordered. (Per BA: no $ figure, a sum
                                  amalgamates mixed-price receipts.) A return can
                                  only ever be raised against what was received,
                                  so RMA mode drops it for a Receiving column
                                  rendered at the end of the row. */}
                              {!isRma && (
                              <td className="px-2 py-2 text-right whitespace-nowrap">
                                <span className="text-[12px] font-semibold text-gray-900 tabular-nums">{item.receivedQty}</span>
                                <span className="text-[11px] text-gray-300 mx-1">/</span>
                                <span className="text-[12px] font-medium text-gray-500 tabular-nums">{item.orderedQty}</span>
                                <span className="text-[10px] font-medium text-gray-400 ml-1">{item.uom}</span>
                              </td>
                              )}
                              {/* Price is decision support rather than a decision,
                                  so on a return it moves into the row's detail
                                  strip. Invoice rows keep the inline input. */}
                              {!isRma && (
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
                                        <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Price changed</p>
                                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                          The PO priced this item at{' '}
                                          <button
                                            type="button"
                                            onClick={() => { clearMoneyDrafts(item.id); updateLineItem(item.id, 'unitPrice', String(item.originalUnitPrice)); }}
                                            className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors tabular-nums cursor-pointer p-0 bg-transparent border-0 align-baseline"
                                            style={{ fontWeight: 600, fontFamily: 'inherit' }}
                                            aria-label={`Revert unit price to ${item.originalUnitPrice}`}
                                          >
                                            ${item.originalUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                          </button>
                                          . Click the price to revert.
                                        </p>
                                      </HoverCardContent>
                                    </HoverCard>
                                  ) : (
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>$</span>
                                  )}
                                  <Input
                                    type="number"
                                    value={priceValue}
                                    onChange={(e) => setMoneyDraft(item.id, 'unitPrice', e.target.value)}
                                    className={`h-7 pl-5 pr-9 text-right text-[11px] tabular-nums shadow-none rounded-md font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-1 ${
                                      priceChanged
                                        ? 'pl-7 bg-white border-amber-400 text-amber-700 focus-visible:ring-amber-100 focus-visible:border-amber-500'
                                        : 'text-gray-900 bg-white border-slate-200 hover:border-slate-300 focus-visible:ring-primary/20 focus-visible:border-primary'
                                    }`}
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none whitespace-nowrap" style={{ fontWeight: 500 }}>/{item.uom}</span>
                                </div>
                              </td>
                              )}
                              <td id={`line-qty-${item.id}`} className={`px-2 py-2 transition-colors ${isOverBilled ? 'bg-red-50/60' : isUnderBilled ? 'bg-amber-50/60' : 'bg-emerald-50/[0.4]'}`}>
                                <div className="relative w-full">
                                    <Input
                                      type="number"
                                      value={item.invoiceQty}
                                      onChange={(e) => handleQtyInput(item.id, e)}
                                      className={`h-7 w-full text-right text-[11px] tabular-nums shadow-none rounded-md font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-1 ${
                                        isOverBilled
                                          ? 'pl-7 pr-8 bg-white border-red-400 text-red-600 focus-visible:ring-red-100 focus-visible:border-red-500'
                                          : isUnderBilled
                                            ? 'pl-7 pr-8 bg-white border-amber-400 text-amber-700 focus-visible:ring-amber-100 focus-visible:border-amber-500'
                                            : 'pl-2 pr-8 text-emerald-700 bg-white border-emerald-200 focus-visible:ring-emerald-100'
                                      }`}
                                    />
                                    {isUnderBilled && (
                                      <HoverCard openDelay={300} closeDelay={120}>
                                        <HoverCardTrigger asChild>
                                          <button
                                            type="button"
                                            tabIndex={-1}
                                            className="absolute left-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-4 h-4 rounded-full text-amber-500 hover:bg-amber-100 transition-colors cursor-help"
                                            aria-label={isRma ? "Returning less than the quantity available to return" : "Invoicing less than the remaining quantity"}
                                          >
                                            <AlertTriangle className="w-3 h-3" />
                                          </button>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                          <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Below remaining</p>
                                          <div className="mt-1 space-y-0.5 text-[11px] text-slate-500 leading-snug">
                                            <p>Received: <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{item.receivedQty} {item.uom}</span></p>
                                            <p>{copy.alreadyQtyLabel} <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{Math.max(0, item.receivedQty - item.remainingQty)} {item.uom}</span></p>
                                            <p>
                                              Remaining:{' '}
                                              <button
                                                type="button"
                                                onClick={() => updateLineItem(item.id, 'invoiceQty', item.remainingQty)}
                                                className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors tabular-nums cursor-pointer p-0 bg-transparent border-0 align-baseline"
                                                style={{ fontWeight: 600, fontFamily: 'inherit' }}
                                                aria-label={`Set ${isRma ? 'return' : 'invoice'} quantity to ${item.remainingQty} ${item.uom}`}
                                              >
                                                {item.remainingQty} {item.uom}
                                              </button>
                                            </p>
                                          </div>
                                          <p className="text-[11px] text-slate-500 leading-snug mt-1.5">
                                            {isRma
                                              ? <>You're returning less than the {item.remainingQty} {item.uom} available. The other {item.remainingQty - item.invoiceQty} {item.uom} stay in stock and can be returned on a later RMA.</>
                                              : <>You're invoicing less than the remaining {item.remainingQty} {item.uom}. The other {item.remainingQty - item.invoiceQty} {item.uom} will stay open for a future invoice.</>}
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
                                            aria-label={isRma ? "Return quantity exceeds the quantity available to return" : "Invoice quantity exceeds remaining"}
                                          >
                                            <AlertTriangle className="w-3 h-3" />
                                          </button>
                                        </HoverCardTrigger>
                                        <HoverCardContent side="top" className="max-w-[280px] p-2.5 bg-white border border-border rounded-lg shadow-md z-[300]">
                                          <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>Exceeds remaining</p>
                                          <div className="mt-1 space-y-0.5 text-[11px] text-slate-500 leading-snug">
                                            <p>Received: <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{item.receivedQty} {item.uom}</span></p>
                                            <p>{copy.alreadyQtyLabel} <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{Math.max(0, item.receivedQty - item.remainingQty)} {item.uom}</span></p>
                                            <p>
                                              Remaining:{' '}
                                              <button
                                                type="button"
                                                onClick={() => updateLineItem(item.id, 'invoiceQty', item.remainingQty)}
                                                className="text-[11px] leading-snug text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 hover:decoration-primary transition-colors tabular-nums cursor-pointer p-0 bg-transparent border-0 align-baseline"
                                                style={{ fontWeight: 600, fontFamily: 'inherit' }}
                                                aria-label={`Set ${isRma ? 'return' : 'invoice'} quantity to ${item.remainingQty} ${item.uom}`}
                                              >
                                                {item.remainingQty} {item.uom}
                                              </button>
                                            </p>
                                          </div>
                                          <p className="text-[11px] text-slate-500 leading-snug mt-1.5">
                                            {isRma
                                              ? "You can't return more than was received. Click the number to reset it."
                                              : "You can't invoice more than the remaining quantity. Click the number to reset it."}
                                          </p>
                                        </HoverCardContent>
                                      </HoverCard>
                                    )}
                                  <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none whitespace-nowrap ${isOverBilled ? 'text-red-400' : isUnderBilled ? 'text-amber-500' : 'text-emerald-700/70'}`} style={{ fontWeight: 500 }}>{item.uom}</span>
                                </div>
                              </td>
                              {!isRma && (
                              <td className="px-2 py-2 text-right">
                                <div className="relative w-full">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500" style={{ fontWeight: 600 }}>$</span>
                                  <Input
                                    type="number"
                                    value={totalValue}
                                    onChange={(e) => setMoneyDraft(item.id, 'lineTotal', e.target.value)}
                                    className="h-7 pl-5 pr-2 text-right text-[11px] tabular-nums shadow-none rounded-md font-semibold text-gray-900 bg-white border-slate-200 hover:border-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
                                  />
                                </div>
                              </td>
                              )}
                              {!isRma && (
                                <td className="px-3 py-2">
                                  <GLAccountPicker
                                    value={item.glAccount}
                                    defaultValue={item.defaultGlAccount}
                                    onChange={(next) => updateLineItem(item.id, 'glAccount', next)}
                                    disabled={GL_FIELDS_LOCKED}
                                  />
                                </td>
                              )}
                              <td className={`px-0 text-center sticky right-0 z-10 shadow-[inset_1px_0_0_0_#E2E8F0,-3px_0_6px_-2px_rgba(15,23,42,0.10)] transition-colors ${isRma ? 'py-1.5' : 'py-2'} ${isSelected ? 'bg-blue-50' : 'bg-white group-hover:bg-[#F5F9FF]'}`}>
                                {selectedIds.size === 0 && (
                                  <div className="flex items-center justify-center">
                                    <button
                                      onClick={() => {
                                        const previousData = JSON.parse(JSON.stringify(currentPOsData));
                                        setCurrentPOsData(prev => prev.map(po => {
                                          if (po.poNumber !== item.poNumber) return po;
                                        
                                          // Filter items, selectedItemIds, and selectedGRNItemIds to ensure full removal
                                          const originalItemId = item.id.split('-').pop();
                                          return {
                                            ...po,
                                            items: po.items.filter(pItem => !item.id.endsWith(pItem.id)),
                                            selectedItemIds: po.selectedItemIds.filter(id => id !== originalItemId),
                                            selectedGRNItemIds: po.selectedGRNItemIds?.filter(id => id !== `${item.grnNumbers[0]}:${originalItemId}`)
                                          };
                                        }));
                                      
                                        toast(`Item ${item.sku} has been removed from ${isRma ? 'RMA' : 'Invoice'} ${invoiceNumber}`, {
                                          description: "This action can be undone within 30 seconds.",
                                          action: {
                                            label: "Undo (30s)",
                                            onClick: () => setCurrentPOsData(previousData),
                                          },
                                          cancel: {
                                            label: "Close",
                                            onClick: () => console.log("Toast closed"),
                                          },
                                          duration: 30000,
                                        });
                                      }}
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
                )}

                {/* The search, on the step rather than in front of it. A return
                    is rarely finished in one pass, and making the second part
                    reopen the picker put a door in front of the most repeated
                    action on the step. Only on the by-item route: coming in by
                    vendor, another part has to come from that vendor's book,
                    which the picker is already scoped to. */}
                {/* The vendor is named in the picker in front of this step
                    now, and everything on the return is theirs, so a second
                    vendor search on the step was offering to start a return
                    the flow cannot hold. Parts are added from the item search
                    below, which the route already scopes. */}
                {isRma && startMode === 'vendor' && STEP1 !== 'configure' && (
                  <InlineVendorSearch
                    query={lineSearchQuery}
                    onQuery={setLineSearchQuery}
                    onReturn={vendorLegs.map((leg) => {
                      const rows = leg.rows.filter((r) => r.qty > 0);
                      const uoms = new Set(rows.map((r) => r.uom));
                      return {
                        vendorCode: leg.vendorCode,
                        vendorName: leg.vendorName,
                        partCount: rows.length,
                        units: rows.reduce((n, r) => n + r.qty, 0),
                        uom: uoms.size === 1 ? [...uoms][0]! : 'units',
                      };
                    })}
                    onAdd={(vendorCode, picks) => {
                      const already = new Set(lineItems.map((l) => l.sku));
                      handleAddPOs(
                        selectionFromVendorItems(
                          vendorCode,
                          picks.filter((p) => !already.has(p.sku)),
                        ),
                      );
                    }}
                    onOpenVendor={(vendorCode) => {
                      const leg = vendorLegs.find((v) => v.vendorCode === vendorCode);
                      const first = leg?.rows.find((r) => r.qty > 0);
                      const line = first ? lineItems.find((li) => li.sku === first.sku) : undefined;
                      if (!line) return;
                      setFocusedLineId(line.id);
                      setVendorSheetCode(vendorCode);
                      setLineDetailOpen(true);
                    }}
                    onPickSerials={pickSerialsFor}
                  />
                )}
                {/* Both routes land here. By item the vendor is still to be
                    named; by vendor it was named before anything was picked,
                    so the panel opens with it already chosen. The screen is
                    the same either way. */}
                {isRma && STEP1 === 'configure' && (() => {
                  // Past the first step, a line with no figure is not on the
                  // return. It matters on the vendor route, where the rail
                  // opens holding the whole of a vendor's book: the ones being
                  // sent back are the ones that were counted, and carrying the
                  // rest into the steps that ask about units and receipts
                  // would ask those questions of parts nobody is returning.
                  const rail: RailLine[] = lineItems
                    .filter(
                      (l) =>
                        activeStep === 'lines' ||
                        l.invoiceQty > 0 ||
                        addedLater.includes(lineKey(l.sku, l.uom ?? 'EA')) ||
                        railHold.includes(lineKey(l.sku, l.uom ?? 'EA')),
                    )
                    .map((l) => ({
                      key: lineKey(l.sku, l.uom),
                      sku: l.sku,
                      description: l.description,
                      uom: l.uom,
                      trackingMode: trackingModeFor(l.sku),
                      qty: l.invoiceQty,
                    }))
                    // Narrowest definition first, from the step that asks who
                    // this is going back to onward. A serial names one vendor
                    // and that vendor is then the return's, so the lines that
                    // can answer the question have to be the ones asked
                    // first; plain stock, which cannot answer it at all,
                    // comes last and takes what they said. The first step
                    // keeps the order things were added in, because nothing
                    // there depends on it.
                    .sort((a, b) =>
                      activeStep === 'lines' ? 0 : narrowness(a.sku) - narrowness(b.sku),
                    );
                  // Focus is a line, not a part: the same helmet can be on the
                  // return twice, in eaches and in boxes, and opening one of
                  // them must not open the other.
                  const focusSku =
                    (configureSku && rail.some((r) => r.key === configureSku)
                      ? configureSku
                      : null) ??
                    rail[0]?.key ??
                    null;
                  const focusLine = rail.find((r) => r.key === focusSku);
                  return (
                    <ReturnConfigureItems
                      lotQty={lotQtyFor(
                        currentPOItems.find(
                          (i) => lineKey(i.sku, i.uom ?? 'EA') === focusLine?.key,
                        )?.id ?? '',
                      )}
                      onOpenLots={() => {
                        const item = focusLine
                          ? currentPOItems.find((i) => i.sku === focusLine.sku)
                          : undefined;
                        if (item) setLotModalLineId(item.id);
                      }}
                      // The rail alone on the first, the rail beside a panel
                      // on the three after it.
                      stage={
                        activeStep === 'units' ||
                        activeStep === 'receivers'
                          ? activeStep
                          : 'items'
                      }
                      // Pressing Continue is how the user asks what is
                      // missing, so that is when the rows answer.
                      showErrors={showRowErrors}
                      // What the step is still waiting on, line by line. The
                      // same reckoning Continue uses, shown on the rail as it
                      // stands rather than only when the user asks.
                      // What each line has to show for itself on this step.
                      // The rail is the only place the lines that are not in
                      // focus can be seen, so it says where each one stands
                      // rather than only that it is unfinished.
                      // Whose provenance leads away from the vendor this
                      // return is with.
                      conflict={(l) => {
                        if (!rmaVendorLock) return null;
                        const nameOf = (code: string) =>
                          mockVendors.find((v) => v.vendorCode === code)?.vendorName ?? code;
                        const lockName = nameOf(rmaVendorLock);
                        const clash = vendorConflict(l.sku);
                        if (clash) {
                          return {
                            kind: 'blocked' as const,
                            owners: clash.owners.map(nameOf),
                            lockName,
                          };
                        }
                        const li = currentPOItems.find(
                          (i) => lineKey(i.sku, i.uom ?? 'EA') === l.key,
                        );
                        if (!li || (li.invoiceQty ?? 0) <= 0) return null;
                        const declared = li.invoiceQty ?? 0;
                        // Plain stock is asked rather than read, so it can
                        // be pointed at the wrong vendor -- picked before a
                        // serial named one, or picked on a line the vendor
                        // never shipped. Neither is a dead end: both have an
                        // answer, and the band is where it is offered.
                        if (trackingModeFor(l.sku) === 'none') {
                          const chosen = countedVendorFor(l.sku, l.uom);
                          const take = () => {
                            markAnswered('vendor', l.key);
                            markAnswered('units', l.key);
                            pickCountedVendor(l.sku, l.uom, declared, rmaVendorLock);
                          };
                          // Already on them is already answered. Asking a
                          // second time left the band standing over a line
                          // whose only question it had just answered.
                          if (chosen !== rmaVendorLock) {
                            if (chosen) {
                              return {
                                kind: 'switch' as const,
                                lockName,
                                currentName: nameOf(chosen),
                                onSwitch: take,
                              };
                            }
                            const rline = resolutionLines.find((r) => r.sku === l.sku);
                            const shipped = rline
                              ? resolveCandidates(rline).filter((c) => c.shipped)
                              : [];
                            if (!shipped.some((c) => c.vendorCode === rmaVendorLock)) {
                              const why = lockReason();
                              return {
                                kind: 'unshipped' as const,
                                lockName,
                                ...(why ? { lockReason: why } : {}),
                                onUse: take,
                              };
                            }
                          }
                        }
                        // More on the line than they ever sent. Nothing on
                        // this panel can close it, so the panel says so and
                        // offers the only figure that can.
                        const cap = vendorCapFor(li);
                        // Nothing at all is not a quantity to offer. A line
                        // they have none of is either in conflict, which is
                        // already said above, or stock nobody can trace,
                        // which can go back to them in any quantity.
                        if (cap === null || cap <= 0 || cap >= declared) return null;
                        return {
                          kind: 'shortfall' as const,
                          lockName,
                          cap,
                          declared,
                          uom: l.uom,
                          onFix: () =>
                            setQtyGate({
                              lineId: li.id,
                              sku: li.sku,
                              uom: l.uom,
                              from: declared,
                              to: cap,
                              vendorName: lockName,
                              units: trackingModeFor(l.sku) !== 'none',
                            }),
                        };
                      }}
                      rowStatus={(l) => {
                        const li = currentPOItems.find(
                          (i) => lineKey(i.sku, i.uom ?? 'EA') === l.key,
                        );
                        if (!li) return null;
                        const mode = trackingModeFor(l.sku);

                        if (activeStep === 'units') {
                          // Plain stock is asked for its vendor on this step
                          // too, in the panel beside the rail. It is never
                          // stroked here -- the question belongs to the panel
                          // -- but once it has an answer the card says so.
                          if (mode === 'none') {
                            const named = countedVendorFor(l.sku, l.uom);
                            return named
                              ? {
                                  label: 'Vendor assigned',
                                  tone: 'done' as const,
                                  title: `Going back to ${
                                    mockVendors.find((v) => v.vendorCode === named)?.vendorName ??
                                    'this vendor'
                                  }`,
                                }
                              : null;
                          }
                          const want = li.invoiceQty ?? 0;
                          const have = hasSerials(mode)
                            ? isLotMode(mode)
                              ? lotQtyFor(li.id)
                              : serialOriginsFor(l.sku).length
                            : lotQtyFor(li.id);
                          const noun = hasSerials(mode) ? 'units' : l.uom;
                          const label = `${formatQty(have)} of ${formatQty(want)} ${noun}`;
                          return want > 0 && have >= want
                            ? { label, tone: 'done' as const }
                            : {
                                label,
                                tone: 'todo' as const,
                                title: hasSerials(mode)
                                  ? 'Select the serial numbers to return'
                                  : 'Enter the quantity to return from each lot',
                              };
                        }

                        // The vendor step says nothing on the card. The panel
                        // beside it names the vendor for the line in focus,
                        // and a line still without one is stroked: a vendor's
                        // name repeated down the rail was the same name over
                        // and over.
                        if (activeStep === 'vendor') {
                          if (hasSerials(mode)) return null;
                          const chosen = countedVendorFor(l.sku, l.uom);
                          // Answered lines say so on the card. The vendor's
                          // name still stays off the rail -- it was the same
                          // name down every row -- so the card says the
                          // question is settled and the panel says by whom.
                          return chosen
                            ? {
                                label: 'Vendor assigned',
                                tone: 'done' as const,
                                title: `Going back to ${
                                  mockVendors.find((v) => v.vendorCode === chosen)?.vendorName ??
                                  'this vendor'
                                }`,
                              }
                            : { label: '', tone: 'todo' as const };
                        }

                        return null;
                      }}
                      pendingKeys={
                        activeStep === 'units' || activeStep === 'vendor'
                          ? [
                              ...new Set([
                                ...rail
                                  .filter((l) => !answeredByHand[activeStep].includes(l.key))
                                  .map((l) => l.key),
                                ...stepBlockers
                                  .map((b) => b.sku)
                                  .filter((k): k is string => Boolean(k)),
                              ]),
                            ]
                          : []
                      }
                      query={lineSearchQuery}
                      onQuery={setLineSearchQuery}
                      catalogue={rmaCatalogue}
                      lines={rail}
                      focused={focusSku}
                      onFocus={setConfigureSku}
                      deliveries={
                        focusLine ? configureDeliveries(focusLine.sku, focusLine.uom) : []
                      }
                      // A part joins with nothing chosen. What comes back is
                      // the table's business, and pre-filling it would be an
                      // answer nobody gave.
                      onAdd={(sku) => {
                        handleAddPOs(selectionFromItems([{ sku, qty: 0 }]));
                        const added = returnableItems().find((i) => i.sku === sku);
                        setConfigureSku(lineKey(sku, added?.stock[0]?.uom ?? added?.uom ?? 'EA'));
                      }}
                      // One line, not every line of that part. A helmet on the
                      // return in eaches and in boxes is two rows, and the
                      // remove on one of them takes one of them off.
                      onRemove={(key) => {
                        const gone = lineItems.find((li) => lineKey(li.sku, li.uom ?? 'EA') === key);
                        if (!gone) return;
                        // Matched on the part and the unit, not on the id: a
                        // rail line is keyed `inv-{po}-{poLineId}` while the
                        // order's own row is keyed `{poLineId}`, so comparing
                        // the two never matched and the remove did nothing.
                        const isGone = (li: { sku: string; uom?: string }) =>
                          li.sku === gone.sku && (li.uom ?? 'EA') === gone.uom;
                        setCurrentPOsData((prev) =>
                          prev
                            .map((po) => {
                              const dropped = new Set(
                                po.items.filter(isGone).map((li) => li.id),
                              );
                              return {
                                ...po,
                                items: po.items.filter((li) => !dropped.has(li.id)),
                                selectedItemIds: (po.selectedItemIds ?? []).filter(
                                  (id) => !dropped.has(id),
                                ),
                              };
                            })
                            .filter((po) => po.items.length > 0),
                        );
                        setItemTies((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                        setVendorAllocations((prev) => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      }}
                      // A counted line's figure was given on its first stage,
                      // so a tie is measured against it rather than summing
                      // into it. Only a lot line still builds its quantity out
                      // of the rows.
                      onRowQty={(grnNumber, qty) => {
                        if (!focusLine) return;
                        if (!hasSerials(trackingModeFor(focusLine.sku))) {
                          // What the line would be tied to in all, if this
                          // row took the figure being asked for.
                          const code = countedVendorFor(focusLine.sku, focusLine.uom);
                          const ties =
                            itemTies[lineKey(focusLine.sku, focusLine.uom)]?.[code ?? '']?.ties ??
                            {};
                          const others = Object.entries(ties)
                            .filter(([g]) => g !== grnNumber)
                            .reduce((n, [, v]) => n + v, 0);
                          const declared = focusLine.qty;
                          const li = currentPOItems.find(
                            (i) => lineKey(i.sku, i.uom ?? 'EA') === focusLine.key,
                          );
                          if (li && qty > 0 && Math.round((others + qty - declared) * 100) / 100 > 0) {
                            setTieRaise({
                              sku: focusLine.sku,
                              uom: focusLine.uom,
                              grnNumber,
                              docQty: qty,
                              declared,
                              fits: Math.max(0, Math.round((declared - others) * 100) / 100),
                              lineId: li.id,
                            });
                            return;
                          }
                          setTieQty(focusLine.sku, focusLine.uom, grnNumber, qty);
                          return;
                        }
                        setDeliveryQty(focusLine.sku, focusLine.uom, grnNumber, qty);
                      }}
                      // A purchase order belongs to the ordering module, the
                      // same way a new vendor belongs to partner creation.
                      onOpenPO={() => window.open('', '_blank')}
                      currencyLock={currencyLockFor}
                      onAllRows={(on) => {
                        if (!focusLine) return;
                        if (trackingModeFor(focusLine.sku) !== 'serialized') {
                          setAllTies(focusLine.sku, focusLine.uom, on);
                          return;
                        }
                        setAllDeliveries(focusLine.sku, focusLine.uom, on);
                      }}
                      onOpenUnits={() => {
                        if (!focusLine) return;
                        const line = lineItems.find(
                          (li) => lineKey(li.sku, li.uom ?? 'EA') === focusLine.key,
                        );
                        if (!line) return;
                        // Held to the figure on the card. The count is asked
                        // there, the same way it is asked of every other part,
                        // so ticking fourteen of a declared fifteen is stopped
                        // rather than quietly rewriting the line to fourteen.
                        setSerialModalVendor(null);
                        setSerialModalLineId(line.id);
                      }}
                      onOpenLine={(sku) => {
                        const line = lineItems.find((l) => l.sku === sku);
                        if (!line) return;
                        setFocusedLineId(line.id);
                        setLineDetailOpen(true);
                      }}
                      // The ceiling belongs to the shelf, not to the part: a
                      // line written in pallets is capped by the pallets on
                      // hand, and reading the base figure there let somebody
                      // return three hundred of something held twelve deep.
                      cap={
                        focusLine ? shelfQty(focusLine.sku, focusLine.uom) : 0
                      }
                      shelves={
                        focusLine
                          ? returnableItems().find((i) => i.sku === focusLine.sku)?.stock ?? []
                          : []
                      }
                      // Which candidates share a parent with a vendor another
                      // line is already going back to. That is the pair the
                      // second step offers to merge, so the row says so before
                      // it is chosen rather than after.
                      // The vendor, once anything on the return has named
                      // one. Every line goes back to them now, so it is said
                      // once across the step rather than on each line's own
                      // panel: three cards saying the same name is the same
                      // fact three times.
                      lockedVendor={lockedVendor ?? rmaVendorLock}
                      lockedVendorName={
                        lockedVendor ?? rmaVendorLock
                          ? [...mockVendors, ...adHocVendors].find(
                              (v) => v.vendorCode === (lockedVendor ?? rmaVendorLock),
                            )?.vendorName ?? null
                          : null
                      }
                      lockedVendorAddress={
                        lockedVendor ?? rmaVendorLock
                          ? vendorAddress((lockedVendor ?? rmaVendorLock)!)
                          : null
                      }
                      // What named them, which is the thing a read-only fact
                      // has to carry: a vendor nobody remembers choosing
                      // reads as a vendor the flow chose.
                      // Said as a sentence about what happened, not as a
                      // clause bolted to a standing one: "They were set as the
                      // vendor when you picked serials from CAB-XL-10."
                      lockedVendorNote={(() => {
                        if (lockedVendor) return 'They were set as the vendor when the return was started from them.';
                        if (!rmaVendorLock) return null;
                        const by = controlledLines().find((li) => controlledVendor(li));
                        if (!by) {
                          const plain = lineItems.find(
                            (li) =>
                              li.invoiceQty > 0 &&
                              countedVendorFor(li.sku, li.uom ?? 'EA') === rmaVendorLock,
                          );
                          return plain
                            ? `They were set as the vendor when you chose them on ${plain.sku}.`
                            : null;
                        }
                        const mode = trackingModeFor(by.sku);
                        return mode === 'lot'
                          ? `They were set as the vendor when you picked lots from ${by.sku}.`
                          : `They were set as the vendor when you picked serials from ${by.sku}.`;
                      })()}
                      familyOnReturn={(vendorCode) => {
                        if (!focusLine) return null;
                        const vendor = mockVendors.find((v) => v.vendorCode === vendorCode);
                        if (!vendor?.familyCode) return null;
                        const elsewhere = stepTwoLegs.some(
                          (leg) =>
                            leg.familyCode === vendor.familyCode &&
                            leg.vendorCode !== vendorCode &&
                            leg.items.some((i) => i.sku !== focusLine.sku),
                        );
                        return elsewhere ? vendor.familyName ?? null : null;
                      }}
                      volumeUom={
                        focusLine
                          ? returnableItems().find((i) => i.sku === focusLine.sku)?.uom ??
                            focusLine.uom
                          : ''
                      }
                      unitsReceived={(vendorCode) =>
                        focusLine ? unitsReceivedFor(focusLine.sku, vendorCode) : []
                      }
                      // A different unit is a different shelf, so the line is
                      // rebuilt on it rather than relabelled, and whatever was
                      // tied to the old unit's deliveries goes with it: those
                      // documents are not this line's any more.
                      onUom={(uom) => {
                        if (focusLine) rewriteUom(focusLine.sku, focusLine.uom, uom);
                      }}
                      // The rail writes by part: every row carries a field on
                      // the quantity step, and the row in focus keeps one on
                      // every step after it.
                      onDeclareFor={declareFor}
                      onUomFor={rewriteUom}
                      // The same part again, on a shelf of its own. It gets a
                      // line id of its own, which is what lets the two hold
                      // different vendors: a box supplier is not always the
                      // each supplier.
                      // The serial picker itself, on the step that asks for
                      // it. It was a button that opened the same list in a
                      // dialog over a panel with nothing else on it; the panel
                      // has the room and the picks apply as they are made, so
                      // the dialog was two clicks around a list. The dialog is
                      // still mounted for the rows that open it.
                      unitPicker={(() => {
                        if (activeStep !== 'units' || !focusLine) return undefined;
                        if (trackingModeFor(focusLine.sku) !== 'serialized') return undefined;
                        const li = currentPOItems.find(
                          (i) => lineKey(i.sku, i.uom ?? 'EA') === focusLine.key,
                        );
                        if (!li) return undefined;
                        const declared = li.invoiceQty ?? 0;
                        const pool = availableSerials(li.sku, li.id, li.receivedQty);
                        const receipts = (li.receipts ?? []).map((r) => ({
                          grnNumber: r.grnNumber,
                          receivedQty: r.receivedQty,
                        }));
                        const origins = serialOrigins(li.sku, li.id, li.receivedQty, receipts, pool);
                        const states = unitStatesFor(li.sku, pool);
                        const chosen = new Set(lineSerials[li.id] ?? []);

                        // The units themselves, first and outside.
                        //
                        // This panel used to open on a list of vendors, with
                        // not one serial visible until one of them was ticked.
                        // That is a vendor step wearing another hat, and it
                        // runs the resolution backwards: the brief has the
                        // serial naming the vendor, so the serials are what
                        // the panel opens on and the vendor is what appears
                        // once one is picked.
                        const vendorBySerial = new Map(
                          origins.map((o) => [
                            o.serial,
                            { vendorCode: o.vendorCode, vendorName: o.vendorName },
                          ]),
                        );
                        const named = [...chosen];
                        const owner = named.length > 0 ? vendorBySerial.get(named[0]!) : undefined;
                        const everyUnit = origins.filter(
                          (o) => states.get(o.serial) !== 'allocated',
                        );
                        const vendorCount = new Set(origins.map((o) => o.vendorCode)).size;

                        return (
                          <div className="flex min-h-0 flex-1 flex-col gap-3">
                            {/* No vendor card here. The first unit picked
                                names the vendor for the whole return, so the
                                answer belongs to the step's header rather
                                than to the line that happened to be open
                                when it was given. */}
                            <SerialSelectionModal
                              open
                              variant="inline"
                              onOpenChange={() => {}}
                              lines={[
                                {
                                  id: li.id,
                                  sku: li.sku,
                                  description: li.description,
                                  image: imageForSku(li.sku),
                                  receivedQty: pool.length,
                                  uom: li.uom,
                                  serialPool: pool,
                                },
                              ]}
                              activeLineId={li.id}
                              selected={{ [li.id]: named }}
                              {...(declared > 0 ? { target: declared } : {})}
                              onChangeCount={(next) =>
                                updateLineItem(li.id, 'invoiceQty', String(next))
                              }
                              onChange={(_lineId, next) => {
                                if (next.length > 0)
                                  markAnswered('units', lineKey(li.sku, li.uom ?? 'EA'));
                                setSerialsForLine(li, next, true);
                              }}
                              vendorOf={(sn) => vendorBySerial.get(sn) ?? null}
                              // The return's vendor, not the controlled
                              // lines' alone. A plain line's vendor is still a
                              // decision about the whole return -- one RMA is
                              // one vendor -- so the batches and units on
                              // every other line follow it, the same way they
                              // follow a serial. It was read off the
                              // controlled lines only, which left a return
                              // whose vendor had been chosen on a plain line
                              // offering every supplier's batches beside it.
                              lockedVendor={lockForLine(li.sku, li.uom ?? 'EA')}
                              lockedVendorName={(() => {
                                const code = lockForLine(li.sku, li.uom ?? 'EA');
                                return code
                                  ? mockVendors.find((v) => v.vendorCode === code)?.vendorName ??
                                      null
                                  : null;
                              })()}
                              lockedBy={lockOrigin()}
                              onExpand={() => {
                                setSerialModalBucket(null);
                                setSerialModalVendor(null);
                                setSerialModalLineId(li.id);
                              }}
                            />
                          </div>
                        );
                      })()}
                                            // Plain stock on the units step: no units, no batches,
                      // only whose it is. The same card the serialized line
                      // gets, with the rows built from who has shipped the
                      // part rather than from where its serials came back
                      // through -- one bolt is any bolt, so this one is asked
                      // rather than read.
                      vendorPicker={(() => {
                        if (activeStep !== 'units' || !focusLine) return undefined;
                        if (trackingModeFor(focusLine.sku) !== 'none') return undefined;
                        const li = currentPOItems.find(
                          (i) => lineKey(i.sku, i.uom ?? 'EA') === focusLine.key,
                        );
                        if (!li) return undefined;
                        // Asked straight away, not held behind the controlled
                        // lines. Plain stock cannot say who shipped it, so a
                        // vendor picked here can be contradicted later by a
                        // serial -- but holding the card shut until then hid
                        // the whole question behind another line, and most
                        // returns have nothing to contradict it with. The
                        // contradiction is handled where it happens: the band
                        // above the list says the return has moved and offers
                        // the move.
                        const declared = li.invoiceQty ?? 0;
                        const chosenVendor = countedVendorFor(focusLine.sku, focusLine.uom);
                        const line = resolutionLines.find((l) => l.sku === focusLine.sku);
                        const all = line
                          ? resolveCandidates(line)
                          : [];
                        const shipped = all.filter((c) => c.shipped);
                        // What each vendor is actually holding of this line.
                        // Reading the single chosen vendor left every row but
                        // one blank once the line was spread across all of
                        // them.
                        const split = line ? vendorSplitFor(line) : {};
                        const rows = (shipped.length > 0 ? shipped : all)
                          .map((c) => ({
                            vendorCode: c.vendorCode,
                            vendorName: c.vendorName,
                            total: c.lifetime,
                            available: c.lifetime,
                            picked:
                              split[c.vendorCode] ??
                              (c.vendorCode === chosenVendor ? declared : 0),
                          }))
                          // The vendor the return is with is the only row
                          // that can be ticked, so it leads. Eleventh in a
                          // list of thirteen greyed-out names, it read as a
                          // list with nothing available on it.
                          .sort((a, c) =>
                            a.vendorCode === rmaVendorLock
                              ? -1
                              : c.vendorCode === rmaVendorLock
                                ? 1
                                : 0,
                          );
                        // The vendor is settled, and the rest of the book
                        // stays on screen shut.
                        //
                        // Listing only the one they can use hid the reason it
                        // is the only one; listing everyone as though any were
                        // available hid the lock. So the list is whole, their
                        // row leads it, and every other row is drawn locked
                        // with the reason on it.
                        //
                        // Plain stock they never shipped can still go back to
                        // them, because one bolt is any bolt. Then their row
                        // is built rather than found, and says what it is: a
                        // vendor with no receipt for this part, taking it back
                        // anyway.
                        const locked = (() => {
                          if (!rmaVendorLock) return rows;
                          const theirs = rows.find(
                            (r) => r.vendorCode === rmaVendorLock && r.available > 0,
                          );
                          if (theirs) return rows;
                          // Until the user says so. A vendor who has never
                          // shipped the part is not a candidate on the list;
                          // they become one by the band's own button, and the
                          // row appears then, holding the answer.
                          if ((split[rmaVendorLock] ?? 0) <= 0) return rows;
                          const known = all.find((c) => c.vendorCode === rmaVendorLock);
                          return [
                            {
                              vendorCode: rmaVendorLock,
                              vendorName:
                                known?.vendorName ??
                                mockVendors.find((v) => v.vendorCode === rmaVendorLock)
                                  ?.vendorName ??
                                rmaVendorLock,
                              total: 0,
                              available: declared,
                              picked: split[rmaVendorLock] ?? 0,
                              noHistory: true,
                            },
                            ...rows.filter((r) => r.vendorCode !== rmaVendorLock),
                          ];
                        })();

                        return (
                          <ReturnSerialVendors
                            rows={locked}
                            need={declared}
                            named={Math.round(
                              locked.reduce((n, r) => n + r.picked, 0) * 100,
                            ) / 100}
                            uom={li.uom ?? 'EA'}
                            // The return's vendor, not this line's. Where a
                            // serial or a batch has already named one, plain
                            // stock follows it: one bolt is any bolt, so it
                            // has nothing of its own to say about who shipped
                            // it, and letting it disagree with a serial was
                            // letting it start a second return.
                            lockedVendor={rmaVendorLock ?? chosenVendor ?? null}
                            lockedVendorName={
                              mockVendors.find(
                                (v) => v.vendorCode === (rmaVendorLock ?? chosenVendor),
                              )?.vendorName ?? null
                            }
                            lockNote={
                              rmaVendorLock
                                ? `This return is going back to ${
                                    mockVendors.find((v) => v.vendorCode === rmaVendorLock)
                                      ?.vendorName ?? rmaVendorLock
                                  }, named by the serial numbers and lots already selected. Clear those to choose somebody else.`
                                : undefined
                            }
                            countsUnits={false}
                            onFill={(vendorCode) => {
                              markAnswered('vendor', focusLine.key);
                              markAnswered('units', focusLine.key);
                              pickCountedVendor(
                                focusLine.sku,
                                focusLine.uom,
                                declared,
                                vendorCode,
                              );
                            }}
                            onClear={() => {
                              setVendorAllocations((prev) => forgetLine(prev, focusLine.sku));
                              setItemTies((prev) => forgetLine(prev, focusLine.sku));
                            }}
                            onOpen={(vendorCode) => {
                              markAnswered('vendor', focusLine.key);
                              markAnswered('units', focusLine.key);
                              pickCountedVendor(
                                focusLine.sku,
                                focusLine.uom,
                                declared,
                                vendorCode,
                              );
                            }}
                          onCreateVendor={() => window.open('', '_blank')}
                          />
                        );
                      })()}
                      // The lot picker, drawn in the panel on the same terms
                      // as the serial picker beside it. A batch and its units
                      // are the same kind of answer as a unit number, so they
                      // are asked in the same place rather than behind a
                      // dialog of their own.
                      lotPicker={(() => {
                        if (activeStep !== 'units' || !focusLine) return undefined;
                        if (!isLotMode(trackingModeFor(focusLine.sku))) return undefined;
                        const li = currentPOItems.find(
                          (i) => lineKey(i.sku, i.uom ?? 'EA') === focusLine.key,
                        );
                        if (!li) return undefined;
                        const declared = li.invoiceQty ?? 0;

                        // A batch arrives on receipts and a receipt names a
                        // supplier, so a lot line reads as vendor rows too.
                        // The batches themselves open behind the row, in the
                        // same picker, cut to what that vendor sent.
                        const uom = li.uom ?? 'EA';
                        const blocks = lotBlocksFor(li.sku, uom);
                        const picks = lineLots[li.id] ?? [];
                        const pickedLots = new Set(picks.map((a) => a.lot));
                        const chosenVendor = countedVendorFor(li.sku, uom);
                        const byVendor = new Map<
                          string,
                          { vendorName: string; total: number; available: number; picked: number }
                        >();
                        blocks.forEach((block) =>
                          block.receipts.forEach((r) => {
                            const row = byVendor.get(r.vendorCode) ?? {
                              vendorName: r.vendorName,
                              total: 0,
                              available: 0,
                              picked: 0,
                            };
                            row.total = Math.round((row.total + r.qty) * 100) / 100;
                            row.available = row.total;
                            byVendor.set(r.vendorCode, row);
                          }),
                        );
                        // What each vendor is holding of this line, read off
                        // the picks rather than off the one chosen vendor:
                        // a batch is several suppliers' stock in one bin, so
                        // every row has to say its own share.
                        const serialOf = new Map(
                          trackingModeFor(li.sku) === 'lot-serialized'
                            ? lotUnitPool(li.sku, uom).map((u) => [u.serial, u.vendorCode])
                            : [],
                        );
                        picks.forEach((a) => {
                          if (!pickedLots.has(a.lot)) return;
                          if (a.serials && a.serials.length > 0) {
                            a.serials.forEach((sn) => {
                              const code = serialOf.get(sn);
                              const row = code ? byVendor.get(code) : undefined;
                              if (row) row.picked += 1;
                            });
                            return;
                          }
                          // A plain batch has no unit to trace, so its picked
                          // quantity follows the shares its receipts describe.
                          const block = blocks.find((b) => b.lot === a.lot);
                          if (!block) return;
                          const total = block.receipts.reduce((n, r) => n + r.qty, 0) || 1;
                          block.receipts.forEach((r) => {
                            const row = byVendor.get(r.vendorCode);
                            if (!row) return;
                            row.picked =
                              Math.round((row.picked + (a.qty * r.qty) / total) * 100) / 100;
                          });
                        });
                        const rows = [...byVendor.entries()]
                          .map(([vendorCode, row]) => ({ vendorCode, ...row }))
                          .sort((a, b) => b.available - a.available);

                        // The batches themselves, first and outside, the
                        // way the serial picker stands on the panel beside
                        // it. A numbered unit inside a batch names its
                        // supplier, so lot-serialized resolves outright; a
                        // plain batch arrives on several suppliers' receipts
                        // at once, so it narrows the list and the vendor is
                        // asked underneath, once the batches are picked.
                        const takenQty = picks.reduce((n, a) => n + a.qty, 0);
                        const serialized = trackingModeFor(li.sku) === 'lot-serialized';
                        const owner = (() => {
                          if (!serialized) return null;
                          const first = picks.flatMap((a) => a.serials ?? [])[0];
                          const code = first ? serialOf.get(first) : undefined;
                          if (!code) return null;
                          return {
                            vendorCode: code,
                            vendorName: byVendor.get(code)?.vendorName ?? code,
                          };
                        })();
                        // Who could have sent what has been picked. A plain
                        // batch cannot name one of them, so the question
                        // narrows rather than disappearing.
                        const narrowed = rows.filter((r) => r.picked > 0);
                        const lockName = controlledLock
                          ? mockVendors.find((v) => v.vendorCode === controlledLock)?.vendorName ??
                            controlledLock
                          : null;

                        return (
                          <div className="flex min-h-0 flex-1 flex-col gap-3">
                            {/* The vendor is the step's header, not the
                                line's: every line on the return is going
                                back to them. */}
                            <LotSelectionModal
                              open
                              variant="inline"
                              onOpenChange={() => {}}
                              lines={[
                                {
                                  id: li.id,
                                  sku: li.sku,
                                  description: li.description,
                                  image: imageForSku(li.sku),
                                  receivedQty: li.receivedQty ?? 0,
                                  uom: li.uom,
                                },
                              ]}
                              activeLineId={li.id}
                              selected={{ [li.id]: picks }}
                              {...(declared > 0 ? { target: declared } : {})}
                              // The return's vendor, not the controlled
                              // lines' alone. A plain line's vendor is still a
                              // decision about the whole return -- one RMA is
                              // one vendor -- so the batches and units on
                              // every other line follow it, the same way they
                              // follow a serial. It was read off the
                              // controlled lines only, which left a return
                              // whose vendor had been chosen on a plain line
                              // offering every supplier's batches beside it.
                              lockedVendor={lockForLine(li.sku, li.uom ?? 'EA')}
                              lockedVendorName={(() => {
                                const code = lockForLine(li.sku, li.uom ?? 'EA');
                                return code
                                  ? mockVendors.find((v) => v.vendorCode === code)?.vendorName ??
                                      null
                                  : null;
                              })()}
                              lockedBy={lockOrigin()}
                              onChangeCount={(next) =>
                                updateLineItem(li.id, 'invoiceQty', String(next))
                              }
                              onChange={(lineId, next) => {
                                if (next.length > 0) markAnswered('units', lineKey(li.sku, uom));
                                setLineLots((prev) => ({ ...prev, [lineId]: next }));
                                // A plain batch under a lock is already cut
                                // to that vendor's share of it, so picking
                                // any of it is picking them. Written through
                                // here, or the line stood there with batches
                                // chosen and no vendor against it, which the
                                // steps after this one read as unanswered.
                                if (!serialized) {
                                  const qtyNow = next.reduce((n, a) => n + a.qty, 0);
                                  if (qtyNow === 0) {
                                    setVendorAllocations((prev) => forgetLine(prev, li.sku));
                                    setItemTies((prev) => forgetLine(prev, li.sku));
                                    return;
                                  }
                                  // The batch names the vendor. One batch is
                                  // one supplier's, so picking it answers the
                                  // question the step used to ask underneath
                                  // the picker.
                                  const owner = (() => {
                                    for (const pick of next) {
                                      if (pick.qty <= 0) continue;
                                      const block = blocks.find((b) => b.lot === pick.lot);
                                      const v = block ? lotVendorFor(block) : null;
                                      if (v) return v.vendorCode;
                                    }
                                    return controlledLock;
                                  })();
                                  if (owner) pickCountedVendor(li.sku, uom, qtyNow, owner);
                                  return;
                                }
                                const firstUnit = next.flatMap((a) => a.serials ?? [])[0];
                                const code = firstUnit ? serialOf.get(firstUnit) : undefined;
                                const qty = next.reduce((n, a) => n + a.qty, 0);
                                if (code && qty > 0) pickCountedVendor(li.sku, uom, qty, code);
                                else if (!code) {
                                  setVendorAllocations((prev) => forgetLine(prev, li.sku));
                                  setItemTies((prev) => forgetLine(prev, li.sku));
                                }
                              }}
                              onExpand={() => {
                                setLotModalVendor(null);
                                setLotModalLineId(li.id);
                              }}
                            />

                          </div>
                        );
                      })()}
                                            // What a line this step does not ask about already
                      // says, so it reads as settled rather than as skipped.
                      answeredNote={(l) => {
                        if (activeStep === 'units') return 'nothing to select';
                        const origins = serialOriginsFor(l.sku);
                        if (origins.length === 0) return 'select its serial numbers first';
                        // The receipt step and the vendor step are settled by
                        // the same act, so each names the half it would have
                        // asked for rather than both naming the vendor.
                        if (activeStep === 'receivers') {
                          const docs = [...new Set(origins.map((o) => o.grnNumber))];
                          return docs.length === 1
                            ? `tied to ${docs[0]}`
                            : `tied to ${docs.length} documents`;
                        }
                        const names = [...new Set(origins.map((o) => o.vendorName))];
                        return names.length === 1
                          ? `goes back to ${names[0]}`
                          : `${names.length} vendors, read off its units`;
                      }}
                      onAddUnit={(sku, uom) => {
                        handleAddPOs(selectionFromItems([{ sku, qty: 0, uom }]));
                        // Added from a later step, the new line has no figure
                        // yet, and the rail past the first step only carries
                        // lines that do. So it is remembered until it has one,
                        // and the step it was added on shows it and focuses
                        // it: the point of adding a second unit there is to
                        // answer for it there.
                        setAddedLater((prev) =>
                          prev.includes(lineKey(sku, uom)) ? prev : [...prev, lineKey(sku, uom)],
                        );
                        setConfigureSku(lineKey(sku, uom));
                      }}
                      named={focusLine ? serialOriginsFor(focusLine.sku).length : 0}
                      onDeclare={(qty) => {
                        if (focusLine) declareFor(focusLine.sku, focusLine.uom, qty);
                      }}
                      vendors={
                        focusLine && trackingModeFor(focusLine.sku) !== 'serialized'
                          ? (() => {
                              const all = resolveCandidates({
                                ...(resolutionLines.find((l) => l.sku === focusLine.sku) ??
                                  ({ sku: focusLine.sku } as ResolutionLine)),
                              });
                              // Normally the list is whoever shipped the part:
                              // a return goes back to where it came from, and
                              // offering forty vendors who never sold it is
                              // the question this step exists to stop asking.
                              //
                              // Unless nobody did. Stock counted in at a
                              // stocktake or carried over from a migration is
                              // in the building with no receiver behind it, so
                              // there is no "where it came from" to offer --
                              // and the panel's own copy has been promising to
                              // "show the rest" against a list that had been
                              // filtered down to nothing. Then it is the whole
                              // book, because somebody is taking it back and
                              // only a person knows who.
                              const shipped = all.filter((c) => c.shipped);
                              // A vendor is already settled, so there is no
                              // list to choose from.
                              //
                              // The serials on another line named who this
                              // return is with, and one RMA is one vendor. The
                              // panel was still offering eight other suppliers
                              // -- every one of them a choice the return
                              // cannot take -- and offering the locked vendor
                              // itself at the line's full quantity on a part
                              // they have never shipped. What is left is the
                              // one candidate that is real: them, if they
                              // actually sent it. If they did not, the band
                              // above says so and offers the two ways out.
                              if (rmaVendorLock) {
                                return shipped.filter(
                                  (c) => c.vendorCode === rmaVendorLock && c.lifetime > 0,
                                );
                              }
                              return shipped.length > 0 ? shipped : all;
                            })()
                              .map((c) => ({
                                vendorCode: c.vendorCode,
                                vendorName: c.vendorName,
                                lifetime: c.lifetime,
                                recent: c.recent,
                                // So the panel can see which two candidates are
                                // branches of one company and keep them
                                // together at the top of the list.
                                familyCode: mockVendors.find(
                                  (v) => v.vendorCode === c.vendorCode,
                                )?.familyCode,
                              }))
                          : []
                      }
                      chosenVendor={focusLine ? countedVendorFor(focusLine.sku, focusLine.uom) : null}
                      docsForVendor={(vendorCode) =>
                        focusLine ? vendorDeliveries(focusLine.sku, focusLine.uom, vendorCode) : []
                      }
                      untied={
                        focusLine
                          ? Object.values(itemTies[lineKey(focusLine.sku, focusLine.uom)] ?? {}).some((e) => e.untied)
                          : false
                      }
                      merge={focusLine ? siteMerge[focusLine.sku] !== false : true}
                      // One RMA is one vendor, so a vendor named for one line
                      // is a vendor the whole return can consolidate onto.
                      // Every other counted line nobody has answered yet, that
                      // this vendor has actually shipped, goes to them too --
                      // otherwise the user names the same vendor once per line
                      // and the return ends up as four documents where one
                      // would do. A line already answered is left alone, and a
                      // serialized line is never touched: its vendor is read
                      // off the units, not chosen.
                      onPickVendor={(vendorCode) => {
                        if (!focusLine) return;
                        markAnswered('vendor', focusLine.key);
                        pickCountedVendor(
                          focusLine.sku,
                          focusLine.uom,
                          focusLine.qty,
                          vendorCode,
                        );

                        // A vendor is picked for the line it is picked on,
                        // and for no other. Pulling every other line that
                        // vendor had also shipped onto the same RMA answered a
                        // question about those lines that nobody had asked,
                        // and left the user checking what had moved.
                      }}
                      // Partner creation is its own screen in its own module.
                      // Typing a name here wrote a supplier the rest of the
                      // system had never heard of -- no terms, no address, no
                      // account to credit. The tab is empty for now; the route
                      // goes in when that screen is ready.
                      onCreateVendor={() => window.open('', '_blank')}
                      onUntied={(next) => {
                        if (!focusLine) return;
                        const vendorCode = countedVendorFor(focusLine.sku, focusLine.uom);
                        if (!vendorCode) return;
                        setItemTies((prev) => ({
                          ...prev,
                          [lineKey(focusLine.sku, focusLine.uom)]: {
                            [vendorCode]: next
                              ? { ties: {}, untied: true }
                              : { ties: {}, untied: false },
                          },
                        }));
                      }}
                      onMerge={(next) => {
                        if (!focusLine) return;
                        setSiteMerge((prev) => ({ ...prev, [focusLine.sku]: next }));
                      }}
                    />
                  );
                })()}
                {isRma && startMode === 'item' && STEP1 === 'catalogue' && (
                  <ReturnSelectItemsStep
                    query={lineSearchQuery}
                    onQuery={setLineSearchQuery}
                    lines={lineItems.map((l) => ({ sku: l.sku, qty: l.invoiceQty, uom: l.uom }))}
                    // One control does both jobs now: the catalogue is always
                    // on screen, so putting a part on the return and changing
                    // how much of it is going back are the same gesture on the
                    // same row.
                    onQty={(sku, qty) => {
                      const line = lineItems.find((l) => l.sku === sku);
                      if (line) {
                        updateLineItem(line.id, 'invoiceQty', qty);
                        return;
                      }
                      const item = returnableItems().find((i) => i.sku === sku);
                      handleAddPOs(selectionFromItems([{ sku, qty, uom: item?.uom ?? 'EA' }]));
                    }}
                    onDrop={(sku) => {
                      setCurrentPOsData((prev) =>
                        prev
                          .map((po) => ({
                            ...po,
                            items: po.items.filter((li) => li.sku !== sku),
                            selectedItemIds: (po.selectedItemIds ?? []).filter(
                              (id) => !id.startsWith(`item-${sku}`),
                            ),
                          }))
                          .filter((po) => po.items.length > 0),
                      );
                    }}
                    onOpenLine={(sku) => {
                      const line = lineItems.find((l) => l.sku === sku);
                      if (!line) return;
                      setFocusedLineId(line.id);
                      setLineDetailOpen(true);
                    }}
                    onPickSerials={pickSerialsFor}
                  />
                )}
                {isRma && startMode === 'item' && STEP1 === 'search' && (
                  <InlineItemSearch
                    query={lineSearchQuery}
                    onQuery={setLineSearchQuery}
                    lines={lineItems.map((l) => ({ sku: l.sku, qty: l.invoiceQty, uom: l.uom }))}
                    onAdd={(picks) => {
                      const already = new Set(lineItems.map((l) => l.sku));
                      handleAddPOs(selectionFromItems(picks.filter((p) => !already.has(p.sku))));
                    }}
                    onQty={(sku, qty) => {
                      const line = lineItems.find((l) => l.sku === sku);
                      if (line) updateLineItem(line.id, 'invoiceQty', qty);
                    }}
                    // Off the return, not down to zero. A line kept at zero is
                    // still a line: the row read it as chosen and re-ticked
                    // itself, so changing your mind about a part was a gesture
                    // the step quietly refused.
                    onDrop={(sku) => {
                      setCurrentPOsData((prev) =>
                        prev
                          .map((po) => ({
                            ...po,
                            items: po.items.filter((li) => li.sku !== sku),
                            selectedItemIds: (po.selectedItemIds ?? []).filter(
                              (id) => !id.startsWith(`item-${sku}`),
                            ),
                          }))
                          .filter((po) => po.items.length > 0),
                      );
                    }}
                    // Changing the unit is not an edit to the figure, it is a
                    // different shelf: what is on hand, what the ceiling is and
                    // what actually travels all change with it. So the line is
                    // rebuilt in the new unit rather than relabelled, in one
                    // pass -- removing and re-adding across two renders left
                    // the add filtered out as an item already on the return.
                    onUom={(sku, pick) => {
                      setCurrentPOsData((prev) => {
                        const stripped = prev
                          .map((po) => ({
                            ...po,
                            items: po.items.filter((li) => li.sku !== sku),
                            selectedItemIds: (po.selectedItemIds ?? []).filter(
                              (id) => !id.startsWith(`item-${sku}`),
                            ),
                          }))
                          .filter((po) => po.items.length > 0);
                        return [...stripped, ...selectionFromItems([pick])];
                      });
                    }}
                    onOpenLine={(sku) => {
                      const line = lineItems.find((l) => l.sku === sku);
                      if (!line) return;
                      setFocusedLineId(line.id);
                      setLineDetailOpen(true);
                    }}
                    showErrors={showRowErrors}
                    onTick={noteTick}
                    onPickSerials={pickSerialsFor}
                  />
                )}

                </div>{/* /Outer card */}
              </section>}

              {/* Standalone keeps a little scroll breathing room at the
                  bottom; the PO-based view manages its own 16px via the
                  line-items card, so no extra spacer there. */}
              {isStandalone && <div className="h-6" />}
            </div>
          </div>
          )}

          {/* RIGHT SECTION (30%, capped at the width it reaches in the 1430px
              modal). Full view is asked for to see more of the line items, so
              the extra width goes there rather than stretching a column of
              stacked form fields.

              On a return the same sections are the later steps instead of a
              rail, so the container becomes the step body and the form is
              held to a readable column rather than stretched across the
              modal. It still carries the footer on every step, which is why
              it is not gated away on the line-items step. */}
          <div
            className={
              isRma
                ? `min-h-0 bg-[#FAFBFC] flex flex-col overflow-hidden ${CONFIGURE_STEPS.includes(activeStep) || activeStep === 'partner' ? 'shrink-0' : 'flex-1'}`
                : 'w-[30%] max-w-[430px] shrink-0 bg-[#FAFBFC] flex flex-col overflow-hidden border-l border-[#EEF2F6]'
            }
          >
            {/* A step whose panel has not moved here yet. It names what will
                live on it rather than rendering nothing, so walking the shell
                reads as a flow with gaps instead of a flow that is broken. */}
            {isRma && onStubStep && (
              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-8 py-10 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-300">
                    <ListChecks className="w-5 h-5" />
                  </div>
                  <p className="text-[14px] text-foreground" style={{ fontWeight: 600 }}>
                    {stepPlan[currentStepIndex]?.label ?? 'This step'}
                  </p>
                  <p className="mt-1.5 max-w-[440px] text-[12px] text-slate-500 leading-relaxed">
                    {STUB_COPY[activeStep] ?? 'This step is next to be built.'}
                  </p>
                </div>
              </div>
            )}

            {/* The vendor step has its own body above and nothing for this
                one to add: it was rendering the accordion and the summary
                column underneath the picker, taking half the height off a
                step whose whole content is a list. */}
            {(!isRma ||
              (activeStep !== 'partner' && !CONFIGURE_STEPS.includes(activeStep) && !onStubStep)) && (
            <div className={`flex-1 overflow-y-auto custom-scrollbar ${isRma ? 'px-6 py-5' : 'p-4 space-y-4'}`}>
              {/* Later steps take the shipment wizard's step-body shell: a
                  full-width padded canvas, an amber strip stating what the
                  receipts left unresolved, then a two-column grid whose
                  right side holds the decision and stays in view while the
                  left side scrolls. */}
              {/* The vendor question used to be asked here, in a panel, and
                  then restated by the cards below it. One surface now: the card
                  is where a vendor's units are placed, so the question is asked
                  in the shape of the thing being built. */}

              
              <div
                // The settlement step opens with the same header band the
                // steps before it wear, and a band has nothing above it.
                className={isRma ? `grid gap-6 ${activeStep === 'resolution' ? '' : 'mt-5'}` : ''}
                style={
                  isRma
                    ? {
                        gridTemplateColumns:
                          activeStep === 'routing' || activeStep === 'resolution'
                            ? 'minmax(0, 1fr)'
                            : 'minmax(0, 1fr) 420px',
                      }
                    : undefined
                }
              >
              <div className={isRma ? 'min-w-0' : ''}>
              {/* Multi-Section Accordion Review */}
              <Accordion
                type="multiple" 
                value={expandedSections} 
                onValueChange={setExpandedSections}
                className="space-y-2.5"
              >
                
                {/* Section 1: General information — invoice-only. Every field
                    in it is invoice accounting (ID, posting/due date, A/P,
                    payment terms); a return's own two fields now read on the
                    RMA Details card and under Return Logistics. */}
                {!isRma && (
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
                      {/* RMA mode carries only the vendor's RMA number and the
                          shipping instruction here — invoice accounting fields
                          (ID, posting/due date, A/P, payment terms) have no
                          counterpart on a return. */}
                      {!isRma && (
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
                            <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 600 }}>System-generated ID</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Omne assigns this identifier automatically to preserve accounting integrity and internal traceability. It can't be changed.</p>
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
                            <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>System-generated</p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-0.5">The invoice ID is created by Omne to keep accounting traceability. It's locked, your reference for the vendor's own number is the Vendor Invoice Number field.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      )}

                      {!isRma && (
                      <>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Due Date</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative cursor-not-allowed">
                                <Input
                                  value={dueDate}
                                  readOnly
                                  aria-disabled="true"
                                  className="h-9 bg-slate-50 border-slate-200 text-[11px] text-slate-500 cursor-not-allowed pointer-events-none shadow-none disabled:opacity-100 w-full"
                                  style={{ fontWeight: 600 }}
                                />
                                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>Auto-calculated</p>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Due date is derived from the invoice date and the vendor's payment terms. Change either of those to recompute it.</p>
                            </TooltipContent>
                          </Tooltip>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>A/P Account</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {GL_FIELDS_LOCKED ? (
                              /* Locked, but not a dead end (feedback
                                 7/20/26): the account itself links out to
                                 Partner Management, where the mapping is
                                 actually maintained. */
                              <div className="w-full inline-flex items-center justify-between gap-2 h-9 px-2.5 rounded-md border border-slate-200 bg-slate-50 text-[12px] text-slate-500" style={{ fontWeight: 500 }}>
                                {apAccount ? (
                                  <a
                                    href={VENDOR_DETAIL_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="truncate tabular-nums hover:text-primary hover:underline transition-colors"
                                  >
                                    {apAccount}
                                  </a>
                                ) : (
                                  <span className="truncate italic text-slate-400">No A/P account</span>
                                )}
                                <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => { setApConfigModalOpen(true); setApModalSearch(''); }}
                                className="w-full inline-flex items-center justify-between gap-2 h-9 px-2.5 rounded-md border border-slate-200 text-[12px] transition-colors bg-white text-foreground hover:bg-primary/[0.03] hover:border-primary/40"
                                style={{ fontWeight: 500 }}
                              >
                                <span className={`truncate tabular-nums ${apAccount ? '' : 'italic text-slate-400'}`}>
                                  {apAccount || 'No A/P account'}
                                </span>
                                <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </button>
                            )}
                          </TooltipTrigger>
                          {GL_FIELDS_LOCKED && (
                            <TooltipContent side="top" className="max-w-[260px] p-2.5 bg-white border border-border rounded-lg shadow-md">
                              <p className="text-[11px] text-foreground leading-snug" style={{ fontWeight: 500 }}>
                                {apAccount || 'A/P account'} is locked for editing
                              </p>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                The mapping is managed in Partner Management. Click the account to open it there.
                              </p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                        {/* Auto-populated indicator — derived from vendor
                            category mapping (VENDOR_AP_MAPPING). */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="text-[10px] text-slate-500 leading-tight" style={{ fontWeight: 500 }}>
                            Auto-derived from this vendor's profile.
                          </span>
                        </div>
                      </div>

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
                              // The modal resets its own filters when it opens.
                              setPaymentTermsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-blue-700 transition-colors"
                            style={{ fontWeight: 500 }}
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            Change
                          </button>
                        </div>
                        {(() => {
                          const preset = findPresetByLabel(paymentTerms);
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
                          return (
                            <PaymentTermCard
                              term={current}
                              isSelected
                              hideCheckmark
                              compact
                              readOnly
                              showPresetBadge
                              isInherited={paymentTerms === vendorDefaultPaymentTerm}
                            />
                          );
                        })()}
                      </div>
                      </>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                )}

                {/* Section 2: GL Impact */}
                {/* Section 3: Payment hold — invoice-only, hidden in RMA mode */}
                {!isRma && (
                <AccordionItem
                  value="hold"
                  id="payment-hold-section"
                  className={`border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden ${
                    holdReasonError ? 'border-red-300 ring-2 ring-red-100' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between w-full group">
                    <AccordionTrigger className="hover:no-underline py-2.5 flex-1 [&>svg]:hidden">
                      <div className="flex items-center gap-2">
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
                              Submit and post the invoice as normal, but block payment until you release the hold. Use it when the invoice is valid but you're not ready to pay.
                            </p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-1.5">
                              <span className="text-slate-700" style={{ fontWeight: 600 }}>Example: </span>the pump arrived damaged and you're waiting on a credit note, so post the invoice now but hold payment until it's settled.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </AccordionTrigger>
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
                      className="scale-90"
                    />
                  </div>
                  <AccordionContent className="pb-4 pt-2 space-y-3.5">
                    {/* Reason, uppercase eyebrow label with red asterisk
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
                        label="Notify On Hold"
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
                        className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 hover:border-slate-400 hover:bg-slate-50/60 transition-colors cursor-pointer"
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
                  </AccordionContent>
                </AccordionItem>
                )}

                {/* Section 4: Exception — invoice-only, hidden in RMA mode */}
                {!isRma && (
                <AccordionItem
                  value="exception"
                  id="exception-section"
                  className={`border rounded-lg bg-white px-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden ${
                    exceptionTypeError || exceptionDescriptionError ? 'border-red-300 ring-2 ring-red-100' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between w-full group">
                    <AccordionTrigger className="hover:no-underline py-2.5 flex-1 [&>svg]:hidden">
                      <div className="flex items-center gap-2">
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
                              Flag an issue on this invoice, like a quantity or price mismatch, so it can be submitted without posting.
                            </p>
                            <p className="text-[11px] text-slate-500 leading-snug mt-1.5">
                              <span className="text-slate-700" style={{ fontWeight: 600 }}>Example: </span>the PO was for 100 units but the vendor billed for 120, so submit it flagged for AP to investigate before it posts.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </AccordionTrigger>
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
                      className="scale-90"
                    />
                  </div>
                  <AccordionContent className="pb-4 pt-2 space-y-3.5">
                    {/* Type + description, uppercase eyebrow labels with
                        a red asterisk to flag required. */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                        Type
                        <span style={{ color: '#DC2626' }}>*</span>
                      </Label>
                      {/* Multi-select, an invoice can carry several
                          exception reasons at once, so the user ticks one or
                          more from the dropdown. */}
                      <Popover>
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
                          {EXCEPTION_TYPE_OPTIONS.map((opt) => {
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
                        label="Notify On Exception"
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
                        className="w-full flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 hover:border-slate-400 hover:bg-slate-50/60 transition-colors cursor-pointer"
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
                  </AccordionContent>
                </AccordionItem>
                )}

                {/* Section 5: Additional charges — invoice-only, hidden in RMA mode */}
                {!isRma && (
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
                    <AdditionalChargesPanel
                      charges={additionalCharges}
                      onChange={setAdditionalCharges}
                      descriptionError={chargeDescriptionError}
                      onDescriptionErrorClear={() => setChargeDescriptionError(false)}
                      glNote={
                        isStandalone
                          ? 'Recorded as expenses on this invoice, shown on their debit lines in GL Impact.'
                          : 'Rolled into inventory costs, added to the Inventory GL account and shown on its debit line in GL Impact.'
                      }
                    />
                  </AccordionContent>
                </AccordionItem>
                )}

                {/* Section 6: Freight & Logistics — read-only carrier
                    cards inherited from the vendor's partner config + an
                    editable freight charges amount and GL account. The
                    Carrier / Shipping method / Dispatch type selects are
                    gone because those decisions live on the partner page;
                    the invoicing user just records the cost.

                    On a multi-site return this whole section IS the routing
                    decision, so it is the routing step. Everywhere else it
                    reads with the rest of the paperwork. */}
                {/* Where a return ships and how its credit settles are facts
                    about a vendor. Until one is named there is nothing here
                    but placeholders, and a card full of placeholders reads as
                    a card the user has to fill in. It waits instead. */}
                {/* The by-item route's second step: the return regrouped by
                    who is taking it back, and the one decision that needs
                    every line answered first. */}
                {/* Credit or refund, asked once per RMA. It was a stub until
                    Sept 14, which is why a new draft opened already saying
                    Replacement against a reason nothing had asked for (brief
                    8.1, 8.5), and it asked once for the whole return until the
                    cards below showed how wrong that reads with two vendors on
                    it: one RMA is one vendor, so one resolution is one answer
                    each. */}
                {isRma && activeStep === 'resolution' && (
                  <ReturnResolutionStep
                    targets={resolutionTargets}
                    answers={resolutions}
                    showErrors={showRowErrors}
                    tags={resolutionTags}
                    onTags={(vendorCode, next) =>
                      setResolutionTags((prev) => ({ ...prev, [vendorCode]: next }))
                    }
                    files={resolutionFiles}
                    onFiles={(vendorCode, next) =>
                      setResolutionFiles((prev) => ({ ...prev, [vendorCode]: next }))
                    }
                    charges={resolutionCharges}
                    onCharges={(vendorCode, next) =>
                      setResolutionCharges((prev) => ({ ...prev, [vendorCode]: next }))
                    }
                    savedCharges={resolutionChargesSaved}
                    onSaveCharges={saveVendorCharges}
                    onDiscardCharges={(vendorCode) =>
                      setResolutionCharges((prev) => ({
                        ...prev,
                        [vendorCode]: resolutionChargesSaved[vendorCode] ?? [],
                      }))
                    }
                    onAnswer={(vendorCode, next) =>
                      setResolutions((prev) => {
                        const current = prev[vendorCode] ?? {
                          returnType: null,
                          reason: null,
                          note: '',
                        };
                        const merged = { ...current, ...next };
                        // Only where the reason genuinely implies a remedy.
                        // Failed inspection and a wrong variant do not, so
                        // their defaults were taken out of the rules (brief
                        // 8.6) and this leaves the answer blank for them.
                        if (next.reason && next.returnType === undefined) {
                          const implied = defaultReturnType(next.reason, undefined);
                          if (implied) merged.returnType = implied;
                        }
                        return { ...prev, [vendorCode]: merged };
                      })
                    }
                  />
                )}

                {/* Merge and split: the return regrouped by who is taking it
                    back, once every line has a vendor. Two branches of one
                    company travelling as one RMA, a vendor's goods coming off
                    more than one of their sites, and the split into separate
                    returns that either of those forces. */}
                {isRma && STEP1 === 'configure' && activeStep === 'routing' && (
                  <ReturnVendorStep
                    legs={stepTwoLegs}
                    // `mergeInto` + `splitMode` are what the draft builder
                    // reads when it decides which vendor a leg lands on, so
                    // the step writes to those rather than keeping a second
                    // copy of the same answer that nothing would act on.
                    merges={splitMode === 'merge' ? mergeInto : {}}
                    left={unnamedLines}
                    onMerge={(familyCode, vendorCode) => {
                      if (vendorCode === null) {
                        setMergeInto((prev) => {
                          const next = { ...prev };
                          delete next[familyCode];
                          if (Object.keys(next).length === 0) setSplitMode('split');
                          return next;
                        });
                        return;
                      }
                      setMergeInto((prev) => ({ ...prev, [familyCode]: vendorCode }));
                      setSplitMode('merge');
                    }}
                    onQty={(sku, vendorCode, qty) => {
                      const li = lineItems.find((l) => l.sku === sku);
                      if (!li) return;
                      updateLineItem(li.id, 'invoiceQty', qty);
                      const uom = li.uom ?? 'EA';
                      if (trackingModeFor(sku) === 'none') {
                        pickCountedVendor(sku, uom, qty, vendorCode);
                      }
                    }}
                    onBackToItem={(sku) => {
                      setConfigureSku(sku);
                      setActiveStep('lines');
                    }}
                  />
                )}

                {isRma && STEP1 !== 'configure' && activeStep === 'routing' && returnVendors.length === 0 && unplacedUnits.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-[#FAFBFC] px-4 py-5 flex items-start gap-2.5">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-[#E8ECF1] text-slate-300 shrink-0">
                      <Truck className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] text-slate-500" style={{ fontWeight: 600 }}>
                        {copy.logisticsSection}
                      </p>
                      <p className="text-[12px] text-slate-400 mt-0.5 leading-snug">
                        Name a vendor above and this fills in with where that return ships, who
                        carries it, and the accounts the credit settles against.
                      </p>
                    </div>
                  </div>
                )}
                {/* The section was gated on a vendor already being settled, which
                    was true while a panel above it did the settling. Now this is
                    where vendors get named, so gating it on one existing hid the
                    only place you could name one. */}
                {(!isRma || (activeStep === 'routing' && STEP1 !== 'configure' && (returnVendors.length > 0 || unplacedUnits.length > 0))) && (
                <AccordionItem
                  value="freight"
                  className={
                    isRma
                      ? 'border-0 bg-transparent px-0 shadow-none'
                      : 'border border-[#E8ECF1] rounded-2xl bg-white px-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
                  }
                >
                  {/* The cart's left column is nothing but cards: no panel round
                      them, no icon, no heading, no line of explanation. The step
                      is already titled, and a card that names the part it is
                      about does not need a section telling it so. */}
                  <AccordionTrigger className={`hover:no-underline py-3 group ${isRma ? 'hidden' : ''}`}>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 shrink-0">
                        <Truck className="w-3.5 h-3.5 text-amber-700" />
                      </span>
                      <div className="text-left">
                        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>{copy.logisticsSection}</p>
                        <p className="text-[11px] text-slate-500 mt-px" style={{ fontWeight: 400 }}>
                          {isRma
                            ? 'What each RMA covers, where it ships, and how the credit settles.'
                            : 'Freight terms for this invoice.'}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className={isRma ? 'pb-0 pt-0 space-y-3' : 'pb-4 pt-2 space-y-3'}>
                    {/* Return ship-to — opens the PO detail page's partner /
                        location picker, so a return is addressed off the same
                        catalogue a purchase order ships to. A return drawn from
                        one vendor site is one shipment, and it states that
                        shipment the way a multi-site return states each of
                        its own: where it goes and who carries it in one card. */}
                    {/* The overall Return Logistics block is gone. It offered one
                        destination, one carrier, one pay-to and one authorisation
                        number for a return that ships in as many boxes as it has
                        vendors -- and once each vendor carried its own, this
                        stated the same facts a second time and wrongly. Those
                        facts live on the vendor now, and a vendor is one click
                        away on the card that names it. */}

                    {/* Multi-site return — the destination is a decision before
                        it is an address. Returning to each site is what the
                        receipts imply; consolidating is what the vendor asks
                        for when one address takes everything. */}
                    {/* One card per part, and inside it the vendors it goes back
                        to. The purchase-order cart groups by vendor because an
                        order has one supplier and many parts; a return is the
                        other way round, so the axes swap and everything else
                        about the card stays. */}
                    {isRma && itemCards.length > 0 && (
                      <div>
                        {/* No banner and no eyebrow. Each card carries its own
                            shortfall on its own header, beside the part it
                            belongs to -- a strip at the top repeated every one of
                            them at once and left the reader matching a part
                            number back to a card. */}
                        {/* By vendor, the cards group by vendor and list parts.
                            By item they group by part and list vendors. Each
                            route ends in the shape it came in through. */}
                        {startMode === 'vendor' ? (
                          <div className="flex flex-col gap-4">
                            {vendorLegs.map((leg) => {
                              const rows = leg.rows.map((r) => ({
                                key: r.key,
                                sku: r.sku,
                                description: r.description,
                                uom: r.uom,
                                qty: r.qty,
                                cap: r.cap,
                                locked: r.locked,
                                trackingMode: trackingModeFor(r.sku),
                                unitPrice: lineItems.find((x) => x.sku === r.sku)?.unitPrice ?? 0,
                                // Anyone else who shipped this item. From a
                                // vendor's card the excess has to leave the
                                // card, so the targets come from the item's own
                                // suppliers rather than from this vendor's rows.
                                moveTargets: vendorsForItem(r.sku)
                                  .filter((o) => o.vendorCode !== leg.vendorCode)
                                  .slice(0, MAX_VENDORS_PER_PART)
                                  .map((o) => ({ code: o.vendorCode, name: o.vendorName, cap: o.returnableQty })),
                              }));
                              return (
                                <ReturnVendorGroupCard
                                  key={leg.vendorCode}
                                  vendorName={leg.vendorName}
                                  rows={rows}
                                  value={rows.reduce((n, r) => n + r.qty * r.unitPrice, 0)}
                                  collapsed={!!collapsedLegs[leg.vendorCode]}
                                  onToggleCollapse={() =>
                                    setCollapsedLegs((prev) => ({ ...prev, [leg.vendorCode]: !prev[leg.vendorCode] }))
                                  }
                                  onQty={writeLegQty}
                                  onMoveBalance={(sku, toVendorCode) => {
                                    const row = rows.find((rw) => rw.sku === sku);
                                    if (!row) return;
                                    const excess = Math.round((row.qty - row.cap) * 100) / 100;
                                    if (excess <= 0) return;
                                    const line = resolutionLines.find((l) => l.sku === sku);
                                    if (!line) return;
                                    const next = { ...vendorSplitFor(line) };
                                    next[leg.vendorCode] = row.cap;
                                    next[toVendorCode] = Math.round(((next[toVendorCode] ?? 0) + excess) * 100) / 100;
                                    setVendorAllocations((prev) => ({ ...prev, [line.key]: next }));
                                    setExtraVendors((prev) =>
                                      prev.includes(toVendorCode) ? prev : [...prev, toVendorCode],
                                    );
                                  }}
                                  onPickSerials={(sku) => {
                                    const line = lineItems.find((li) => li.sku === sku);
                                    if (!line) return;
                                    setSerialModalVendor(leg.vendorCode);
                                    setSerialModalLineId(line.id);
                                  }}
                                  onEditRow={(sku) => {
                                    const line = lineItems.find((li) => li.sku === sku);
                                    if (!line) return;
                                    setFocusedLineId(line.id);
                                    setVendorSheetCode(leg.vendorCode);
                                    setLineDetailOpen(true);
                                  }}
                                  // The same modal the first step opens, over
                                  // the step rather than back at it: adding a
                                  // second item to a vendor is the same act as
                                  // adding the first.
                                  onAddItems={() => setAddItemsVendor(leg.vendorCode)}
                                />
                              );
                            })}
                          </div>
                        ) : (
                        // One rail, one answer. The column of cards is gone:
                        // every card repeated the same header, and the part
                        // being worked on was as likely to be below the fold
                        // as on screen.
                        <ReturnResolvePane
                          items={resolveRail}
                          selected={resolveCard?.line.sku ?? null}
                          onSelect={setResolveSku}
                          layout={STEP2 === 'checklist' ? 'single' : 'two-column'}
                          // The rest of the line -- reason, remedy, notes,
                          // files -- is the first step's sheet, and it opens
                          // from the item rather than being repeated here.
                          onOpenLine={(sku) => {
                            const line = lineItems.find((li) => li.sku === sku);
                            if (!line) return;
                            setFocusedLineId(line.id);
                            setLineDetailOpen(true);
                          }}
                        >
                          {(resolveCard ? [resolveCard] : []).map((card) =>
                            // One checklist of the deliveries the units came
                            // off, whatever the part is tracked by. Ticking a
                            // row names the vendor, so the vendor is never
                            // asked for -- which is what let a counted part
                            // and a serialized one become the same screen.
                            STEP2 === 'checklist' && !isLotMode(trackingModeFor(card.line.sku)) ? (
                              <ReturnSourceChecklist
                                key={card.line.key}
                                uom={card.line.uom}
                                qty={card.line.qty}
                                trackingMode={trackingModeFor(card.line.sku)}
                                sources={checklistSources(card.line)}
                                untied={untiedFor(card.line)}
                                onToggle={(grn, on) => {
                                  if (trackingModeFor(card.line.sku) === 'serialized') {
                                    // A serialized row is ticked by naming its
                                    // units, so the checkbox is shorthand for
                                    // taking as many of them as the return
                                    // still has room for.
                                    const line = lineItems.find((li) => li.sku === card.line.sku);
                                    if (!line) return;
                                    const pool = serialPoolFor(card.line.sku, grn);
                                    const kept = (lineSerials[line.id] ?? []).filter(
                                      (sn) => !pool.includes(sn),
                                    );
                                    if (!on) {
                                      setSerialsForLine(line, kept, true);
                                      return;
                                    }
                                    const room = Math.max(0, Math.round((card.line.qty - kept.length) * 100) / 100);
                                    setSerialsForLine(line, [...kept, ...pool.slice(0, room)], true);
                                    return;
                                  }
                                  const chosen = new Set(
                                    checklistSources(card.line)
                                      .filter((sc) => sc.taken > 0)
                                      .map((sc) => sc.grnNumber),
                                  );
                                  if (on) chosen.add(grn);
                                  else chosen.delete(grn);
                                  applySources(card.line, chosen);
                                }}
                                onToggleAll={(on) => {
                                  if (trackingModeFor(card.line.sku) === 'serialized') {
                                    const line = lineItems.find((li) => li.sku === card.line.sku);
                                    if (!line) return;
                                    if (!on) {
                                      setSerialsForLine(line, [], true);
                                      return;
                                    }
                                    const all = checklistSources(card.line).flatMap((sc) =>
                                      serialPoolFor(card.line.sku, sc.grnNumber),
                                    );
                                    setSerialsForLine(line, all.slice(0, card.line.qty), true);
                                    return;
                                  }
                                  applySources(
                                    card.line,
                                    on
                                      ? new Set(
                                          allDeliveries(card.line.sku, card.line.uom).map((d) => d.grnNumber),
                                        )
                                      : new Set(),
                                  );
                                }}
                                onOpenUnits={() => {
                                  const line = lineItems.find((li) => li.sku === card.line.sku);
                                  if (!line) return;
                                  setSerialModalVendor(null);
                                  setSerialModalLineId(line.id);
                                }}
                                onUntied={(next) => setUntied(card.line, next)}
                                footer={
                                  trackingModeFor(card.line.sku) === 'serialized' ? (
                                    <p className="text-[11px] text-slate-500">
                                      Nothing to choose here: the unit carries its vendor and the
                                      document it arrived on.
                                    </p>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="min-w-0 truncate text-[11px] text-slate-500">
                                        {card.rows.some((r) => r.qty > 0)
                                          ? `Goes back to ${card.rows
                                              .filter((r) => r.qty > 0)
                                              .map((r) => r.vendorName)
                                              .join(', ')}`
                                          : 'Nothing ticked yet, so nobody is named.'}
                                      </p>
                                      {/* The exception the checklist cannot
                                          answer: a part going back to someone
                                          whose paperwork it never came in on. */}
                                      <VendorPicker
                                        sku={card.line.sku}
                                        uom={card.line.uom}
                                        candidates={resolveCandidates(card.line)}
                                        label={
                                          card.rows.some((r) => r.qty > 0)
                                            ? 'Send it elsewhere'
                                            : 'Choose a vendor'
                                        }
                                        onCreate={(vendorName) => {
                                          const existing = [...mockVendors, ...adHocVendors].find(
                                            (v) => v.vendorName.toLowerCase() === vendorName.toLowerCase(),
                                          );
                                          if (existing) return existing.vendorCode;
                                          const vendorCode = `NEW-${String(adHocVendors.length + 1).padStart(3, '0')}`;
                                          setAdHocVendors((prev) => [...prev, { vendorCode, vendorName }]);
                                          return vendorCode;
                                        }}
                                        onPick={(vendorCode) => {
                                          // Named by hand rather than read off
                                          // a document, so there is nothing for
                                          // the credit to unwind.
                                          allocateVendor(card.line.key, vendorCode, card.line.qty);
                                          setExtraVendors((p) =>
                                            p.includes(vendorCode) ? p : [...p, vendorCode],
                                          );
                                          setItemTies((prev) => ({
                                            ...prev,
                                            [card.line.sku]: { [vendorCode]: { ties: {}, untied: true } },
                                          }));
                                        }}
                                      />
                                    </div>
                                  )
                                }
                              />
                            ) : trackingModeFor(card.line.sku) === 'none' ? (
                              <ReturnResolveItemCard
                                key={card.line.key}
                                sku={card.line.sku}
                                uom={card.line.uom}
                                unitPrice={lineItems.find((l) => l.sku === card.line.sku)?.unitPrice ?? 0}
                                qty={card.line.qty}
                                candidates={resolveCandidates(card.line)}
                                shares={card.rows.map((row) => ({
                                  vendorCode: row.vendorCode,
                                  vendorName: row.vendorName,
                                  qty: row.qty,
                                  cap: row.cap,
                                  shipped: row.shipped !== false,
                                  receivers: receiversInUom(
                                    card.line.sku,
                                    row.vendorCode,
                                    card.line.uom,
                                  ),
                                  // Branches of the same company that
                                  // delivered this part and are not on the
                                  // return yet. A share stuck against one
                                  // branch's ceiling is usually a share the
                                  // branch next door can finish.
                                  siblings: (() => {
                                    const family = mockVendors.find(
                                      (v) => v.vendorCode === row.vendorCode,
                                    )?.familyCode;
                                    if (!family) return [];
                                    const taken = new Set(card.rows.map((r) => r.vendorCode));
                                    return vendorsForItem(card.line.sku)
                                      .filter(
                                        (o) =>
                                          !taken.has(o.vendorCode) &&
                                          mockVendors.find((v) => v.vendorCode === o.vendorCode)
                                            ?.familyCode === family,
                                      )
                                      .map((o) => ({
                                        vendorCode: o.vendorCode,
                                        vendorName: o.vendorName,
                                        lifetime: o.returnableQty,
                                      }));
                                  })(),
                                  ties: itemTies[lineKey(card.line.sku, card.line.uom)]?.[row.vendorCode]?.ties ?? {},
                                  untied: itemTies[lineKey(card.line.sku, card.line.uom)]?.[row.vendorCode]?.untied ?? false,
                                }))}
                                onQty={(vendorCode, n) => {
                                  allocateVendor(card.line.key, vendorCode, n);
                                  // The ties were laid across the old figure.
                                  // Leaving them meant a share of 40 still
                                  // claiming to unwind 300.
                                  const current = itemTies[lineKey(card.line.sku, card.line.uom)]?.[vendorCode]?.ties ?? {};
                                  const chosen = new Set(
                                    Object.keys(current).filter((g) => (current[g] ?? 0) > 0),
                                  );
                                  setTieChosen(card.line.sku, vendorCode, n, card.line.uom, chosen);
                                }}
                                onAddVendor={(vendorCode) => {
                                  // What is unplaced goes to them, but never more
                                  // than they ever delivered: a vendor credits
                                  // what they sold, so handing them the whole
                                  // return opened the row already over its own
                                  // ceiling. What is left over stays visible as
                                  // unplaced, which is the prompt to split it.
                                  // A vendor who has delivered the part is
                                  // bounded by what they delivered. One who
                                  // has not is bounded by nothing of theirs,
                                  // so the return's own count is the ceiling.
                                  const ceiling = vendorsForItem(card.line.sku)
                                    .find((o) => o.vendorCode === vendorCode)?.returnableQty ?? card.line.qty;
                                  const next = { ...vendorSplitFor(card.line) };
                                  let give = Math.min(Math.max(card.spare, 0), ceiling);
                                  if (give <= 0) {
                                    // Nothing spare, so adding a vendor is a
                                    // split: the biggest holder gives up half.
                                    const biggest = Object.entries(next)
                                      .filter(([code]) => code !== vendorCode)
                                      .sort((a, b) => b[1] - a[1])[0];
                                    if (biggest) {
                                      const moved = Math.min(ceiling, Math.floor(biggest[1] / 2));
                                      if (moved > 0) {
                                        allocateVendor(card.line.key, biggest[0], biggest[1] - moved);
                                        give = moved;
                                      }
                                    }
                                  }
                                  allocateVendor(card.line.key, vendorCode, give);
                                  setExtraVendors((p) => (p.includes(vendorCode) ? p : [...p, vendorCode]));
                                  setItemTies((prev) => ({
                                    ...prev,
                                    [card.line.sku]: {
                                      ...(prev[card.line.sku] ?? {}),
                                      [vendorCode]: {
                                        ties: defaultTies(card.line.sku, vendorCode, give, card.line.uom),
                                        untied: false,
                                      },
                                    },
                                  }));
                                }}
                                onCreateVendor={(vendorName) => {
                                  // Filed against the return rather than the
                                  // master: this is a prototype's stand-in for
                                  // the vendor record somebody creates in
                                  // purchasing, and it exists so the return
                                  // can name a partner the system has never
                                  // dealt with.
                                  const existing = [...mockVendors, ...adHocVendors].find(
                                    (v) => v.vendorName.toLowerCase() === vendorName.toLowerCase(),
                                  );
                                  if (existing) return existing.vendorCode;
                                  const vendorCode = `NEW-${String(adHocVendors.length + 1).padStart(3, '0')}`;
                                  setAdHocVendors((prev) => [...prev, { vendorCode, vendorName }]);
                                  return vendorCode;
                                }}
                                onRemoveVendor={(vendorCode) => {
                                  allocateVendor(card.line.key, vendorCode, 0);
                                  setItemTies((prev) => {
                                    const forSku = { ...(prev[card.line.sku] ?? {}) };
                                    delete forSku[vendorCode];
                                    return { ...prev, [card.line.sku]: forSku };
                                  });
                                }}
                                // Which documents, not how much of each. The
                                // share is laid across whatever is chosen, so
                                // removing one draws on the next rather than
                                // leaving the credit short.
                                onToggleTie={(vendorCode, grnNumber, on) => {
                                  const share = vendorSplitFor(card.line)[vendorCode] ?? 0;
                                  const current = itemTies[lineKey(card.line.sku, card.line.uom)]?.[vendorCode]?.ties ?? {};
                                  const chosen = new Set(
                                    Object.keys(current).filter((g) => (current[g] ?? 0) > 0),
                                  );
                                  if (on) chosen.add(grnNumber);
                                  else chosen.delete(grnNumber);
                                  setTieChosen(card.line.sku, vendorCode, share, card.line.uom, chosen);
                                }}
                                onUntied={(vendorCode, next) =>
                                  setItemTies((prev) => {
                                    const forSku = prev[card.line.sku] ?? {};
                                    const entry = forSku[vendorCode] ?? { ties: {}, untied: false };
                                    return {
                                      ...prev,
                                      [card.line.sku]: {
                                        ...forSku,
                                        [vendorCode]: { ties: next ? {} : entry.ties, untied: next },
                                      },
                                    };
                                  })
                                }
                              />
                            ) : trackingModeFor(card.line.sku) === 'serialized' ? (
                              <ReturnSerialResolve
                                key={card.line.key}
                                sku={card.line.sku}
                                uom={card.line.uom}
                                qty={card.line.qty}
                                unitPrice={lineItems.find((l) => l.sku === card.line.sku)?.unitPrice ?? 0}
                                origins={serialOriginsFor(card.line.sku)}
                                onPickUnits={() => {
                                  const line = lineItems.find((li) => li.sku === card.line.sku);
                                  if (!line) return;
                                  setSerialModalVendor(null);
                                  setSerialModalLineId(line.id);
                                }}
                              />
                            ) : (
                            <ReturnItemCard
                              key={card.line.key}
                              sku={card.line.sku}
                              description={card.line.description}
                              uom={card.line.uom}
                              trackingMode={trackingModeFor(card.line.sku)}
                              {...(card.line.unsourced ? { unsourced: true } : {})}
                              lineQty={card.line.qty}
                              rows={card.rows}
                              addable={card.addable}
                              collapsed={!!collapsedItems[card.line.key]}
                              onToggleCollapse={() =>
                                setCollapsedItems((prev) => ({ ...prev, [card.line.key]: !prev[card.line.key] }))
                              }
                              onQty={(vendorCode, qty) => allocateVendor(card.line.key, vendorCode, qty)}
                              // Cut the row back to what that vendor shipped and
                              // give the rest to another. The receiving vendor
                              // may then be over its own ceiling, which the card
                              // says on its row -- the arithmetic does not hide
                              // and the user keeps moving until it balances.
                              onMoveBalance={(fromVendorCode, toVendorCode) => {
                                const from = card.rows.find((rw) => rw.vendorCode === fromVendorCode);
                                if (!from) return;
                                const excess = Math.round((from.qty - from.cap) * 100) / 100;
                                if (excess <= 0) return;
                                const next = { ...vendorSplitFor(card.line) };
                                next[fromVendorCode] = from.cap;
                                next[toVendorCode] = Math.round(((next[toVendorCode] ?? 0) + excess) * 100) / 100;
                                setVendorAllocations((prev) => ({ ...prev, [card.line.key]: next }));
                                setExtraVendors((prev) =>
                                  prev.includes(toVendorCode) ? prev : [...prev, toVendorCode],
                                );
                              }}
                              onAddVendor={(vendorCode) => {
                                const option = card.line.options.find((o) => o.vendorCode === vendorCode);
                                // Nobody shipped an unsourced part, so no
                                // supplier record sets a ceiling for it. What
                                // bounds it is the stock: reading the ceiling
                                // off an option that does not exist yet gave
                                // every newly named vendor nothing to hold, so
                                // choosing one appeared to do nothing.
                                const ceiling = card.line.unsourced
                                  ? card.line.qty
                                  : option?.returnableQty ?? 0;
                                // Whatever is unplaced goes to them. If nothing is
                                // -- the usual case, since every part arrives
                                // fully placed -- adding a second vendor is a
                                // split, so the biggest holder gives up half. It
                                // has to move something: a row that cannot accept
                                // a unit until you go and free one elsewhere is a
                                // dead end dressed as a choice.
                                let give = Math.min(ceiling, card.spare);
                                const next = { ...vendorSplitFor(card.line) };
                                if (give <= 0) {
                                  const biggest = Object.entries(next)
                                    .filter(([code]) => code !== vendorCode)
                                    .sort((a, b) => b[1] - a[1])[0];
                                  if (biggest) {
                                    const moved = Math.min(ceiling, Math.floor(biggest[1] / 2));
                                    if (moved > 0) {
                                      next[biggest[0]] = biggest[1] - moved;
                                      give = moved;
                                    }
                                  }
                                }
                                next[vendorCode] = give;
                                setVendorAllocations((prev) => ({ ...prev, [card.line.key]: next }));
                                setExtraVendors((prev) =>
                                  prev.includes(vendorCode) ? prev : [...prev, vendorCode],
                                );
                              }}
                              onOpenVendor={(vendorCode) => {
                                const line = lineItems.find((li) => li.sku === card.line.sku);
                                if (!line) return;
                                setFocusedLineId(line.id);
                                setVendorSheetCode(vendorCode);
                                setLineDetailOpen(true);
                              }}
                              onOpenSerials={(vendorCode) => {
                                const line = lineItems.find((li) => li.sku === card.line.sku);
                                if (!line) return;
                                setSerialModalVendor(vendorCode);
                                setSerialModalLineId(line.id);
                              }}
                              onOpenLine={() => {
                                const line = lineItems.find((li) => li.sku === card.line.sku);
                                if (!line) return;
                                setFocusedLineId(line.id);
                                setLineDetailOpen(true);
                              }}
                            />
                            ),
                          )}
                        </ReturnResolvePane>
                        )}
                      </div>
                    )}

                    {/* Carrier — inherited from the vendor profile but
                        changeable per invoice, mirroring Payment Terms. The
                        "Change" link opens the Browse Carriers modal; the
                        summary below is the partner-style carrier card.

                        Sits directly under the destination because both are
                        read off the vendor's partner record, so the two
                        inherited values are checked together before the notes
                        the user writes themselves. */}
                    {/* One shipment means one carrier, so on a return the
                        choice lives on the shipment row in the destination
                        card above rather than as a field of its own down here.
                        Only the picker those rows open remains. */}
                    {isMultiOrigin && returnRouting === 'origin' ? (
                      <CarrierBrowseModal
                        open={carrierPickerForOrigin !== null}
                        onOpenChange={(v) => { if (!v) setCarrierPickerForOrigin(null); }}
                        title={copy.logisticsSection}
                        subtitle="Choose a carrier for this shipment"
                        entityNoun="shipment"
                        selectedId={carrierPickerForOrigin ? originCarrierId[carrierPickerForOrigin] ?? null : null}
                        vendorDefaultCarrierId={
                          carrierPickerForOrigin
                            ? defaultCarrierForOrigin(
                                returnOrigins.find((o) => o.id === carrierPickerForOrigin) ?? { id: '', name: '' },
                              )?.id ?? null
                            : null
                        }
                        onApply={(c) => {
                          setOriginCarrierId((prev) =>
                            carrierPickerForOrigin ? { ...prev, [carrierPickerForOrigin]: c.id } : prev,
                          );
                          setCarrierPickerForOrigin(null);
                        }}
                      />
                    ) : selectedCarrier && !isMultiOrigin && !isRma ? (
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Carrier</Label>
                        {/* Same one-line row a return's shipments use, with the
                            full card a hover away. */}
                        <HoverCard openDelay={200} closeDelay={120}>
                          <HoverCardTrigger asChild>
                            <div className="group/carrier flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                              <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                              <p className="text-[10px] text-slate-500 truncate min-w-0 flex-1" style={{ fontWeight: 500 }}>
                                {selectedCarrier.name}
                                {selectedCarrier.id !== vendorDefaultCarrierId && (
                                  <span className="text-amber-700"> · Changed</span>
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setCarrierDraftId(selectedCarrier.id);
                                  setCarrierModalOpen(true);
                                }}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 transition-all shrink-0 cursor-pointer opacity-0 group-hover/carrier:opacity-100 focus-visible:opacity-100"
                                aria-label="Change carrier"
                                title="Change carrier"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent side="left" align="start" className="w-[340px] p-2 space-y-1.5">
                            <CarrierCard
                              carrier={selectedCarrier}
                              isSelected
                              hideCheckmark
                              readOnly
                              showStatusBadge
                              entityNoun={isRma ? "return" : "invoice"}
                            />
                            {/* Name the vendor: the carrier resolves from the
                                partner profile, so a vendor change moves it. */}
                            <div className="flex items-start gap-1.5 px-1 pb-0.5">
                              {selectedCarrier.id === vendorDefaultCarrierId ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-px" />
                              ) : (
                                <Edit3 className="w-3 h-3 text-slate-400 shrink-0 mt-px" />
                              )}
                              <span className="text-[10px] text-slate-500 leading-snug" style={{ fontWeight: 500 }}>
                                {selectedCarrier.id === vendorDefaultCarrierId ? (
                                  <>Inherited from <span style={{ fontWeight: 600 }}>{vendorName}</span>'s partner profile.</>
                                ) : (
                                  copy.carrierOverriddenNote
                                )}
                              </span>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </div>
                    ) : null}

                    {/* Packing and dock notes are the one logistics field the
                        user writes rather than inherits, so they read after the
                        destination and carrier. Same ExpandableTextarea as
                        Description. */}

                    {/* Editable freight cost — the per-invoice value.
                        Hidden on RMAs at Areeb's request; unhide by dropping
                        the !isRma guard here and on the note below. */}
                    {!isRma && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Freight Charges</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]" style={{ fontWeight: 500 }}>$</span>
                        <Input
                          type="number"
                          value={freightAmount || ''}
                          onChange={(e) => setFreightAmount(Number(e.target.value))}
                          className="pl-6 h-9 bg-white border-slate-200 text-[12px] tabular-nums shadow-none text-right pr-2.5 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
                          style={{ fontWeight: 500 }}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    )}

                    {/* No freight GL to map — for inventory invoices freight
                        is capitalised into the inventory value (ASC 330), so
                        it rolls into the Inventory GL account and shows on the
                        Inventory debit line in GL Impact. Standalone invoices
                        have no inventory, so freight is expensed instead. */}
                    {!isRma && (
                    <div className="pt-2.5 mt-1 border-t border-slate-100 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-[10px] text-slate-500 leading-tight" style={{ fontWeight: 500 }}>
                        {isStandalone
                          ? 'Recorded as a freight expense on this invoice, shown on its debit line in GL Impact.'
                          : 'Rolled into inventory costs, added to the Inventory GL account and shown on its debit line in GL Impact.'}
                      </span>
                    </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
                )}

                {/* Payment — ported from the Record Payment flow's card of
                    the same name so account selection reads identically on
                    both surfaces. */}
                
                {/* The vendor's RMA number, the resolution date and the
                    description are all optional and mostly filled in later,
                    so they sit below Return Logistics and start collapsed. */}
                
                {/* GL impact — placed just above Attachments so the
                    journal preview sits at the tail of the sidebar
                    (after all sources that contribute Dr/Cr rows have
                    been configured above). Invoice-only; a return posts
                    nothing until the goods ship, so RMA mode shows its
                    journal on the detail page instead. */}
                {!isRma && (
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
                    {(() => {
                      // Aggregate Dr rows from every GL source the invoice
                      // touches: line items (grouped by their glAccount),
                      // freight (single row if amount > 0), and each
                      // non-zero additional charge. Single Cr row = the
                      // A/P account for the invoice total. The BALANCED
                      // strip reads `Debit = Credit` and verifies the
                      // running sums match.
                      const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      const drMap = new Map<string, number>();
                      if (isStandalone) {
                        // Standalone: each line expenses to the GL account the
                        // user picks at the line-item level (a line is skipped
                        // until its account is chosen). Freight + charges
                        // expense to their default GL accounts — there's no
                        // inventory to capitalise into.
                        standaloneItems.forEach((it) => {
                          if (it.amount > 0 && it.glAccount) {
                            drMap.set(it.glAccount, (drMap.get(it.glAccount) || 0) + it.amount);
                          }
                        });
                        if (freightAmount > 0) drMap.set(DEFAULT_FREIGHT_GL_ACCOUNT, (drMap.get(DEFAULT_FREIGHT_GL_ACCOUNT) || 0) + freightAmount);
                        if (additionalChargesTotal > 0) drMap.set(DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT, (drMap.get(DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT) || 0) + additionalChargesTotal);
                      } else {
                        lineItems.forEach((li) => {
                          drMap.set(li.glAccount, (drMap.get(li.glAccount) || 0) + li.lineTotal);
                        });
                        // Freight + additional charges are capitalised into
                        // inventory (ASC 330): roll them into the line items'
                        // inventory account so they land on the Inventory debit
                        // line, not separate freight / charge GL rows.
                        const capitalised = freightAmount + additionalChargesTotal;
                        if (capitalised > 0) {
                          const inventoryAccount = lineItems[0]?.glAccount || '1200 Inventory';
                          drMap.set(inventoryAccount, (drMap.get(inventoryAccount) || 0) + capitalised);
                        }
                      }
                      const drRows = Array.from(drMap.entries()).map(([account, amount]) => ({
                        code: account.split(' ')[0],
                        name: account.substring(account.split(' ')[0].length + 1),
                        amount,
                      }));
                      // Fallback: when nothing maps to a debit yet we still
                      // show a Dr placeholder so the panel has shape. Inventory
                      // invoices default to Inventory; standalone invoices
                      // prompt the user to pick a GL account per line.
                      if (drRows.length === 0) {
                        drRows.push(isStandalone
                          ? { code: ', ', name: 'Select a GL account on each line', amount: 0 }
                          : { code: '1200', name: 'Inventory', amount: 0 });
                      }
                      const drTotal = drRows.reduce((s, r) => s + r.amount, 0);
                      const apCode = apAccount.split(' ')[0];
                      const apName = apAccount.substring(apCode.length + 1);
                      const isBalanced = Math.abs(drTotal - total) < 0.01;
                      return (
                        <div className="border-t border-border bg-white">
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
                                      DEBIT
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px]">
                                    <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Debit (Dr)</p>
                                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Increases an asset or expense account. Inventory you receive lands on the debit side because the company now owns more stock.</p>
                                  </TooltipContent>
                                </Tooltip>
                                <span className="text-[10px] text-slate-400 tabular-nums font-mono shrink-0" style={{ fontWeight: 500 }}>
                                  {row.code}
                                </span>
                                <span className="text-[12px] text-foreground flex-1 truncate" style={{ fontWeight: 500 }}>
                                  {row.name}
                                </span>
                                <span className="text-[12px] text-foreground tabular-nums shrink-0" style={{ fontWeight: 600 }}>
                                  ${fmt(row.amount)}
                                </span>
                              </div>
                              <div className="h-px bg-border/60 mx-3.5" />
                            </div>
                          ))}

                          {/* Credit row — single, equal to invoice total */}
                          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="inline-flex items-center px-1.5 h-[18px] rounded-md text-[10px] tracking-wide cursor-help"
                                  style={{ fontWeight: 700, backgroundColor: '#F1F5F9', color: '#475569' }}
                                >
                                  CREDIT
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[240px]">
                                <p className="text-[11px] text-foreground" style={{ fontWeight: 600 }}>Credit (Cr)</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Increases a liability, equity, or revenue account. The invoice creates a payable to the vendor, so the offset lands on the credit side.</p>
                              </TooltipContent>
                            </Tooltip>
                            <span className="text-[10px] text-slate-400 tabular-nums font-mono shrink-0" style={{ fontWeight: 500 }}>
                              {apCode}
                            </span>
                            <span className="text-[12px] text-foreground flex-1 truncate" style={{ fontWeight: 500 }}>
                              {apName}
                            </span>
                            <span className="text-[12px] text-foreground tabular-nums shrink-0" style={{ fontWeight: 600 }}>
                              ${fmt(total)}
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
                                {isBalanced ? 'BALANCED' : 'OUT OF BALANCE'}
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
                )}

                {/* Section 7: Attachments (Notes section removed) */}
                              </Accordion>
              </div>

              {/* Sticky decision column. On the routing step it carries the
                  choice itself, so the options stay in view while the
                  shipments they describe scroll beside them. On the last
                  step the same slot summarises what is about to be created,
                  which is the only place the return reads as a whole. */}
              {/* On the resolving step there is no rail. It answered a
                  question this step does not ask -- how many documents the
                  return becomes -- which is settled by what the step decides
                  and belongs with the confirmation, not beside the work. */}
              {isRma &&
                activeStep !== 'routing' &&
                activeStep !== 'resolution' &&
                // Nor on the vendor step. Every figure on it reads a dash or a
                // zero before anything is picked, which is a panel telling the
                // user that the work they have not done yet is not done.
                activeStep !== 'partner' && (
                <aside className="lg:sticky lg:self-start" style={{ top: 16 }}>
                  <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <div className="px-4 py-3 flex items-center gap-2.5">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#DBEAFE] border border-blue-200 text-primary shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          Return summary
                        </p>
                        <p className="text-[11px] text-slate-500 mt-px" style={{ fontWeight: 400 }}>
                          What saving this draft will create
                        </p>
                      </div>
                    </div>

                    {/* The vendor split is not a preference. An RMA is raised
                        against one vendor and settles against that vendor's
                        orders, so goods from two of them are two returns --
                        offering to merge them was offering something the
                        accounting cannot honour. The split is stated here, not
                        asked. Where the goods go inside a vendor's own sites
                        stays editable further down. */}
                    {/* The count and the vendor list moved into the grouping
                        panel below, where the count is actually decided. Stating
                        it here as well meant two places claiming the same
                        number, and only one of them could still be right after
                        the user answered. */}
                    {(
                      <div className="p-4 flex flex-col gap-2.5">
                        {[
                          { label: 'Vendor', value: isRma && returnVendors.length === 0 ? '—' : vendorName },
                          { label: 'Lines returning', value: `${returnableLines.length}` },
                          {
                            label: returnLegs.length > 1 ? 'Shipments' : 'Destination',
                            value:
                              returnLegs.length > 1
                                ? `${returnLegs.length}`
                                : isRma && returnVendors.length === 0
                                  ? '—'
                                  : shipToName,
                          },
                          { label: copy.totalLabel, value: `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
                        ].map((row) => (
                          <div key={row.label} className="flex items-baseline justify-between gap-3">
                            <span className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>{row.label}</span>
                            <span className="text-[12px] text-foreground text-right truncate tabular-nums" style={{ fontWeight: 600 }}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* The rail carried one small block and a column of empty
                        white. The invoicing workspace puts the running totals
                        under its sidebar for exactly this reason: the panel
                        that states the shape of the thing should also state
                        its size. */}
                    {/* The cart states its money as a per-partner breakdown and
                        one escalated total, which is the right shape here: this
                        return is several returns, and a single figure hid that.
                        The rail's old block also restated a destination that now
                        belongs to each card. */}
                  </div>
                </aside>
              )}
              </div>

              <div className="h-10" />
            </div>
            )}

            {/* Why the step will not advance — an edge-to-edge band above the
                footer, the same slot the shipment wizard uses, so the reason
                sits between the work and the control that is refusing rather
                than arriving as a toast the user has to catch. */}
            {/* Why Continue did not move, said once the user has pressed it.
                The jump and the lit row answer where the problem is, and on a
                step holding a single line they answer it by lighting the row
                that was already lit -- which reads as a dead button. So the
                reason comes back in words too, in the slot between the work
                and the control that is refusing, and only after the press
                that asked for it. */}
            {/* The step's issues, counted, right above the button that is
                being pressed against them. It used to read out the first
                blocker's sentence and say nothing about the other four, so a
                return with five lines left to answer was five Continues and
                five surprises. */}
            {showIssuesBand && (
              <div className="px-4 sm:px-5 py-2 bg-amber-50 border-t border-amber-200 shrink-0 flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-[12.5px] text-amber-800 min-w-0 truncate" style={{ fontWeight: 500 }}>
                  <span style={{ fontWeight: 700 }}>
                    {rmaIssues.length} issue{rmaIssues.length === 1 ? '' : 's'}
                  </span>{' '}
                  on this return
                  {/* On the last step there is nothing to continue to: the
                      button saves. Saying "blocks continuing" there pointed
                      at a step that does not exist. */}
                  {rmaIssues.length === 1
                    ? isFinalStep
                      ? ', it blocks saving.'
                      : ', it blocks continuing.'
                    : isFinalStep
                      ? ', they all block saving.'
                      : ', they all block continuing.'}
                </p>
                {/* One button for the whole set.
                    
                    A line whose vendor has no receipt for it has one sensible
                    answer, and answering it card by card is the same click
                    repeated. The strip offers it once, in the words of what it
                    does, and says who it is for. */}
                {unmatchedPlain.length > 0 && rmaVendorLock && (
                  <button
                    type="button"
                    onClick={resolveUnmatchedPlain}
                    className="shrink-0 inline-flex h-7 items-center gap-1.5 rounded-full bg-primary px-3 text-[12px] text-white shadow-sm transition-colors hover:bg-blue-700"
                    style={{ fontWeight: 600 }}
                  >
                    <Check className="w-3 h-3" />
                    {unmatchedPlain.length === 1
                      ? 'Set it up as an untied return for '
                      : `Set all ${unmatchedPlain.length} up as untied returns for `}
                    {mockVendors.find((v) => v.vendorCode === rmaVendorLock)?.vendorName ??
                      'this vendor'}
                  </button>
                )}
                {renderIssuesReview()}
              </div>
            )}

            <div className="px-3 sm:px-5 py-2.5 border-t border-[#EEF2F6] bg-white shrink-0 sticky bottom-0 z-10">
              {/* Total row. The collapsible subtotal breakdown that used to
                  sit above it is gone, so it no longer needs a rule to
                  separate it from anything. */}
              {/* What the return is worth follows from who takes it back and on
                  what terms, and neither is settled on the first step. Stating a
                  figure there gave a number to a question nobody had answered
                  yet, and it moved every time a quantity did. On the second step
                  the summary panel states it from what is actually placed with
                  each vendor, and this row was quoting the lines instead -- two
                  different figures side by side, the smaller one labelled as
                  the return's value. */}
              {!isRma && (
              <div className="mb-3 flex justify-between items-baseline">
                <span className="text-[12px] text-slate-500" style={{ fontWeight: 500 }}>{copy.totalLabel}</span>
                <span className="text-[20px] text-foreground tabular-nums leading-none tracking-tight" style={{ fontWeight: 700 }}>
                  ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              )}

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
                {isRma && currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] text-slate-500 hover:text-foreground transition-colors cursor-pointer mr-auto"
                    style={{ fontWeight: 500 }}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                )}
                {/* States what the step is holding, the way the reference
                    footer counts what is about to be committed. */}
                {isRma && (
                  <div
                    className={`flex items-center gap-2 text-[12px] text-slate-500 ${
                      currentStepIndex > 0 ? '' : 'mr-auto'
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {/* A line count says nothing on its own, and "ready to
                        return" said the wrong thing outright: a line can carry
                        a quantity and still have no vendor, which the panel
                        called out while the footer called it ready. So the
                        count answers the step it is standing on -- added,
                        allocated and ready are three different figures and
                        only one of them is true at a time. */}
                    {(() => {
                      // Scoped to the step. Counting every line made a step
                      // that had answered everything it asks about report
                      // "2 of 3", which reads as a failure when it is not.
                      // The vendor step counts no lines: there are none yet,
                      // and "0 lines ready to return" on a screen that has not
                      // asked about lines reads as a failure rather than a
                      // step that has not been reached.
                      if (activeStep === 'partner') {
                        return (
                          <span>
                            {lockedVendor ? (
                              <>
                                Returning to{' '}
                                <span className="text-foreground" style={{ fontWeight: 600 }}>
                                  {mockVendors.find((v) => v.vendorCode === lockedVendor)
                                    ?.vendorName ?? lockedVendor}
                                </span>
                              </>
                            ) : (
                              'Select the vendor this return settles with'
                            )}
                          </span>
                        );
                      }
                      const asks = (l: { sku: string; invoiceQty: number }) => {
                        const mode = trackingModeFor(l.sku);
                        // Past the quantity step, a line carrying no figure is
                        // not on the return. The vendor route puts the whole of
                        // a vendor's book on the rail, so twenty-nine rows with
                        // quantities on two of them is two lines going back,
                        // not twenty-nine ready to return.
                        if (activeStep !== 'lines' && l.invoiceQty <= 0) return false;
                        if (activeStep === 'units') return mode !== 'none';
                        if (activeStep === 'vendor' || activeStep === 'receivers')
                          return mode !== 'serialized';
                        return true;
                      };
                      const scoped = currentPOItems.filter(asks);
                      const total = scoped.length;
                      // Counted off the lines themselves on the first step,
                      // because the ticked-but-empty warnings are held back
                      // until Continue is pressed and the count cannot wait
                      // for them to say how many lines carry a figure.
                      const short =
                        activeStep === 'lines'
                          ? scoped.filter((l) => l.invoiceQty <= 0).length
                          : new Set(stepBlockers.filter((b) => b.sku).map((b) => b.sku)).size;
                      const done = Math.max(0, total - short);
                      const noun = total === 1 ? 'line' : 'lines';
                      // A line with nothing to tie is answered and has no
                      // document, so counting it under "with a receiving
                      // document" told the user the opposite of what the
                      // panel above it was warning them about.
                      const untiedLines = scoped.filter((l) => {
                        // Tied by its units: a serial number was on a
                        // receiver, so the line already names the documents
                        // behind it and is never untied. Counting it put
                        // "4 lines going back untied" over three.
                        if (
                          hasSerials(trackingModeFor(l.sku)) &&
                          serialOriginsFor(l.sku).some((o) => Boolean(o.grnNumber))
                        )
                          return false;
                        const entries = Object.values(
                          itemTies[lineKey(l.sku, l.uom ?? 'EA')] ?? {},
                        );
                        if (entries.some((e) => e.untied)) return true;
                        // Nothing tied and nothing to tie: a line whose unit
                        // has no receiving document behind it is untied by
                        // circumstance rather than by a switch.
                        const tied = entries.reduce(
                          (n, e) =>
                            n + Object.values(e.ties ?? {}).reduce((m, q) => m + (q as number), 0),
                          0,
                        );
                        return tied <= 0;
                      }).length;
                      const what =
                        activeStep === 'lines'
                          ? startMode === 'vendor'
                            ? 'of theirs with a quantity'
                            : 'with a quantity'
                          : activeStep === 'units'
                            ? 'with serial numbers or lots'
                            : activeStep === 'vendor'
                              ? 'with a vendor'
                              : activeStep === 'receivers'
                                ? untiedLines === 0
                                  ? 'with a receiving document'
                                  : 'going back untied'
                                : 'ready to return';
                      // The untied sentence counts untied lines, not the
                      // step's own total. A return with one line tied by its
                      // serial numbers and four sent loose read "5 lines going
                      // back untied", which is a figure nothing on the step
                      // agrees with.
                      const untiedSentence =
                        activeStep === 'receivers' && untiedLines > 0 && untiedLines < total;
                      return (
                        <span>
                          {untiedSentence ? (
                            <>
                              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{untiedLines}</span>
                              {' of '}
                              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{total}</span>{' '}
                              {noun} going back untied
                            </>
                          ) : short === 0 ? (
                            <>
                              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{total}</span>{' '}
                              {noun} {what}
                            </>
                          ) : (
                            <>
                              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{done}</span>
                              {' of '}
                              <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>{total}</span>{' '}
                              {noun} {what}
                            </>
                          )}
                        </span>
                      );
                    })()}
                  </div>
                )}
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
                    instead of disabling the CTA. A return advances the
                    wizard instead until the last step, where the same
                    submit runs. */}
                {/* The mid-flow Save as Draft is gone.
                    
                    A return saved halfway is a document with a vendor and no
                    receipts, or receipts and no resolution, and every step
                    after the one it was saved on would have to be answerable
                    later somewhere else. The flow is six steps and the last
                    one writes it. Cancel still leaves without writing
                    anything. */}
                <Button
                  onClick={isRma ? goNext : handleSubmit}
                  // All but never disabled on a return. What is missing is
                  // said in the band above and reached by pressing this:
                  // greying the button out answers a question the user has
                  // not asked yet and leaves them hunting for the reason.
                  //
                  // The one exception is an empty return. There is no row to
                  // send them to, nothing to flag, and no step after this one
                  // that could be about anything -- "press Continue to find
                  // out what is missing" is not a lesson worth teaching with
                  // a blank screen. Adding the first part is the only thing
                  // on offer, and the step says so twice already.
                  disabled={
                    isRma
                      ? (activeStep === 'lines' && currentPOItems.length === 0) ||
                        (activeStep === 'partner' && !lockedVendor)
                      : !canAdvance
                  }
                  className="bg-primary text-primary-foreground shrink-0"
                >
                  {isRma && !isFinalStep ? (
                    <>
                      Continue
                      <ChevronRight className="w-4 h-4 ml-1.5" />
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="w-4 h-4 mr-1.5" />
                      {isResubmit ? copy.resubmitLabel : copy.submitLabel}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How far a restocking fee entered on the last step reaches: this
          return, or the vendor's profile. Asked on the save, before the
          drafts are written. */}
      <RestockingFeeScopeModal
        open={feeScopeQueue.length > 0}
        onOpenChange={(next) => {
          if (next) return;
          // A close that follows a choice is the dialog tidying itself up; the
          // queue has already moved on and must not be emptied under it.
          if (feeScopeAnswering.current) {
            feeScopeAnswering.current = false;
            return;
          }
          // Backing out leaves the return unsaved on the step it was asked
          // from, which is where the fee can be changed.
          setFeeScopeQueue([]);
        }}
        vendorName={feeScopeQueue[0]?.vendorName ?? ''}
        pct={feeScopeQueue[0]?.pct ?? 0}
        amount={feeScopeQueue[0]?.amount ?? 0}
        currentPct={feeScopeQueue[0]?.currentPct}
        onChoose={answerFeeScope}
      />

      {/* Submit confirmation — fires on every submit and branches on
          which flags are toggled. Copy comes from the BA-approved
          spec (4 cases: default / Payment Hold only / Exception only /
          both). Visual treatment adapts: clean submit is primary blue,
          Payment Hold amber, Exception rose, both rose. */}
      <AlertDialog open={showSubmitWarning} onOpenChange={setShowSubmitWarning}>
        {/* Wider than the standard confirm (meeting feedback 7/17/26): the
            long-and-narrow shape scrolled badly once GL posting lines
            stack up. */}
        <AlertDialogContent
          className="sm:max-w-[680px] p-0 gap-0 overflow-hidden rounded-2xl border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
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
            const isPreInvoiceSubmit = !isStandalone && currentPOsData.length > 0 && currentPOsData.every((po) => po.isPreInvoice);
            const variant: Variant = (() => {
              if (isExceptionActive && isPaymentHoldActive) {
                return {
                  chipLabel: 'Exception + Payment Hold',
                  chipBg: '#FFF1F2', chipText: '#BE123C',
                  glowColor: '#F43F5E',
                  tileBg: '#FECDD3', tileIconColor: '#BE123C',
                  title: 'Submit with Exception and Payment Hold?',
                  howItWorks: "It's held in Exception first and won't post until that's resolved. After it clears and is approved, the Payment Hold keeps payment blocked until you release it.",
                  implications: 'Nothing posts or pays while it’s in Exception. Even once it’s resolved and approved, payment stays blocked until you release the hold.',
                  primaryLabel: 'Submit',
                  primaryBg: '#BE123C',
                };
              }
              if (isExceptionActive) {
                return {
                  chipLabel: 'Exception',
                  chipBg: '#FFF1F2', chipText: '#BE123C',
                  glowColor: '#F43F5E',
                  tileBg: '#FECDD3', tileIconColor: '#BE123C',
                  title: 'Submit with an open Exception?',
                  howItWorks: "The invoice is submitted but held in Exception. It won't move to approval until someone resolves the flagged issue.",
                  implications: 'Nothing posts to the GL and no payment can happen until the exception is resolved.',
                  primaryLabel: 'Submit with Exception',
                  primaryBg: '#BE123C',
                };
              }
              if (isPaymentHoldActive) {
                return {
                  chipLabel: 'Payment Hold',
                  chipBg: '#FFFBEB', chipText: '#92400E',
                  glowColor: '#F59E0B',
                  tileBg: '#FEF3C7', tileIconColor: '#B45309',
                  title: 'Submit with a Payment Hold?',
                  howItWorks: 'The invoice goes through approval and posts to the GL as usual. Payment stays blocked until you release the hold.',
                  implications: 'The liability is recorded on your books now, but no money goes out until the hold is released.',
                  primaryLabel: 'Submit with hold',
                  primaryBg: '#B45309',
                };
              }
              if (isPreInvoiceSubmit) {
                return {
                  chipLabel: 'Confirm submission',
                  chipBg: '#EBF3FF', chipText: '#0654BC',
                  glowColor: '#0A77FF',
                  tileBg: '#D6E8FF', tileIconColor: '#0654BC',
                  title: 'Submit this pre-invoice for approval?',
                  howItWorks: 'It goes to your approvers first. As a pre-invoice, it has no GL impact yet.',
                  implications: "This pre-invoice is created against a PO with nothing received yet, so it doesn't post to the General Ledger and isn't payable. The entries below are a preview of what will post once goods are received and it converts to an invoice.",
                  primaryLabel: 'Submit pre-invoice for approval',
                  primaryBg: 'hsl(var(--primary))',
                };
              }
              if (isResubmit) {
                return {
                  chipLabel: 'Confirm resubmission',
                  chipBg: '#EBF3FF', chipText: '#0654BC',
                  glowColor: '#0A77FF',
                  tileBg: '#D6E8FF', tileIconColor: '#0654BC',
                  title: 'Resubmit this invoice?',
                  howItWorks: 'It goes back to your approvers. Once approved, it posts to the General Ledger.',
                  implications: 'The invoice becomes payable under your Net 30 terms. Review the GL impact below before you resubmit.',
                  primaryLabel: 'Resubmit',
                  primaryBg: 'hsl(var(--primary))',
                };
              }
              return {
                chipLabel: 'Confirm submission',
                chipBg: '#EBF3FF', chipText: '#0654BC',
                glowColor: '#0A77FF',
                tileBg: '#D6E8FF', tileIconColor: '#0654BC',
                title: 'Submit this invoice for approval?',
                howItWorks: 'It goes to your approvers. Once approved, it posts to the General Ledger.',
                implications: 'The invoice becomes payable under your Net 30 terms. Review the GL impact below before you submit.',
                primaryLabel: 'Submit for approval',
                primaryBg: 'hsl(var(--primary))',
              };
            })();

            const HeaderIcon = (isExceptionActive || isPaymentHoldActive) ? AlertTriangle : CheckCircle2;

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
                    style={{ fontWeight: 600, backgroundColor: variant.chipBg, color: variant.chipText, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
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

                  <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
                    {/* What are the implications */}
                    <div className="w-full rounded-xl border border-border bg-white shadow-sm p-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500" style={{ fontWeight: 600 }}>
                          {isPreInvoiceSubmit ? 'What this means' : 'What are the implications'}
                        </p>
                      </div>
                      <p className="text-[12px] text-slate-600" style={{ lineHeight: 1.6 }}>
                        {variant.implications}
                      </p>
                    </div>

                    {/* Quantity / price deviations from the PO — surfaced at
                        the moment of submission so nothing lands on the
                        approver unannounced (design feedback 7/13/26). */}
                    {!isStandalone && (() => {
                      const changedLines = lineItems.filter(
                        (i) =>
                          (i.invoiceQty > 0 && i.invoiceQty < i.remainingQty) ||
                          i.unitPrice !== i.originalUnitPrice,
                      );
                      if (changedLines.length === 0) return null;
                      return (
                        <div className="w-full rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm p-4">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500" style={{ fontWeight: 600 }}>
                              Changes on this invoice
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            {changedLines.map((i) => (
                              <div key={i.id} className="text-[12px] text-slate-600" style={{ lineHeight: 1.5 }}>
                                <span className="text-foreground" style={{ fontWeight: 600 }}>{i.sku}</span>
                                {i.invoiceQty > 0 && i.invoiceQty < i.remainingQty && (
                                  <span className="block">
                                    Invoicing {i.invoiceQty} of {i.remainingQty} {i.uom} remaining. The other {i.remainingQty - i.invoiceQty} {i.uom} will stay open for a future invoice.
                                  </span>
                                )}
                                {i.unitPrice !== i.originalUnitPrice && (
                                  <span className="block">
                                    Price Per Unit changed from ${i.originalUnitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} to ${i.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}.
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* GL impact — exact journal lines this invoice posts. */}
                    <div className="w-full rounded-xl border border-border bg-white shadow-sm p-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Receipt className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500" style={{ fontWeight: 600 }}>
                          {isPreInvoiceSubmit ? 'GL impact on conversion' : 'GL impact'}
                        </p>
                      </div>
                      {isPreInvoiceSubmit && (
                        <p className="text-[12px] text-slate-500 mb-2" style={{ fontWeight: 600 }}>
                          Preview only. Nothing posts until goods are received.
                        </p>
                      )}
                      <p className="text-[12px] text-slate-600 mb-2" style={{ lineHeight: 1.6 }}>
                        {ledger === 'ar'
                          ? 'This invoice books a receivable from the customer and recognizes the full amount as revenue, including freight and other charges billed on.'
                          : isStandalone
                            ? 'This is a standalone invoice, so each line is an expense and posts to the expense account you choose. There is no inventory involved, so freight and other charges are expensed as well.'
                            : `${isPreInvoiceSubmit ? 'When this converts to an invoice, freight' : 'Freight'} and acquisition charges such as duties, customs, and handling are rolled into inventory costs, not expensed.`}
                      </p>
                      {(() => {
                        const fmtGl = (n: number) =>
                          `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        // GL account strings are stored as "CODE Name"
                        // (e.g. "6000 Office Expense"); split on the first
                        // space to render code + name in their columns.
                        const parseGl = (s: string) => {
                          const str = (s || '').trim();
                          const code = str.split(' ')[0];
                          return { code, name: str.substring(code.length + 1) || 'Expense' };
                        };
                        // Standalone: each line is an expense posting to
                        // the GL account the user chose (Dr), offset by
                        // Accounts Payable (Cr). No inventory — freight and
                        // additional charges are expensed too. Debits are
                        // grouped by account so repeated accounts net into
                        // one line.
                        // Inventory invoice (ASC 330): freight + acquisition
                        // charges are capitalised, so they roll into the
                        // single Inventory (1200) debit.
                        const drMap = new Map<string, number>();
                        standaloneItems.forEach((it) => {
                          if (it.amount > 0 && it.glAccount) drMap.set(it.glAccount, (drMap.get(it.glAccount) || 0) + it.amount);
                        });
                        // Standalone has no inventory to capitalise into, so
                        // freight + additional charges expense to their
                        // default GL accounts.
                        if (freightAmount > 0) drMap.set(DEFAULT_FREIGHT_GL_ACCOUNT, (drMap.get(DEFAULT_FREIGHT_GL_ACCOUNT) || 0) + freightAmount);
                        if (additionalChargesTotal > 0) drMap.set(DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT, (drMap.get(DEFAULT_ADDITIONAL_CHARGE_GL_ACCOUNT) || 0) + additionalChargesTotal);
                        // AR mirror (7/20/26): a customer invoice books the
                        // receivable on the debit side and revenue on the
                        // credit side — the exact inverse of the AP posting.
                        const glLines: { code: string; name: string; debit?: number; credit?: number }[] = ledger === 'ar'
                          ? [
                              { code: '1200', name: 'Accounts Receivable', debit: total },
                              { code: '4000', name: 'Sales Revenue', credit: total },
                            ]
                          : isStandalone
                            ? [
                                ...[...drMap.entries()].map(([acct, amt]) => {
                                  const p = parseGl(acct);
                                  return { code: p.code, name: p.name, debit: amt };
                                }),
                                { code: '2000', name: 'Accounts Payable', credit: total },
                              ]
                            : [
                                { code: '1200', name: 'Inventory', debit: subtotal + freightAmount + additionalChargesTotal },
                                { code: '2000', name: 'Accounts Payable', credit: total },
                              ];
                        const drTotal = glLines.reduce((s, l) => s + (l.debit || 0), 0);
                        const crTotal = glLines.reduce((s, l) => s + (l.credit || 0), 0);
                        return (
                          <div className="mt-1.5 rounded-lg border border-slate-200 bg-white overflow-hidden text-left">
                            <table className="w-full text-[12px]">
                              <thead className="bg-slate-50/70 border-b border-slate-100">
                                <tr>
                                  <th className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>Account</th>
                                  <th className="text-center px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>Debit</th>
                                  <th className="text-center px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-500" style={{ fontWeight: 600 }}>Credit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {glLines.map((line) => (
                                  <tr key={`${line.code}-${line.debit ? 'dr' : 'cr'}`} className="border-b border-slate-100 last:border-b-0">
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                      <span className="font-mono text-[11px] text-slate-500 tabular-nums" style={{ fontWeight: 500 }}>{line.code}</span>
                                      <span className="text-slate-700 ml-1.5" style={{ fontWeight: 500 }}>{line.name}</span>
                                    </td>
                                    <td className="px-3 py-1.5 text-center tabular-nums">
                                      {line.debit ? <span className="text-foreground" style={{ fontWeight: 500 }}>{fmtGl(line.debit)}</span> : <span className="text-slate-300">, </span>}
                                    </td>
                                    <td className="px-3 py-1.5 text-center tabular-nums">
                                      {line.credit ? <span className="text-foreground" style={{ fontWeight: 500 }}>{fmtGl(line.credit)}</span> : <span className="text-slate-300">, </span>}
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
                                  <td className="px-3 py-1.5 text-center tabular-nums text-foreground" style={{ fontWeight: 700 }}>{fmtGl(drTotal)}</td>
                                  <td className="px-3 py-1.5 text-center tabular-nums text-foreground" style={{ fontWeight: 700 }}>{fmtGl(crTotal)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Set-as-default — standalone only, when a vendor is
                        selected and at least one line has a GL account. Mirrors
                        the partner module's "apply changes" choice cards: keep
                        the pick for this invoice only, or promote the most-used
                        account to the vendor's default going forward. */}
                    {isStandalone && currentVendorId && mostUsedGl && (
                      <div className="w-full rounded-xl border border-border bg-white shadow-sm p-4">
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500" style={{ fontWeight: 600 }}>Default expense account</p>
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
                                <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Just this invoice</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Use the accounts you picked for this invoice only. {possessive(vendorName)} default stays unchanged.</p>
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
                                <p className="text-[12px] text-foreground" style={{ fontWeight: 600 }}>Set as default going forward</p>
                                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                                  Make <span className="tabular-nums text-slate-700" style={{ fontWeight: 600 }}>{mostUsedGl}</span> {possessive(vendorName)} default expense account. New standalone invoices for this vendor pre-fill it; past invoices aren't affected.
                                </p>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="w-full mt-6 flex flex-col gap-2.5">
                    <button
                      onClick={() => { setShowSubmitWarning(false); performSubmit(); }}
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
                      Continue editing
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
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
              style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
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
                {copy.discardTitle}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription
              className="text-[13px] mt-2 max-w-[300px] mx-auto"
              style={{ color: 'hsl(var(--muted-foreground))', lineHeight: '1.65' }}
            >
              All the information you&apos;ve entered will be lost. This action cannot be undone.
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={handleConfirmDiscard}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
              >
                Discard changes
              </button>
              <button
                onClick={() => setShowDiscardConfirmation(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
              >
                Continue editing
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
              style={{ fontWeight: 600, backgroundColor: '#FEF2F2', color: '#991B1B', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
            >
              Go back
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
                : copy.discardBody}
            </AlertDialogDescription>
            <div className="w-full mt-7 flex flex-col gap-2.5">
              <button
                onClick={handleConfirmBack}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors hover:opacity-90"
                style={{ fontWeight: 600, backgroundColor: 'hsl(var(--destructive))', color: '#fff' }}
              >
                Discard and go back
              </button>
              <button
                onClick={() => setShowBackConfirmation(false)}
                className="w-full h-11 text-[14px] rounded-xl border-0 cursor-pointer transition-colors"
                style={{ fontWeight: 500, backgroundColor: 'hsl(var(--muted))', color: '#334155' }}
              >
                Continue editing
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Removal Confirmation Prompt */}
      {!isStandalone && poToRemove && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">Remove Purchase Order?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              You are about to remove <span className="font-bold text-foreground">{poToRemove}</span> {copy.removePOBody}. All line items associated with this PO will be cleared.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setPoToRemove(null)}
                className="flex-1 h-10 text-xs font-bold tracking-wider rounded-lg"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRemovePO}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-xs font-bold tracking-wider rounded-lg"
              >
                Yes, remove
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Saving confirmation. A return raises paperwork against a vendor, and
          the second step decides how many vendors that is, so the save says
          what it is about to create and lists it. The same centred gate an
          invoice gets before it posts. */}
      {/* More on the line than the vendor has.
          
          The quantity is typed on the first step and the vendor is named on
          the second, so the two can disagree by the time anybody can see it.
          Cutting the figure is the only way out, and it is a figure the user
          typed, so it is put to them with both numbers on screen. */}
      {qtyGate && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="px-6 pt-6">
              <span className="mb-4 flex w-11 h-11 items-center justify-center rounded-full bg-amber-50">
                <Hash className="w-5 h-5 text-amber-600" />
              </span>
              <h3 className="text-lg text-foreground" style={{ fontWeight: 700 }}>
                Update the quantity to return?
              </h3>
              {/* Said the way it was dictated: the figure they typed, the
                  figure they can have, and the offer. The paragraph before
                  this one explained the rule and left the user to work out
                  what it meant for the number on their screen. */}
              <p className="mt-2 text-sm text-muted-foreground">
                You previously selected {formatQty(qtyGate.from)} {qtyGate.uom} that you wanted to
                return. You can only select {formatQty(qtyGate.to)}, which is all{' '}
                {qtyGate.vendorName} has of {qtyGate.sku} to take back. Would you like to update the
                quantity to return to {formatQty(qtyGate.to)}?
              </p>
              <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] p-3 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">On the line now</span>
                  <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                    {formatQty(qtyGate.from)} {qtyGate.uom}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">After updating</span>
                  <span className="text-primary tabular-nums" style={{ fontWeight: 700 }}>
                    {formatQty(qtyGate.to)} {qtyGate.uom}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-[12px] text-slate-500">
                Returning the rest means a separate RMA against whoever else shipped it.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => setQtyGate(null)} className="h-9">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  fitLineToVendor(qtyGate.lineId);
                  setQtyGate(null);
                }}
                className="h-9 bg-primary text-primary-foreground"
              >
                Update quantity
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* A receipt that carries more than the line does. Put before it is
          tied, because tying it silently rewrote the quantity the user typed
          on the first step. */}
      {tieRaise && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Backing out is not one of the two answers, so it is not a
                third button competing with them. It is the cross, where
                every other dialog in the flow keeps it. */}
            <button
              type="button"
              onClick={() => setTieRaise(null)}
              aria-label="Close"
              className="absolute right-3 top-3 flex w-8 h-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="px-6 pt-6">
              <span className="mb-4 flex w-11 h-11 items-center justify-center rounded-full bg-blue-50">
                <FileText className="w-5 h-5 text-primary" />
              </span>
              <h3 className="pr-8 text-lg text-foreground" style={{ fontWeight: 700 }}>
                {tieRaise.grnNumber} carries more than this line
              </h3>
              {/* The quantity is the user's own answer, given a step ago, so
                  the offer is to tie what fits inside it. Raising the line to
                  the whole document is still here and still one press, but it
                  is the second reading of the situation rather than the
                  first: the screen was proposing a change to a figure nobody
                  had asked it to change. */}
              <p className="mt-2 text-sm text-muted-foreground">
                {tieRaise.sku} is set to return {formatQty(tieRaise.declared)} {tieRaise.uom}, and{' '}
                {tieRaise.grnNumber} brings {formatQty(tieRaise.docQty)} {tieRaise.uom} with it.
                Take {formatQty(tieRaise.fits)} {tieRaise.uom} off it and the line stays as you
                entered it. Selecting the document in full raises the line to{' '}
                {formatQty(
                  Math.round((tieRaise.declared - tieRaise.fits + tieRaise.docQty) * 100) / 100,
                )}{' '}
                {tieRaise.uom}.
              </p>
              <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FAFBFC] p-3 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">On the line now</span>
                  <span className="text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                    {formatQty(tieRaise.declared)} {tieRaise.uom}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">After selecting {tieRaise.grnNumber}</span>
                  <span className="text-primary tabular-nums" style={{ fontWeight: 700 }}>
                    {formatQty(
                      Math.round((tieRaise.declared - tieRaise.fits + tieRaise.docQty) * 100) / 100,
                    )}{' '}
                    {tieRaise.uom}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <Button
                variant="outline"
                onClick={() => {
                  const next =
                    Math.round((tieRaise.declared - tieRaise.fits + tieRaise.docQty) * 100) / 100;
                  updateLineItem(tieRaise.lineId, 'invoiceQty', String(next));
                  setTieQty(tieRaise.sku, tieRaise.uom, tieRaise.grnNumber, tieRaise.docQty);
                  setTieRaise(null);
                }}
                className="h-9"
              >
                Update the quantity
              </Button>
              {tieRaise.fits > 0 && (
                <Button
                  onClick={() => {
                    setTieQty(tieRaise.sku, tieRaise.uom, tieRaise.grnNumber, tieRaise.fits);
                    setTieRaise(null);
                  }}
                  className="h-9 bg-primary text-primary-foreground"
                >
                  Take {formatQty(tieRaise.fits)} {tieRaise.uom} only
                </Button>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Serial unit picker for serialized return lines. Mounted once and
          driven off the clicked line, since its own rail moves between the
          return's other serialized lines. */}
      {isRma && (() => {
        // Opened from a split line's breakdown, the picker is scoped to one
        // invoice state: only that bucket's own units are on offer, and what is
        // chosen there is that bucket's return quantity.
        // Opened from a vendor row on the second step, the picker is scoped to
        // one vendor: only the units that came back through them are on offer,
        // and how many are named there is what that vendor takes. Offering the
        // whole pool would let the row claim units another supplier shipped.
        const vendorLine = serialModalVendor
          ? currentPOItems.find((i) => i.id === serialModalLineId)
          : undefined;
        // Opened from a vendor row on Serials and lots, the picker is that
        // row's units and nothing else, and what is ticked there is what the
        // line is returning from them. The older screen's version of this
        // wrote a vendor allocation instead; this one writes the serials,
        // because on this step the serials are the answer.
        if (serialModalVendor && vendorLine && activeStep === 'units') {
          const vendorCode = serialModalVendor;
          const pool = serialPoolForVendor(
            availableSerials(vendorLine.sku, vendorLine.id, vendorLine.receivedQty),
            vendorLine.receipts ?? [],
            vendorCode,
          );
          const theirs = new Set(pool);
          const already = lineSerials[vendorLine.id] ?? [];
          const supply = vendorsForItem(vendorLine.sku).find((o) => o.vendorCode === vendorCode);
          const close = () => {
            setSerialModalLineId(null);
            setSerialModalVendor(null);
          };
          return (
            <SerialSelectionModal
              open
              onOpenChange={(v) => {
                if (!v) close();
              }}
              lines={[
                {
                  id: vendorLine.id,
                  sku: vendorLine.sku,
                  description: vendorLine.description,
                  image: imageForSku(vendorLine.sku),
                  receivedQty: pool.length,
                  uom: vendorLine.uom,
                  serialPool: pool,
                },
              ]}
              activeLineId={vendorLine.id}
              selected={{ [vendorLine.id]: already.filter((sn) => theirs.has(sn)) }}
              {...(vendorLine.invoiceQty > 0 ? { target: vendorLine.invoiceQty } : {})}
              onChangeCount={(next) =>
                updateLineItem(vendorLine.id, 'invoiceQty', String(next))
              }
              onChange={(_lineId, next) => {
                if (next.length > 0)
                  markAnswered('units', lineKey(vendorLine.sku, vendorLine.uom ?? 'EA'));
                // Everything this line holds from anybody else stays as it
                // was: the modal is one vendor's shelf, not the whole line.
                setSerialsForLine(
                  vendorLine,
                  [...already.filter((sn) => !theirs.has(sn)), ...next],
                  true,
                );
              }}
              sourceLabel={supply?.vendorName ?? vendorCode}
            />
          );
        }

        if (serialModalVendor && vendorLine) {
          const vendorCode = serialModalVendor;
          const supply = vendorsForItem(vendorLine.sku).find((o) => o.vendorCode === vendorCode);
          const pool = serialPoolForVendor(
            availableSerials(vendorLine.sku, vendorLine.id, vendorLine.receivedQty),
            vendorLine.receipts ?? [],
            vendorCode,
          );
          const line = resolutionLines.find((l) => l.sku === vendorLine.sku);
          const taken = line ? vendorSplitFor(line)[vendorCode] ?? 0 : 0;
          const close = () => { setSerialModalLineId(null); setSerialModalVendor(null); };
          return (
            <SerialSelectionModal
              open
              onOpenChange={(v) => { if (!v) close(); }}
              lines={[{
                id: vendorLine.id,
                sku: vendorLine.sku,
                description: vendorLine.description,
                image: imageForSku(vendorLine.sku),
                receivedQty: pool.length,
                uom: vendorLine.uom,
                serialPool: pool,
              }]}
              activeLineId={vendorLine.id}
              // What is already theirs, named. The row's figure is a count, so
              // the picker opens on that many of their units rather than on
              // nothing -- reopening it must not read as having chosen none.
              selected={{ [vendorLine.id]: pool.slice(0, Math.min(taken, pool.length)) }}
              onChange={(_lineId, next) => {
                if (!line) return;
                allocateVendor(line.key, vendorCode, next.length);
              }}
              // The modal reads this as "the units going back from ...", so it
              // takes the vendor's name and nothing else. "units from X" put
              // the word twice.
              sourceLabel={supply?.vendorName ?? vendorCode}
            />
          );
        }

        const bucketItem = serialModalBucket
          ? currentPOItems.find((i) => i.id === serialModalLineId && i.invoiceSplit)
          : undefined;
        if (serialModalBucket && bucketItem && bucketItem.invoiceSplit) {
          const bucket = serialModalBucket;
          const split = bucketItem.invoiceSplit;
          const allocation = allocationFor(bucketItem.id, bucketItem.invoiceQty, split);
          return (
            <SerialSelectionModal
              open
              onOpenChange={(v) => { if (!v) { setSerialModalLineId(null); setSerialModalBucket(null); } }}
              lines={[{
                id: bucketItem.id,
                sku: bucketItem.sku,
                description: bucketItem.description,
                image: imageForSku(bucketItem.sku),
                receivedQty: split[bucket],
                uom: bucketItem.uom,
                serialPool: bucketSerialPool(bucketItem.sku, bucketItem.id, bucketItem.receivedQty, split, bucket),
              }]}
              activeLineId={bucketItem.id}
              selected={{
                [bucketItem.id]: bucketSerialsFor(
                  bucketItem.id, bucketItem.sku, bucketItem.receivedQty, split, bucket, allocation[bucket],
                ),
              }}
              onChange={(_lineId, next) => setBucketSerials(bucketItem, split, bucket, next, allocation)}
              sourceLabel={`${BUCKET_LABELS[bucket]} units`}
            />
          );
        }
        const serialLines = currentPOItems
          .filter((item) => trackingModeFor(item.sku) === 'serialized')
          .map((item) => ({
            id: item.id,
            sku: item.sku,
            description: item.description,
            image: imageForSku(item.sku),
            receivedQty: item.receivedQty,
            uom: item.uom,
          }));
        const receipts = Array.from(new Set(currentPOItems.flatMap((i) => i.grnNumbers)));
        // Who shipped each unit, for the full-screen picker. The panel reads
        // it and refuses the units that came from anybody else; without it
        // here, going full screen quietly lifted the rule the panel behind
        // it was enforcing.
        const fullScreenOwners = (() => {
          const li = serialModalLineId
            ? currentPOItems.find((i) => i.id === serialModalLineId)
            : undefined;
          if (!li) return new Map<string, { vendorCode: string; vendorName: string }>();
          const pool = availableSerials(li.sku, li.id, li.receivedQty);
          const lineReceipts = (li.receipts ?? []).map((r) => ({
            grnNumber: r.grnNumber,
            receivedQty: r.receivedQty,
          }));
          return new Map(
            serialOrigins(li.sku, li.id, li.receivedQty, lineReceipts, pool).map((o) => [
              o.serial,
              { vendorCode: o.vendorCode, vendorName: o.vendorName },
            ]),
          );
        })();
        return (
          <>
          {/* The batch picker, on the same terms as the unit picker beside it:
              opened from the line, counting against what the line declared. */}
          {/* The batch picker full screen, which is the same picker the
              panel draws, opened over it. It used to stand down on the units
              step, from when that step opened a picker off a vendor row: the
              Full screen button was there, it set the line, and nothing
              happened. A serialized line expands, so a lot line expands. */}
          <LotSelectionModal
            open={lotModalLineId !== null}
            onOpenChange={(v) => { if (!v) setLotModalLineId(null); }}
            lockedVendor={(() => {
              const li = currentPOItems.find((i) => i.id === lotModalLineId);
              return li ? lockForLine(li.sku, li.uom ?? 'EA') : rmaVendorLock;
            })()}
            lockedVendorName={(() => {
              const li = currentPOItems.find((i) => i.id === lotModalLineId);
              const code = li ? lockForLine(li.sku, li.uom ?? 'EA') : rmaVendorLock;
              return code ? mockVendors.find((v) => v.vendorCode === code)?.vendorName ?? null : null;
            })()}
            lockedBy={lockOrigin()}
            lines={currentPOItems
              .filter((i) => isLotMode(trackingModeFor(i.sku)))
              .map((i) => ({
                id: i.id,
                sku: i.sku,
                description: i.description,
                receivedQty: i.receivedQty ?? 0,
                uom: i.uom,
                image: imageForSku(i.sku),
              }))}
            activeLineId={lotModalLineId}
            selected={lineLots}
            {...(() => {
              const declared = currentPOItems.find((i) => i.id === lotModalLineId)?.invoiceQty ?? 0;
              return declared > 0 ? { target: declared } : {};
            })()}
            onChangeCount={(next) => {
              if (!lotModalLineId) return;
              updateLineItem(lotModalLineId, 'invoiceQty', String(next));
            }}
            onChange={(lineId, next) => {
              const li = currentPOItems.find((i) => i.id === lineId);
              if (next.length > 0 && li) markAnswered('units', lineKey(li.sku, li.uom ?? 'EA'));
              setLineLots((prev) => ({ ...prev, [lineId]: next }));
              // A plain batch under a lock is that vendor's share of it, so
              // picking any of it picks them -- the same write the panel
              // makes, or expanding it left the line with batches and no
              // vendor against them.
              if (li && !hasSerials(trackingModeFor(li.sku))) {
                const uom = li.uom ?? 'EA';
                const qtyNow = next.reduce((n, a) => n + a.qty, 0);
                if (controlledLock && qtyNow > 0) {
                  pickCountedVendor(li.sku, uom, qtyNow, controlledLock);
                }
              }
            }}
          />

          <SerialSelectionModal
            open={serialModalLineId !== null}
            onOpenChange={(v) => {
              // The cap is applied here rather than on every tick. Trimming as
              // the user picks fights them: each unit named from a sixth vendor
              // dropped units already named from a fifth, and a selection of
              // sixty ended up as twenty. Closing the picker is when the
              // selection is a selection.
              if (!v) {
                const id = serialModalLineId;
                const line = id ? lineItems.find((l) => l.id === id) : undefined;
                if (id && line) {
                  const kept = capVendors(line.sku, lineSerials[id] ?? []);
                  if (kept.dropped > 0) {
                    setLineSerials((prev) => ({ ...prev, [id]: kept.serials }));
                    updateLineItem(id, 'invoiceQty', kept.serials.length);
                    toast(`Held to ${MAX_VENDORS_PER_PART} vendors`, {
                      description: `${line.sku} traced to ${kept.vendors}. The ${MAX_VENDORS_PER_PART} with the most units are on the return; ${kept.dropped} unit${kept.dropped === 1 ? '' : 's'} from the others came off it.`,
                      duration: 12000,
                    });
                  }
                }
                setSerialModalLineId(null);
                setSerialModalVendor(null);
              }
            }}
            lines={serialLines}
            activeLineId={serialModalLineId}
            vendorOf={(sn) => fullScreenOwners.get(sn) ?? null}
            lockedVendor={(() => {
              const li = currentPOItems.find((i) => i.id === serialModalLineId);
              return li ? lockForLine(li.sku, li.uom ?? 'EA') : rmaVendorLock;
            })()}
            lockedVendorName={
              rmaVendorLock
                ? mockVendors.find((v) => v.vendorCode === rmaVendorLock)?.vendorName ?? null
                : null
            }
            lockedBy={lockOrigin()}
            selected={Object.fromEntries(
              serialLines.map((l) => {
                const item = currentPOItems.find((i) => i.id === l.id);
                return [l.id, lineBucketSerials[l.id] ? serialsForLine(l.id, l.sku, l.id, l.receivedQty, item?.invoiceQty ?? 0) : lineSerials[l.id] ?? []];
              }),
            )}
            // What the first step said is going back. The picker counts
            // against it instead of overwriting it: ticking fourteen of a
            // fifteen the user typed used to rewrite the line to fourteen,
            // which is the miscount agreeing with itself.
            //
            // Only once there is a count to count against. A serialized part
            // gets on the return by naming its units, so on the first step it
            // joins at nothing and the picker is what decides the figure --
            // holding it to a target of zero disabled the confirm and left no
            // way to add one at all.
            {...(() => {
              if (!serialModalLineId || unitsSetCount.has(serialModalLineId)) return {};
              const declared = currentPOItems.find((i) => i.id === serialModalLineId)?.invoiceQty ?? 0;
              return declared > 0 ? { target: declared } : {};
            })()}
            onChangeCount={(next) => {
              if (!serialModalLineId) return;
              updateLineItem(serialModalLineId, 'invoiceQty', String(next));
            }}
            onChange={(lineId, next) => {
              // Which bill each unit came off is read back off the pools, so a
              // named unit still lands on the receipt and invoice it belongs
              // to rather than only bumping a count.
              const line = lineItems.find((l) => l.id === lineId);
              // The units become the count where there is no count yet, and
              // are held to it where there is. Writing it every time is what
              // let ticking fourteen of a declared fifteen quietly rewrite the
              // line to fourteen, so the miscount agreed with itself; never
              // writing it left a serialized part unable to get onto the
              // return at all, since naming its units is the only way it can.
              const seeding = unitsSetCount.has(lineId);
              if (line?.invoiceSplit) {
                setSerialsForLine(line, next, !seeding);
                return;
              }
              setLineSerials((prev) => ({ ...prev, [lineId]: next }));
              if (seeding) updateLineItem(lineId, 'invoiceQty', next.length);
            }}
            {...(receipts.length === 1 ? { sourceLabel: receipts[0]! } : {})}
          />
          </>
        );
      })()}

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
      {/* Coming in by item, "add more" is another part -- the same one-field
          search they started in, not the vendor-first picker. */}
      {!isStandalone && startMode === 'item' && isAddPOOpen && (
        <ItemSearchModal
          onClose={() => setIsAddPOOpen(false)}
          onBack={() => setIsAddPOOpen(false)}
          alreadyAdded={lineItems.map((l) => l.sku)}
          title="Add more parts"
          subtitle="Find another part and say how much of it is coming back."
          onContinue={(picks) => {
            const already = new Set(lineItems.map((l) => l.sku));
            handleAddPOs(selectionFromItems(picks.filter((p) => !already.has(p.sku))));
            setIsAddPOOpen(false);
          }}
        />
      )}
      {!isStandalone && startMode !== 'item' && (
        <VendorSelectionModalNested
          isOpen={isAddPOOpen}
          onClose={() => setIsAddPOOpen(false)}
          onContinue={handleAddPOs}
          variant={mode}
          purpose="add"
          fixedVendorId={currentVendorId || undefined}
          alreadySelectedPONumbers={currentPOsData.map((p) => p.poNumber)}
          alreadySelectedGRNNumbers={currentPOsData.flatMap((p) => p.relatedGRNs.map((g) => g.grnNumber))}
          alreadySelectedGRNItemIds={currentPOsData.flatMap((p) => p.selectedGRNItemIds ?? [])}
        />
      )}

      {/* Everything about one line. It lives out here with the other sheets
          because it is a fixed overlay and the first step's section, which used
          to host it, is unmounted on the second -- so the part number opened
          nothing at all from the cards. */}
                {isRma && (() => {
                  const focused = displayedPOItems.find((i) => i.id === focusedLineId) ?? displayedPOItems[0] ?? null;
                  // Everything about one line, in front of the list rather than
                  // beside it. The pane used to sit in a column of its own, which
                  // meant the step showed one line's detail whether or not anybody
                  // had asked for it, and squeezed the list that names the lines
                  // into a third of the width. Clicking a row opens it, as
                  // clicking a purchase-order line does.
                  //
                  // Escape closes; a click on the sheet behind does not. A line
                  // carries typed quantities, picked units, notes and files, and a
                  // stray click outside is not an instruction to abandon them.
                  if (!lineDetailOpen || !focused) return null;
                  return (
                  <>
                    <div className="fixed inset-0 bg-black/50 z-[180]" aria-hidden />
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-label={`How ${focused.sku} comes back`}
                      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[181] flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_24px_60px_rgba(16,24,40,0.18)] w-[calc(100%-2rem)]"
                      // Purchasing fixes the height because its modal always fills
                      // it -- two columns and five tabs. A return line is as tall
                      // as the line is: a plain part asks four questions, a
                      // serialized one asks about every unit. So it grows to what
                      // it holds and stops at the same ceiling.
                      style={{ maxWidth: 'min(82vw, 1180px)', maxHeight: 'min(86vh, 840px)' }}
                    >
                      {/* The vendor, and who they are. This sheet is one
                          vendor's arrangements for one item, and the item is
                          already the first thing in the body -- so the header
                          carries the half the body does not. A labelled way out
                          rather than a bare glyph, as the purchasing modal
                          does. */}
                      <div className="shrink-0 flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
                        <div className="min-w-0 flex-1">
                          <h2 className="truncate text-[15px] text-foreground" style={{ fontWeight: 700 }}>
                            {detailVendor?.vendorName ?? vendorName}
                          </h2>
                          {(() => {
                            const v = mockVendors.find(
                              (mv) => mv.vendorCode === detailVendor?.vendorCode || mv.vendorName === vendorName,
                            );
                            const blurb = v ? [v.category, v.type, v.paymentTerms].filter(Boolean).join(' · ') : '';
                            return (
                              <p className="truncate text-[12px] text-slate-500 mt-0.5">
                                {blurb}
                                {detailVendor && blurb ? ' · ' : ''}
                                {detailVendor
                                  ? `${detailVendor.partCount} ${detailVendor.partCount === 1 ? 'item' : 'items'} · ${formatQty(detailVendor.units)} ${detailVendor.uom} coming back`
                                  : ''}
                              </p>
                            );
                          })()}
                        </div>

                        <button
                          type="button"
                          onClick={revertLineSheet}
                          aria-label="Discard these changes and close"
                          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-foreground"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-y-auto items-scroll bg-[#F7F9FC]">
                        {!focused ? (
                          <p className="text-[12px] text-slate-400 text-center px-5 py-10" style={{ fontWeight: 500 }}>
                            Select a line to set how it comes back.
                          </p>
                        ) : (() => {
                          const item = focused;
                          const lineTotal = item.invoiceQty * item.unitPrice;
                          const isOverBilled = item.invoiceQty > item.remainingQty;
                          // Either money field may be cleared; the line just
                          // has no value until one of them is filled back in.
                          const priceDraft = moneyDraft(item.id, 'unitPrice');
                          const totalDraft = moneyDraft(item.id, 'lineTotal');
                          const priceEmpty = priceDraft?.trim() === '' || totalDraft?.trim() === '';
                          const priceValue = priceDraft ?? (priceEmpty ? '' : String(item.unitPrice));
                          const totalValue = totalDraft ?? (priceEmpty ? '' : String(Number(lineTotal.toFixed(2))));
                          const priceChanged = !priceEmpty && Math.abs(item.unitPrice - item.originalUnitPrice) > 0.004;
                          const isSerialLine = trackingModeFor(item.sku) === 'serialized';
                          const lineSerialList = isSerialLine
                            ? serialsForLine(item.id, item.sku, item.id, item.receivedQty, item.invoiceQty)
                            : [];
                          const files = lineAttachments[item.id] ?? [];
                          // A return settles per invoice state: a line sitting
                          // in one state answers quantity, reason, remedy and
                          // price once, a line spanning several answers them
                          // once per state. Both go through the same card, so
                          // the line carries no second copy of those fields.
                          // Every return line goes through the card, whether or
                          // not it has invoice states to break down. Gating on
                          // the breakdown dropped stock with no receipts behind
                          // it into a bare set of legacy fields -- the same
                          // sheet, reached the same way, in a different design.
                          const useBreakdown = isRma;
                          // No delivery, so no invoice state to settle against:
                          // the quantity is written straight onto the line
                          // instead of laid across slices that do not exist.
                          const noReceipts = isRma && bucketCount(item.invoiceSplit) === 0;
                          // Every line of this item settles as one, so the card
                          // works off their combined split and spreads whatever
                          // the user sets back across the lines that carry it.
                          const groupLines = lineItems.filter((l) => l.sku === item.sku);
                          const combinedSplit: LineInvoiceSplit = {
                            received: groupLines.reduce((n, l) => n + (l.invoiceSplit?.received ?? 0), 0),
                            notInvoiced: groupLines.reduce((n, l) => n + (l.invoiceSplit?.notInvoiced ?? 0), 0),
                            invoicedUnpaid: groupLines.reduce((n, l) => n + (l.invoiceSplit?.invoicedUnpaid ?? 0), 0),
                            paid: groupLines.reduce((n, l) => n + (l.invoiceSplit?.paid ?? 0), 0),
                          };
                          const combinedAllocation = groupLines.reduce(
                            (acc, l) => {
                              const a = allocationFor(l.id, l.invoiceQty, l.invoiceSplit);
                              RETURN_BUCKETS.forEach((bkt) => {
                                acc[bkt] += a[bkt] ?? 0;
                              });
                              return acc;
                            },
                            { notInvoiced: 0, invoicedUnpaid: 0, paid: 0 } as Record<ReturnBucket, number>,
                          );
                          // Fill the lines in order, each taking what it can
                          // carry, so a combined figure still lands on real
                          // receipts rather than floating above them.
                          const spreadAcrossLines = (next: Record<ReturnBucket, number>) => {
                            const remaining: Record<ReturnBucket, number> = { ...next };
                            groupLines.forEach((l) => {
                              const lineAlloc = { ...allocationFor(l.id, l.invoiceQty, l.invoiceSplit) };
                              RETURN_BUCKETS.forEach((bkt) => {
                                const cap = l.invoiceSplit?.[bkt] ?? 0;
                                const take = Math.max(0, Math.min(cap, remaining[bkt]));
                                lineAlloc[bkt] = take;
                                remaining[bkt] -= take;
                              });
                              setAllocation(l.id, lineAlloc);
                              updateLineItem(l.id, 'invoiceQty', allocationTotal(lineAlloc));
                              applyBucketPrices(l.id, lineBucketPrices[l.id] ?? {}, lineAlloc, l.unitPrice);
                            });
                          };
                          const allocation = combinedAllocation;
                          // One reading of every leaf the line's units sit on:
                          // a receipt, under a bill or under none. The card
                          // asks one question of them now, so they are summed
                          // rather than grouped.
                          const lineRows = groupLines.flatMap((l) =>
                            slicesWithQty(l).map((r) => ({ line: l, ...r })),
                          );
                          const totalAvailable = noReceipts
                            ? groupLines.reduce((n, l) => n + l.remainingQty, 0)
                            : lineRows.reduce((n, r) => n + r.slice.qty, 0);
                          const totalQty = noReceipts
                            ? groupLines.reduce((n, l) => n + l.invoiceQty, 0)
                            : lineRows.reduce((n, r) => n + r.qty, 0);
                          const returnCredit = noReceipts
                            // No slices to price, so the value is the plain one:
                            // what is going back times what the stock is carried
                            // at. Reading it off the slices returned $0.00 next
                            // to a summary panel stating the real figure.
                            ? groupLines.reduce((n, l) => n + l.invoiceQty * l.unitPrice, 0)
                            : lineRows.reduce(
                                (n, r) =>
                                  n + r.qty * bucketPriceFor(r.line.id, BUCKET_OF_SLICE[r.slice.state], r.line.unitPrice),
                                0,
                              );

                          // Documents are stated, not asked. They read the same
                          // whatever is picked: which order a line came off and
                          // how it was billed are facts about it, not results of
                          // the count, and dimming them made a fact look like a
                          // control that was switched off.
                          const chipsBy = (
                            keyOf: (r: (typeof lineRows)[number]) => string,
                            build: (r: (typeof lineRows)[number]) => Omit<DocChip, 'detail'>,
                            /** Named on hover when the chip itself does not name
                             *  it -- a status chip stands for the bills behind it. */
                            noteOf?: (r: (typeof lineRows)[number]) => string | null,
                          ): DocChip[] => {
                            const acc = new Map<
                              string,
                              { chip: Omit<DocChip, 'detail'>; qty: number; avail: number; notes: Set<string> }
                            >();
                            lineRows.forEach((r) => {
                              const k = keyOf(r);
                              const cur = acc.get(k) ?? { chip: build(r), qty: 0, avail: 0, notes: new Set<string>() };
                              cur.qty += r.qty;
                              cur.avail += r.slice.qty;
                              const note = noteOf?.(r);
                              if (note) cur.notes.add(note);
                              acc.set(k, cur);
                            });
                            return [...acc.values()].map(({ chip, qty, avail, notes }) => ({
                              ...chip,
                              detail: `${notes.size ? [...notes].join(', ') + ' · ' : ''}${qty} of ${avail} ${item.uom}`,
                            }));
                          };
                          const poChips = chipsBy(
                            (r) => r.line.poNumber,
                            (r) => ({ key: r.line.poNumber, label: `PO ${r.line.poNumber}` }),
                          );
                          const receiptChips = chipsBy(
                            (r) => r.slice.grnNumber,
                            (r) => ({ key: r.slice.grnNumber, label: r.slice.grnNumber }),
                          );
                          // What the units' billing state is, not which paper
                          // it is on. Two bills in the same state say the same
                          // thing about the money, so they read as one chip and
                          // name themselves on hover.
                          const invoiceChips = chipsBy(
                            (r) => r.slice.state,
                            (r) => ({
                              key: r.slice.state,
                              label: SLICE_STATE_LABELS[r.slice.state],
                              state: r.slice.state,
                            }),
                            (r) => r.slice.invoiceNumber,
                          );

                          // One number for the line. It fills the leaves in
                          // order -- unbilled first, then billed, then paid --
                          // so the least settled money moves before the most.
                          const setTotalQty = (next: number) => {
                            let remaining = Math.max(0, next);
                            // Nothing to lay it across. Routing this through the
                            // slices would spread it over receipts that do not
                            // exist, come back as zero, and drop the line off
                            // the return entirely.
                            if (noReceipts) {
                              groupLines.forEach((l, i) => {
                                const take = i === groupLines.length - 1
                                  ? remaining
                                  : Math.min(remaining, l.remainingQty);
                                updateLineItem(l.id, 'invoiceQty', String(Math.max(0, take)));
                                remaining -= Math.max(0, take);
                              });
                              return;
                            }
                            const perLine = new Map<string, Record<string, number>>();
                            lineRows.forEach((r) => {
                              const take = Math.max(0, Math.min(r.slice.qty, remaining));
                              remaining -= take;
                              const map = perLine.get(r.line.id) ?? {};
                              map[r.slice.key] = take;
                              perLine.set(r.line.id, map);
                            });
                            perLine.forEach((map, lineId) => {
                              const l = groupLines.find((x) => x.id === lineId);
                              if (l) writeSlices(l, map);
                            });
                          };
                          const fillSources = (full: boolean) => setTotalQty(full ? totalAvailable : 0);

                          // Reason and remedy are the line's single answer now.
                          // They are still stored per invoice state underneath,
                          // because that is what the payload and the accounting
                          // read, so the one answer is written to each state the
                          // units actually sit in.
                          const activeBuckets = RETURN_BUCKETS.filter((b) =>
                            lineRows.some((r) => BUCKET_OF_SLICE[r.slice.state] === b && r.slice.qty > 0.004),
                          );
                          const leadBucket = activeBuckets[0] ?? 'notInvoiced';
                          const leadLineId = groupLines[0]?.id ?? item.id;
                          const lineReason = bucketReasonFor(leadLineId, leadBucket);
                          const setLineReasonAll = (next: string) =>
                            groupLines.forEach((l) =>
                              activeBuckets.forEach((b) =>
                                setBucketReason(l.id, b, next, allocationFor(l.id, l.invoiceQty, l.invoiceSplit)[b]),
                              ),
                            );
                          // Why and how are answerable before anything is
                          // picked -- a returner usually knows the reason
                          // before the count. So the options are worked out
                          // against what the line could send back, not against
                          // what is currently in the box: at zero the rules
                          // would see no units in any state and rule every
                          // remedy out.
                          const optionQty = totalQty > 0 ? totalQty : totalAvailable;
                          const lineType = bucketTypeFor(
                            leadLineId,
                            leadBucket,
                            lineReason as ReturnReason,
                            optionQty,
                          );
                          const setLineTypeAll = (next: string) =>
                            groupLines.forEach((l) => activeBuckets.forEach((b) => setBucketType(l.id, b, next)));
                          // A remedy has to be legal for every state the units
                          // sit in, not just the first: refunding an accrual is
                          // not a thing, so an option blocked anywhere is
                          // blocked here.
                          const lineTypeOptions = bucketReturnTypeOptions(
                            leadBucket,
                            lineReason as ReturnReason,
                            optionQty,
                          ).map((o) => ({
                            type: o.type,
                            disabled:
                              !!o.disabled ||
                              activeBuckets.some((b) =>
                                bucketReturnTypeOptions(b, lineReason as ReturnReason, optionQty).some(
                                  (x) => x.type === o.type && x.disabled,
                                ),
                              ),
                          }));
                          return (
                            <>
                              <div className="sticky top-0 z-20 bg-white border-b border-[#EEF2F6] px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <LineItemImage
                                    sku={item.sku}
                                    src={imageForSku(item.sku)}
                                    alt={item.sku}
                                    size="w-12 h-12"
                                    onPreview={() => setPreviewImage({ src: imageForSku(item.sku), sku: item.sku, description: item.description })}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <h4 className="text-[14px] text-foreground tracking-[-0.005em] truncate" style={{ fontWeight: 600 }}>{item.sku}</h4>
                                      {/* Three states, not two. A lot-controlled
                                          part is not serialized, but calling it
                                          "Non-Serialized" hides that it comes
                                          back by lot rather than by count. */}
                                      {(() => {
                                        const mode = trackingModeFor(item.sku);
                                        return (
                                          <TrackingTag mode={mode} size="md" />
                                        );
                                      })()}
                                      {/* Billing state belongs to a vendor's invoices. Until
                                          the vendor is settled there is no bill to report on,
                                          and one supplier's status would misdescribe a part
                                          that several of them ship. */}
                                      {isRma && !unresolvedVendorSkus.has(item.sku) && (
                                        <InvoiceStatusChip split={item.invoiceSplit} uom={item.uom} />
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate">{longDescriptionFor(item.sku, item.description)}</p>
                                    {/* Each line settles with its own vendor and
                                        travels its own route, and both change from
                                        one line to the next once a return spans
                                        vendors, so they are stated on the line
                                        rather than over the whole document. */}
                                    {isRma && (() => {
                                      const lineVendor = vendorForPO(item.poNumber);
                                      if (!lineVendor) return null;
                                      return (
                                        <div className="flex items-center gap-x-2 gap-y-1 flex-wrap mt-1">
                                          {lineVendor && (() => {
                                            const suppliers = vendorsForSku(item.sku);
                                            return (
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <button
                                                    type="button"
                                                    title={
                                                      suppliers.length > 1
                                                        ? `Returning to ${suppliers.length} vendors: ${suppliers.map((v) => v.name).join(', ')}`
                                                        : lineVendor
                                                    }
                                                    className="inline-flex items-center gap-1 min-w-0 max-w-full h-5 pl-1.5 pr-1 rounded-full bg-[#F1F5F9] border border-[#E8ECF1] hover:border-primary/40 hover:bg-accent/40 transition-colors text-left cursor-pointer"
                                                  >
                                                    <Building2 className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                                                    <span className="text-[10px] text-slate-600 truncate" style={{ fontWeight: 600 }}>
                                                      {suppliers.length > 1 ? `${suppliers.length} vendors` : lineVendor}
                                                    </span>
                                                    <span className="text-slate-300">·</span>
                                                    <span className="text-[10px] text-slate-500 tabular-nums shrink-0" style={{ fontWeight: 500 }}>
                                                      PO {item.poNumber}
                                                    </span>
                                                    <ChevronDown className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                                                  </button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                  align="start"
                                                  sideOffset={6}
                                                  className="w-[288px] p-0 rounded-xl overflow-hidden z-[400] shadow-lg border border-border/60"
                                                >
                                                  <div className="px-3 py-2.5 border-b border-[#EEF2F6] bg-[#FAFBFC]">
                                                    <p className="text-[12px] text-foreground truncate" style={{ fontWeight: 600 }}>
                                                      {item.sku}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 mt-px">
                                                      Supplied by {suppliers.length}{' '}
                                                      {suppliers.length === 1 ? 'vendor' : 'vendors'}
                                                    </p>
                                                  </div>
                                                  <div className="p-1.5 max-h-[220px] overflow-y-auto">
                                                    {suppliers.map((v) => {
                                                      const supplier = mockVendors.find((mv) => mv.vendorName === v.name);
                                                      return (
                                                        <div
                                                          key={v.name}
                                                          className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-black/[0.03] transition-colors"
                                                        >
                                                          <span className="w-7 h-7 rounded-md overflow-hidden bg-white border border-[#E8ECF1] flex items-center justify-center shrink-0">
                                                            {supplier?.imageUrl ? (
                                                              <ImageWithFallback
                                                                src={supplier.imageUrl}
                                                                alt={v.name}
                                                                className="w-full h-full object-cover"
                                                              />
                                                            ) : (
                                                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                                            )}
                                                          </span>
                                                          <div className="min-w-0 flex-1">
                                                            <p className="text-[12px] truncate text-foreground" style={{ fontWeight: 600 }}>
                                                              {v.name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 truncate mt-px">
                                                              PO {v.poNumbers.join(', ')}
                                                            </p>
                                                          </div>
                                                          <span className="shrink-0 text-[11px] text-slate-600 tabular-nums" style={{ fontWeight: 600 }}>
                                                            {v.qty} {v.uom}
                                                          </span>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                  <p className="px-3 py-2 border-t border-[#EEF2F6] bg-[#FAFBFC] text-[10px] text-slate-500 leading-snug">
                                                    Which of them the credit settles against is decided in Return Logistics.
                                                  </p>
                                                </PopoverContent>
                                              </Popover>
                                            );
                                          })()}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                                {(() => {
                                  const skuLines = lineItems.filter((l) => l.sku === item.sku);
                                  const itemTotal = skuLines.reduce((sum, l) => sum + l.invoiceQty, 0);
                                  const itemCap = skuLines.reduce((sum, l) => sum + l.remainingQty, 0);
                                  const none = isRma && itemTotal <= 0;
                                  // The figure and its ceiling in one pill, so
                                  // the header answers "how much, out of what"
                                  // the same way the quantity card does.
                                  return (
                                    <span
                                      className={`shrink-0 inline-flex items-baseline gap-1 px-2.5 py-1 rounded-full ${
                                        none ? 'bg-slate-50 border border-slate-200' : 'bg-slate-100'
                                      }`}
                                    >
                                      <span
                                        className={`text-[12px] tabular-nums ${none ? 'text-slate-400' : 'text-gray-900'}`}
                                        style={{ fontWeight: 600 }}
                                      >
                                        {none ? '—' : formatQty(itemTotal)}
                                      </span>
                                      <span className="text-[11px] text-slate-500 tabular-nums">
                                        {isRma ? `of ${formatQty(itemCap)} ${item.uom}` : `${item.uom} to return`}
                                      </span>
                                    </span>
                                  );
                                })()}
                              </div>

                              <div className="space-y-3">
                                {/* Only for lines with no invoice split behind
                                    them. Where there is one, the settlement card
                                    already quotes what is available and what is
                                    going back, so this pair would say it twice. */}
                                {!useBreakdown && (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Received on this PO</Label>
                                    <div className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 flex items-center gap-1.5">
                                      <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>{item.uom}</span>
                                      <span className="text-[12px] text-slate-600 tabular-nums" style={{ fontWeight: 600 }}>{item.receivedQty}</span>
                                    </div>
                                  </div>
                                  <div className="space-y-1.5">
                                  <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Return Qty</Label>
                                  {isSerialLine ? (
                                    <SerialQtyCell
                                      sku={item.sku}
                                      poLineId={item.id}
                                      receivedQty={item.receivedQty}
                                      selected={lineSerialList}
                                      onOpen={() => setSerialModalLineId(item.id)}
                                      size="md"
                                      align="start"
                                    />
                                  ) : (
                                    <label className={`h-9 rounded-md border bg-white px-2.5 flex items-center gap-1.5 cursor-text focus-within:ring-1 ${
                                      isOverBilled
                                        ? 'border-red-400 focus-within:ring-red-100 focus-within:border-red-500'
                                        : 'border-emerald-200 focus-within:ring-emerald-100'
                                    }`}>
                                      <span className="text-[11px] text-slate-500 pointer-events-none shrink-0" style={{ fontWeight: 600 }}>{item.uom}</span>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={item.invoiceQty}
                                        onChange={(e) => handleQtyInput(item.id, e)}
                                        className={`h-7 flex-1 min-w-0 border-0 bg-transparent p-0 text-left text-[12px] tabular-nums shadow-none font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0 ${
                                          isOverBilled ? 'text-red-600' : 'text-emerald-700'
                                        }`}
                                      />
                                    </label>
                                  )}
                                  {isOverBilled && (
                                    <p className="flex items-center gap-1 text-[10px] text-red-600" style={{ fontWeight: 500 }}>
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      You can't return more than the {item.remainingQty} {item.uom} available.{' '}
                                      <button
                                        type="button"
                                        onClick={() => updateLineItem(item.id, 'invoiceQty', item.remainingQty)}
                                        className="text-[10px] text-primary underline decoration-primary/60 underline-offset-2 hover:text-blue-700 transition-colors p-0 bg-transparent border-0"
                                        style={{ fontWeight: 600, fontFamily: 'inherit' }}
                                      >
                                        Reset
                                      </button>
                                    </p>
                                  )}
                                  </div>
                                </div>
                                )}

                                {/* A serialized line ships named units, so it
                                    starts with nothing picked. The qty control
                                    can't say that on its own, so the count and
                                    the way to set it sit together here. */}
                                {isSerialLine && !useBreakdown && (
                                  <div className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                                    lineSerialList.length === 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
                                  }`}>
                                    <div className="flex items-start gap-2 min-w-0">
                                      <ScanLine className={`w-3.5 h-3.5 shrink-0 mt-px ${lineSerialList.length === 0 ? 'text-amber-500' : 'text-slate-400'}`} />
                                      <p className="text-[10px] text-slate-500 leading-snug" style={{ fontWeight: 500 }}>
                                        {lineSerialList.length === 0 ? (
                                          <>
                                            <span className="text-amber-700">No serial numbers selected yet.</span>{' '}
                                            Pick the units you are shipping back from the {item.receivedQty} received on this PO.
                                          </>
                                        ) : (
                                          <>
                                            <span className={lineSerialList.length === item.receivedQty ? 'text-slate-700' : 'text-amber-700'}>
                                              {lineSerialList.length === item.receivedQty
                                                ? `All ${item.receivedQty} serial numbers received on this PO are selected to ship back.`
                                                : `${lineSerialList.length} of ${item.receivedQty} serial numbers selected, ${item.receivedQty - lineSerialList.length} staying with you.`}
                                            </span>{' '}
                                            Deselect any unit you are keeping.
                                          </>
                                        )}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setSerialModalLineId(item.id)}
                                      className={`shrink-0 h-7 px-2.5 rounded-md border bg-white text-[10px] transition-colors cursor-pointer ${
                                        lineSerialList.length === 0
                                          ? 'border-amber-300 text-amber-700 hover:border-amber-400'
                                          : 'border-slate-200 text-slate-600 hover:text-primary hover:border-primary/40'
                                      }`}
                                      style={{ fontWeight: 600 }}
                                    >
                                      {lineSerialList.length === 0 ? 'Select units' : 'Review units'}
                                    </button>
                                  </div>
                                )}

                                {/* Money is priced per invoice state where there is
                                    one, and the line carries the weighted average
                                    of those states. */}
                                {/* Price and total are stated, not entered:
                                    a return settles at what the goods were
                                    billed at, so the figures are read off the
                                    line rather than re-typed. */}
                                {!useBreakdown && (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Price Per Unit</Label>
                                    <div className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 flex items-center gap-1">
                                      <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>$</span>
                                      {/* Several vendors price the same item
                                          differently, so a single line's price
                                          would not square with a total summed
                                          across all of them. State the blend. */}
                                      <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                                        {(() => {
                                          const qty = groupLines.reduce((n, l) => n + l.invoiceQty, 0);
                                          const value = groupLines.reduce((n, l) => n + l.invoiceQty * l.unitPrice, 0);
                                          const blended = qty > 0 ? value / qty : item.unitPrice;
                                          return blended.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                        })()}
                                      </span>
                                      {new Set(groupLines.map((l) => l.unitPrice)).size > 1 && (
                                        <span className="text-[10px] text-slate-400 ml-0.5" style={{ fontWeight: 500 }}>avg</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Total</Label>
                                    <div className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2.5 flex items-center gap-1">
                                      <span className="text-[11px] text-slate-500" style={{ fontWeight: 600 }}>$</span>
                                      <span className="text-[12px] text-foreground tabular-nums" style={{ fontWeight: 600 }}>
                                        {groupLines
                                          .reduce((sum, l) => sum + l.invoiceQty * l.unitPrice, 0)
                                          .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Expected resolution date</Label>
                                    <label className="h-9 rounded-md border border-slate-200 bg-white px-2.5 flex items-center gap-1.5 cursor-text focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary transition-colors">
                                      <CalendarClock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <Input
                                        type="date"
                                        value={resolutionDateFor(item.id, item.poNumber)}
                                        onChange={(e) =>
                                          setLineExpectedResolution((prev) => ({ ...prev, [item.id]: e.target.value }))
                                        }
                                        className="h-7 flex-1 min-w-0 border-0 bg-transparent p-0 text-[12px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                        style={{ fontWeight: 600 }}
                                      />
                                    </label>
                                  </div>
                                </div>
                                )}

                                {/* Why a line comes back. How it settles is
                                    not asked any more -- the ledger decides
                                    it from the invoice state. */}
                                {!useBreakdown && (
                                <div className="grid grid-cols-1 gap-3">
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] text-slate-500" style={{ fontWeight: 500 }}>Return Reason</Label>
                                    <Select value={returnReasonFor(item.id)} onValueChange={(next) => setLineReason(item.id, next, item.invoiceSplit)}>
                                      <SelectTrigger className="h-9 text-[12px] bg-white border-slate-200 hover:border-primary/40 focus:ring-1 focus:ring-primary/20 rounded-md">
                                        <SelectValue placeholder="Select reason" />
                                      </SelectTrigger>
                                      <SelectContent className="text-[12px] z-[220]">
                                        {RETURN_REASONS.map((r) => (
                                          <SelectItem key={r} value={r} className="text-[12px]">{r}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                )}

                                <div className="p-4 sm:p-5 space-y-3">
                                {/* Two columns, as the reference lays its
                                    configure step out: the primary card on
                                    the left, the supporting ones stacked on
                                    the right. */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                                <div className="space-y-3">
                                {useBreakdown && (
                                  <ReturnUnitsCard
                                    uom={item.uom}
                                    available={totalAvailable}
                                    qty={totalQty}
                                    credit={returnCredit}
                                    purchaseOrders={poChips}
                                    receipts={receiptChips}
                                    invoices={invoiceChips}
                                    onQtyChange={setTotalQty}
                                    expectedResolution={resolutionDateFor(item.id, item.poNumber)}
                                    onExpectedResolutionChange={(next) =>
                                      setLineExpectedResolution((prev) => ({ ...prev, [item.id]: next }))
                                    }
                                    {...(isSerialLine
                                      ? { onPickUnits: () => setSerialModalLineId(item.id) }
                                      : {})}
                                    onReturnAll={() => fillSources(true)}
                                    onClear={() => fillSources(false)}
                                    reasons={RETURN_REASONS}
                                    reason={lineReason}
                                    onReasonChange={setLineReasonAll}
                                    type={lineType}
                                    typeOptions={lineTypeOptions}
                                    onTypeChange={setLineTypeAll}
                                    // The sheet is reached from a vendor row, so
                                    // by the time it is open the vendor is named
                                    // in its own heading. Saying it is chosen
                                    // next was left over from the step before.
                                    vendorResolved={detailVendor !== null || !unresolvedVendorSkus.has(item.sku)}
                                    {...(noReceipts ? { noReceipts: true } : {})}
                                  />
                                )}


                                </div>

                                {/* Right column — Notes and Supporting
                                    Documents. The forecast moved in beside the
                                    quantity: both are things set about the
                                    line, and a card of its own for one date
                                    was a card too many. */}
                                <div className="space-y-3">
                                  {/* Above Notes, because where the credit lands
                                      is the first thing anyone opening a vendor's
                                      sheet is here to check. */}
                                  {detailVendor && (
    <ReturnVendorCard
    vendorName={detailVendor.vendorName}
    rmaNumber={originRmaNumber[detailVendor.vendorCode] ?? ''}
    onRmaNumber={(next) =>
    setOriginRmaNumber((prev) => ({ ...prev, [detailVendor.vendorCode]: next }))
    }
    payToLabel={
    PAY_FROM_ACCOUNTS.find((a) => a.id === payToForVendor(detailVendor.vendorName))?.label ?? ''
    }
    onEditPayTo={() => openPayToForVendor(detailVendor.vendorName)}
    glAccount={apAccountForVendor(detailVendor.vendorName)}
    />
                                  )}
                                  <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <div className="flex items-center gap-2.5 px-4 py-3">
                                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#DBEAFE] border border-blue-200 shrink-0">
                                        <FileText className="w-3.5 h-3.5 text-primary" />
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Notes</p>
                                        <p className="text-[11px] text-slate-500 mt-px">Context the vendor needs to process this line.</p>
                                      </div>
                                    </div>
                                    <div className="border-t border-[#EEF2F6] p-3 sm:p-4 bg-white">
                                      <Textarea
                                        placeholder="Add context the vendor needs to process this line."
                                        value={lineNotes[item.id] ?? ''}
                                        onChange={(e) => setLineNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                        className="min-h-[68px] text-[11px] bg-white border-slate-200 shadow-none resize-none placeholder:text-[11px] placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-primary/20 focus-visible:border-primary"
                                        style={{ fontWeight: 400 }}
                                      />
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-[#E8ECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                    <div className="flex items-center gap-2.5 px-4 py-3">
                                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#DBEAFE] border border-blue-200 shrink-0">
                                        <Paperclip className="w-3.5 h-3.5 text-primary" />
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>Attachments</p>
                                        <p className="text-[11px] text-slate-500 mt-px">
                                          {files.length === 0
                                            ? 'Damage photos, the authorization email, or the inspection report.'
                                            : `${files.length} file${files.length === 1 ? '' : 's'} attached`}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="border-t border-[#EEF2F6] p-3 sm:p-4 bg-white">
                                      <CreateLineAttachments
                                        lineId={item.id}
                                        files={files}
                                        onChange={(next) => setLineAttachments((prev) => ({ ...prev, [item.id]: next }))}
                                      />
                                    </div>
                                  </div>
                                </div>
                                </div>

                                {/* The source documents were named again here,
                                    back when the units card said nothing about
                                    where they came from. It now lists every
                                    receipt the return draws on, across all of
                                    the item's orders, where this card only ever
                                    showed the focused line's single PO -- two
                                    answers to one question, the narrower one
                                    sitting lower down the pane. */}
                              </div>
                              </div>
                            </>
                          );
                        })()}

                      </div>

                      {/* The way out, said as a decision rather than a dismissal.
                          Cancel restores what the sheet found; Save keeps it and
                          closes, because the fields have already written
                          through. */}
                      <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border bg-white px-5 py-3">
                        <p className="min-w-0 truncate text-[12px] text-slate-500">
                          {detailVendor
                            ? `Applies to ${focused.sku} coming back from ${detailVendor.vendorName}.`
                            : `Applies to ${focused.sku}.`}
                        </p>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={revertLineSheet}
                            className="inline-flex items-center h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] text-foreground transition-colors hover:bg-slate-50"
                            style={{ fontWeight: 500 }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={closeLineSheet}
                            className="inline-flex items-center h-9 rounded-lg bg-primary px-4 text-[13px] text-white shadow-sm transition-colors hover:bg-blue-700"
                            style={{ fontWeight: 600 }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                  );
                })()}

      {/* A vendor's catalogue, opened from their card on the second step. It is
          the first step's own modal: same rows, same quantity field, same
          serial picker, so a vendor's second item is added exactly the way
          their first one was. */}
      {isRma && addItemsVendor && (
        <VendorItemsSheet
          vendorCode={addItemsVendor}
          onClose={() => setAddItemsVendor(null)}
          onAdd={(picks) => {
            const already = new Set(lineItems.map((l) => l.sku));
            handleAddPOs(
              selectionFromVendorItems(
                addItemsVendor,
                picks.filter((p) => !already.has(p.sku)),
              ),
            );
            setAddItemsVendor(null);
          }}
          onPickSerials={(sku) => { setAddItemsVendor(null); pickSerialsFor(sku); }}
        />
      )}

      {/* Which branch takes the group's return, asked on the way into merging. */}
      {isRma && mergeOpen && (() => {
        const groups = mergeableFamilies(groupingLegs);
        if (groups.length === 0) return null;
        return (
          <ReturnFamilyMergeModal
            groups={groups.map((family) => ({
              familyCode: family.familyCode,
              familyName: family.familyName,
              candidates: family.legs.map((l) => ({
                vendorCode: l.vendorCode,
                vendorName: l.vendorName,
                items: l.items,
                units: l.units,
                uom: l.uom,
              })),
            }))}
            chosen={mergeInto}
            onClose={() => {
              // Backing out of the question backs out of the answer it was for,
              // unless a branch was already carrying it from an earlier pass.
              setMergeOpen(false);
              if (!groups.some((g) => mergeInto[g.familyCode])) setSplitMode('split');
            }}
            onMerge={(picks) => {
              // Every group at once, because the dialog asked about every group
              // at once. Answering them one dialog at a time asked the same
              // question twice and never showed the whole of it.
              setMergeInto((prev) => ({ ...prev, ...picks }));
              setSplitMode('merge');
              setMergeOpen(false);
            }}
          />
        );
      })()}

      {/* The vendor's own sheet is gone. It carried the same three fields the
          line sheet now carries, so opening a vendor and opening a line were
          two ways to edit halves of one decision. The line sheet holds both. */}

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
                    <span className="text-[15px] font-mono text-gray-900" style={{ fontWeight: 700 }}>{sku}</span>
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
                      <div className="text-[10px] text-slate-400 mt-0.5" style={{ fontWeight: 500 }}>Price Per Unit</div>
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
                      <h3 className="text-[13px] font-bold text-foreground">GL Configuration</h3>
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
                        <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">{category}</span>
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
                                  <span className={`text-[11px] font-semibold tracking-tight ${isSelected ? 'text-blue-700' : 'text-muted-foreground'}`}>{code}</span>
                                  <span className={`text-[11px] font-medium truncate ${isSelected ? 'text-blue-600' : 'text-muted-foreground'}`}>{name}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider shrink-0">DR</span>
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
                      <h3 className="text-[13px] font-bold text-foreground">GL Configuration</h3>
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
                    <span className="text-[10px] font-medium text-muted-foreground/70">
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
                        <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">{category}</span>
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
                                  <span className={`text-[11px] font-semibold tracking-tight ${isSelected ? 'text-blue-700' : 'text-muted-foreground'}`}>{code}</span>
                                  <span className={`text-[11px] font-medium truncate ${isSelected ? 'text-blue-600' : 'text-muted-foreground'}`}>{name}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider shrink-0">DR</span>
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

      {/* Browse Payment Terms. The shell lives in its own component now, so
          the return detail page opens the same modal from its vendor card
          rather than a smaller picker standing in for it. */}
      <PaymentTermsBrowseModal
        open={paymentTermsModalOpen}
        onOpenChange={setPaymentTermsModalOpen}
        selectedTermId={selectedPaymentTermId}
        inheritedTermName={vendorDefaultPaymentTerm}
        onApply={(t) => {
          setSelectedPaymentTermId(t.id);
          setPaymentTermsDraft(t.name);
          setPaymentTermsModalOpen(false);
          if (t.name !== paymentTerms) setPaymentTermsConfirmOpen(true);
        }}
      />

      {/* Payment Terms scope confirmation — ported from the partner
          Vendor Rules Configuration "Save Changes" dialog
          (GroupBulkApplyModal). Glow header with icon disk + uppercase
          chip, centered title + description, "Changes you made" panel
          showing the prev → next diff, and two option cards: keep the
          new term scoped to this invoice/PO, or push it to the vendor
          profile so future invoices default to it. */}
      <AlertDialog open={paymentTermsConfirmOpen} onOpenChange={setPaymentTermsConfirmOpen}>
        <AlertDialogContent
          className="flex flex-col p-0 gap-0 border-0 sm:border !max-w-[600px] !w-[600px] !rounded-2xl overflow-hidden shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)]"
          style={{ zIndex: 230 }}
          onInteractOutside={() => setPaymentTermsConfirmOpen(false)}
        >
          <AlertDialogHeader className="sr-only">
            <AlertDialogTitle>Update payment terms</AlertDialogTitle>
            <AlertDialogDescription>Choose how broadly this payment-term update should apply.</AlertDialogDescription>
          </AlertDialogHeader>

          {/* Glow header */}
          <div className="relative flex flex-col items-center pt-10 pb-6" style={{ background: 'linear-gradient(180deg, #EBF3FF 0%, rgba(235,243,255,0.3) 70%, transparent 100%)' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] h-[80px] rounded-full blur-[50px] opacity-25" style={{ backgroundColor: '#0A77FF' }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#D6E8FF' }}>
              <Tag className="w-8 h-8" style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <span
              className="mt-4 px-3 py-1 rounded-full text-[11px]"
              style={{ fontWeight: 600, backgroundColor: '#EBF3FF', color: '#044394', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
            >
              Update Payment Terms
            </span>
          </div>

          {/* Body */}
          {(() => {
            const vendorName = vendorData?.vendorName || standaloneVendor?.vendorName || 'this vendor';
            return (
              <div className="flex flex-col items-center text-center px-7 pb-7">
                <h2 className="text-[18px] tracking-[-0.02em]" style={{ fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                  Update payment terms for {vendorName}?
                </h2>
                <p className="text-[13px] mt-2 max-w-[420px] leading-[1.65]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Choose how broadly this update should apply.
                </p>

                {/* What you're updating — single-line diff, no count pill
                    since only one field can change here. */}
                <div className="w-full mt-5 rounded-xl border px-4 py-3 text-left" style={{ backgroundColor: '#EEF2FF', borderColor: '#E0E7FF' }}>
                  <p className="text-[10px] uppercase tracking-wide mb-2" style={{ fontWeight: 600, color: '#4338CA' }}>What you're updating</p>
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#4F46E5] shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                      <span className="text-[11px] text-foreground" style={{ fontWeight: 500 }}>Payment Term</span>
                      <span className="text-[11px] text-slate-600 inline-flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-slate-500 line-through tabular-nums">{paymentTerms}</span>
                        <span className="text-slate-400">→</span>
                        <span className="tabular-nums" style={{ color: '#4F46E5', fontWeight: 600 }}>{paymentTermsDraft}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Option cards + Cancel */}
                <div className="w-full mt-6 flex flex-col gap-2.5 text-left">
                  {/* Option 1, Apply for this PO only. */}
                  <button
                    type="button"
                    onClick={() => {
                      if (termsTargetVendor) {
                        setVendorPaymentTerms((prev) => ({ ...prev, [termsTargetVendor]: paymentTermsDraft }));
                        setTermsTargetVendor(null);
                      } else {
                        setPaymentTerms(paymentTermsDraft);
                      }
                      setPaymentTermsConfirmOpen(false);
                    }}
                    className="w-full text-left rounded-xl border border-border bg-white hover:border-slate-300 hover:shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)] transition-all cursor-pointer p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-slate-100 text-slate-600">
                        <Check className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground" style={{ fontWeight: 600 }}>
                          Apply for this PO only
                        </p>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-[11px] text-slate-600 truncate">
                              Only this invoice uses the new term.
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
                      if (termsTargetVendor) {
                        setVendorPaymentTerms((prev) => ({ ...prev, [termsTargetVendor]: paymentTermsDraft }));
                        setTermsTargetVendor(null);
                      } else {
                        setPaymentTerms(paymentTermsDraft);
                      }
                      setPaymentTermsConfirmOpen(false);
                    }}
                    className="w-full text-left rounded-xl border border-blue-100 bg-accent hover:bg-blue-100 transition-colors cursor-pointer p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 bg-primary text-white shadow-[0_1px_4px_rgba(10,119,255,0.25)]">
                        <Zap className="w-[18px] h-[18px]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[13px] text-primary" style={{ fontWeight: 600 }}>
                            Apply for {vendorName} going forward
                          </p>
                          <span className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] border bg-white text-primary border-primary/20" style={{ fontWeight: 600 }}>
                            Vendor default
                          </span>
                        </div>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-[11px] text-slate-700 truncate">
                              Sets the vendor's default payment term.
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
                      <ChevronRightIcon className="w-4 h-4 text-primary shrink-0 mt-2" />
                    </div>
                  </button>

                  {/* Cancel — full-width muted button. */}
                  <button
                    onClick={() => setPaymentTermsConfirmOpen(false)}
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

      <CarrierBrowseModal
        open={carrierModalOpen}
        onOpenChange={setCarrierModalOpen}
        title={copy.logisticsSection}
        subtitle={copy.carrierBrowseSubtitle}
        entityNoun={isRma ? 'return' : 'invoice'}
        selectedId={carrierDraftId}
        vendorDefaultCarrierId={vendorDefaultCarrierId}
        onApply={(c) => {
          setCarrierDraftId(c.id);
          if (c.id !== selectedCarrier?.id) setCarrierConfirmOpen(true);
        }}
      />

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
            <AlertDialogTitle>Update carrier</AlertDialogTitle>
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
              style={{ fontWeight: 600, backgroundColor: '#FFFBEB', color: '#92400E', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}
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
                  <p className="text-[10px] uppercase tracking-wide mb-2" style={{ fontWeight: 600, color: '#92400E' }}>What you're updating</p>
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
                          {copy.carrierScopeOne}
                        </p>
                        <div className="mt-2 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-[11px] text-slate-600 truncate">
                              {copy.carrierScopeOneHint}
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
                            Vendor default
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
                              {copy.carrierScopeAllHint}
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

      {/* Pay-from account picker, shared with the Record Payment flow. */}
      <PayFromAccountModal
        open={payFromModalOpen}
        onOpenChange={setPayFromModalOpen}
        value={payToTargetVendor ? payToForVendor(payToTargetVendor) : payFromId}
        accounts={isRma ? PAY_TO_ACCOUNTS : PAY_FROM_ACCOUNTS}
        {...(isRma
          ? { title: 'Refund account', subtitle: "Where the vendor's refund is expected to land. Set on the partner." }
          : {})}
        onApply={(id) => {
          if (payToTargetVendor) {
            setVendorPayToIds((prev) => ({ ...prev, [payToTargetVendor]: id }));
            setPayToTargetVendor(null);
          } else {
            setPayFromId(id);
          }
        }}
      />

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
                              <span className={`text-[12px] tabular-nums shrink-0 ${isSelected ? 'text-primary' : 'text-slate-500'}`} style={{ fontWeight: 600 }}>
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
                    <th className="px-4 py-3 text-right">Price Per Unit</th>
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
                        <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5 uppercase tracking-tighter">{item.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[12px] font-semibold text-foreground">{item.quantity} {item.uom}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[12px] font-bold text-muted-foreground">${item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
            <Button variant="outline" onClick={onClose} className="h-10 px-6 font-semibold text-[11px] tracking-widest uppercase border-border">
              Cancel
            </Button>
            <Button 
              onClick={handleAdd}
              disabled={selectedIds.size === 0}
              className="h-10 px-8 font-semibold text-[11px] tracking-widest uppercase bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              Add items
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
