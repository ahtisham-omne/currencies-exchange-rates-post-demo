import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  ChevronDown,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ArrowLeft,
  FileText,
  Building2,
  User,
  CreditCard,
  Paperclip,
  Package,
  Truck,
  MapPin,
  CalendarDays,
  CalendarClock,
  Pencil,
  Check,
  CheckCircle2,
  Clock,
  PackageCheck,
  Download,
  Printer,
  Eye,
  ShoppingBag,
  CircleDollarSign,
  Tag,
  Send,
  BadgeDollarSign,
  Info,
  X,
  Save,
  Lock,
  PackageOpen,
  ClipboardCheck,
  AlertCircle,
  Clipboard,
  Plus,
  Trash2,
  Copy,
  Archive,
  ArchiveRestore,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Phone,
  Mail,
  Search,
  Star,
  Users,
  FlaskConical,
  Receipt,
  Landmark,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

/* ── shadcn/ui component imports (Priority A) ── */
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import POInactiveItemsWarningModal, { type InactiveWarningMode } from "./POInactiveItemsWarningModal";
import ItemStatusChip from "./ItemStatusChip";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

/* ── Store ── */
import {
  getPO,
  subscribeToPOStore,
  updatePOStatus,
  updateLineItem,
  updatePORulingDeactivation,
  getShipmentMethodLabel,
  sendPO,
  confirmPO,
  recordReceiving,
  getReceivingProgress,
  removeLineItemFromPO,
  addLineItemToPO,
  updatePORecipient,
  updatePOContacts,
  updatePOPayment,
  updatePODeliveryDate,
  duplicatePO,
  revertPOStatus,
  cancelPO,
  cancelRemaining,
  markPOFullyReceived,
  reactivatePO,
  cancelLineItem,
  isPOVersionLocked,
  isPOArchived,
  canArchivePO,
  archivePO,
  restorePO,
  ARCHIVE_CANCELS_STATUSES,
  recordPOVersion,
  revertPOToVersion,
  buildVersionSnapshot,
  restorePOFromSnapshot,
  getLineItemNoteCounts,
  computeExpectedDeliveryDate,
  computeExpectedPOCompletion,
  setPOAdjustments,
  recalcPOTotals,
  setPOCurrency,
  describeRateChange,
  poRateFields,
} from "./poStore";
import type { PurchaseOrderData, POStatus, POLineItem, POChangeRecord, POVersionEntry, POVersionSnapshot, POVersionStatus, PONoteType, POVendor } from "./poStore";
import { permissionReason, useCan } from "./poPermissions";
import {
  SHOW_PO_PRICING_RULES,
  getVendorRules,
  computeLineBreakdowns,
  computePOSubtotal,
  enforceHundredPercentCap,
  type LinePricingBreakdown,
} from "./poPricingRulesData";
import { POPriceBreakdownHoverCard } from "./POPriceBreakdownHoverCard";
import { ManageAdjustmentsModal, AddOrderLevelAdjustmentModal } from "./ManageAdjustmentsModal";
import { usePOAdjustments } from "./usePOAdjustments";
import {
  computePOPricing,
  computePORuleBreakdowns,
  poAdjustmentsForLine,
  replaceLineAdjustments,
  type LineAdjustmentBreakdown,
} from "./poOrderPricing";
import { POPricingRulesManageModal } from "./POPricingRulesManageModal";
import type { VendorEntity, VendorLocationInfo } from "./catalogData";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import ItemsCatalogueModal from "./CatalogueModal";
import type { CatalogItem } from "./catalogData";
import { OutdatedConfigsPill } from "./OutdatedConfigsPill";
import { OutdatedConfigsModal, type OutdatedUpdate } from "./OutdatedConfigsModal";
import {
  getOutdatedForId,
  markOutdatedApplied,
  markOutdatedIgnored,
  shouldShowOutdatedBanner,
  dismissOutdatedBanner,
} from "./outdatedConfigs";
import OutdatedSyncOverlay from "./OutdatedSyncOverlay";
import POVersionHistoryModal from "./POVersionHistoryModal";
import POVersionRevertModal from "./POVersionRevertModal";
import { getVendorContacts, PAY_TO_VENDORS, SHIPPED_TO_VENDORS, FUNDED_BY_VENDORS, CATALOG, getVendorUnitPrice, upsertVendorUnitPrice, qualifyItemForVendorGlobally } from "./catalogData";
import { PriceConfirmationDialog, PriceWarningShell, classifyPriceChange, type PriceCheckOutcome } from "./PriceConfirmationDialog";
import { PODiscardDialog } from "./PODiscardDialog";
import VendorSelectionDialog from "./VendorSelectionDialog";
import type { VendorSelection } from "./VendorSelectionDialog";
import { SelectPartnerLocationDialog } from "./SelectPartnerLocationDialog";
import { CancelReasonFields, useCancelReason } from "./CancelReasonFields";
import { POActionDialog } from "./POActionDialog";
import { PODocumentPreviewDialog } from "./PODocumentPreviewDialog";
import { PARTNER_LOCATION_ITEMS, OUR_COMPANY_ITEM } from "./partnerLocationData";

import PaymentTermsDialog from "./PaymentTermsDialog";
import { BrowsePaymentTermsModal } from "./BrowsePaymentTermsModal";
import { PAYMENT_TERM_PRESETS } from "./paymentTermPresets";
import { SelectPOCsModal } from "./SelectPOCsModal";
import SelectPaymentMethodModal from "./SelectPaymentMethodModal";
import { FONT } from "./designTokens";
import { DocCurrencyProvider, DocMoney } from "./currency/DocCurrency";
import { useDocCurrency } from "./currency/docCurrencyContext";
import { CurrencyFlag } from "./currency/CurrencyChip";
import { POCurrencyFields, type POCurrencyChange } from "./currency/POCurrencyFields";
import { BASE_CURRENCY } from "@/app/currency/currencies";
import { currencyDecimals, formatMoney, moneyPrefix } from "@/app/currency/money";
import { crossRate, fromPOCurrency, poFx, roundTo, ruleAmountFactor, vendorCurrency } from "@/app/currency/poFx";
import { midRateOn, toBase } from "@/app/currency/rates";
import { ArchivePODialog } from "./ArchivePODialog";
import TransitionOverlay from "./TransitionOverlay";
import { StateTransitionOverlay } from "./StateTransitionOverlay";
import { usePOTransitions } from "./usePOTransitions";
import AppShell from "./layout/AppShell";
// Partners-aligned horizontal padding for the PO detail page (header
// outer + cancellation banners + body section). Caps at `xl:px-8` (32px)
// so the page never gets the huge `2xl:px-16` / `3xl:px-24` gutters that
// the shared `PX` const adds for the listing view. Mirrors
// `Partners/.../VendorDetailsPage.tsx:723,989`.
const DETAIL_PX = "px-4 lg:px-6 xl:px-8";

/* Feature flag — parks the Credit Limits + People sidebar sections
   behind a switch (buyer 2026-07-28: "remove credit limits and people
   from detail page every state, preserve this to you maybe we need it
   back after sometime"). Flip to `true` to render both sections. The
   underlying JSX and its data plumbing (`creditRemaining`, `po.createdBy`,
   `po.approvedBy`, etc.) are kept intact so the sections can be re-
   enabled without rewiring. Same "hide + preserve" pattern used for
   Purchase Requests in the planner (`SHOW_PURCHASE_REQUESTS_IN_PLANNER`
   in `procurementPlanningParams.ts`). */
const SHOW_PO_CREDIT_LIMITS_AND_PEOPLE = false;

// Single morph-transition recipe used by every scroll-morphed element
// in the detail header. Standardising on `all 250ms` with Tailwind's
// canonical ease curve keeps the title row's animation in lockstep —
// previously we had 200ms / 250ms / 300ms / 400ms scattered across
// elements, which made the morph feel choppy as elements arrived at
// their compact state at different moments.
const MORPH_TRANSITION = "all 250ms cubic-bezier(0.4, 0, 0.2, 1)";
import {
  VendorInfoCard,
  CollapsibleSection,
} from "./POSidebarSections";
import { DashInfoLabel } from "./_dashboardModalKit";
import PODetailTabs from "./PODetailTabs";
import { AttachmentsTab as PODetailAttachmentsTab } from "./po/AttachmentsTab";
import { generateAttachments as generatePoAttachments } from "./po/attachmentSeed";
import POVersionSaveModal from "./POVersionSaveModal";
import OrderFlow from "./OrderFlow";
import type { OrderFlowItem, OrderFlowResult } from "./OrderFlow";
import TruncatedItemName from "./TruncatedItemName";
import BackButton from "./BackButton";
import ImageLightbox from "./ImageLightbox";
import { QuickViewPanel, type QuickViewData } from "./QuickViewPanel";
import POVersionHistoryTab from "./POVersionHistoryTab";
import {
  formatQuantityValue,
  getDraftQuantityValue,
  isValidQuantityDraft,
  parseQuantityDraft,
  preventInvalidQuantityKey,
} from "./quantityInputUtils";

function isSerializedLineItem(li: POLineItem) {
  const hash = li.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 3 === 0;
}
import POVersionDropdown from "./POVersionDropdown";
import { getItemImages } from "./catalogData";
import PONotesSection, { LineItemNoteIndicator } from "./PONotesSection";

/* Funded By: Our Company first (the default), then partners (ERP-4790). */
const FUNDED_BY_PICKER_ITEMS = [
  OUR_COMPANY_ITEM,
  ...PARTNER_LOCATION_ITEMS.filter((i) => i.type === "partner").map((i) => ({ ...i, isDefault: false })),
];

/* ═════════════════════���═══════�������═════������════════════════════��═════
   TYPOGRAPHY — CSS variable-bound, Inter only
   ═══════════════════════════════════════════════════════════════ */

const st = {
  pageTitle: {
    fontSize: "var(--text-h3)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,

  pageSub: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,

  sectionHeading: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,

  fieldLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,

  fieldValue: {
    fontSize: "13px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,

  fieldValueBold: {
    fontSize: "13px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,

  uiCaption: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,

  uiLabel: {
    fontSize: "12px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,

  uiSmall: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,

  tiny: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,

  priceValue: {
    fontSize: "13px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.4",
    fontFamily: FONT,
  } as React.CSSProperties,

  totalLabel: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,

  badgeMeta: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.35",
    fontFamily: FONT,
  } as React.CSSProperties,

  // Stepper labels — 10px ladder matches Partners' compact label rhythm
  // (`Partners/.../VendorDetailsPage.tsx` description + tab bar). Reduced
  // from 11px so the LifecycleTracker reads as a status strip, not a
  // headline.
  stepLabel: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
  } as React.CSSProperties,

  stepLabelActive: {
    fontSize: "10px",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
  } as React.CSSProperties,

  summaryLabel: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-normal)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,

  summaryValue: {
    fontSize: "var(--text-label)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.45",
    fontFamily: FONT,
  } as React.CSSProperties,

  grandTotal: {
    fontSize: "var(--text-h2)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
  } as React.CSSProperties,

};

/* ── POLineItem → OrderFlowItem mapper ── */
function poLineItemToOrderFlowItem(li: POLineItem, vendorName: string): OrderFlowItem {
  // Look up the catalog item by itemNumber to get the correct catalog ID for vendor offers
  const catalogMatch = CATALOG.find(c => c.itemNumber === li.itemNumber);
  return {
    id: catalogMatch?.id ?? li.id,
    itemNumber: li.itemNumber,
    descriptiveName: li.descriptiveName,
    image: li.image,
    unitPrice: li.unitPrice,
    currentStock: Math.round(li.quantity * 1.8),  // derived estimate
    minQuantity: Math.max(1, Math.round(li.quantity * 0.5)),
    shortageDate: null,
    partnerLocation: vendorName,
    category: li.category,
    location: li.inboundLocation,
    vendorUOM: li.vendorUOM,
    vendorUOMQty: li.vendorUOMQty,
    defaultUOM: li.defaultUOM,
    discount: li.discount,
    inactive: li.inactive,
  };
}

/* ── Lifecycle Steps ── */
const LIFECYCLE_STEPS: { status: POStatus; label: string; icon: React.ElementType }[] = [
  { status: "Draft", label: "Draft", icon: FileText },
  { status: "Sent", label: "Sent", icon: Send },
  { status: "Confirmed", label: "Confirmed", icon: Check },
  { status: "Partially Received", label: "Partially Received", icon: PackageCheck },
  { status: "Fully Received", label: "Fully Received", icon: Package },
];

/* ══════════════════════��═════════════��══════════════════════════
   STATUS BADGE — uses shadcn Badge + semantic colour overrides
   ═════════════════════���═══════════════════════════��═���═══════════ */

const STATUS_INLINE: Record<POStatus, React.CSSProperties> = {
  Draft: { backgroundColor: "var(--status-draft-bg)", color: "var(--status-draft-text)" },
  Confirmed: { backgroundColor: "var(--status-confirmed-bg)", color: "var(--status-confirmed-text)" },
  Sent: { backgroundColor: "var(--status-sent-bg)", color: "var(--status-sent-text)" },
  "Partially Received": { backgroundColor: "var(--status-partial-bg)", color: "var(--status-partial-text)" },
  "Fully Received": { backgroundColor: "var(--status-received-bg)", color: "var(--status-received-text)" },
  Cancelled: { backgroundColor: "var(--status-cancelled-bg)", color: "var(--status-cancelled-text)" },
  "Active with Cancellations": { backgroundColor: "var(--status-active-cancel-bg)", color: "var(--status-active-cancel-text)" },
  "Fully Received with Cancellations": { backgroundColor: "var(--status-closed-cancel-bg)", color: "var(--status-closed-cancel-text)" },
};

/* Display-side rename — buyer 2026-07-31 asked for "closed with
   cancellations" language over "fully received with cancellations",
   since a cancellation means the PO wasn't fully fulfilled. Keeps
   the underlying POStatus enum value unchanged (heavily referenced
   across the codebase as a string literal); only the badge / row
   label swaps. */
const STATUS_DISPLAY_LABEL: Partial<Record<POStatus, string>> = {
  "Fully Received with Cancellations": "Closed with Cancellations",
};

function StatusBadge({ status }: { status: POStatus }) {
  const isClosedWithCancellations = status === "Fully Received with Cancellations";
  const label = STATUS_DISPLAY_LABEL[status] ?? status;
  // Verbatim port of Partners' StatusPill recipe
  // (`Partners/.../VendorDetailsPage.tsx`):
  //   `inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] gap-1`
  //   inline `fontWeight: 500` + `backgroundColor / color / borderColor` from status palette.
  // Replaces the prior `rounded-sm px-2.5 py-1` recipe — wrong shape (pill, not chip)
  // and too tall, so the badge dwarfed the 16px PO# next to it.
  return (
    <span
      className="inline-flex items-center rounded-full border whitespace-nowrap"
      style={{
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.35,
        gap: 4,
        fontFamily: FONT,
        ...(STATUS_INLINE[status] ?? STATUS_INLINE.Draft),
        borderColor: "color-mix(in srgb, currentColor 25%, transparent)",
      }}
    >
      {label}
      {isClosedWithCancellations && (
        <span
          className="inline-block size-1.5 rounded-full shrink-0"
          style={{ backgroundColor: "hsl(var(--warning))" }}
        />
      )}
    </span>
  );
}

/* ══════════════════════════════════���══════════���═════════════════
   LIFECYCLE TRACKER — Horizontal stepper
   ═════���═══���═������════���═══════════════════��═══��═════════════════════ */

/* ── Step Color Map — unique color per lifecycle state ── */
const STEP_COLORS: Record<POStatus, {
  solid: string;
  tint: string;
  glow: string;
  label: string;
}> = {
  Draft: {
    solid: "hsl(var(--muted-foreground))",
    tint: "color-mix(in srgb, hsl(var(--muted-foreground)) 8%, transparent)",
    glow: "color-mix(in srgb, hsl(var(--muted-foreground)) 14%, transparent)",
    label: "hsl(var(--muted-foreground))",
  },
  Sent: {
    solid: "hsl(var(--chart-4))",
    tint: "color-mix(in srgb, hsl(var(--chart-4)) 10%, transparent)",
    glow: "color-mix(in srgb, hsl(var(--chart-4)) 16%, transparent)",
    label: "hsl(var(--chart-4))",
  },
  Confirmed: {
    solid: "hsl(var(--primary))",
    tint: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)",
    glow: "color-mix(in srgb, hsl(var(--primary)) 16%, transparent)",
    label: "hsl(var(--primary))",
  },
  "Partially Received": {
    solid: "hsl(var(--warning))",
    tint: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)",
    glow: "color-mix(in srgb, hsl(var(--warning)) 14%, transparent)",
    label: "hsl(var(--warning))",
  },
  "Fully Received": {
    /* Terminal "received" state — switched to the green `--success`
       palette (2026-06, buyer feedback) so the header gradient, step
       ladder, and bottom card-edge all read as success rather than
       the previous near-white blue accent. */
    solid: "hsl(var(--success))",
    tint: "color-mix(in srgb, hsl(var(--success)) 12%, transparent)",
    glow: "color-mix(in srgb, hsl(var(--success)) 16%, transparent)",
    label: "hsl(var(--success))",
  },
  Cancelled: {
    solid: "hsl(var(--destructive))",
    tint: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)",
    glow: "color-mix(in srgb, hsl(var(--destructive)) 14%, transparent)",
    label: "hsl(var(--destructive))",
  },
  "Active with Cancellations": {
    solid: "hsl(var(--warning))",
    tint: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)",
    glow: "color-mix(in srgb, hsl(var(--warning)) 14%, transparent)",
    label: "hsl(var(--warning))",
  },
  "Fully Received with Cancellations": {
    /* Buyer 2026-07-31: "gradient needs to be yellow like we have for
       partially received we are not showing green gradient" — a PO
       closed with cancellations was never fully fulfilled, so the
       header/stepper wash mirrors the amber `--warning` used by
       Partially Received rather than the green terminal-success wash. */
    solid: "hsl(var(--warning))",
    tint: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)",
    glow: "color-mix(in srgb, hsl(var(--warning)) 14%, transparent)",
    label: "hsl(var(--warning))",
  },
};

/**
 * getStepperBackground — radial-gradient whose horizontal anchor
 * slides left→right as steps complete. This is the PRIMARY color
 * layer — it lives inside the stepper row and carries the main
 * gradient intensity. Center-anchored ellipse for a soft, diffused look.
 */
function getStepperBackground(
  currentStatus: POStatus,
  currentIndex: number,
  totalSteps: number,
  allCompleted: boolean,
): React.CSSProperties {
  if (allCompleted) {
    return {
      // Terminal-state stepper wash now uses `--success` so the green
      // theme covers the entire row (matches the green step ladder).
      background: `linear-gradient(90deg,
        color-mix(in srgb, hsl(var(--success)) 10%, transparent) 0%,
        color-mix(in srgb, hsl(var(--success)) 7%, transparent) 50%,
        color-mix(in srgb, hsl(var(--success)) 3%, transparent) 100%)`,
    };
  }
  if (currentIndex <= 0) return {};
  const stepColor = STEP_COLORS[currentStatus] ?? STEP_COLORS.Draft;
  const centerX = Math.round((currentIndex / (totalSteps - 1)) * 100);
  const clampedX = Math.min(90, Math.max(10, centerX));
  return {
    background: `radial-gradient(
      ellipse 100% 260% at ${clampedX}% 50%,
      ${stepColor.tint} 0%,
      color-mix(in srgb, ${stepColor.solid} 5%, transparent) 35%,
      transparent 70%
    )`,
  };
}

/**
 * getHeaderBackground — bottom-weighted gradient wash spanning the
 * full header card (rows 1-3). Designed so the upper rows (back
 * button, PO number, meta) stay almost white with only a faint
 * hint of color, while intensity builds toward the stepper row at
 * the bottom. Uses a single vertical linear-gradient plus a soft
 * bottom-anchored radial for the horizontal position tracking.
 *
 * Best-practice notes:
 *  - Single direction (top→bottom) avoids competing gradient angles
 *  - Very low opacity at top (1-2%) keeps the header "clean"
 *  - Bottom radial is wide + diffused so it merges seamlessly
 *    with the stepper's own gradient without a visible seam
 */
function getHeaderBackground(
  currentStatus: POStatus,
  currentIndex: number,
  totalSteps: number,
  allCompleted: boolean,
): React.CSSProperties {
  if (allCompleted) {
    return {
      // Header wash flips to the green `--success` token so the top
      // chrome of a Fully-Received PO reads "complete" rather than
      // tinting toward the brand-blue accent.
      background: `linear-gradient(180deg,
        color-mix(in srgb, hsl(var(--success)) 1%, transparent) 0%,
        color-mix(in srgb, hsl(var(--success)) 2%, transparent) 50%,
        color-mix(in srgb, hsl(var(--success)) 5%, transparent) 100%)`,
    };
  }

  if (currentIndex <= 0) return {};

  const stepColor = STEP_COLORS[currentStatus] ?? STEP_COLORS.Draft;
  const centerX = Math.round((currentIndex / (totalSteps - 1)) * 100);
  const clampedX = Math.min(85, Math.max(15, centerX));

  /*
   * Layer 1 (bottom): soft radial anchored at the stepper row,
   *   horizontally tracking the active step. Provides the focused
   *   color "bloom" that bleeds slightly upward.
   * Layer 2 (full): gentle top-to-bottom linear that gives the
   *   upper rows just a whisper of tint (1% → 3%).
   */
  return {
    background: `
      radial-gradient(
        ellipse 90% 60% at ${clampedX}% 100%,
        color-mix(in srgb, ${stepColor.solid} 5%, transparent) 0%,
        color-mix(in srgb, ${stepColor.solid} 2%, transparent) 55%,
        transparent 90%
      ),
      linear-gradient(180deg,
        color-mix(in srgb, ${stepColor.solid} 1%, transparent) 0%,
        color-mix(in srgb, ${stepColor.solid} 1.5%, transparent) 55%,
        color-mix(in srgb, ${stepColor.solid} 3%, transparent) 100%
      )`,
  };
}

function LifecycleTracker({ currentStatus, po }: { currentStatus: POStatus; po?: PurchaseOrderData }) {
  const isCancelled = currentStatus === "Cancelled";
  const isActiveWithCancellations = currentStatus === "Active with Cancellations";
  const isFullyReceivedWithCancellations = currentStatus === "Fully Received with Cancellations";

  // Map compound statuses to their base lifecycle position.
  // Buyer 2026-07-31: "closed with cancellation needs to be in partially
  // received state not in fully received state" — a PO with cancellations
  // was never fully fulfilled (some items were cancelled instead of
  // delivered), so the tracker anchors at "Partially Received" even when
  // every non-cancelled line was received in full. Ladder stops one step
  // short of the terminal "Fully Received" node.
  const effectiveStatus: POStatus = isCancelled
    ? (po?.preCancellationStatus || "Draft")
    : isActiveWithCancellations
    ? (po?.preCancellationStatus || "Confirmed")
    : isFullyReceivedWithCancellations
    ? "Partially Received"
    : currentStatus;

  const currentIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === effectiveStatus);

  const totalSteps = LIFECYCLE_STEPS.length;
  const allCompleted = effectiveStatus === "Fully Received";
  const activeColors = isCancelled ? STEP_COLORS.Cancelled : (STEP_COLORS[effectiveStatus] ?? STEP_COLORS.Draft);

  return (
    <div className="relative w-full" style={{ minHeight: 48 }}>
      {/* Steps row — gradient now lives on the parent card */}
      <div className="relative flex items-center w-full h-full py-2">
      {LIFECYCLE_STEPS.map((step, idx) => {
        const isCompleted = allCompleted || idx < currentIndex;
        const isCurrent = idx === currentIndex && !allCompleted;
        const isLast = idx === totalSteps - 1;
        const StepIcon = step.icon;

        /* Color palette (2026-05): pivoted from `--accent` (pale blue
           background token — too low-contrast against the white check icon)
           to `--primary` (solid blue) for completed steps so the stepper
           reads cleanly against the card surface. Current step keeps its
           status-specific vivid color (`STEP_COLORS[status].solid`), future
           steps stay as outlined gray bubbles.

           2026-06: when the lifecycle is fully complete (`allCompleted`
           — Fully Received / Fully Received with Cancellations), the
           ladder flips from `--primary` (blue) to `--success` (green)
           so the entire row reads as terminal success rather than mid-
           flight progress. The check icon stays white in both palettes. */
        const doneSolid = allCompleted ? "hsl(var(--success))" : "hsl(var(--primary))";
        const doneTint = allCompleted
          ? "color-mix(in srgb, hsl(var(--success)) 12%, transparent)"
          : "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)";

        return (
          <div key={step.status} className="contents">
            {/* Circle + Label */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{
                  // Compacted circle ladder (was 28/24/22) — matches Partners'
                  // tighter chrome rhythm and shaves ~8px of stepper height.
                  width: isCurrent ? 24 : isCompleted ? 22 : 20,
                  height: isCurrent ? 24 : isCompleted ? 22 : 20,
                  ...(isCompleted
                    ? {
                        backgroundColor: doneSolid,
                        boxShadow: `0 2px 6px ${doneTint}`,
                      }
                    : isCurrent
                    ? {
                        backgroundColor: activeColors.solid,
                        boxShadow: `0 0 0 3px ${activeColors.glow}, 0 2px 8px color-mix(in srgb, hsl(var(--foreground)) 8%, transparent)`,
                      }
                    : {
                        backgroundColor: "transparent",
                        border: "1.5px solid hsl(var(--border))",
                      }),
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                {isCompleted ? (
                  <Check className="size-2.5" style={{ color: "hsl(var(--primary-foreground))", strokeWidth: 3 }} />
                ) : isCurrent ? (
                  <StepIcon className="size-3" style={{ color: "hsl(var(--primary-foreground))", strokeWidth: 2.5 }} />
                ) : (
                  <StepIcon className="size-2.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.35, strokeWidth: 2 }} />
                )}
              </div>

              <span
                className="hidden sm:block whitespace-nowrap"
                style={{
                  ...(isCompleted
                    ? { ...st.stepLabelActive, color: doneSolid }
                    : isCurrent
                    ? { ...st.stepLabelActive, color: "hsl(var(--foreground))" }
                    : { ...st.stepLabel, color: "hsl(var(--muted-foreground))", opacity: 0.5 }),
                  transition: "all 0.3s ease",
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line — mx tightened 2.5/3.5 → 2/3, height 2.5 → 2 so
                the strip feels lighter and the completed segments read as a
                single continuous track rather than chunky dumbbells. */}
            {!isLast && (
              <div className="flex-1 mx-2 lg:mx-3 min-w-[12px] relative" style={{ height: 4 }}>
                {idx < currentIndex - 1 || (allCompleted && idx < totalSteps - 1) ? (
                  /* Between two completed steps: solid primary */
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundColor: doneSolid,
                      height: 2,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  />
                ) : idx === currentIndex - 1 && !allCompleted ? (
                  /* Last completed → current: solid primary */
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundColor: doneSolid,
                      height: 2,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  />
                ) : idx === currentIndex && !allCompleted ? (
                  /* Current → next future: dashed with active color */
                  <div
                    className="absolute rounded-full"
                    style={{
                      inset: 0,
                      height: 2.5,
                      top: "50%",
                      transform: "translateY(-50%)",
                      backgroundColor: "hsl(var(--border))",
                      WebkitMaskImage: "repeating-linear-gradient(90deg, black 0px, black 6px, transparent 6px, transparent 11px)",
                      maskImage: "repeating-linear-gradient(90deg, black 0px, black 6px, transparent 6px, transparent 11px)",
                      opacity: 0.65,
                    }}
                  />
                ) : (
                  /* Future: dashed grey */
                  <div
                    className="absolute rounded-full"
                    style={{
                      inset: 0,
                      height: 2,
                      top: "50%",
                      transform: "translateY(-50%)",
                      backgroundColor: "hsl(var(--border))",
                      WebkitMaskImage: "repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)",
                      maskImage: "repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)",
                      opacity: 0.65,
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

/* ═════════���═══════════════��══════════════════════����═══��════���════
   SECTION CARD — uses design-system tokens, no hard-coded colours
   ════════════════════════════════���══════════════════════��═══════ */

function SectionCard({
  icon: Icon,
  title,
  children,
  action,
  compact,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card overflow-hidden">
      <div className={`flex items-center justify-between ${compact ? "px-4 py-2.5" : "px-5 py-3"} border-b border-border`}>
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center ${compact ? "size-6" : "size-7"} rounded-[var(--radius-sm)] bg-primary/8`}>
            <Icon className={`${compact ? "size-3" : "size-3.5"} text-primary`} />
          </div>
          <span className="text-foreground" style={st.sectionHeading}>{title}</span>
        </div>
        {action}
      </div>
      <div>{children}</div>
    </div>
  );
}

/* ═══════════��════════════════════════════════════���══════════��═══
   TAB PLACEHOLDER PANEL — Empty state for non-Items tabs
   ═══════════════════════════════════════════════════════════════ */

/* Empty / coming-soon tab state — verbatim port of Partners' PlaceholderTab
   (`Partners/.../VendorDetailsPage.tsx:2226-2267`). Used for tabs whose data
   sources are still in design (Receiving Docs, Invoices & Payments,
   Communications, Comments, Recent Activities).
   Anatomy:
     - 400px-min card surface with rounded-xl + border
     - Animated icon stack: ping backdrop (3s) + floating gradient tile (4s)
     - "Coming Soon" pulse pill
     - 16/600 label + slate-400 13px description
     - Staggered fade-in (0.1s / 0.2s / 0.3s) for icon → pill → label → desc */
function TabPlaceholderPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden" style={{ minHeight: 400 }}>
      <div className="flex flex-col items-center justify-center w-full h-full py-24 px-6 text-center">
        {/* Animated icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-primary/5 animate-ping" style={{ animationDuration: "3s" }} />
          <div
            className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-accent border border-border flex items-center justify-center shadow-sm"
            style={{ animation: "csFloat 4s ease-in-out infinite" }}
          >
            <Icon className="w-7 h-7 text-slate-400" />
          </div>
        </div>
        {/* Coming Soon pulse pill */}
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted border border-border mb-3"
          style={{ animation: "csFade 0.5s ease-out both", animationDelay: "0.1s" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 600 }}>Coming Soon</span>
        </div>
        {/* Label */}
        <h3
          className="text-foreground text-[16px] mb-1.5"
          style={{ fontWeight: 600, animation: "csFade 0.5s ease-out both", animationDelay: "0.2s" }}
        >
          {title}
        </h3>
        {/* Description */}
        <p
          className="text-slate-400 text-[13px] max-w-sm leading-relaxed"
          style={{ animation: "csFade 0.5s ease-out both", animationDelay: "0.3s" }}
        >
          {description}
        </p>
      </div>
      {/* Keyframes — scoped inline. csFloat gives the icon tile a gentle
          4-second vertical bob; csFade fades + lifts the pill/label/desc by
          8px so the empty state assembles itself when the tab is opened. */}
      <style>{`
        @keyframes csFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes csFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

/* ═════════════════════════════════��═══════════════════════════���═
   LINE ITEM CARD — individual card with progressive disclosure
   ══════════���════════════════════════════════════════════════════ */

function LineItemCard({
  item,
  canEdit,
  onEdit,
  onImageClick,
  onRemove,
}: {
  item: POLineItem;
  canEdit: boolean;
  onEdit: () => void;
  onImageClick: (src: string) => void;
  onRemove?: () => void;
}) {
  const receivingPct = item.quantity > 0 ? Math.min(100, (item.receivedQuantity / item.quantity) * 100) : 0;
  const hasReceiving = item.receivedQuantity > 0;
  const isFullyReceived = item.receivedQuantity >= item.quantity;
  const [expanded, setExpanded] = useState(false);

  /* Mock enrichment data — in production these come from catalog/inventory service */
  const mockStockData = React.useMemo(() => {
    const hash = item.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const currentStock = (hash * 7) % 200;
    const minQuantity = [10, 15, 20, 25, 30, 50][hash % 6];
    const belowMin = currentStock < minQuantity;
    const stockDiff = currentStock - minQuantity;
    const shortageDate = belowMin ? ["Mar 15, 2026", "Mar 22, 2026", "Apr 02, 2026", "Apr 10, 2026"][hash % 4] : null;
    const attachments = hash % 3;
    return { currentStock, minQuantity, belowMin, stockDiff, shortageDate, attachments };
  }, [item.id]);

  const effectivePrice = item.unitPrice * (1 - item.discount / 100);
  const { currency } = useDocCurrency();

  const detailCount = [
    mockStockData.belowMin,
    mockStockData.shortageDate,
    mockStockData.attachments > 0,
    item.shipmentMethod,
    item.needByDate,
  ].filter(Boolean).length;

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-border overflow-hidden transition-all duration-150 group hover:shadow-[var(--elevation-sm)]"
      style={{ backgroundColor: "hsl(var(--card))", marginBottom: "8px", fontFamily: FONT }}
    >
      {/* ── Main row ── */}
      <div
        className="flex items-start gap-3 px-3 py-2.5"
      >
        {/* 1. Thumbnail — square 72×72 */}
        <div
          className="relative shrink-0 w-[72px] h-[72px] min-w-[72px] min-h-[72px] rounded-[var(--radius-md)] overflow-hidden cursor-pointer"
          style={{ backgroundColor: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
          onClick={(e) => { e.stopPropagation(); onImageClick(item.image); }}
        >
          <ImageWithFallback
            src={item.image}
            alt={item.descriptiveName}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-all flex items-center justify-center">
            <Eye className="size-4 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
          </div>
          {isFullyReceived && (
            <div
              className="absolute top-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded-[var(--radius-sm)]"
              style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))", fontSize: "8px", fontWeight: "var(--font-weight-semibold)", lineHeight: "1", fontFamily: FONT }}
            >
              <Check className="size-2" /> Done
            </div>
          )}
        </div>

        {/* 2. Content area */}
        <div className="flex flex-col flex-1 min-w-0 gap-0">
          {/* Part number + warning badges */}
          <div className="flex items-center gap-2">
            <span
              className="text-foreground"
              style={{ fontSize: "14px", fontWeight: "var(--font-weight-semibold)", lineHeight: "20px", fontFamily: FONT }}
            >
              {item.itemNumber}
            </span>
            {mockStockData.belowMin && (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-[var(--radius-sm)] shrink-0"
                style={{ backgroundColor: "hsl(var(--warning-tint))", color: "hsl(var(--warning))", fontSize: "9px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px", fontFamily: FONT }}
              >
                <AlertTriangle className="size-2.5" />
                Low Stock
              </span>
            )}
            {hasReceiving && !isFullyReceived && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0 rounded-[var(--radius-sm)] shrink-0"
                style={{ backgroundColor: "hsl(var(--primary-tint))", color: "hsl(var(--primary))", fontSize: "9px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px", fontFamily: FONT }}
              >
                {item.receivedQuantity}/{item.quantity} received
              </span>
            )}
          </div>

          {/* Description */}
          <span
            className="text-foreground line-clamp-1 mt-0.5"
            style={{ fontSize: "12px", fontWeight: "var(--font-weight-normal)", lineHeight: "16px", fontFamily: FONT }}
          >
            {item.descriptiveName}
            {item.description && (
              <span style={{ color: "hsl(var(--muted-foreground))" }}> — {item.description}</span>
            )}
          </span>

          {/* Price per unit + Quantity */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <div className="flex items-baseline gap-1">
              <span className="text-foreground" style={{ fontSize: "12px", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px", fontFamily: FONT }}>
                {formatMoney(effectivePrice, currency)}
              </span>
              <span className="text-muted-foreground" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
                per {item.defaultUOM}
              </span>
            </div>
            <span style={{ color: "hsl(var(--border))" }}>·</span>
            <span className="text-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-medium)", lineHeight: "15px", fontFamily: FONT }}>
              {item.vendorQty} {item.vendorUOM}{item.vendorQty > 1 ? "s" : ""}
              {item.vendorUOMQty > 1 && (
                <span className="text-muted-foreground" style={{ fontWeight: "var(--font-weight-normal)", fontFamily: FONT }}>{" "}({item.quantity} {item.defaultUOM}{item.quantity > 1 ? "s" : ""})</span>
              )}
            </span>
          </div>

          {/* Receiving progress */}
          {hasReceiving && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden max-w-[200px]">
                <div
                  className={`h-full rounded-full transition-all ${isFullyReceived ? "bg-accent" : "bg-primary"}`}
                  style={{ width: `${receivingPct}%` }}
                />
              </div>
              <span className={isFullyReceived ? "text-accent" : "text-primary"} style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", lineHeight: "14px", fontFamily: FONT }}>
                {item.receivedQuantity}/{item.quantity} {item.defaultUOM}s
              </span>
            </div>
          )}
        </div>

        {/* 3. Right column: Amount + Actions */}
        <div className="flex flex-col items-end gap-1 shrink-0 w-[130px]">
          <span
            className="text-foreground"
            style={{ fontSize: "15px", fontWeight: "var(--font-weight-semibold)", lineHeight: "20px", fontFamily: FONT }}
          >
            {formatMoney(item.lineTotal, currency)}
          </span>
          {item.discount > 0 ? (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--radius-sm)]"
              style={{ backgroundColor: "hsl(var(--success-tint))", color: "hsl(var(--success))", fontSize: "10px", fontWeight: "var(--font-weight-semibold)", lineHeight: "1", fontFamily: FONT }}
            >
              <Tag className="size-2.5" /> {item.discount}% off
            </span>
          ) : (
            <span
              className="text-muted-foreground"
              style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "14px", fontFamily: FONT, opacity: 0.5 }}
            >
              Standard pricing
            </span>
          )}
          <div className="flex-1" />
          {canEdit && (
            <div className="flex items-center gap-1">
              <button
                className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] border border-border text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/[0.04] transition-all cursor-pointer"
                onClick={() => onEdit()}
                title="Edit item"
              >
                <Pencil className="size-3" />
              </button>
              {onRemove && (
                <button
                  className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 transition-all cursor-pointer"
                  onClick={() => onRemove!()}
                  title="Remove item"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Progressive disclosure toggle ── */}
      <div
        className="flex items-center px-3 cursor-pointer select-none"
        style={{ borderTop: "1px solid hsl(var(--border))" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <button
          className="flex items-center gap-1 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
          style={{ fontSize: "10px", fontWeight: "var(--font-weight-medium)", lineHeight: "14px", fontFamily: FONT }}
        >
          <ChevronDown
            className="size-3 transition-transform duration-200"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
          {expanded ? "Less details" : `${detailCount} more details`}
        </button>
      </div>

      {/* ── Expanded secondary details ── */}
      {expanded && (
        <div
          className="px-3 pb-2.5 flex flex-col gap-1.5"
          style={{ paddingLeft: "calc(12px + 72px + 12px)" }}
        >
          {/* Below min, Shortage date, Attachments */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
              Below min:{" "}
              {mockStockData.belowMin ? (
                <span className="text-destructive" style={{ fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>{mockStockData.stockDiff} {item.defaultUOM}</span>
              ) : (
                <span style={{ color: "hsl(var(--foreground))", opacity: 0.3, fontFamily: FONT }}>—</span>
              )}
            </span>
            <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
              Shortage:{" "}
              {mockStockData.shortageDate ? (
                <span className="text-foreground" style={{ fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>{mockStockData.shortageDate}</span>
              ) : (
                <span style={{ color: "hsl(var(--foreground))", opacity: 0.3, fontFamily: FONT }}>—</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
              <Paperclip className="size-2.5" />
              {mockStockData.attachments > 0 ? (
                <span className="text-foreground" style={{ fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>{mockStockData.attachments} file{mockStockData.attachments > 1 ? "s" : ""}</span>
              ) : (
                <span style={{ opacity: 0.5 }}>None</span>
              )}
            </span>
          </div>

          {/* Shipment method + delivery-dates summary (2026-07-29 model
              rebuild). Primary-first order: Expected delivery leads
              (required in the new model), then Ship by, then Promise
              ship (only if the vendor has committed one — record-only
              so we don't clutter the row when it's empty). */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <Truck className="size-2.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }} />
              <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
                {getShipmentMethodLabel(item.shipmentMethod)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <CalendarClock className="size-2.5" style={{ color: "hsl(var(--muted-foreground))", opacity: 0.5 }} />
              <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
                Expected delivery <span className="text-foreground" style={{ fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>{item.expectedDeliveryDate || computeExpectedDeliveryDate(item.promisedShipDate, item.shipmentMethod) || "—"}</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
                Ship by <span className="text-foreground" style={{ fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>{item.needByDate || "—"}</span>
              </span>
            </div>
            {item.promisedShipDate && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
                  Promise ship <span className="text-foreground" style={{ fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>{item.promisedShipDate}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════�����═══════════════════════════════════
   LINE ITEM EDIT DIALOG — shadcn Dialog + Input + Label + Select
   ═══════��═══════════════════════════════════════════════════════ */


/* ══════���════════════════════════════════════════════════════════
   CHANGE VENDOR CONTACT DIALOG
   ═══════════════════════════════════════════════════════════════ */

/** Compact "Delivery dates" hover trigger that sits under a line
 *  item's description. Trigger: a subtle chip showing a CalendarDays
 *  icon; hover reveals a small popover with the 2026-07-29
 *  delivery-dates model (Expected delivery — required primary,
 *  Ship by — optional, Promise ship — record-only, only rendered
 *  when the vendor has committed one). Same design language as
 *  POPriceBreakdownHoverCard's PRICE BREAKDOWN card. Expected
 *  Delivery falls back to the computed value when the stored field
 *  is empty. */
function LineItemDateStrip({ li }: { li: POLineItem }) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ x: number; y: number; placement: "top" | "bottom" } | null>(null);
  const triggerRef = React.useRef<HTMLSpanElement>(null);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const fmtShort = (iso: string | undefined | null): string => {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
  };
  const fmtFull = (iso: string | undefined | null): string => {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const expected =
    li.expectedDeliveryDate ||
    computeExpectedDeliveryDate(li.promisedShipDate, li.shipmentMethod) ||
    undefined;

  const calcPos = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const estimatedH = 168;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: "top" | "bottom" = spaceBelow > estimatedH + 12 ? "bottom" : "top";
    setPos({
      x: rect.left,
      y: placement === "bottom" ? rect.bottom + 6 : rect.top - 6,
      placement,
    });
  }, []);

  const handleEnter = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    openTimer.current = setTimeout(() => {
      calcPos();
      setOpen(true);
    }, 200);
  }, [calcPos]);
  const handleLeave = React.useCallback(() => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }, []);
  const handleCardEnter = React.useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const handleCardLeave = React.useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  }, []);
  React.useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        aria-label="Hover to view delivery dates"
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 cursor-help shrink-0 hover:bg-slate-50 hover:border-slate-300 transition-colors"
        style={{
          fontSize: 10.5,
          lineHeight: 1.2,
          fontFamily: FONT,
          borderStyle: "dotted",
          borderColor: "#CBD5E1",
        }}
      >
        <CalendarDays style={{ width: 10, height: 10, color: "#0A77FF" }} />
        <span className="text-slate-700" style={{ fontWeight: 500 }}>
          Delivery dates
        </span>
        <ChevronDown style={{ width: 9, height: 9, color: "#94A3B8" }} />
      </span>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            onMouseEnter={handleCardEnter}
            onMouseLeave={handleCardLeave}
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.placement === "bottom" ? pos.y : undefined,
              bottom: pos.placement === "top" ? window.innerHeight - pos.y : undefined,
              zIndex: 99999,
              fontFamily: FONT,
              pointerEvents: "auto",
              animation: "poLidhcIn 180ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <style>{`
              @keyframes poLidhcIn {
                from { opacity: 0; transform: translateY(${pos.placement === "bottom" ? "-4px" : "4px"}) scale(0.97); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>
            <div
              style={{
                width: 244,
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)",
                overflow: "hidden",
              }}
            >
              {/* Header — same chrome as PRICE BREAKDOWN card */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 14px 8px",
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <CalendarDays style={{ width: 13, height: 13, color: "#9CA3AF", flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#1F2937",
                    letterSpacing: 0.3,
                    textTransform: "uppercase",
                  }}
                >
                  Delivery Dates
                </span>
              </div>
              {/* Body rows (2026-07-29 model rebuild). Order matches the
                  new hierarchy: Expected delivery (required primary,
                  highlighted), Ship by (optional secondary), Promise
                  ship (optional record-only, only rendered when the
                  vendor has committed one — hidden by default). */}
              <div style={{ padding: "6px 0" }}>
                <DateRow label="Expected delivery" value={fmtFull(expected)} bold highlight />
                <DateRow label="Ship by" value={fmtFull(li.needByDate)} />
                {li.promisedShipDate && (
                  <DateRow label="Promise ship" value={fmtFull(li.promisedShipDate)} />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function DateRow({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 14px",
        gap: 12,
        backgroundColor: highlight ? "#F0FDF4" : undefined,
      }}
    >
      <span
        style={{
          fontSize: 11.5,
          fontWeight: bold ? 600 : 400,
          color: highlight ? "#065F46" : "#374151",
          lineHeight: 1.4,
        }}
      >
        {label}
      </span>
      <span
        className="tabular-nums"
        style={{
          fontSize: 11.5,
          fontWeight: bold || highlight ? 600 : 500,
          color: highlight ? "#059669" : value === "—" ? "#9CA3AF" : "#1F2937",
          lineHeight: 1.4,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function LineItemsPanel({
  po,
  canEdit,
  freeEdit,
  onRequestEditSession,
  onEditItem,
  onViewItem,
  onThumbnailQuickView,
  onImageClick,
  onRemoveItem,
  onAddItems,
  onCancelItem,
  onUpdateQty,
  onUpdatePrice,
  onQualifyLine,
  onChangeLineLocation,
  pricingBreakdowns,
  adjustmentBreakdowns,
}: {
  po: PurchaseOrderData;
  canEdit: boolean;
  /** True when edits can proceed without version confirmation (Draft or active editing session) */
  freeEdit: boolean;
  /** Called when user tries to edit in a non-freeEdit state — triggers version confirmation modal */
  onRequestEditSession: (tag?: string) => void;
  onEditItem: (item: POLineItem) => void;
  /** Called when user clicks the row — opens Item Detail modal (OrderFlow `edit-po`). */
  onViewItem: (item: POLineItem) => void;
  /** Called when user clicks the thumbnail — opens the QuickViewPanel preview
   *  modal (same one used on the items catalog / listing thumbnail). */
  onThumbnailQuickView: (item: POLineItem) => void;
  onImageClick: (src: string) => void;
  onRemoveItem: (liId: string) => void;
  onAddItems: () => void;
  onCancelItem?: (liId: string) => void;
  onUpdateQty: (li: POLineItem, vendorQty: number, quantity: number) => void;
  onUpdatePrice: (li: POLineItem, unitPrice: number) => void;
  /** Resolve a line's pending qualification: moves `needsQualificationForVendor`
   *  into `qualifiedForVendor` on the store side and records the scope
   *  the buyer picked in the confirm dialog:
   *    · "vendor"  — also updates the item↔vendor mapping globally
   *                  (`qualifyItemForVendorGlobally`) so future POs on
   *                  this vendor see the item as qualified.
   *    · "po-only" — leaves the master mapping alone; scoped to this PO. */
  onQualifyLine: (li: POLineItem, scope: "vendor" | "po-only") => void;
  /** Change the vendor ship-from location for a single line (2026-07-28).
   *  Different items on the same PO can source from different vendor
   *  locations; picked inline on the row via a compact popover. */
  onChangeLineLocation: (li: POLineItem, location: { id: string; name: string }) => void;
  /** Precomputed pricing rule breakdowns per line — hoisted to the
   *  parent so the sidebar block and this panel share the same source
   *  of truth. Empty map when no rules apply (or feature flag off). */
  pricingBreakdowns: Map<string, LinePricingBreakdown>;
  /** Item-level one-time discounts/premiums per line (from poOrderPricing). */
  adjustmentBreakdowns?: Map<string, LineAdjustmentBreakdown>;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) => setExpandedRows((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  /* Inline qty editing */
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [editingQtyValue, setEditingQtyValue] = useState<string>("");

  const startQtyEdit = (li: POLineItem) => {
    setEditingQtyId(li.id);
    setEditingQtyValue(String(li.vendorQty));
  };

  const commitQtyEdit = (li: POLineItem) => {
    const serialized = isSerialized(li);
    const parsedQty = parseQuantityDraft(editingQtyValue, serialized);
    const newVendorQty = parsedQty == null || parsedQty <= 0
      ? li.vendorQty
      : serialized
        ? Math.max(1, parsedQty)
        : parsedQty;
    const newDefaultQty = newVendorQty * li.vendorUOMQty;
    onUpdateQty(li, newVendorQty, newDefaultQty);
    setEditingQtyId(null);
  };

  const cancelQtyEdit = () => {
    setEditingQtyId(null);
  };

  /* Inline price editing */
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>("");

  /* Prices are in the PO's currency (spec 4.3), typed to its minor unit.
     Plain digits: a number input can't take "1,245.00". */
  const { currency } = useDocCurrency();
  const priceDecimals = currencyDecimals(currency);
  const pricePrefix = moneyPrefix(currency).trim();
  const startPriceEdit = (li: POLineItem) => {
    setEditingPriceId(li.id);
    const effectivePrice = li.unitPrice * (1 - li.discount / 100);
    setEditingPriceValue(effectivePrice.toFixed(priceDecimals));
  };

  const commitPriceEdit = (li: POLineItem) => {
    // $0 (zero-priced lines) is a FIRST-CLASS valid price — never block / floor it.
    // We only fall back to the existing price when the input is unparseable.
    const parsed = parseFloat(editingPriceValue);
    const newPrice = Number.isFinite(parsed) ? Math.max(0, parsed) : li.unitPrice;
    onUpdatePrice(li, newPrice);
    setEditingPriceId(null);
  };

  const cancelPriceEdit = () => {
    setEditingPriceId(null);
  };

  /* Receiving state — show progress when PO is beyond Confirmed */
  const showReceiving = po.status === "Partially Received" || po.status === "Fully Received" || po.status === "Confirmed" || po.status === "Active with Cancellations" || po.status === "Fully Received with Cancellations";

  const totalUnits = po.lineItems.reduce((sum, li) => sum + li.quantity, 0);

  // Column-header typography matches Partners' compact-table caption ladder:
  // 10px / 600 / uppercase / 0.04em letter-spacing / slate-500. The prior 11px
  // (`--text-xs`) was a hair larger than Partners' canonical caption size.
  const COL_HEADER: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    lineHeight: "16px",
    fontFamily: FONT,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "#64748B" /* slate-500 — crisper contrast than `--muted-foreground` */,
  };

  /* Mock serialization — in production this comes from catalog */
  const isSerialized = isSerializedLineItem;

  /* Duplicate-flow qualification callout: which lines the new vendor
     doesn't carry, stamped at duplicate time in `duplicatePO()`. When
     any exist, we render an amber banner above the line-items table
     with bulk Keep-all / Remove-all actions, plus per-row Remove/Qualify
     controls on each flagged row. Banner + row highlights vanish once
     every pending line has been resolved. */
  const pendingLines = po.lineItems.filter((li) => li.needsQualificationForVendor);
  const pendingVendorName = pendingLines[0]?.needsQualificationForVendor ?? "";
  /* Vendor location catalog for the picked Pay-To vendor — drives the
     per-line "Ships from" popover (2026-07-28). Empty when the vendor
     name doesn't match anything in PAY_TO_VENDORS, in which case the
     chip won't render. */
  const vendorLocationCatalog = React.useMemo(() => {
    const entity = PAY_TO_VENDORS.find(
      (v) => v.name.trim().toLowerCase() === po.vendor.name.trim().toLowerCase(),
    );
    return entity?.locations ?? [];
  }, [po.vendor.name]);
  /* Scope prompt (2026-07-28) — reuses the PriceWarningShell chrome from
     the price-add flow. `target` picks which set of lines to qualify:
     "bulk" walks every pending line, "single" walks the one clicked. */
  const [qualifyPrompt, setQualifyPrompt] = useState<
    | { target: "single"; li: POLineItem }
    | { target: "bulk" }
    | null
  >(null);
  const promptLines: POLineItem[] =
    qualifyPrompt?.target === "single"
      ? [qualifyPrompt.li]
      : qualifyPrompt?.target === "bulk"
        ? pendingLines
        : [];
  const promptVendorName = promptLines[0]?.needsQualificationForVendor ?? pendingVendorName;
  const applyQualification = (scope: "vendor" | "po-only") => {
    promptLines.forEach((li) => onQualifyLine(li, scope));
    setQualifyPrompt(null);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* ── Header / Summary Bar — Partners pattern: icon-tile + title + counter
           chips + primary CTA. Counters now render as Partners' "+N more" style
           inline chips (10/600 muted) so the strip reads as a cohesive label row,
           not a sentence with embedded numbers. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/8 shrink-0">
            <ShoppingBag className="size-3.5 text-primary" />
          </div>
          <span className="text-foreground" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, fontFamily: FONT }}>Line Items</span>
          {/* Counter chips — Partners small-pill aesthetic. */}
          <span
            className="inline-flex items-center rounded-md tabular-nums"
            style={{ padding: "1px 6px", backgroundColor: "#F1F5F9", color: "#475569", fontSize: 10, fontWeight: 600, fontFamily: FONT, lineHeight: 1.4 }}
          >
            {po.lineItems.length} {po.lineItems.length === 1 ? "item" : "items"}
          </span>
          <span
            className="inline-flex items-center rounded-md tabular-nums"
            style={{ padding: "1px 6px", backgroundColor: "#F1F5F9", color: "#475569", fontSize: 10, fontWeight: 600, fontFamily: FONT, lineHeight: 1.4 }}
          >
            {totalUnits.toLocaleString()} units
          </span>
        </div>
        {canEdit && (
          /* Add Items — Partners' canonical card-header CTA (`Partners/.../
             DataTableStyleReference`): filled primary `bg-primary text-white
             shadow-sm h-9 px-3.5 rounded-lg`. Replaces the prior outline-primary
             recipe (`border-primary/30 text-primary`) which doesn't exist in
             Partners' button vocabulary — Partners only ships filled-primary,
             outline-neutral, and ghost variants. */
          <button
            type="button"
            onClick={() => {
              if (!freeEdit) { onRequestEditSession("Item Added"); return; }
              onAddItems();
            }}
            className="rounded-lg inline-flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 h-9 px-3.5 transition-colors duration-150"
            style={{
              backgroundColor: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1,
              fontFamily: FONT,
              border: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0862D0' /* Partners primary-hover verbatim */; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'hsl(var(--primary))'; }}
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
            Add Items
          </button>
        )}
      </div>

      {/* ── Duplicate-flow qualification banner — visible when any line
            has `needsQualificationForVendor` set. Compact single-line
            layout: icon + N items + vendor + bulk actions. Slim, muted
            amber surface (2026-07-28 feedback: was too loud). */}
      {pendingLines.length > 0 && (
        <div
          className="flex items-center gap-3 border-b px-4 py-2"
          style={{ backgroundColor: "#FFFBEB70", borderColor: "#FDE68A" }}
        >
          <AlertTriangle
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "#B45309" }}
          />
          <div
            className="min-w-0 flex-1 text-[12px]"
            style={{ color: "#78350F", fontFamily: FONT, lineHeight: 1.4 }}
          >
            <span style={{ fontWeight: 600 }}>
              {pendingLines.length} item{pendingLines.length === 1 ? "" : "s"}
            </span>{" "}
            {pendingLines.length === 1 ? "is" : "are"} not qualified for{" "}
            <span style={{ fontWeight: 600 }}>{pendingVendorName}</span>. You can either order {pendingLines.length === 1 ? "it" : "them"} from this vendor for this PO only, or qualify {pendingLines.length === 1 ? "it" : "them"} permanently at the partner level.
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Primary — Qualify on this PO only. Applies the "po-only"
                scope directly to every pending line without opening the
                scope prompt, since the copy above already spelled out
                the choice. */}
            <button
              type="button"
              onClick={() => {
                for (const li of pendingLines) onQualifyLine(li, "po-only");
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-[#0A77FF] px-2.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#0862D0]"
              style={{ fontFamily: FONT }}
            >
              <Check className="h-3 w-3" strokeWidth={2.5} />
              Qualify on this PO only
            </button>
            {/* Secondary — Qualify at partner level. Same as above but
                writes to the global partner catalog via the vendor
                scope, so the item is qualified on all future POs too. */}
            <button
              type="button"
              onClick={() => {
                for (const li of pendingLines) onQualifyLine(li, "vendor");
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#BFDBFE] bg-white px-2.5 text-[11.5px] font-semibold text-[#0A77FF] transition-colors hover:bg-blue-50/60"
              style={{ fontFamily: FONT }}
            >
              Qualify at partner level
            </button>
          </div>
        </div>
      )}

      {/* ── Column Headers — Partners table strip recipe: `bg-muted/30` surface,
            10/600 uppercase slate-500 captions with 0.04em letter-spacing,
            8px vertical padding. Tightened from `py-2` to `py-2` (kept) but the
            surface dropped from full `--secondary` to `--muted/30` so the strip
            reads as a quiet divider rather than a banded header. */}
      {po.lineItems.length > 0 && (
        <div
          className="grid items-center px-4 py-2 border-b border-border"
          style={{ gridTemplateColumns: showReceiving ? "1fr 100px 110px 110px 90px 72px" : "1fr 100px 110px 110px 72px", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}
        >
          <span style={COL_HEADER}>Line Item</span>
          <span style={{ ...COL_HEADER, textAlign: "right" }}>Qty</span>
          <span style={{ ...COL_HEADER, textAlign: "right" }}>Price Per Unit</span>
          <span style={{ ...COL_HEADER, textAlign: "right" }}>Total</span>
          {showReceiving && <span style={{ ...COL_HEADER, textAlign: "right" }}>Received</span>}
          <span />
        </div>
      )}

      {/* ── Line Item Rows ── */}
      {po.lineItems.map((li, idx) => {
        const isExpanded = expandedRows.has(li.id);
        const effectivePrice = li.unitPrice * (1 - li.discount / 100);
        const fullDescription = [
          li.descriptiveName,
          li.description ? li.description : null,
        ].filter(Boolean).join(" — ");
        const serialized = isSerialized(li);
        const isEditingQty = editingQtyId === li.id;
        const isItemCancelled = !!li.cancelled;
        const previewVendorQty = isEditingQty ? (parseQuantityDraft(editingQtyValue, serialized) ?? 0) : li.vendorQty;
        const previewLineTotal = previewVendorQty * li.vendorUOMQty * effectivePrice;

        const needsQualification = !!li.needsQualificationForVendor;
        return (
          <div
            key={li.id}
            style={{
              borderBottom: idx < po.lineItems.length - 1 ? "1px solid hsl(var(--border))" : undefined,
              opacity: isItemCancelled ? 0.5 : 1,
              /* Rows the new vendor doesn't carry get the same amber-50
                 wash as the "Needs review" chip, plus a 2px amber left
                 accent — matches 2026-07-28 feedback to highlight the
                 whole row with the chip's tint. */
              borderLeft: needsQualification ? "2px solid #F59E0B" : undefined,
              backgroundColor: needsQualification ? "#FFFBEB" : undefined,
            }}
          >
            <div
              className={
                needsQualification
                  ? "group grid px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-amber-100/50"
                  : "group grid px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-muted/30"
              }
              style={{ gridTemplateColumns: showReceiving ? "1fr 100px 110px 110px 90px 72px" : "1fr 100px 110px 110px 72px", alignItems: "start" }}
              onClick={() => {
                const isInlineEditing = editingQtyId === li.id || editingPriceId === li.id;
                if (isInlineEditing) return;
                onViewItem(li);
              }}
            >
              {/* ── LINE ITEM column (contains both collapsed and expanded content) ── */}
              <div className="flex gap-3 min-w-0 pr-4">
                {/* Row number — slate-400 tabular-nums (was 12/0.4 opacity which
                     ghosted out at ~35% visible). 11/500 with explicit slate-400
                     keeps the index legible without competing with the part #. */}
                <span
                  className="shrink-0 w-[28px] text-right flex items-center justify-end tabular-nums"
                  style={{ fontSize: 11, fontWeight: 500, lineHeight: "16px", fontFamily: FONT, color: "#94A3B8" /* slate-400 */, minHeight: "44px" }}
                >
                  {String(idx + 1).padStart(3, "0")}
                </span>

                {/* Square thumbnail — clicking opens the QuickViewPanel preview
                     modal (the same one shown on the items catalog / listing
                     thumbnail — `CatalogueModal` + `PurchaseOrdersListing`).
                     Row click + edit icon still open the full OrderFlow
                     `edit-po` modal — thumbnail offers a quicker peek. */}
                <div
                  className="relative shrink-0 rounded-md overflow-hidden cursor-pointer transition-all duration-150 hover:ring-2 hover:ring-primary/30"
                  style={{ width: isExpanded ? 64 : 44, height: isExpanded ? 64 : 44, backgroundColor: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
                  onClick={(e) => { e.stopPropagation(); onThumbnailQuickView(li); }}
                  title="Quick view"
                >
                  <ImageWithFallback src={li.image} alt={li.descriptiveName} className="w-full h-full object-cover" />
                  {/* Image cycling arrows — only when expanded and item has multiple potential images */}
                  {isExpanded && (
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-0.5 pb-0.5">
                      <button
                        className="flex items-center justify-center size-4 rounded-full bg-foreground/50 text-card hover:bg-foreground/70 transition-colors cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); }}
                        title="Previous image"
                      >
                        <ChevronLeft className="size-2.5" />
                      </button>
                      <button
                        className="flex items-center justify-center size-4 rounded-full bg-foreground/50 text-card hover:bg-foreground/70 transition-colors cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); }}
                        title="Next image"
                      >
                        <ChevronDown className="size-2.5" style={{ transform: "rotate(-90deg)" }} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Item text content */}
                <div className="flex flex-col min-w-0 gap-0.5 flex-1">
                  {/* Part number + serialization pill — pills upgraded to
                       Partners' chip recipe (`inline-flex items-center rounded-md
                       border` + 10/600 + status-tinted bg + 1px border). Prior
                       9px text-3xs / py-0 chips were nearly unreadable and lacked
                       a defined edge. Cancelled pill now uses Partners' canonical
                       cancellation palette (#FEF2F2 / #991B1B / #FECACA). */}
                  <div className="flex items-center gap-2">
                    <span
                      className="text-foreground"
                      style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px", fontFamily: FONT, textDecoration: isItemCancelled ? "line-through" : undefined }}
                    >
                      {li.itemNumber}
                    </span>
                    {isItemCancelled && (
                      <span
                        className="inline-flex items-center rounded-md border shrink-0"
                        style={{
                          padding: "1px 6px",
                          backgroundColor: "#FEF2F2",
                          color: "#991B1B",
                          borderColor: "#FECACA",
                          fontSize: 10,
                          fontWeight: 600,
                          lineHeight: 1.4,
                          fontFamily: FONT,
                        }}
                      >
                        Cancelled
                      </span>
                    )}
                    {!isItemCancelled && (li.cancelledQuantity ?? 0) > 0 && (
                      <span
                        className="inline-flex items-center rounded-md border shrink-0 tabular-nums"
                        style={{
                          padding: "1px 6px",
                          backgroundColor: "#FEF2F2",
                          color: "#991B1B",
                          borderColor: "#FECACA",
                          fontSize: 10,
                          fontWeight: 600,
                          lineHeight: 1.4,
                          fontFamily: FONT,
                        }}
                        title="Remaining quantity cancelled after partial receipt"
                      >
                        {li.cancelledQuantity} {li.defaultUOM} cancelled
                      </span>
                    )}
                    {li.inactive && !isItemCancelled && (
                      <ItemStatusChip inactive={li.inactive} size="sm" showActive={false} />
                    )}
                    <span
                      className="inline-flex items-center rounded-md border shrink-0"
                      style={{
                        padding: "1px 6px",
                        backgroundColor: "#F1F5F9" /* slate-100 — neutral chip surface */,
                        color: "#475569" /* slate-600 — readable label */,
                        borderColor: "#E2E8F0" /* slate-200 */,
                        fontSize: 10,
                        fontWeight: 600,
                        lineHeight: 1.4,
                        fontFamily: FONT,
                      }}
                    >
                      {serialized ? "Serialized" : "Non-Serialized"}
                    </span>
                    {/* Duplicate-flow chips. Tiny badges that surface
                        state stamped on the line during the Duplicate
                        PO flow so the buyer sees the exception inline.
                          · Needs review — new vendor doesn't carry the
                            item; row shows Remove/Qualify strip below.
                          · Qualified — buyer picked "Qualify" for the
                            new vendor; still needs Partners setup.
                          · Price changed — catalog price moved since
                            the source PO; hover shows the new price. */}
                    {li.needsQualificationForVendor && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQualifyPrompt({ target: "single", li });
                            }}
                            className="inline-flex items-center gap-1 rounded-md border shrink-0 cursor-pointer transition-colors hover:brightness-95"
                            style={{
                              padding: "1px 5px 1px 6px",
                              backgroundColor: "#FFFBEB",
                              color: "#B45309",
                              borderColor: "#FDE68A",
                              fontSize: 10,
                              fontWeight: 600,
                              lineHeight: 1.4,
                              fontFamily: FONT,
                            }}
                          >
                            <span>Needs review</span>
                            <ChevronDown className="h-2.5 w-2.5" style={{ color: "#B45309" }} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={6}
                          className="max-w-[240px] text-[11px]"
                        >
                          <span className="font-semibold">{li.needsQualificationForVendor}</span> doesn't carry this item yet. Click to qualify it, or use the row's X to remove.
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {li.qualifiedForVendor && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-flex items-center rounded-md border shrink-0 cursor-help"
                            style={{
                              padding: "1px 6px",
                              backgroundColor: "#EFF6FF",
                              color: "#0A77FF",
                              borderColor: "#BFDBFE",
                              fontSize: 10,
                              fontWeight: 600,
                              lineHeight: 1.4,
                              fontFamily: FONT,
                            }}
                          >
                            {li.qualifiedScope === "po-only" ? "Qualified · PO only" : "Qualified"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={6}
                          className="max-w-[240px] text-[11px]"
                        >
                          {li.qualifiedScope === "po-only" ? (
                            <>
                              Qualified for <span className="font-semibold">{li.qualifiedForVendor}</span> on this PO only. Master item↔vendor mapping unchanged.
                            </>
                          ) : (
                            <>
                              Qualified for <span className="font-semibold">{li.qualifiedForVendor}</span> globally. Future POs on this vendor will inherit.
                            </>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {li.priceChangedFromCatalog != null && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-flex items-center rounded-md border shrink-0 cursor-help"
                            style={{
                              padding: "1px 6px",
                              backgroundColor: "#FFFBEB",
                              color: "#B45309",
                              borderColor: "#FDE68A",
                              fontSize: 10,
                              fontWeight: 600,
                              lineHeight: 1.4,
                              fontFamily: FONT,
                            }}
                          >
                            Price changed
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={6}
                          className="max-w-[240px] text-[11px]"
                        >
                          Catalog price moved since the original PO.<br />
                          <span className="font-semibold">{formatMoney(li.unitPrice, currency)}</span>
                          {" → "}
                          <span className="font-semibold">{formatMoney(li.priceChangedFromCatalog, currency)}</span>
                          {" per unit. Edit the price to sync."}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {/* Note indicator */}
                    {(() => {
                      const nc = getLineItemNoteCounts(po.id, li.id);
                      return <LineItemNoteIndicator vendorCount={nc.vendor} internalCount={nc.internal} />;
                    })()}
                    {/* Delivery-dates chip — sits next to the notes
                        indicator on the header row (buyer 2026-07-22
                        "add date opening next to the notes"). Hover
                        opens the DELIVERY DATES popover with the
                        2026-07-29 model: Expected delivery (primary),
                        Ship by (optional), Promise ship (record-only,
                        only shown when set). */}
                    <LineItemDateStrip li={li} />
                    {/* Per-line ship-from chip (2026-07-28). Ship-from
                        is per-line — different items on the same PO can
                        source from different vendor locations. Chip
                        opens a compact popover with the vendor's full
                        location catalog. Hidden when the vendor has no
                        location list or when the line has no seeded
                        location (e.g. same-vendor duplicates). */}
                    {li.vendorLocationName && vendorLocationCatalog.length > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex max-w-[180px] items-center gap-1 rounded-md border shrink-0 cursor-pointer transition-colors hover:bg-slate-50"
                            style={{
                              padding: "1px 6px",
                              backgroundColor: "#F8FAFC",
                              color: "#334155",
                              borderColor: "#E2E8F0",
                              fontSize: 10,
                              fontWeight: 600,
                              lineHeight: 1.4,
                              fontFamily: FONT,
                            }}
                            title={`Ships from ${li.vendorLocationName}`}
                          >
                            <MapPin className="h-2.5 w-2.5 shrink-0" style={{ color: "#64748B" }} />
                            <span className="truncate">{li.vendorLocationName}</span>
                            <ChevronDown className="h-2.5 w-2.5 shrink-0" style={{ color: "#94A3B8" }} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          side="bottom"
                          align="start"
                          sideOffset={6}
                          className="w-[260px] p-0"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontFamily: FONT }}
                        >
                          <div className="border-b border-slate-100 px-3 py-2">
                            <div className="text-[12px] text-slate-900" style={{ fontWeight: 600 }}>
                              Ships from
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              Pick a {po.vendor.name} location for this line
                            </div>
                          </div>
                          <div className="max-h-[220px] overflow-y-auto py-1">
                            {vendorLocationCatalog.map((loc) => {
                              const isSelected = li.vendorLocationId === loc.id;
                              return (
                                <button
                                  key={loc.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onChangeLineLocation(li, { id: loc.id, name: loc.name });
                                  }}
                                  className={`flex w-full items-start gap-2 px-3 py-1.5 text-left transition-colors ${
                                    isSelected ? "bg-blue-50/60" : "hover:bg-slate-50"
                                  }`}
                                >
                                  <div
                                    className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 ${
                                      isSelected ? "border-[#0A77FF]" : "border-slate-300"
                                    }`}
                                  >
                                    {isSelected && (
                                      <div
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{ backgroundColor: "#0A77FF" }}
                                      />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="truncate text-[12px] text-slate-900"
                                        style={{ fontWeight: 500 }}
                                      >
                                        {loc.name}
                                      </span>
                                      {loc.isDefault && (
                                        <span
                                          className="inline-flex shrink-0 items-center rounded-md text-[9px] font-semibold uppercase tracking-wide"
                                          style={{
                                            color: "#0A77FF",
                                            backgroundColor: "#EFF6FF",
                                            border: "1px solid #BFDBFE",
                                            letterSpacing: "0.05em",
                                            padding: "0 5px",
                                            lineHeight: "14px",
                                          }}
                                        >
                                          Default
                                        </span>
                                      )}
                                    </div>
                                    {loc.description && (
                                      <div
                                        className="mt-0.5 text-[10.5px] text-slate-500"
                                        style={{ lineHeight: 1.4 }}
                                      >
                                        {loc.description}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>

                  {/* Item name + description — bumped 11px → 12/400 line-height 18px
                       so the primary descriptor is comfortably readable; previously
                       the body text sat at the same size as the column captions. */}
                  <TruncatedItemName
                    name={fullDescription}
                    maxChars={80}
                    style={{ fontSize: 12, fontWeight: 400, lineHeight: "18px", color: "#475569" /* slate-600 — readable secondary text */ }}
                    className=""
                  />
                </div>
              </div>

              {/* ── QTY column — editable in every non-cancelled state ── */}
              <div className="flex flex-col items-end pt-0.5">
                {canEdit ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <input
                      type="text"
                      inputMode={serialized ? "numeric" : "decimal"}
                      value={isEditingQty ? editingQtyValue : li.vendorQty}
                      onChange={(e) => {
                        if (!freeEdit) return;
                        if (!isEditingQty) startQtyEdit(li);
                        const raw = e.target.value;
                        if (isValidQuantityDraft(raw, serialized)) setEditingQtyValue(raw);
                      }}
                      onFocus={(e) => {
                        if (!freeEdit) {
                          e.target.blur();
                          onRequestEditSession("Qty Change");
                          return;
                        }
                        if (!isEditingQty) startQtyEdit(li);
                        setTimeout(() => e.target.select(), 0);
                      }}
                      onKeyDown={(e) => {
                        preventInvalidQuantityKey(e, serialized);
                        if (e.key === "Enter") commitQtyEdit(li);
                        if (e.key === "Escape") cancelQtyEdit();
                      }}
                      onBlur={() => { if (isEditingQty) commitQtyEdit(li); }}
                      onClick={(e) => e.stopPropagation()}
                      readOnly={!freeEdit}
                      /* Input recipe — Partners compact-form pattern verbatim
                         (`Partners/.../PocDataTable.tsx` search-input + base
                         shadcn Input override):
                           h-9 (36px) · rounded-md · border-border/80 · shadow-sm
                           · focus:border-primary · focus:ring-2 ring-primary/20
                           · text 13 (kept smaller than Partners' text-sm so the
                              numeric columns don't overflow our fixed widths)
                           · weight 400 default · tabular-nums for column alignment.
                         Partners has no true inline-edit cells; this is the
                         closest analogue in their input vocabulary. */
                      className={`w-[84px] h-9 px-2 text-right rounded-md border bg-white text-foreground outline-none shadow-sm transition-all duration-150 tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/20 ${!freeEdit ? "cursor-pointer" : ""}`}
                      style={{ fontSize: 13, fontWeight: 400, lineHeight: "18px", fontFamily: FONT, borderColor: "color-mix(in srgb, hsl(var(--border)) 80%, transparent)" }}
                    />
                    <span className="w-[84px] text-right" style={{ fontSize: 10, fontWeight: 500, lineHeight: "12px", fontFamily: FONT, color: "#64748B" /* slate-500 */, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                      {li.vendorUOM}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className="text-foreground tabular-nums"
                      style={{ fontSize: 13, fontWeight: 500, lineHeight: "18px", fontFamily: FONT }}
                    >
                      {li.vendorQty}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 500, lineHeight: "12px", fontFamily: FONT, color: "#64748B" /* slate-500 */, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                      {li.vendorUOM}
                    </span>
                  </div>
                )}
              </div>

              {/* ── PRICE PER UNIT — editable in every non-cancelled state ── */}
              <div className="text-right pt-0.5">
                {canEdit ? (
                  <div className="relative inline-flex items-center">
                    {/* Currency sign — the PO currency's symbol or code
                         (spec 4.3), slate-500 / 13 / 400 (matches input
                         weight), sits inside the input via left padding
                         sized to it so the numeric column right-aligns. */}
                    <span className="absolute left-2.5 pointer-events-none tabular-nums" style={{ fontSize: 13, fontWeight: 400, lineHeight: "18px", fontFamily: FONT, color: "#64748B" }}>{pricePrefix}</span>
                    <input
                      type="number"
                      min={0}
                      step={10 ** -priceDecimals}
                      aria-label={`Price per unit, ${currency}`}
                      value={editingPriceId === li.id ? editingPriceValue : effectivePrice.toFixed(priceDecimals)}
                      onChange={(e) => {
                        if (!freeEdit) return;
                        if (editingPriceId !== li.id) startPriceEdit(li);
                        setEditingPriceValue(e.target.value);
                      }}
                      onFocus={(e) => {
                        if (!freeEdit) {
                          e.target.blur();
                          onRequestEditSession("Price Change");
                          return;
                        }
                        if (editingPriceId !== li.id) startPriceEdit(li);
                        setTimeout(() => e.target.select(), 0);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitPriceEdit(li);
                        if (e.key === "Escape") cancelPriceEdit();
                      }}
                      onBlur={() => { if (editingPriceId === li.id) commitPriceEdit(li); }}
                      onClick={(e) => e.stopPropagation()}
                      readOnly={!freeEdit}
                      /* Same recipe as the Qty input — Partners compact-form pattern:
                         h-9 · rounded-md · border-border/80 · shadow-sm · focus:ring-2
                         primary/20 · 13/400 tabular-nums. `pl-6` gives the $ sign
                         room and `pr-2` keeps the right edge flush. */
                      /* No spinner (as on the price-book inputs), so a yen or won
                         price's extra digits fit the column. */
                      className={`h-9 pr-2 text-right rounded-md border bg-white text-foreground outline-none shadow-sm transition-all duration-150 tabular-nums focus:border-primary focus:ring-2 focus:ring-primary/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${!freeEdit ? "cursor-pointer" : ""}`}
                      style={{ width: Math.min(110, 96 + 8 * Math.max(0, pricePrefix.length - 1)), paddingLeft: 16 + 8 * pricePrefix.length, fontSize: 13, fontWeight: 400, lineHeight: "18px", fontFamily: FONT, borderColor: "color-mix(in srgb, hsl(var(--border)) 80%, transparent)" }}
                    />
                  </div>
                ) : (
                  <span
                    className="text-foreground tabular-nums"
                    style={{ fontSize: 13, fontWeight: 500, lineHeight: "18px", fontFamily: FONT }}
                  >
                    {formatMoney(effectivePrice, currency)}
                  </span>
                )}
              </div>

              {/* ── TOTAL — 13/600 tabular-nums so totals align cleanly down
                   the column. Discount badge (below) is now visible (primary-600)
                   instead of the prior invisible --accent token. */}
              <div className="text-right pt-0.5">
                {/* Line total — hover breakdown reveals the vendor
                    pricing rules stacked onto this line (ported from
                    Sales-Order-V5). Falls back to a bare span if no
                    rules are active (POPriceBreakdownHoverCard
                    handles the empty-impacts case gracefully). */}
                <POPriceBreakdownHoverCard
                  line={{
                    id: li.id,
                    itemCode: li.itemNumber,
                    orderedQty: li.quantity,
                    unitPrice: li.unitPrice * (1 - li.discount / 100),
                  }}
                  breakdown={pricingBreakdowns.get(li.id) ?? null}
                  adjustment={adjustmentBreakdowns?.get(li.id) ?? null}
                  formatCurrency={(n) => formatMoney(n, currency)}
                >
                  <span
                    className="text-foreground tabular-nums"
                    style={{ fontSize: 13, fontWeight: 600, lineHeight: "18px", fontFamily: FONT }}
                  >
                    {/* Net line total — static %, pricing rules and item-level
                        one-times included, so it matches the hover card's
                        Total and the Order Summary. */}
                    {formatMoney(isEditingQty
                      ? previewLineTotal
                      : li.lineTotal
                        - (pricingBreakdowns.get(li.id)?.discountAmount ?? 0)
                        + (pricingBreakdowns.get(li.id)?.premiumAmount ?? 0)
                        + (adjustmentBreakdowns?.get(li.id)?.net ?? 0),
                    currency)}
                  </span>
                </POPriceBreakdownHoverCard>
                {li.discount > 0 && (
                  <span
                    className="block mt-0.5 tabular-nums"
                    style={{ fontSize: 10, fontWeight: 500, lineHeight: "14px", fontFamily: FONT, color: "#085FCC" /* Partners primary-600 — used for inline savings/overflow indicators verbatim from `Partners/.../VendorDetailsPage.tsx` */ }}
                  >
                    -{li.discount}% off
                  </span>
                )}
                {/* Per-line rule indicator (buyer 2026-07-29: "always
                    show the net amount whenever any rule is applied —
                    the two-rules row should read 13% off"). Reads
                    "N rule(s) · X% off" when the net impact is a
                    discount, "N rule(s) · X% premium" when it's a
                    premium, "N rule(s)" if the two sides cancel out.
                    Net % is discount % minus premium %, both relative
                    to the base subtotal. */}
                {(() => {
                  const bd = pricingBreakdowns.get(li.id);
                  if (!bd || bd.ruleImpacts.length === 0) return null;
                  const ruleCount = bd.ruleImpacts.length;
                  const base = bd.baseSubtotal;
                  const netAmount = bd.discountAmount - bd.premiumAmount;
                  const netPct = base > 0 ? (netAmount / base) * 100 : 0;
                  const label = ruleCount === 1 ? "rule" : "rules";
                  const roundedPct = Math.round(netPct * 10) / 10;
                  const displayPct = Number.isInteger(roundedPct) ? roundedPct.toFixed(0) : roundedPct.toFixed(1);
                  let suffix = "";
                  let color = "#1B6EF3";
                  if (roundedPct > 0) {
                    suffix = ` · ${displayPct}% off`;
                    color = "hsl(var(--success))";
                  } else if (roundedPct < 0) {
                    suffix = ` · ${Math.abs(Number(displayPct))}% premium`;
                    color = "#7C3AED";
                  }
                  return (
                    <span
                      className="block mt-0.5"
                      style={{ fontSize: 10, fontWeight: 500, lineHeight: "14px", fontFamily: FONT, color }}
                    >
                      {ruleCount} {label}{suffix}
                    </span>
                  );
                })()}
              </div>

              {/* ── RECEIVED (inline column) — palette switched 2026-05.
                   Previously used `--accent` (pale blue #EFF6FF) for "fully
                   received" text + bar fill, which rendered invisible against
                   the white card surface. Now uses `--success` (emerald) for
                   full, `--warning` (amber) for partial, `--muted-foreground`
                   for none — threshold-driven palette matching the rest of
                   the app's status semantics. */}
              {showReceiving && (() => {
                const recvPct = li.quantity > 0 ? Math.min(100, (li.receivedQuantity / li.quantity) * 100) : 0;
                const isFull = li.receivedQuantity >= li.quantity;
                const isPartial = li.receivedQuantity > 0 && !isFull;
                const statusColor = isFull ? "hsl(var(--success))" : isPartial ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))";
                return (
                  <div className="flex flex-col items-end gap-1 pt-0.5">
                    <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, lineHeight: "18px", fontFamily: FONT, color: statusColor }}>
                      {li.receivedQuantity}/{li.quantity}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 500, lineHeight: "12px", fontFamily: FONT, color: "#64748B" /* slate-500 — matches other secondary labels */, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                      {li.vendorUOM}
                    </span>
                    <div className="w-full max-w-[72px] h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "hsl(var(--border))" }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${recvPct}%`, backgroundColor: isFull ? "hsl(var(--success))" : isPartial ? "hsl(var(--warning))" : "transparent" }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* ── ACTIONS — Partners ghost-button recipe: 32×32 (h-8 w-8) rounded-md
                   muted icon with hover bg `--muted/60` and color-shifting target.
                   Hover bg bumped 6% → 60% muted (with primary/destructive tint
                   for semantic) so the affordance is actually visible; icons
                   bumped from `size-3` to `size-3.5` for parity. */}
              <div className="flex items-center justify-end gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
                {(canEdit || onCancelItem) && !isItemCancelled && (
                  <>
                    {canEdit && <button
                      className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors duration-150 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!freeEdit) { onRequestEditSession("Item Edit"); return; }
                        onEditItem(li);
                      }}
                      title="Edit item"
                      aria-label="Edit item"
                    >
                      <Pencil className="size-3.5" />
                    </button>}
                    {po.status === "Draft" ? (
                      <button
                        className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!freeEdit) { onRequestEditSession("Item Removed"); return; }
                          onRemoveItem(li.id);
                        }}
                        title="Remove item"
                        aria-label="Remove item"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : onCancelItem ? (
                      <button
                        className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); onCancelItem(li.id); }}
                        title="Cancel item"
                        aria-label="Cancel item"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Empty State — Partners empty-state recipe
            (`Partners/.../DataTableStyleReference`): icon `w-8 h-8`
            text-muted-foreground, `text-sm` headline, `text-xs` body,
            primary button. Prior recipe used `foreground/20-40` opacity
            tokens that rendered the label nearly invisible. */}
      {canEdit && po.lineItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
            <Package className="size-5" style={{ color: "#94A3B8" /* slate-400 */ }} strokeWidth={1.75} />
          </div>
          <div className="text-center">
            <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, fontFamily: FONT, color: "#334155" /* slate-700 */ }}>No items yet</p>
            <p className="mt-1" style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.4, fontFamily: FONT, color: "#64748B" /* slate-500 */ }}>
              Click &quot;Browse Vendor Items&quot; to add to this PO.
            </p>
          </div>
          <Button
            size="sm"
            className="h-9 gap-1.5 px-4 mt-1 rounded-lg shadow-sm"
            style={{ fontSize: 13, fontWeight: 600, fontFamily: FONT, lineHeight: 1 }}
            onClick={onAddItems}
          >
            <Plus className="size-3.5" /> Browse Vendor Items
          </Button>
        </div>
      )}

      {/* Qualify-scope prompt (2026-07-28) — reuses PriceWarningShell
          from the price-add flow so the "add to master vs use here
          only" pattern reads consistently across the Draft. Opens
          when the buyer clicks Qualify (single) or Qualify all (bulk). */}
      <PriceWarningShell
        open={qualifyPrompt !== null}
        onOpenChange={(next) => {
          if (!next) setQualifyPrompt(null);
        }}
        tone="blue"
        chipLabel="Qualify vendor"
        title="Would you like to qualify this vendor for these items?"
        description={
          qualifyPrompt?.target === "bulk" ? (
            <>
              You're qualifying{" "}
              <span style={{ fontWeight: 600 }}>{promptLines.length}</span> line item{promptLines.length === 1 ? "" : "s"} for{" "}
              <span style={{ fontWeight: 600 }}>{promptVendorName}</span>. Use them on this PO only, or add this to the partner's location and keep ordering from there.
            </>
          ) : (
            <>
              You're qualifying{" "}
              <span style={{ fontWeight: 600 }}>{qualifyPrompt?.target === "single" ? qualifyPrompt.li.itemNumber : ""}</span> for{" "}
              <span style={{ fontWeight: 600 }}>{promptVendorName}</span>. Use it on this PO only, or add this to the partner's location and keep ordering from there.
            </>
          )
        }
        primaryLabel="Qualify on this PO only"
        secondaryLabel="Add this to the partner's location and keep ordering from there"
        onPrimary={() => applyQualification("po-only")}
        onSecondary={() => applyQualification("vendor")}
      />
    </div>
  );
}


function ChangeVendorContactDialog({
  open,
  onOpenChange,
  poId,
  vendorName,
  currentRecipient,
  currentSecondaryNames,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  poId: string;
  vendorName: string;
  currentRecipient: { name: string; role: string; email: string; phone: string };
  currentSecondaryNames: string[];
  onSaved?: (newPrimaryName: string, newSecondaryNames: string[]) => void;
}) {
  const contacts = getVendorContacts(vendorName);
  const [primaryName, setPrimaryName] = useState(currentRecipient.name);
  const [secondaryNames, setSecondaryNames] = useState<Set<string>>(new Set(currentSecondaryNames));
  const [searchQuery, setSearchQuery] = useState("");

  /* Avatar palette */
  const AVATAR_BG = [
    "var(--avatar-1-bg)", "var(--avatar-3-bg)", "var(--avatar-4-bg)",
    "var(--avatar-2-bg)", "var(--avatar-5-bg)", "var(--avatar-6-bg)", "var(--avatar-7-bg)",
  ];
  const AVATAR_TEXT = [
    "var(--avatar-1-text)", "var(--avatar-3-text)", "var(--avatar-4-text)",
    "var(--avatar-2-text)", "var(--avatar-5-text)", "var(--avatar-6-text)", "var(--avatar-7-text)",
  ];

  useEffect(() => {
    if (open) {
      setPrimaryName(currentRecipient.name);
      setSecondaryNames(new Set(currentSecondaryNames));
      setSearchQuery("");
    }
  }, [open, currentRecipient.name, currentSecondaryNames]);

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const filteredContacts = searchQuery.trim()
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : contacts;

  const toggleSecondary = (name: string) => {
    if (name === primaryName) return; // can't add primary as secondary
    setSecondaryNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const makePrimary = (name: string) => {
    // If switching primary, remove new primary from secondary set
    setSecondaryNames((prev) => {
      const next = new Set(prev);
      next.delete(name);
      // Optionally add old primary to secondary
      if (primaryName && primaryName !== name) {
        next.add(primaryName);
      }
      return next;
    });
    setPrimaryName(name);
  };

  const handleSave = () => {
    const c = contacts.find((ct) => ct.name === primaryName);
    if (c) {
      const finalSecondary = Array.from(secondaryNames).filter((n) => n !== primaryName);
      updatePOContacts(poId, { name: c.name, role: c.role, email: c.email, phone: c.phone }, finalSecondary);
      onSaved?.(c.name, finalSecondary);
    }
    onOpenChange(false);
  };

  const selectedCount = 1 + secondaryNames.size; // primary + secondaries

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-center size-10 rounded-[var(--radius-md)] bg-primary/8 shrink-0">
            <Users className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle style={{ ...st.fieldValueBold, fontSize: "var(--text-label)" }} className="text-foreground">
              Manage Point of Contacts
            </DialogTitle>
            <DialogDescription style={st.uiSmall} className="text-muted-foreground mt-0.5">
              Select contacts and assign one as primary for {vendorName}
            </DialogDescription>
          </div>
          <span
            className="inline-flex items-center px-2 py-1 rounded-[var(--radius-sm)] bg-secondary text-muted-foreground shrink-0"
            style={st.tiny}
          >
            {selectedCount} selected
          </span>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
            <input
              className="w-full h-8 pl-9 pr-3 rounded-[var(--radius-md)] border border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/40 transition-all"
              style={st.uiSmall}
              placeholder="Search contacts by name, role, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Two-column contact grid */}
        <div className="px-5 pb-3 max-h-[55vh] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {filteredContacts.length === 0 && (
            <div className="py-8 text-center text-muted-foreground/50" style={st.uiSmall}>
              No contacts match your search
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filteredContacts.map((contact) => {
              const isPrimary = contact.name === primaryName;
              const isSecondary = secondaryNames.has(contact.name);
              const isSelected = isPrimary || isSecondary;
              const avatarIdx = contacts.indexOf(contact);

              return (
                <button
                  key={contact.name}
                  type="button"
                  className={`rounded-[var(--radius-md)] border transition-all cursor-pointer text-left ${
                    isSelected
                      ? "border-primary/40 ring-1 ring-primary/15 bg-primary/[0.04]"
                      : "border-border bg-card hover:border-primary/25 hover:bg-secondary/40"
                  }`}
                  onClick={() => {
                    if (isPrimary) return;
                    toggleSecondary(contact.name);
                  }}
                >
                  <div className="flex items-start gap-2.5 p-3">
                    {/* Avatar */}
                    <div
                      className="flex items-center justify-center size-9 rounded-full shrink-0 mt-0.5"
                      style={{ backgroundColor: AVATAR_BG[avatarIdx % AVATAR_BG.length] }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "var(--font-weight-medium)" as string,
                          lineHeight: "1",
                          fontFamily: FONT,
                          color: AVATAR_TEXT[avatarIdx % AVATAR_TEXT.length],
                        }}
                      >
                        {getInitials(contact.name)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Name */}
                      <span className="text-foreground block truncate" style={st.fieldValueBold}>
                        {contact.name}
                      </span>
                      {/* Role */}
                      <span className="text-muted-foreground block mt-0.5 truncate" style={st.uiSmall}>
                        {contact.role}
                      </span>
                      {/* Phone + Email */}
                      <div className="flex flex-col gap-0.5 mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <Phone className="size-2.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                          <span className="text-foreground/70 truncate" style={st.uiSmall}>{contact.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail className="size-2.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                          <span className="text-foreground/70 truncate" style={st.uiSmall}>{contact.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: star (only when selected) + checkbox */}
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {isSelected && (
                        <button
                          type="button"
                          className={`flex items-center justify-center size-6 rounded-[var(--radius-sm)] transition-all ${
                            isPrimary
                              ? "text-primary cursor-default"
                              : "text-muted-foreground/40 hover:text-primary hover:bg-primary/8 cursor-pointer"
                          }`}
                          title={isPrimary ? "Primary contact" : "Set as primary contact"}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isPrimary) makePrimary(contact.name);
                          }}
                        >
                          <Star className={`size-4 ${isPrimary ? "fill-primary" : ""}`} />
                        </button>
                      )}
                      <div
                        className={`flex items-center justify-center size-5 rounded-[var(--radius-sm)] border transition-all ${
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-border"
                        }`}
                      >
                        {isSelected && <Check className="size-3 text-white" />}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-secondary/50">
          <span className="text-muted-foreground" style={st.uiSmall}>
            {contacts.length} contacts available
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3" style={st.uiLabel} onClick={() => onOpenChange(false)}>
              <X className="size-3.5" />
              Cancel
            </Button>
            <Button size="sm" className="h-8 gap-1.5 px-4" style={st.uiLabel} onClick={handleSave}>
              <Save className="size-3.5" />
              Save Contacts
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════��═════════��══════════════
   (removed — now in PaymentTermsDialog / PaymentMethodDialog)
   ═══════════��═════════════════════════════════════��═════════════ */

/* ══════════════════════════════════════════════════════════════
   DUPLICATE PO DIALOG
   Shows a summary of what will be duplicated and creates a new Draft PO.
   ═══════════════════════════════════════════════════════════════ */

export interface DuplicatePOConfirmOpts {
  sourceVersion: number;
  vendor: VendorEntity | null;
  /** Ship-to / vendor location picked inside the dialog when the buyer
   *  chose "Different vendor". Undefined for same-vendor duplicates or
   *  when the picked vendor has no location list. The parent forwards
   *  this to `startDuplicate` which overrides the default location in
   *  `vendorEntityToPOVendor`. */
  vendorLocation?: VendorLocationInfo;
}

/* ─────────────────────────────────────────────────────────────────
   Duplicate PO modal — ported from the Sales Orders V5 Duplicate
   Sales Order pattern (buyer 2026-07-22: "our current modal is too
   much information … same as sales order, vendors instead of
   customers"). Two white section cards on a light wash; RadioOption
   cards for Same/Different vendor; portalled version picker; small
   Cancel + Duplicate footer.
   ───────────────────────────────────────────────────────────────── */

function DuplicateSectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border border-slate-200 bg-white"
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
    >
      <div
        className="flex items-center gap-2 rounded-t-lg border-b border-[#EEF2F6] px-4 py-2.5"
        style={{ backgroundColor: "#FAFBFC" }}
      >
        <div
          className="flex h-6 w-6 items-center justify-center rounded-md shrink-0"
          style={{ backgroundColor: "rgba(10,119,255,0.08)" }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: "#0A77FF" }} />
        </div>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[13px] text-slate-900" style={{ fontWeight: 600 }}>
            {title}
          </span>
          {description && (
            <span className="text-[11px] leading-snug text-slate-500">{description}</span>
          )}
        </div>
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </div>
  );
}

/* Radio card surface — div (not button) so nested search input +
   list rows remain interactive. Selected state = primary border +
   light ring, matching the SO reference. */
function DuplicateRadioCard({
  selected,
  onSelect,
  children,
  showDisclosure = false,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  /** When true, renders a trailing chevron in the header row that
   *  rotates 90° when the card is `selected` — a hint that picking
   *  this card reveals more UI below (buyer 2026-07-28). */
  showDisclosure?: boolean;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group cursor-pointer rounded-lg border bg-white px-3 py-2.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A77FF]/20 ${
        selected
          ? "border-[#7AB8FF]/70"
          : "border-slate-200 hover:border-slate-300"
      }`}
      style={
        selected
          ? { boxShadow: "0 1px 4px rgba(10,119,255,0.06)" }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors ${
            selected
              ? "bg-[#0A77FF]"
              : "border-[1.5px] border-slate-300 group-hover:border-slate-400"
          }`}
          style={
            selected
              ? { boxShadow: "0 0 0 2px rgba(10,119,255,0.15)" }
              : undefined
          }
        >
          {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
        {showDisclosure && (
          <ChevronRight
            className="mt-[5px] h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200"
            style={{ transform: selected ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        )}
      </div>
    </div>
  );
}

/* Radix wraps outside-click into a CustomEvent whose `target` is the
   Radix layer, not the real DOM target. The real path lives on
   `e.detail.originalEvent`. We walk composedPath so a click anywhere
   inside our portalled version panel reads as in-bounds and the
   Dialog stays open. */
function isClickInsideDupVersionPanel(e: any): boolean {
  const orig = e?.detail?.originalEvent;
  const path: EventTarget[] =
    typeof orig?.composedPath === "function" ? orig.composedPath() : [];
  for (const node of path) {
    const el = node as Element | null;
    if (
      el &&
      typeof (el as any).getAttribute === "function" &&
      (el as Element).getAttribute("data-dup-po-version-panel") !== null
    ) {
      return true;
    }
  }
  const target = (orig?.target ?? e?.target) as HTMLElement | null;
  if (target && typeof target.closest === "function" && target.closest("[data-dup-po-version-panel]")) {
    return true;
  }
  return false;
}

/* Version-status palette — same values used by the Version History
   dropdown (`POVersionDropdown.tsx`) so the two surfaces read as one
   family. Each entry supplies the row pill (bg / color / border) and
   the status icon that goes in the round icon tile. */
const DUP_VERSION_STATUS_CFG: Record<
  POVersionStatus,
  { label: string; bg: string; color: string; border: string; icon: React.ElementType }
> = {
  draft:                { label: "Draft",     bg: "#F1F5F9", color: "#334155", border: "#E2E8F0", icon: FileText },
  sent:                 { label: "Sent",      bg: "#EFF6FF", color: "#1E40AF", border: "#BFDBFE", icon: Send },
  confirmed:            { label: "Confirmed", bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0", icon: CheckCircle2 },
  "partially-received": { label: "Partial",   bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", icon: Clock },
};

/* Short date used in the version rows — mm/dd/yyyy so it aligns with
   the Version History dropdown and consumes minimal width. */
function formatDupVersionDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/* Version picker — portalled panel with `position: fixed` so the
   Dialog's `overflow-y: auto` body can't clip it; `pointer-events:
   auto` restores clickability under Radix's body scroll-lock. Each
   row mirrors the Version History dropdown (`POVersionDropdown.tsx`):
   status-tinted icon tile + V{n} + status pill + "Latest" pill (for
   the newest version) + right-aligned date. */
function DuplicateVersionSelect({
  versions,
  selectedVersion,
  currentVersion,
  onSelect,
  onViewVersionDetails,
}: {
  versions: POVersionEntry[];
  selectedVersion: number;
  currentVersion: number;
  onSelect: (v: number) => void;
  /** Per-row "View details" affordance — selects the row's version and
   *  opens the Version History modal (or whichever detail surface the
   *  parent wires up). Undefined hides the button entirely. Replaces
   *  the older global "View details" button that lived above the list. */
  onViewVersionDetails?: (v: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    left: number;
    minWidth: number;
    placeAbove: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPanelPos(null);
      return;
    }
    const reposition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const panelHeight = 320;
      const spaceBelow = window.innerHeight - rect.bottom;
      const placeAbove = spaceBelow < panelHeight && rect.top > panelHeight;
      setPanelPos({
        top: placeAbove ? rect.top - 6 : rect.bottom + 6,
        left: rect.left,
        minWidth: Math.max(rect.width, 320),
        placeAbove,
      });
    };
    reposition();
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [isOpen]);

  const selected = versions.find((v) => v.version === selectedVersion) ?? versions[0];
  if (!selected) return null;
  const latestVersionNum = versions[0]?.version ?? currentVersion;
  const isSelectedLatest = selected.version === latestVersionNum;
  const selCfg = DUP_VERSION_STATUS_CFG[selected.versionStatus] ?? DUP_VERSION_STATUS_CFG.draft;
  const SelIcon = selCfg.icon;
  const selDate = formatDupVersionDate(selected.createdAt);

  /* Icon tile — status-tinted for Sent (matches Version History
     dropdown), amber for revert entries, neutral otherwise. */
  const tileVisuals = (v: POVersionEntry) =>
    v.versionStatus === "sent"
      ? { bg: "#DBEAFE", border: "#93C5FD", iconColor: "#2563EB", Icon: Send }
      : v.isRevert
        ? { bg: "#FFFBEB", border: "#FDE68A", iconColor: "#D97706", Icon: RotateCcw }
        : { bg: "#F9FAFB", border: "#F3F4F6", iconColor: "#9CA3AF", Icon: FileText };
  const selTile = tileVisuals(selected);
  const SelTileIcon = selTile.Icon;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="inline-flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
        style={{ minHeight: 44 }}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: selTile.bg, border: `1px solid ${selTile.border}` }}
        >
          <SelTileIcon style={{ width: 11, height: 11, color: selTile.iconColor }} />
        </span>
        <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
          <span
            className="text-[13px] tabular-nums text-slate-900"
            style={{ fontWeight: 600, lineHeight: 1 }}
          >
            V{selected.version}
          </span>
          <span
            className="inline-flex items-center gap-1"
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: selCfg.color,
              backgroundColor: selCfg.bg,
              border: `1px solid ${selCfg.border}`,
              padding: "2px 5px",
              borderRadius: 3,
              lineHeight: 1,
            }}
          >
            <SelIcon style={{ width: 9, height: 9 }} />
            {selCfg.label}
          </span>
          {isSelectedLatest && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#374151",
                backgroundColor: "#F3F4F6",
                border: "1px solid #E5E7EB",
                padding: "2px 5px",
                borderRadius: 3,
                lineHeight: 1,
              }}
            >
              Latest
            </span>
          )}
        </span>
        {selDate && (
          <span
            className="tabular-nums text-slate-400"
            style={{ fontSize: 11, lineHeight: 1 }}
          >
            {selDate}
          </span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && panelPos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            data-dup-po-version-panel
            className="bg-white"
            style={{
              position: "fixed",
              top: panelPos.placeAbove ? undefined : panelPos.top,
              bottom: panelPos.placeAbove ? window.innerHeight - panelPos.top : undefined,
              left: panelPos.left,
              minWidth: panelPos.minWidth,
              borderRadius: 8,
              border: "1px solid #E2E8F0",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
              overflow: "hidden",
              zIndex: 12500,
              pointerEvents: "auto",
              fontFamily: FONT,
            }}
          >
            <div className="border-b border-slate-100 px-3 py-2">
              <div className="text-[12px] text-slate-900" style={{ fontWeight: 600 }}>
                Select version to duplicate
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {versions.length} version{versions.length === 1 ? "" : "s"} available
              </div>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              {versions.map((v) => {
                const rowSelected = v.version === selectedVersion;
                const rowLatest = v.version === latestVersionNum;
                const rowCfg = DUP_VERSION_STATUS_CFG[v.versionStatus] ?? DUP_VERSION_STATUS_CFG.draft;
                const RowStatusIcon = rowCfg.icon;
                const rowTile = tileVisuals(v);
                const RowTileIcon = rowTile.Icon;
                const rowDate = formatDupVersionDate(v.createdAt);
                return (
                  <div
                    key={v.version}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 ${
                      rowSelected ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(v.version);
                        setIsOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: rowTile.bg, border: `1px solid ${rowTile.border}` }}
                      >
                        <RowTileIcon style={{ width: 11, height: 11, color: rowTile.iconColor }} />
                      </span>
                      <span className="inline-flex min-w-0 flex-1 items-center gap-1.5">
                        <span
                          className="text-[13px] tabular-nums text-slate-900"
                          style={{ fontWeight: 600, lineHeight: 1 }}
                        >
                          V{v.version}
                        </span>
                        <span
                          className="inline-flex items-center gap-1"
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: rowCfg.color,
                            backgroundColor: rowCfg.bg,
                            border: `1px solid ${rowCfg.border}`,
                            padding: "2px 5px",
                            borderRadius: 3,
                            lineHeight: 1,
                          }}
                        >
                          <RowStatusIcon style={{ width: 9, height: 9 }} />
                          {rowCfg.label}
                        </span>
                        {rowLatest && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#374151",
                              backgroundColor: "#F3F4F6",
                              border: "1px solid #E5E7EB",
                              padding: "2px 5px",
                              borderRadius: 3,
                              lineHeight: 1,
                            }}
                          >
                            Latest
                          </span>
                        )}
                      </span>
                      {rowDate && (
                        <span
                          className="tabular-nums text-slate-400"
                          style={{ fontSize: 11, lineHeight: 1 }}
                        >
                          {rowDate}
                        </span>
                      )}
                      {rowSelected && (
                        <Check
                          className="h-3.5 w-3.5 shrink-0 text-[#0A77FF]"
                          strokeWidth={3}
                        />
                      )}
                    </button>
                    {/* Per-row View details — selects the row's version
                        and opens the Version History modal on it. Kept
                        as its own button (nested buttons are invalid
                        HTML, so the row is a <div> wrapping two peers). */}
                    {onViewVersionDetails && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(v.version);
                          onViewVersionDetails(v.version);
                          setIsOpen(false);
                        }}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-[#0A77FF] transition-colors hover:bg-blue-50/60"
                        title={`View details for V${v.version}`}
                      >
                        <Eye className="h-3 w-3" />
                        Details
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Duplicate PO — Vendor & Location picker (buyer 2026-07-28).
   Two-pane overlay mirroring ShippingCarrierPicker's structure:
     · Left pane  = searchable vendor list. Hover / click puts a row
                    into the "active" slot which drives the right pane.
     · Right pane = searchable location list for the active vendor.
   Confirmation returns BOTH the picked vendor and location so the
   Duplicate flow can commit them together. Nested inside the parent
   Duplicate Dialog (Radix handles the stacking).
   ───────────────────────────────────────────────────────────────── */

function DuplicateVendorLocationPicker({
  open,
  onOpenChange,
  vendors,
  initialVendorId,
  initialLocationId,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Vendor pool — the source PO's own vendor is expected to be
   *  filtered out by the caller before passing in. */
  vendors: VendorEntity[];
  /** Vendor currently persisted on the parent dialog (or null when
   *  nothing has been picked yet). The picker seeds selection from
   *  this so re-opening the overlay lands on the same row. */
  initialVendorId: string | null;
  /** Location currently persisted on the parent dialog (defaults to
   *  the vendor's default location when null). */
  initialLocationId: string | null;
  onConfirm: (vendor: VendorEntity, location: VendorLocationInfo) => void;
}) {
  const [vendorSearch, setVendorSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  /* Selection is click-only (buyer 2026-07-28: "you don't need to
     show change results on hover"). The right pane always reflects
     the clicked vendor — no hover preview. */
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(
    initialVendorId ?? vendors[0]?.id ?? null,
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(initialLocationId);
  const vendorSearchRef = useRef<HTMLInputElement>(null);

  /* Reseed selection whenever the overlay opens. When the parent
     hasn't picked a vendor yet, default to the first one in the
     list (buyer 2026-07-28: "By default one will be selected always
     the first vendor"). */
  useEffect(() => {
    if (open) {
      setVendorSearch("");
      setLocationSearch("");
      setSelectedVendorId(initialVendorId ?? vendors[0]?.id ?? null);
      setSelectedLocationId(initialLocationId);
      setTimeout(() => vendorSearchRef.current?.focus(), 60);
    }
  }, [open, initialVendorId, initialLocationId, vendors]);

  /* Active vendor drives the right pane — click-only. */
  const activeVendorId = selectedVendorId;
  const activeVendor = React.useMemo(
    () => vendors.find((v) => v.id === activeVendorId) ?? null,
    [vendors, activeVendorId],
  );

  const filteredVendors = React.useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => {
      if (v.name.toLowerCase().includes(q)) return true;
      const loc = v.locations.find((l) => l.isDefault) ?? v.locations[0];
      if (loc?.name.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [vendors, vendorSearch]);

  const filteredLocations = React.useMemo(() => {
    if (!activeVendor) return [] as VendorLocationInfo[];
    const q = locationSearch.trim().toLowerCase();
    if (!q) return activeVendor.locations;
    return activeVendor.locations.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.description?.toLowerCase().includes(q) ?? false),
    );
  }, [activeVendor, locationSearch]);

  /* Location selection auto-follows the vendor being *selected*
     (not merely hovered) — when the buyer clicks a new vendor, we
     jump the location cursor to that vendor's default. */
  useEffect(() => {
    if (!selectedVendorId) return;
    const vendor = vendors.find((v) => v.id === selectedVendorId);
    if (!vendor) return;
    const inList = vendor.locations.some((l) => l.id === selectedLocationId);
    if (inList) return;
    const def =
      vendor.locations.find((l) => l.isDefault) ?? vendor.locations[0];
    setSelectedLocationId(def?.id ?? null);
  }, [selectedVendorId, vendors]);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId) ?? null;
  const selectedLocation = selectedVendor
    ? selectedVendor.locations.find((l) => l.id === selectedLocationId) ??
      selectedVendor.locations.find((l) => l.isDefault) ??
      selectedVendor.locations[0] ??
      null
    : null;

  const canConfirm = selectedVendor !== null && selectedLocation !== null;

  const handleConfirm = () => {
    if (!selectedVendor || !selectedLocation) return;
    onConfirm(selectedVendor, selectedLocation);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[720px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
        style={{
          fontFamily: FONT,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
      >
        {/* HEADER */}
        <div className="shrink-0 rounded-t-2xl border-b border-[#EEF2F6] bg-white px-5 pt-4 pb-3">
          <div className="flex items-start gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: "#EFF6FF" }}
            >
              <Building2 className="h-4 w-4" style={{ color: "#0A77FF" }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle
                className="text-slate-900"
                style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}
              >
                Choose vendor and default ship-from
              </DialogTitle>
              <DialogDescription
                className="text-slate-500"
                style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}
              >
                Pick a vendor on the left and a default ship-from on the right. You can change ship-from per line item on the draft.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* BODY — two panes */}
        <div className="flex" style={{ height: 420, backgroundColor: "#FAFBFC" }}>
          {/* LEFT: Vendors — sidebar has a tinted gray wash so the
              selected row's white card + border reads as elevated
              (mirrors the reference Additional Details sidebar). */}
          <div
            className="flex flex-col shrink-0"
            style={{ width: 280, borderRight: "1px solid #EEF2F6", backgroundColor: "#F8FAFC" }}
          >
            <div className="p-3 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={vendorSearchRef}
                  type="text"
                  placeholder="Search vendors..."
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[12px] placeholder:text-slate-400 focus:border-[#0A77FF] focus:outline-none focus:ring-2 focus:ring-[#0A77FF]/20"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {filteredVendors.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-slate-500">
                  No vendors found
                </div>
              ) : (
                filteredVendors.map((v) => {
                  const isActive = v.id === activeVendorId;
                  const isSelected = v.id === selectedVendorId;
                  const primaryLoc =
                    v.locations.find((l) => l.isDefault) ?? v.locations[0];
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVendorId(v.id);
                        setLocationSearch("");
                      }}
                      /* Row styling recipe mirrors the reference "Additional
                         Details" sidebar: sidebar has a gray wash, selected
                         row is a WHITE card with a subtle border + shadow.
                         Icon tint (blue-50 bg + blue icon) stays constant
                         across selected and non-selected rows so the row
                         itself carries the elevation signal, not the icon. */
                      className="group flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all"
                      style={{
                        borderColor: isSelected ? "#E2E8F0" : "transparent",
                        backgroundColor: isSelected ? "#FFFFFF" : "transparent",
                        boxShadow: isSelected ? "0 1px 2px rgba(15, 23, 42, 0.04)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = "#FFFFFF60";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "#DBEAFE" }}
                      >
                        <Building2 className="h-4 w-4" style={{ color: "#0A77FF" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-[13px] text-slate-900"
                          style={{ fontWeight: 600, lineHeight: 1.3 }}
                        >
                          {v.name}
                        </div>
                        <div
                          className="mt-0.5 truncate text-[11.5px] text-slate-500"
                          style={{ fontWeight: 400, lineHeight: 1.4 }}
                        >
                          {v.locations.length} location{v.locations.length === 1 ? "" : "s"}
                          {primaryLoc ? ` · ${primaryLoc.name}` : ""}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Locations for the active vendor */}
          <div className="flex flex-1 flex-col bg-white">
            <div className="border-b border-[#EEF2F6] p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={
                    activeVendor
                      ? `Search ${activeVendor.name} locations...`
                      : "Search locations..."
                  }
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  disabled={!activeVendor}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[12px] placeholder:text-slate-400 focus:border-[#0A77FF] focus:outline-none focus:ring-2 focus:ring-[#0A77FF]/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!activeVendor ? (
                <div className="flex h-full items-center justify-center px-6 text-center text-[12px] text-slate-500">
                  Pick a vendor on the left to see its ship-to locations.
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-slate-500">
                  No locations found
                </div>
              ) : (
                filteredLocations.map((loc) => {
                  const isSelected =
                    activeVendorId === selectedVendorId && loc.id === selectedLocationId;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => {
                        /* Clicking a location commits BOTH the active
                           vendor (in case it was only hovered) and this
                           location. Keeps the click count low. */
                        setSelectedVendorId(activeVendorId);
                        setSelectedLocationId(loc.id);
                      }}
                      className={`flex w-full items-start gap-2.5 border-b border-slate-100 px-3 py-2.5 text-left transition-colors ${
                        isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/60"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected ? "border-[#0A77FF]" : "border-slate-300"
                        }`}
                      >
                        {isSelected && (
                          <div
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: "#0A77FF" }}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="truncate text-[12.5px] text-slate-900"
                            style={{ fontWeight: 500 }}
                          >
                            {loc.name}
                          </span>
                          {loc.isDefault && (
                            <span
                              className="inline-flex shrink-0 items-center rounded-md text-[9px] font-semibold uppercase tracking-wide"
                              style={{
                                color: "#0A77FF",
                                backgroundColor: "#EFF6FF",
                                border: "1px solid #BFDBFE",
                                letterSpacing: "0.05em",
                                padding: "0 5px",
                                lineHeight: "14px",
                              }}
                            >
                              Default
                            </span>
                          )}
                        </div>
                        {loc.description && (
                          <div className="mt-0.5 truncate text-[11px] text-slate-500">
                            {loc.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex shrink-0 items-center justify-between gap-2.5 border-t border-[#EEF2F6] bg-white px-5 py-3">
          <div className="min-w-0 text-[11.5px] text-slate-500">
            {selectedVendor && selectedLocation ? (
              <>
                <span className="font-semibold text-slate-800">{selectedVendor.name}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                <span>{selectedLocation.name}</span>
              </>
            ) : (
              "Nothing selected yet"
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[12.5px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "#0A77FF" }}
              onMouseEnter={(e) => {
                if (canConfirm) e.currentTarget.style.backgroundColor = "#0866DE";
              }}
              onMouseLeave={(e) => {
                if (canConfirm) e.currentTarget.style.backgroundColor = "#0A77FF";
              }}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              Use vendor
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DuplicatePODialog({
  open,
  onOpenChange,
  po,
  onConfirm,
  onViewDetails,
  sourceVersion,
  onSourceVersionChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  po: PurchaseOrderData;
  onConfirm: (opts: DuplicatePOConfirmOpts) => void;
  /** Opens the full Version History modal on a specific version. Called
      from the per-row "View details" button inside DuplicateVersionSelect
      (2026-07-28: no more global button — each row inspects itself). */
  onViewDetails?: (version: number) => void;
  /** Currently-selected source version. Lifted to the parent so the
      "View details" VH modal can update it externally when the buyer
      picks a different version there. */
  sourceVersion: number;
  onSourceVersionChange: (version: number) => void;
}) {
  const sortedVersions = React.useMemo(
    () => [...po.versions].sort((a, b) => b.version - a.version),
    [po.versions],
  );
  const onlyOneVersion = sortedVersions.length <= 1;

  /* Single-step flow (buyer 2026-07-27): Vendor + Version. Item
     fulfillment + pricing-rule port live on the Draft after the
     duplicate lands (see `needsQualificationForVendor` on POLineItem).
     Ship-to stays in the modal (2026-07-28) — it's a one-click pick
     and picking on the Draft is more clicks than picking here. */
  const [useSameVendor, setUseSameVendor] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<VendorEntity | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  /* Ref points at the "Choose vendor and ship-to" trigger so that
     flipping to Different vendor auto-opens the picker overlay via
     a focus + click nudge; single ref covers both the empty-state
     trigger and the Change button that replaces it. */
  const triggerRef = useRef<HTMLButtonElement>(null);
  /* Location picker (2026-07-28). Seeded to the picked vendor's default
     location whenever a vendor is chosen; buyer can override via the
     two-pane picker overlay. Null when no vendor is picked so the
     summary tile can render an empty state. */
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  /* Two-pane overlay for picking vendor + ship-to location together
     (2026-07-28 redesign: replaces the cramped inline search + list
     stack that used to live inside the Different vendor radio card). */
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setUseSameVendor(true);
      setSelectedVendor(null);
      setSearchQuery("");
      setSelectedLocationId(null);
      setVendorPickerOpen(false);
    }
  }, [open, po.id]);

  /* Snap the ship-to picker back to the vendor's default whenever the
     vendor changes and the buyer hasn't picked a specific location.
     Clears when no vendor is picked so the summary tile hides. */
  useEffect(() => {
    if (!selectedVendor) {
      setSelectedLocationId(null);
      return;
    }
    const inList = selectedVendor.locations.some((l) => l.id === selectedLocationId);
    if (inList) return;
    const def =
      selectedVendor.locations.find((l) => l.isDefault) ??
      selectedVendor.locations[0];
    setSelectedLocationId(def?.id ?? null);
  }, [selectedVendor?.id]);

  const selectedLocation = React.useMemo<VendorLocationInfo | null>(() => {
    if (!selectedVendor || !selectedLocationId) return null;
    return (
      selectedVendor.locations.find((l) => l.id === selectedLocationId) ??
      selectedVendor.locations[0] ??
      null
    );
  }, [selectedVendor, selectedLocationId]);

  /* Exclude the source PO's own vendor from the picker — the PO's
     `vendor.name` doesn't carry a VendorEntity id, so we match by
     lowercased name (best available). */
  const filteredVendors = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const currentName = po.vendor.name.trim().toLowerCase();
    return PAY_TO_VENDORS.filter((v) => v.name.trim().toLowerCase() !== currentName).filter(
      (v) => {
        if (!q) return true;
        const loc = v.locations.find((l) => l.isDefault) ?? v.locations[0];
        const locStr = loc?.name ?? "";
        return v.name.toLowerCase().includes(q) || locStr.toLowerCase().includes(q);
      },
    );
  }, [searchQuery, po.vendor.name]);

  /* Confirm gate — same-vendor duplicates commit immediately; picking
     "Different vendor" also requires an actual vendor selection. All
     the per-line resolution / rule / location work happens on the
     Draft after the duplicate lands (2026-07-27 redesign). */
  const canConfirm = useSameVendor || selectedVendor !== null;

  const handleConfirm = () => {
    onConfirm({
      sourceVersion,
      /* `null` means "keep the source PO's vendor" — the existing
         `duplicatePO` helper reads it that way. */
      vendor: useSameVendor ? null : selectedVendor,
      vendorLocation: useSameVendor ? undefined : selectedLocation ?? undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px] p-0 gap-0 overflow-hidden !rounded-2xl border-0"
        style={{
          fontFamily: FONT,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
        }}
        onPointerDownOutside={(e) => {
          if (isClickInsideDupVersionPanel(e)) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isClickInsideDupVersionPanel(e)) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          if (isClickInsideDupVersionPanel(e)) e.preventDefault();
        }}
      >
        {/* HEADER — SO-style: small icon + title + short description */}
        <div className="shrink-0 rounded-t-2xl border-b border-[#EEF2F6] bg-white px-5 pt-4 pb-3">
          <div className="flex items-start gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: "#EFF6FF" }}
            >
              <Copy className="h-4 w-4" style={{ color: "#0A77FF" }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle
                className="text-slate-900"
                style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}
              >
                Duplicating PO-
                <span className="tabular-nums">{po.poNumber}</span>
              </DialogTitle>
              {/* Subheading intentionally omitted (buyer 2026-07-28) —
                  the title carries the whole context now. */}
              <DialogDescription className="sr-only">
                Duplicate PO {po.poNumber} — pick a version and vendor.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* BODY — light wash w/ white section cards. Scrolls if tall. */}
        <div
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
          style={{ backgroundColor: "#FAFBFC", maxHeight: "calc(88vh - 180px)" }}
        >
          {/* Version to duplicate — moved to the top of the body
              (buyer 2026-07-28). Hidden when the PO has only one
              revision. Per-row "View details" affordance lives inside
              DuplicateVersionSelect so each version can be inspected
              on its own — no more global button. */}
          {!onlyOneVersion && (
            <DuplicateSectionCard
              icon={GitBranch}
              title="Version to duplicate"
              description={`${sortedVersions.length} versions available`}
            >
              <div className="px-1 pb-0.5 pt-1">
                <div className="mb-2 text-[11.5px] text-slate-500">
                  Latest confirmed version is selected by default. You can view more versions by expanding the row.
                </div>
                <DuplicateVersionSelect
                  versions={sortedVersions}
                  selectedVersion={sourceVersion}
                  currentVersion={po.currentVersion}
                  onSelect={onSourceVersionChange}
                  onViewVersionDetails={onViewDetails}
                />
              </div>
            </DuplicateSectionCard>
          )}

          {/* Vendor — Same / Different + inline ship-to picker when a
              different vendor is chosen (buyer 2026-07-28: "we need to
              show the ability for select the location of another vendor
              as well"). Reuses the same VendorEntity → location list
              that the old step-2 picker used. */}
          <DuplicateSectionCard icon={Building2} title="Vendor">
            <DuplicateRadioCard
              selected={useSameVendor}
              onSelect={() => {
                setUseSameVendor(true);
                setSelectedVendor(null);
              }}
            >
              <div
                className="text-[13px] leading-tight text-slate-900"
                style={{ fontWeight: 500 }}
              >
                Same vendor
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-500">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{po.vendor.name}</span>
              </div>
            </DuplicateRadioCard>

            <DuplicateRadioCard
              selected={!useSameVendor}
              showDisclosure
              onSelect={() => {
                /* Modal-first flow (buyer 2026-07-28: "it will open the
                   modal first and after that this section"). Only open
                   the picker when the buyer is transitioning from Same
                   → Different — the card stays on Same vendor until
                   they actually confirm a pick in the picker (see
                   `onConfirm` below). If already on Different, this
                   click is a no-op — the "Change" button in the summary
                   tile handles re-picking. */
                if (useSameVendor) {
                  setVendorPickerOpen(true);
                }
              }}
            >
              <div
                className="text-[13px] leading-tight text-slate-900"
                style={{ fontWeight: 500 }}
              >
                Different vendor
              </div>
              <div className="mt-1 text-[11.5px] text-slate-500">
                Reassign the duplicate to a different vendor.
              </div>

              {/* Smooth expand-in when the card is picked (buyer
                  2026-07-28: "need to do a smooth transition when we
                  click on different vendor it is too quick"). Uses the
                  grid-template-rows 0fr → 1fr trick so the inner
                  content auto-sizes without a hardcoded max-height. */}
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: !useSameVendor ? "1fr" : "0fr" }}
                aria-hidden={useSameVendor}
              >
                <div className="min-h-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="pt-3">
                  {selectedVendor && selectedLocation ? (
                    /* Summary tile — shows the picked vendor + ship-to
                       with a Change link that reopens the two-pane
                       overlay. Keeps the modal short once a choice is
                       made. */
                    <div className="flex items-center gap-2.5 rounded-lg border border-[#BFDBFE] bg-blue-50/40 px-3 py-2.5">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: "#EFF6FF" }}
                      >
                        <Building2 className="h-4 w-4" style={{ color: "#0A77FF" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-[13px] text-slate-900"
                          style={{ fontWeight: 600, lineHeight: 1.3 }}
                        >
                          {selectedVendor.name}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-600">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">
                            {selectedLocation.name}
                            {selectedLocation.description
                              ? ` · ${selectedLocation.description}`
                              : ""}
                          </span>
                        </div>
                        {/* The new PO opens in this vendor's default currency (spec 4.2);
                            duplicatePO converts the prices at the new PO date's rate. */}
                        {(() => {
                          // The lines come from the picked version, in its currency (duplicatePO).
                          const from = po.versions.find((v) => v.version === sourceVersion)?.snapshot.currency ?? poFx(po).currency;
                          const to = vendorCurrency(selectedVendor.name);
                          return (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-600">
                              <CurrencyFlag code={to} size={10} />
                              <span className="truncate">
                                {to === from
                                  ? `Prices stay in ${to}, the vendor's currency`
                                  : `Prices convert ${from} → ${to}, the vendor's currency`}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      <button
                        ref={triggerRef}
                        type="button"
                        onClick={() => setVendorPickerOpen(true)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-[#0A77FF] transition-colors hover:bg-blue-50/60"
                      >
                        <Pencil className="h-3 w-3" />
                        Change
                      </button>
                    </div>
                  ) : (
                    /* Empty-state trigger — one big button that opens
                       the picker overlay. Sized like a form field so it
                       reads as a control, not a CTA. */
                    <button
                      ref={triggerRef}
                      type="button"
                      onClick={() => setVendorPickerOpen(true)}
                      className="flex w-full items-center justify-between gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-slate-300 hover:bg-slate-50/60"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                          style={{ backgroundColor: "#F1F5F9" }}
                        >
                          <Building2
                            className="h-3.5 w-3.5"
                            style={{ color: "#64748B" }}
                          />
                        </span>
                        <span className="min-w-0">
                          <span
                            className="block text-[13px] text-slate-900"
                            style={{ fontWeight: 500, lineHeight: 1.3 }}
                          >
                            Choose vendor and default ship-from
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            {filteredVendors.length} vendor{filteredVendors.length === 1 ? "" : "s"} available · pick a location too
                          </span>
                        </span>
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    </button>
                  )}
                  </div>
                </div>
              </div>
            </DuplicateRadioCard>
          </DuplicateSectionCard>
        </div>

        {/* FOOTER — one-step flow: outlined Cancel + primary Duplicate.
            Per-line qualification / rule porting / ship-to selection
            all happen on the Draft after the duplicate lands. */}
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-[#EEF2F6] bg-white px-5 py-3">
          {/* One-time discounts/premiums never copy (buyer 2026-10-15) —
              they're tied to a deal on this specific order. Only shown
              when the source actually has some, so the buyer knows the
              new PO's price will differ. */}
          {(po.adjustments?.length ?? 0) > 0 && (
            <div className="mr-auto flex min-w-0 items-start gap-1.5 text-[11.5px] leading-4 text-slate-500">
              <Info className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>
                {po.adjustments.length} one-time discount{po.adjustments.length !== 1 ? "s" : ""}/premium{po.adjustments.length !== 1 ? "s" : ""} won't be copied. They apply only to this order's vendor deal.
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:border-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[12.5px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "#0A77FF" }}
            onMouseEnter={(e) => {
              if (canConfirm) e.currentTarget.style.backgroundColor = "#0866DE";
            }}
            onMouseLeave={(e) => {
              if (canConfirm) e.currentTarget.style.backgroundColor = "#0A77FF";
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>
        </div>
      </DialogContent>

      {/* Two-pane vendor + ship-to picker overlay. Sits above the
          parent Duplicate Dialog (Radix handles nested stacks). On
          confirm, seeds `selectedVendor` and `selectedLocationId` so
          the summary tile inside the Different vendor card updates. */}
      <DuplicateVendorLocationPicker
        open={vendorPickerOpen}
        onOpenChange={setVendorPickerOpen}
        vendors={filteredVendors}
        initialVendorId={selectedVendor?.id ?? null}
        initialLocationId={selectedLocationId}
        onConfirm={(vendor, location) => {
          /* Confirm flips the radio to Different vendor and reveals
             the expand section (summary tile). If the buyer cancels
             the picker instead of confirming, `useSameVendor` stays
             true and the card doesn't animate open — the modal-first
             flow just closes cleanly. */
          setUseSameVendor(false);
          setSelectedVendor(vendor);
          setSelectedLocationId(location.id);
        }}
      />
    </Dialog>
  );
}

/* ═══════════════════════════════════════════��══════════════��════
   CHANGE BUTTON (only shown for Draft status)
   ═════════════════��═════════════════════════════════════════════ */

function ChangeButton({ onClick, visible }: { onClick?: () => void; visible?: boolean }) {
  if (visible === false) return null;
  return (
    <button
      className="flex items-center gap-1 text-primary cursor-pointer hover:underline"
      style={st.uiSmall}
      onClick={onClick}
    >
      <Pencil className="size-3" />
      Change
    </button>
  );
}

/* ════════════════════════════════════��════════════════════════���═
   SIDEBAR INFO ROW �� key/value for right column cards
   ══════���═���══��═══════════════════════════════════════════════════ */



/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */

/** A line's item-level one-times in the Items Detail Modal's shape. */
function lineOneTimeAdjustmentsFor(po: PurchaseOrderData, lineId: string) {
  return poAdjustmentsForLine(po, lineId).map(({ scope: _s, appliedTo: _a, ...rest }) => rest);
}

/* Sales Orders `SummaryInfoRow` (`SOSidebar.tsx`) — tappable caption
   under an Order Summary value; text inherits the value colour. */
function SummaryInfoRow({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  const effectiveColor = color || "#334155";
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 transition-colors border-none bg-transparent hover:bg-primary/5 cursor-pointer"
      style={{ padding: "3px 6px", margin: "6px -6px 0", borderRadius: 5, fontSize: 11, fontWeight: 500, lineHeight: 1, fontFamily: "Inter, system-ui, sans-serif", color: effectiveColor }}
    >
      <span>{label}</span>
      <Pencil className="shrink-0 text-muted-foreground/60" style={{ width: 10, height: 10 }} />
    </button>
  );
}

export default function PurchaseOrderDraft() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  /* Pioneer v1.0 permission gates for the PO detail page. Reactive — the
     dev widget's toggles re-render every consumer. `po.one_time_discounts`
     gates adding / editing one-time discounts & premiums. */
  const canCancelArchivePO = useCan("po.cancel_archive");
  const canModifyPricingRules = useCan("po.modify_pricing_rules");
  const canOneTimeDiscounts = useCan("po.one_time_discounts");
  /* One-time discounts/premiums (ported from Sales Orders). Manage modal
     + quick "add order-level" modal opened from the Order Summary row. */
  const [adjustmentsManageOpen, setAdjustmentsManageOpen] = useState(false);
  const [addOrderAdjustmentOpen, setAddOrderAdjustmentOpen] = useState(false);
  /* `fromDuplicate` — router state flag set by the duplicate flow so
     the back button skips the source PO and lands on the listing
     (buyer 2026-07-22: "if I duplicated a version from confirmed
     state, the back button needs to be always on the listing table
     not the previous PO"). */
  const fromDuplicate = Boolean((location.state as { fromDuplicate?: boolean } | null)?.fromDuplicate);
  /* URL search params — read on mount so a caller can deep-link to a
     specific tab (e.g. `/purchase-orders/:id?tab=versions` from the V{n}
     chip on the listing table). Only the initial value is honoured; the
     tab bar syncs from the local `activeTab` state after that. */
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [po, setPO] = useState<PurchaseOrderData | undefined>(undefined);
  /* Pricing rules manage modal — buyer feedback 2026-07-20. The
     sidebar block's Manage button opens it; the modal itself is
     mounted at the end of the return tree. State declared at the
     main-component level (was accidentally scoped to LineItemsPanel
     initially, which caused a hooks-order crash on render). */
  const [pricingRulesManageOpen, setPricingRulesManageOpen] = useState(false);
  /* Nonce bumped when the manage/browse/create modals mutate the shared
     rule catalog (`VENDOR_PRICING_RULES`) so pricingBreakdowns re-derives
     and the sidebar totals + per-line indicators reflect the change
     (buyer 2026-07-29 bug: "Save Changes saves but doesn't update the
     UI"). */
  const [pricingCatalogRev, setPricingCatalogRev] = useState(0);
  const [lightboxData, setLightboxData] = useState<{ images: string[]; partNumber: string; itemName: string } | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<POLineItem | null>(null);
  const [viewingItem, setViewingItem] = useState<POLineItem | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  /* ── Outdated-configs (Partner Management propagation) ──
     Only surfaces on Draft POs whose id is seeded in the mock
     outdatedConfigs pool. Auto-opens the modal when arriving via
     `/purchase-orders/<id>?outdated=1` from the listing pill. */
  const [outdatedUpdates, setOutdatedUpdates] = useState<OutdatedUpdate[]>(() => getOutdatedForId(id));
  const [showOutdatedConfigsModal, setShowOutdatedConfigsModal] = useState(false);
  /* Below-header banner visibility — SO-V5 pattern. Distinct from
     `outdatedUpdates.length > 0` because the banner also honours the
     user's per-doc dismissal (X on the banner without applying or
     ignoring). Auto-collapses when the PO leaves Draft. */
  const [outdatedBannerVisible, setOutdatedBannerVisible] = useState(() =>
    shouldShowOutdatedBanner(id),
  );
  /* Amber sync overlay that plays after the buyer hits "Apply N
     updates" — replaces the previous toast confirmation. Count
     carries the number applied so the overlay copy is accurate
     ("3 configurations synced"). */
  const [syncOverlay, setSyncOverlay] = useState<{ visible: boolean; count: number }>({
    visible: false,
    count: 0,
  });

  /* QuickView item preview — reuses the same modal opened from the items
     catalog / listing thumbnail (`CatalogueModal` + `PurchaseOrdersListing`).
     Triggered by clicking a line item thumbnail in the table below; row +
     edit-icon clicks still open the full OrderFlow `edit-po` modal. */
  const [quickViewData, setQuickViewData] = useState<QuickViewData | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [receivingOpen, setReceivingOpen] = useState(false);
  const [receivingQtys, setReceivingQtys] = useState<Record<string, number>>({});
  const [receivingQtyInputs, setReceivingQtyInputs] = useState<Record<string, string>>({});
  const [receivingConditions, setReceivingConditions] = useState<Record<string, "good" | "damaged" | "rejected">>({});
  const [receivingNotes, setReceivingNotes] = useState<Record<string, string>>({});
  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [vendorContactOpen, setVendorContactOpen] = useState(false);
  const [paymentEditOpen, setPaymentEditOpen] = useState(false);
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
  const [payToDialogOpen, setPayToDialogOpen] = useState(false);
  const [shipToDialogOpen, setShipToDialogOpen] = useState(false);
  const [fundedByDialogOpen, setFundedByDialogOpen] = useState(false);
  /* Initial tab honours `?tab=` from the URL (e.g. the V{n} chip on the
     listing sends `?tab=versions`). Falls back to `"items"` for the
     regular flow. Whitelisted so an unknown query value doesn't put us
     into a phantom tab. */
  const VALID_TABS = new Set(["items", "invoices-payments", "communications", "versions", "notes", "comments"]);
  const [activeTab, setActiveTab] = useState(
    initialTab && VALID_TABS.has(initialTab) ? initialTab : "items",
  );
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [deliveryDateModalOpen, setDeliveryDateModalOpen] = useState(false);
  const [deliveryDateDraft, setDeliveryDateDraft] = useState("");
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  /* View-details modal launched from inside the Duplicate PO dialog's
     Version section (buyer 2026-07-22). Layered on top of the Duplicate
     modal so closing it lands the buyer back in their in-progress
     duplicate selection instead of losing state. */
  const [duplicateViewDetailsOpen, setDuplicateViewDetailsOpen] = useState(false);
  /* Revert target for the header POVersionDropdown's hover-revealed
     revert affordance (buyer 2026-07-22 — dropdown revert must now
     route through the SO-style confirmation modal instead of firing
     `revertPOToVersion` immediately). */
  const [dropdownRevertVersion, setDropdownRevertVersion] = useState<number | null>(null);
  /* Source version for the Duplicate flow — lifted here so the
     "View details" Version History modal can update it externally
     when the buyer picks a different version there. Reset to the
     PO's current version whenever the Duplicate dialog opens. */
  const [duplicateSourceVersion, setDuplicateSourceVersion] = useState<number>(1);
  useEffect(() => {
    if (duplicateDialogOpen && po) {
      setDuplicateSourceVersion(po.currentVersion);
    }
  }, [duplicateDialogOpen, po?.currentVersion, po?.id]);
  /* SO-parity duplicate flow — DuplicatePODialog collects vendor +
     source version (mirrors Sales Orders V5's Duplicate Sales Order),
     then hands off to the 1800ms `StateTransitionOverlay` which fires
     the real `duplicatePO` mutation on completion and auto-navigates. */
  const poTransitions = usePOTransitions();

  /* ── Scroll-morph state — wired by IntersectionObserver below.
        Mirrors Partners' VendorDetailsPage (`Partners/.../VendorDetailsPage.tsx:255,329-339`).
        When `isScrolled` flips true, every morphable element compresses
        (44→32 controls, 16→13 h1, 11→10 pills, gap 8→6, padding 12→8). */
  const [isScrolled, setIsScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  /* ── Fullscreen toggle — mirrors Partners' VendorDetailsPage fullscreen
        affordance (`Partners/.../VendorDetailsPage.tsx:897-910`). When
        active, the `max-w-[1520px]` constraint on the header card + body
        content drops to `max-w-none` so the detail page spans the full
        viewport width. Icon swaps Maximize2 ↔ Minimize2. */
  const [isFullscreen, setIsFullscreen] = useState(false);
  const maxWidthClass = isFullscreen ? "max-w-none" : "max-w-[1520px]";
  const [cancelPOOpen, setCancelPOOpen] = useState(false);
  /* Non-blocking warning when a Draft with inactive line items is moved
     toward an active state. Holds the pending transition until the
     buyer chooses Go back / proceed. */
  const [inactiveWarning, setInactiveWarning] = useState<{ mode: InactiveWarningMode; run: () => void } | null>(null);
  /* Cancel PO window doubles as Cancel remaining once receiving has
     started (ERP-4799). Reason dropdown + notes, reset per open. */
  const [cancelPOMode, setCancelPOMode] = useState<"po" | "remaining">("po");
  const cancelPOReason = useCancelReason(cancelPOOpen);
  const [reactivatePOOpen, setReactivatePOOpen] = useState(false);
  const [reactivateReason, setReactivateReason] = useState("");
  const [reactivateError, setReactivateError] = useState(false);
  const [cancelLineItemId, setCancelLineItemId] = useState<string | null>(null);
  /* Cancel-line reason (ERP-4799) — same dropdown, reset per open. */
  const cancelLineReason = useCancelReason(!!cancelLineItemId);
  /* Archive PO window (ERP-4744 / ERP-4772). */
  const [archivePOOpen, setArchivePOOpen] = useState(false);
  /* Print / Download PO preview (Actions > Print / Download PO). */
  const [docPreview, setDocPreview] = useState<"print" | "download" | null>(null);
  const [allCancelledPromptOpen, setAllCancelledPromptOpen] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [versionReasonInput, setVersionReasonInput] = useState("");
  const [pendingVersionChange, setPendingVersionChange] = useState<{
    title: string;
    summary: string;
    reason: string;
    changes: Array<Omit<POChangeRecord, "id" | "timestamp" | "user">>;
    apply: () => void;
  } | null>(null);

  /* ── Editing Session state (post-Draft versioning) ── */
  interface ChangeDetail {
    tag: string;
    type: POChangeRecord["type"];
    action: POChangeRecord["action"];
    subject: string;
    detail?: string;
  }
  const [editingSession, setEditingSession] = useState<{
    confirmed: boolean;
    changeTags: Set<string>;
    changeCount: number;
    changeDetails: ChangeDetail[];
    snapshot: POVersionSnapshot;
  } | null>(null);
  const [showVersionConfirmModal, setShowVersionConfirmModal] = useState(false);
  const [pendingEditAction, setPendingEditAction] = useState<{ action: () => void; tag?: string; changeDetail?: Omit<ChangeDetail, "tag"> } | null>(null);
  /* Save-Version confirmation modal — opens before `handleSaveVersion()` runs
     so the buyer can review the itemised change list (Partners' "Changes you
     made" pattern, see POVersionSaveModal.tsx). */
  const [saveVersionModalOpen, setSaveVersionModalOpen] = useState(false);

  /** Helper: record a detailed change into the editing session */
  const recordChangeDetail = (tag: string, detail?: Omit<ChangeDetail, "tag">) => {
    setEditingSession(prev => {
      if (!prev) return prev;
      const newTags = new Set(prev.changeTags).add(tag);
      const entry: ChangeDetail = detail
        ? { ...detail, tag }
        : { tag, type: "config-changed", action: "Changed", subject: tag };
      return {
        ...prev,
        changeTags: newTags,
        changeCount: prev.changeCount + 1,
        changeDetails: [...prev.changeDetails, entry],
      };
    });
  };

  /* ── Transition Overlay state ── */
  const [transitionOverlay, setTransitionOverlay] = useState<{
    visible: boolean;
    fromStatus: POStatus;
    toStatus: POStatus;
  }>({ visible: false, fromStatus: "Draft", toStatus: "Draft" });
  const prevStatusRef = React.useRef<POStatus | null>(null);
  const prevPoIdRef = React.useRef<string | null>(null);

  /* Track status changes coming from any source (direct calls, receiving, etc.).
     Guarded by po.id — when navigating between POs (e.g. after a Duplicate
     lands on the new draft) the ref still holds the SOURCE PO's status, so
     without this guard the fresh mount would fire a spurious status-transition
     overlay on top of the Duplicate animation. Reset the ref on id change,
     then only fire the animation on same-id transitions. */
  useEffect(() => {
    if (!po) return;
    const prev = prevStatusRef.current;
    const prevId = prevPoIdRef.current;
    const sameId = prevId === po.id;
    if (sameId && prev && prev !== po.status) {
      setTransitionOverlay({ visible: true, fromStatus: prev, toStatus: po.status });
    }
    prevStatusRef.current = po.status;
    prevPoIdRef.current = po.id;
  }, [po?.id, po?.status]);

  const dismissTransitionOverlay = useCallback(() => {
    setTransitionOverlay((s) => ({ ...s, visible: false }));
  }, []);

  /* Reseed the outdated-configs list whenever we land on a new PO
     id (the buyer might navigate between POs without unmounting).
     Also auto-open the modal when the URL carries `?outdated=1`
     (listing-pill deep-link handoff). */
  useEffect(() => {
    const updates = getOutdatedForId(id);
    setOutdatedUpdates(updates);
    setOutdatedBannerVisible(shouldShowOutdatedBanner(id));
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("outdated") === "1" && updates.length > 0) {
      setShowOutdatedConfigsModal(true);
      /* Strip the flag so a refresh / back-nav doesn't re-open. */
      params.delete("outdated");
      const q = params.toString();
      const nextUrl = `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, [id]);

  /* Auto-collapse the banner when the PO leaves Draft (buyer sent /
     confirmed / cancelled) — matches SO-V5's SODetail behaviour so
     the banner never sits on a locked doc. */
  useEffect(() => {
    if (po && po.status !== "Draft" && outdatedBannerVisible) {
      dismissOutdatedBanner(po.id);
      setOutdatedBannerVisible(false);
    }
  }, [po, outdatedBannerVisible]);

  useEffect(() => {
    if (id) setPO(getPO(id));
    const unsub = subscribeToPOStore(() => {
      if (id) setPO(getPO(id));
    });
    return unsub;
  }, [id]);

  const handleEditItem = useCallback((item: POLineItem) => {
    setEditingItem(item);
    setEditOpen(true);
  }, []);

  const poItemQtyByNumber = React.useMemo(
    () =>
      po
        ? po.lineItems.reduce<Record<string, number>>((acc, li) => {
            acc[li.itemNumber] = (acc[li.itemNumber] ?? 0) + li.vendorQty;
            return acc;
          }, {})
        : {},
    [po]
  );

  const handleAddCatalogItemToPO = useCallback(
    (item: CatalogItem) => {
      if (!po || poItemQtyByNumber[item.itemNumber]) return;

      addLineItemToPO(po.id, {
        id: `add-${item.id}-${Date.now()}`,
        itemNumber: item.itemNumber,
        descriptiveName: item.descriptiveName,
        image: item.image,
        unitPrice: item.unitPrice * (1 - (item.discount || 0) / 100),
        vendorQty: item.vendorUOMQty || 1,
        vendorUOM: item.vendorUOM || "EA",
        vendorUOMQty: item.vendorUOMQty || 1,
        quantity: item.vendorUOMQty || 1,
        defaultUOM: item.defaultUOM || "EA",
        discount: item.discount || 0,
        shipByDate: "",
        shipmentMethod: "",
        needByDate: "",
        inboundLocation: "",
        category: item.category || "",
      // The catalog price is in its vendor's currency; the PO converts it to its own.
      }, undefined, vendorCurrency(item.partnerLocation));

      if (editingSession?.confirmed) {
        recordChangeDetail("Item Added", {
          type: "line-item-added", action: "Added",
          subject: item.itemNumber,
          detail: `${item.descriptiveName} — ${item.vendorUOMQty || 1} ${item.vendorUOM || "EA"}, ${formatMoney(item.unitPrice, vendorCurrency(item.partnerLocation))}/ea`,
        });
      }

      toast.success(`${item.itemNumber} added to PO`, {
        description: item.descriptiveName,
        style: { fontFamily: FONT },
        duration: 2500,
      });
    },
    [po, poItemQtyByNumber]
  );

  /* ── Multi-unit price confirmation prompt (scenario A / B) ──
     Lives above the early-return so hook ordering is stable. */
  const [priceConfirmState, setPriceConfirmState] = useState<{
    open: boolean;
    outcome: PriceCheckOutcome | null;
    onConfirmDefault: () => void;
    onUseOnce: () => void;
  }>({ open: false, outcome: null, onConfirmDefault: () => {}, onUseOnce: () => {} });

  /* ── Unsaved-changes tracking ──
     Mirrors the partner module's pattern (VendorDetailsPage carrier
     section, lines 7240–7266): a single `dirty` flag flips on any edit
     and gates the discard prompt. Resets when the user lands on this
     PO fresh, when they save, or when they confirm the discard.

     Hooks live above the early-return for stable ordering — same
     reason `priceConfirmState` does. */
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  /** When the discard prompt is shown, this holds the navigation we'll
   *  perform if the user confirms. Default: history-back to the listing. */
  const pendingExitRef = useRef<(() => void) | null>(null);

  /* Reset dirty whenever the active PO id changes — landing on a new
     PO must start with a clean slate so the discard prompt doesn't
     fire on a PO the user hasn't actually touched yet. */
  useEffect(() => {
    setDirty(false);
  }, [id]);

  /* ── Scroll-morph wiring — ported verbatim from Partners'
        VendorDetailsPage (`Partners/.../VendorDetailsPage.tsx:329-339`).
        Observes a 1px sentinel positioned at the top of the scroll
        container; when it leaves the viewport (user has scrolled past
        the 44px header gutter) `isScrolled` flips, animating every
        morphable element via inline-style transitions. */
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!el || !root) return;
    // rootMargin 0 (instead of Partners' `-44px`) — Partners' negative top
    // margin offsets for their sticky breadcrumb above the scroll container;
    // our scroll container has no sibling above it (the header is a flex
    // sibling outside the scroll area), so the sentinel can sit flush with
    // the scroll-top and morph fires the moment content moves up.
    const io = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { root, threshold: 0, rootMargin: "0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* Browser-level guard: if the buyer tries to close the tab, refresh,
     or hit the OS back button while there are unsaved edits, the
     browser's native confirmation kicks in. This complements the
     in-app discard prompt for hardware back / tab-close cases. */
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required by some browsers — the actual copy is browser-controlled.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  /* ── Back-navigation callbacks ──
     Defined as hooks ABOVE the `if (!po)` early-return so React sees
     the same hook count on the first (undefined) and subsequent
     (defined) renders. Without this, mounting the page triggers
     "Rendered more hooks than during the previous render". */
  const performBackNavigation = useCallback(() => {
    /* When the buyer arrived here via a duplicate action, skip the
       source PO in the history stack and jump straight to the listing
       (buyer 2026-07-22). Otherwise fall back to the normal
       browser-back / listing behavior. */
    if (fromDuplicate) {
      navigate("/purchase-orders");
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/purchase-orders");
    }
  }, [fromDuplicate, navigate]);

  const handleBackToListing = useCallback(() => {
    if (dirty) {
      pendingExitRef.current = () => {
        setDirty(false);
        performBackNavigation();
      };
      setDiscardOpen(true);
      return;
    }
    performBackNavigation();
  }, [dirty, performBackNavigation]);

  /* ── Pricing rules breakdowns (hooks live ABOVE the `if (!po)`
       early-return for hook-order stability, per the convention noted
       above). Ported from Sales-Order-V5 (see the PO_PRICING_RULES
       audit doc). The breakdowns feed both the line-item panel's
       hover cards and the right-column sidebar block below. */
  const pricingBreakdowns = React.useMemo<Map<string, LinePricingBreakdown>>(() => {
    if (!po || !SHOW_PO_PRICING_RULES) return new Map();
    return computePORuleBreakdowns(po);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po, pricingCatalogRev]);
  /* Single source of truth for the Order Summary money (same engine the
     store uses for `po.total`): subtotal, line %, rules, one-times. */
  const poPricing = React.useMemo(
    () => (po ? computePOPricing(po) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [po, pricingCatalogRev],
  );
  const adjustmentsAPI = usePOAdjustments(po);
  /* Active lines only (cancelled lines don't count toward totals). */
  const totalRulesDiscount = poPricing?.rulesDiscount ?? 0;
  const totalRulesPremium = poPricing?.rulesPremium ?? 0;

  /* ── Empty state ── */
  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-secondary" style={{ fontFamily: FONT }}>
        <div className="flex items-center justify-center size-16 rounded-full bg-card">
          <FileText className="size-7 text-foreground/20" strokeWidth={1.5} />
        </div>
        <div className="text-center flex flex-col gap-1">
          <span className="text-foreground" style={st.sectionHeading}>Purchase Order Not Found</span>
          <span className="text-muted-foreground" style={st.uiSmall}>The PO you&apos;re looking for doesn&apos;t exist or was removed.</span>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" style={st.uiLabel} onClick={() => navigate("/purchase-orders")}>
          <ArrowLeft className="size-3.5" />
          Back to Purchase Orders
        </Button>
      </div>
    );
  }

  const isDraft = po.status === "Draft";
  const isCancelled = po.status === "Cancelled";
  const isActiveWithCancellations = po.status === "Active with Cancellations";
  const isFullyReceivedWithCancellations = po.status === "Fully Received with Cancellations";
  const hasCancelledItems = po.lineItems.some((li) => li.cancelled || (li.cancelledQuantity ?? 0) > 0);
  /* Lines touched by a cancellation — whole-line cancels plus partly
     received lines whose remainder was cancelled (Cancel remaining). */
  const cancelledLineCount = po.lineItems.filter((li) => li.cancelled || (li.cancelledQuantity ?? 0) > 0).length;

  /* ── Header gradient — subtle wash for the whole card ──
     Buyer 2026-07-31: "closed with cancellations" is semantically a
     partial state (some ordered items were cancelled, not delivered),
     so both the tracker and the outer card wash anchor at "Partially
     Received". headerAllCompleted stays false so the terminal-success
     green wash doesn't fire. */
  const effectiveHeaderStatus: POStatus = isCancelled
    ? (po.preCancellationStatus || "Draft")
    : isActiveWithCancellations ? "Confirmed" : isFullyReceivedWithCancellations ? "Partially Received" : po.status;
  const headerCurrentIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === effectiveHeaderStatus);
  const headerAllCompleted = effectiveHeaderStatus === "Fully Received";
  const headerGradient = getHeaderBackground(effectiveHeaderStatus, headerCurrentIndex, LIFECYCLE_STEPS.length, headerAllCompleted);
  const stepperBg = getStepperBackground(effectiveHeaderStatus, headerCurrentIndex, LIFECYCLE_STEPS.length, headerAllCompleted);

  /* ── Unified card gradient — originates from stepper (bottom), fades upward ── */
  const cardGradient = (() => {
    if (headerAllCompleted) {
      // Card wash mirrors the green stepper/header so all three layers
      // (card → header → stepper) share the same `--success`-tinted
      // gradient at the Fully Received terminal state.
      return `linear-gradient(180deg,
        color-mix(in srgb, hsl(var(--success)) 2%, transparent) 0%,
        color-mix(in srgb, hsl(var(--success)) 5%, transparent) 55%,
        color-mix(in srgb, hsl(var(--success)) 10%, transparent) 100%)`;
    }
    if (headerCurrentIndex <= 0) return "";
    const sc = STEP_COLORS[po.status] ?? STEP_COLORS.Draft;
    const cx = Math.min(90, Math.max(10, Math.round((headerCurrentIndex / (LIFECYCLE_STEPS.length - 1)) * 100)));
    return `radial-gradient(
      ellipse 110% 200% at ${cx}% 100%,
      ${sc.tint} 0%,
      color-mix(in srgb, ${sc.solid} 8%, transparent) 25%,
      color-mix(in srgb, ${sc.solid} 3%, transparent) 50%,
      color-mix(in srgb, ${sc.solid} 1%, transparent) 72%,
      transparent 95%
    )`;
  })();

  /* ── PO equivalents of quote-header concepts ── */
  const isFullyReceived = po.status === "Fully Received" || po.status === "Fully Received with Cancellations";
  const isClosed = isFullyReceived || isCancelled; // alias for legacy references
  const isFullyReadOnly = isCancelled;

  /* ── Status-tinted card edge — fixes the "card melts into the page bg"
        problem when the gradient is in play (2026-05). The gradient itself
        fades to transparent at the card edges; combined with the prior
        `border: none` + ultra-subtle `--elevation-card` shadow (0.04 alpha),
        each tinted state lost its perimeter against the slate-50 page
        surface. We now derive a 25%-mixed status accent for the border and
        a two-layer shadow (status-tinted near + neutral far) so every state
        keeps a defined edge while preserving the gradient effect the buyer
        wants. Draft/Sent/Confirmed/Partial/Cancelled all share the recipe;
        only the accent value swaps.
        Declared after `isClosed` because both branches read it — the prior
        ordering tripped the temporal-dead-zone (ReferenceError: Cannot
        access 'isClosed' before initialization). */
  const cardAccent = STEP_COLORS[po.status] ?? STEP_COLORS.Draft;
  const cardBorderColor = isClosed
    ? "color-mix(in srgb, hsl(var(--muted-foreground)) 20%, transparent)"
    : `color-mix(in srgb, ${cardAccent.solid} 25%, hsl(var(--border)))`;
  // Shadow morphs when scrolled — Partners (`Partners/.../VendorDetailsPage.tsx:724`)
  // swaps from `shadow-sm` (expanded) to `shadow-[0_1px_3px_0_rgba(0,0,0,0.04),
  // 0_4px_12px_-4px_rgba(0,0,0,0.05)]` (scrolled), reinforcing the card's lift
  // above the page as the user scrolls past it. We boost the second layer's
  // spread + alpha on scroll while keeping the status-tinted near layer.
  const cardBoxShadow = isClosed
    ? "0 2px 12px color-mix(in srgb, hsl(var(--muted-foreground)) 15%, transparent)"
    : isScrolled
      ? `0 1px 3px color-mix(in srgb, ${cardAccent.solid} 12%, transparent), 0 6px 20px -6px color-mix(in srgb, ${cardAccent.solid} 14%, transparent), 0 2px 4px -2px color-mix(in srgb, hsl(var(--foreground)) 12%, transparent)`
      : `0 1px 3px color-mix(in srgb, ${cardAccent.solid} 12%, transparent), 0 4px 16px -6px color-mix(in srgb, ${cardAccent.solid} 10%, transparent), 0 1px 2px -1px color-mix(in srgb, hsl(var(--foreground)) 8%, transparent)`;

  /* ── Derived: edit controls show in every non-cancelled state until
     receiving starts. Once any receiving is recorded the PO is locked to
     its current version (buyer 2026-10-15) — no revisions; the only line
     action left is Cancel, which strikes the line through in place. ── */
  const isVersionLocked = isPOVersionLocked(po);
  const canEdit = !isCancelled && !isVersionLocked;

  /* ── guardEdit: intercept edits in post-Draft states ──
     Every edit that flows through `guardEdit` also marks the PO as
     dirty so the canonical unsaved-changes prompt fires on Back/Close.
     The flag resets when the user explicitly saves a version or
     confirms a discard. */
  const guardEdit = (action: () => void, tag?: string, changeDetail?: Omit<ChangeDetail, "tag">) => {
    if (isDraft) { action(); setDirty(true); return; }
    if (isCancelled || isVersionLocked) return;
    if (editingSession?.confirmed) {
      action();
      setDirty(true);
      if (tag && changeDetail) {
        recordChangeDetail(tag, changeDetail);
      } else if (tag) {
        // Only add to changeTags (for banner pills) — detail will be recorded by dialog callback
        setEditingSession(prev => prev ? { ...prev, changeTags: new Set(prev.changeTags).add(tag) } : prev);
      }
      return;
    }
    setPendingEditAction({ action, tag, changeDetail });
    setShowVersionConfirmModal(true);
  };

  /* ── One-time discount/premium → versioning bridge ──
     The ported SO modals apply a change first and then report it via
     `onMaterialEvent(description, onRevert)`. PO edits instead go
     through `guardEdit` BEFORE they apply (so the post-Draft "new
     version" prompt can snapshot the pre-change state). Bridge: capture
     the post-change list, revert, then replay it through guardEdit.
     Records an `adjustment-applied` entry for version history. */
  const handleAdjustmentEvent = (description: string, onRevert?: () => void) => {
    const after = getPO(po.id)?.adjustments ?? [];
    const verb = description.split(" ")[0];
    const cd: Omit<ChangeDetail, "tag"> = {
      type: "adjustment-applied",
      action: verb === "Added" ? "Added" : verb === "Removed" ? "Removed" : "Changed",
      subject: "One-Time Discount/Premium",
      detail: description,
    };
    onRevert?.();
    guardEdit(() => setPOAdjustments(po.id, after), "One-Time Discounts/Premiums", cd);
  };

  /* Item-level one-times edited in the Items Detail Modal's Pricing
     Rules tab → replace THIS line's set (other lines' targets untouched).
     Shared by both modal instances (pencil edit + line-click). */
  const persistLineOneTimes = (line: POLineItem, result: OrderFlowResult) => {
    const before = JSON.stringify(lineOneTimeAdjustmentsFor(po, line.id));
    if (JSON.stringify(result.oneTimeAdjustments) === before) return;
    setPOAdjustments(po.id, replaceLineAdjustments(getPO(po.id)?.adjustments ?? [], line.id, result.oneTimeAdjustments));
    setDirty(true);
    if (editingSession?.confirmed) {
      recordChangeDetail("One-Time Discounts/Premiums", {
        type: "adjustment-applied",
        action: "Changed",
        subject: "One-Time Discount/Premium",
        detail: `Updated one-time discounts/premiums on ${line.itemNumber}`,
      });
    }
  };

  /* `handleBackToListing` + `performBackNavigation` are declared above
     the `if (!po)` early-return for hook-order stability. See the
     comment block higher in this file for the navigation rules. */

  /* ── Save Version handler ── */
  const handleSaveVersion = () => {
    if (!po || !editingSession) return;
    const tags = [...editingSession.changeTags];
    const changeCount = editingSession.changeCount;
    const summary = changeCount === 1 && tags.length === 1
      ? tags[0]
      : `${changeCount} change${changeCount !== 1 ? "s" : ""} across ${tags.length} area${tags.length !== 1 ? "s" : ""}`;
    const previousStatus = po.status;
    const changes: Array<Omit<POChangeRecord, "id" | "timestamp" | "user">> = editingSession.changeDetails.map(cd => ({
      type: cd.type,
      action: cd.action,
      subject: cd.subject,
      detail: cd.detail,
    }));
    // Add fallback entries for tags that have no detailed change recorded
    const detailedTags = new Set(editingSession.changeDetails.map(cd => cd.tag));
    for (const tag of tags) {
      if (!detailedTags.has(tag)) {
        changes.push({ type: "config-changed", action: "Changed", subject: tag });
      }
    }
    const newVer = recordPOVersion(po.id, {
      reason: summary,
      changes,
      changeTags: tags,
      previousStatus,
      newStatus: "Draft",
      resetToDraft: !isDraft,
    });
    setEditingSession(null);
    // Edits have been committed to a new version — the buyer no longer
    // has unsaved changes, so the discard prompt should not fire on Back.
    setDirty(false);
    if (newVer) {
      const msg = isDraft
        ? `Version ${newVer} created successfully`
        : `Version ${newVer} created — PO returned to Draft`;
      toast.success(msg, { style: { fontFamily: FONT } });
    }
  };

  /* ── Discard Changes handler ── */
  const handleDiscardChanges = () => {
    if (!po || !editingSession) return;
    restorePOFromSnapshot(po.id, editingSession.snapshot);
    setEditingSession(null);
    toast("Changes discarded", { style: { fontFamily: FONT } });
  };
  const headerColors = isFullyReceived
    ? {
        iconBg: "color-mix(in srgb, hsl(var(--muted-foreground)) 12%, transparent)",
        iconBorder: "color-mix(in srgb, hsl(var(--muted-foreground)) 20%, transparent)",
        iconColor: "hsl(var(--muted-foreground))",
        textColor: "hsl(var(--muted-foreground))",
      }
    : {
        iconBg: "hsl(var(--primary-tint))",
        iconBorder: "color-mix(in srgb, hsl(var(--primary)) 15%, transparent)",
        iconColor: "hsl(var(--primary))",
        textColor: "hsl(var(--foreground))",
      };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "\u2014";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  };

  /* The PO's currency and rate (spec 4.3). The vendor's credit limit is
     written in USD ($125,000); it is compared in the PO's currency. */
  const fx = poFx(po);
  const creditLimit = fx.currency === "USD"
    ? 125000
    : roundTo(fx.currency, 125000 * crossRate(midRateOn("USD", fx.rateDate) ?? 1, fx.rate));
  const creditUsedPercent = Math.min(100, (po.total / creditLimit) * 100);
  const creditRemaining = creditLimit - po.total;

  const selectedPrintVersion: POVersionEntry | undefined =
    viewingVersion == null ? undefined : po.versions.find((v) => v.version === viewingVersion);
  const activeVersionNumber = selectedPrintVersion?.version ?? po.currentVersion;

  const runWithVersionPrompt = (input: {
    title: string;
    summary: string;
    reason: string;
    changes: Array<Omit<POChangeRecord, "id" | "timestamp" | "user">>;
    apply: () => void;
  }) => {
    if (po.status === "Draft") {
      input.apply();
      return;
    }
    setVersionReasonInput(input.reason);
    setPendingVersionChange(input);
  };

  /* Order Summary's currency and rate (spec 4.3): goes through guardEdit
     like every other edit, and is recorded for the version history. */
  const handleCurrencyChange = ({ next, subject }: POCurrencyChange) => {
    const detail = describeRateChange(poRateFields(po), next);
    guardEdit(
      () => {
        setPOCurrency(po.id, next);
        if (subject === "Currency") {
          toast.success(`PO converted to ${next.currency}`, { description: detail, style: { fontFamily: FONT } });
        }
      },
      subject === "Currency" ? "Currency Change" : "Exchange Rate Change",
      { type: "exchange-rate-changed", action: "Changed", subject, detail },
    );
  };

  return (
    <AppShell>
    <DocCurrencyProvider currency={fx.currency} fx={fx} dateLabel="PO date" role="PO currency">
    {/* Page surface: `bg-slate-50` (#F8FAFC) verbatim from Partners
        (`Partners/.../VendorDetailsPage.tsx:671,721`). Previously `bg-secondary`
        which resolved one step darker (slate-100) and made the white header
        card feel like it was floating against a muddy backdrop. */}
    <div ref={scrollContainerRef} className="flex flex-col h-full bg-slate-50 overflow-y-auto animate-page-fade-in" style={{ fontFamily: FONT }}>

      {/* IntersectionObserver sentinel — sits at the very top of the scroll
          container so the header morphs the moment the user starts scrolling.
          Mirrors Partners' detail page sentinel placement
          (`Partners/.../VendorDetailsPage.tsx:716`). */}
      <div ref={sentinelRef} className="shrink-0 h-px" />

      {/* ══════════ STICKY HEADER — unified card: title row + stepper + tabs ══════════
          Sticky at `top-0` so the card pins to the top of the scroll
          container as body content scrolls beneath it. Mirrors Partners
          (`Partners/.../VendorDetailsPage.tsx:721`) — single scroll
          container with the header sticky inside it (vs our prior
          flex-sibling layout that had its own inner scroll area). */}
      <div className="shrink-0 sticky top-0 z-20 bg-slate-50">
        {/* Sticky padding matches Partners (`Partners/.../VendorDetailsPage.tsx:722`):
            top 12px (lg: 16px), bottom 4px — the body section below carries its
            own `pt-3` so the card-bottom-to-body gap totals ~16px instead of
            our prior ~48px. */}
        <div className={`${DETAIL_PX} pt-3 pb-1 lg:pt-4 lg:pb-1`}>
          <div className={`${maxWidthClass} mx-auto`}>
          {/* Card no longer carries `marginBottom: 16px` — Partners' equivalent
              card has no bottom margin; vertical rhythm is owned entirely by
              the sticky-wrapper pb + body section pt.
              `border` + `boxShadow` are status-tinted (see cardBorderColor /
              cardBoxShadow above) so the card keeps a defined perimeter
              against the slate-50 page surface no matter which gradient is
              active. */}
          <div className="rounded-xl" style={{ overflow: 'visible', background: cardGradient ? `${cardGradient}, hsl(var(--card))` : 'hsl(var(--card))', border: `1px solid ${cardBorderColor}`, boxShadow: cardBoxShadow, transition: MORPH_TRANSITION }}>
            {/* Top Section — Title row.
                paddingTop morphs 12 → 8 on scroll (matches Partners
                `Partners/.../VendorDetailsPage.tsx:721-722`); paddingBottom stays
                at 12 expanded / 8 scrolled. All driven by inline-style transitions
                so the morph animates smoothly without re-flowing the layout. */}
            <div className="px-4 lg:px-5" style={{ paddingTop: isScrolled ? 8 : 12, paddingBottom: isScrolled ? 8 : 12, borderRadius: '12px 12px 0 0', transition: MORPH_TRANSITION }}>
              {/* Row 1: Title + Version + Actions */}
              <div className="flex items-center justify-between gap-4">
                {/* Left block — Partners uses `gap-2.5` (10px) between Back/Avatar/Info. */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Back link — uses history.back() so the listing restores
                      the exact tab / sub-tab / filters the buyer was on. If
                      there's nothing to go back to (deep link, new tab), we
                      still land them on the listing root.
                      An unsaved-changes guard wraps this so a dirty draft
                      prompts the canonical discard dialog before leaving.
                      `compact={isScrolled}` halves the size 44→32 (icon 20→16). */}
                  <BackButton
                    onClick={handleBackToListing}
                    title="Back to Purchase Orders"
                    muted={isClosed}
                    compact={isScrolled}
                  />
                  {/* Doc avatar — sits in the same slot as Partners' vendor avatar
                      (`Partners/.../VendorDetailsPage.tsx:747-768`). POs have no brand
                      image, so we render a FileText glyph centered in the rounded-xl
                      surface. 44×44 expanded / 32×32 scrolled. */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-xl"
                    style={{
                      width: isScrolled ? 32 : 44,
                      height: isScrolled ? 32 : 44,
                      backgroundColor: headerColors.iconBg,
                      border: `1px solid ${headerColors.iconBorder}`,
                      boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)',
                      transition: MORPH_TRANSITION,
                    }}
                  >
                    <FileText
                      style={{
                        width: isScrolled ? 14 : 20,
                        height: isScrolled ? 14 : 20,
                        color: headerColors.iconColor,
                        transition: MORPH_TRANSITION,
                      }}
                      strokeWidth={2}
                    />
                  </div>
                  {/* Info block — name + status pill + provenance + version.
                      Gap morphs 8 → 6 on scroll (Partners verbatim). */}
                  <div className="flex items-center flex-wrap min-w-0" style={{ gap: isScrolled ? 6 : 8, transition: MORPH_TRANSITION }}>
                  {/* PO Number — 16/700/22 line-height expanded; 13/600/18 compact
                      (matches Partners' vendor name morph at
                      `Partners/.../VendorDetailsPage.tsx:774-779`). */}
                  <h1
                    className="flex-shrink-0 truncate text-foreground"
                    style={{
                      fontSize: isScrolled ? 13 : 16,
                      fontWeight: isScrolled ? 600 : 700,
                      lineHeight: isScrolled ? '18px' : '22px',
                      color: headerColors.textColor,
                      fontFamily: FONT,
                      margin: 0,
                      transition: MORPH_TRANSITION,
                    }}
                  >
                    {po.poNumber}
                  </h1>
                  {/* Status Badge */}
                  <StatusBadge status={po.status} />

                  {/* Outdated-configs pill removed from the header per
                      SO-V5 sync — the below-header banner (rendered
                      further down this page) now surfaces the drift
                      with more context + a direct "Review and sync"
                      CTA, so the header stays focused on identity
                      (PO number · status · Planner provenance). */}

                  {/* "Created from Planner" provenance pill — only renders when
                     this PO was generated through the Procurement Planner
                     Sandbox (linkedDemandIds populated). Tooltip lists the
                     contributing demand-event IDs so the buyer can trace the
                     PO back to the SO / Request it was designed to cover.
                     Pill recipe ported verbatim from Partners' type badge
                     (`Partners/.../VendorDetailsPage.tsx:830-868`): rounded-md
                     border, 2px 8px padding, 11/600, gap-1, w-3 h-3 icon. */}
                  {po.linkedDemandIds && po.linkedDemandIds.length > 0 && (
                    <Tooltip delayDuration={150}>
                      <TooltipTrigger asChild>
                        <span
                          className="inline-flex items-center gap-1 rounded-md border cursor-help"
                          style={{
                            padding: isScrolled ? "1px 6px" : "2px 8px",
                            fontSize: isScrolled ? 10 : 11,
                            fontWeight: 600,
                            lineHeight: 1.35,
                            backgroundColor: "#EFF6FF",
                            color: "#1E40AF",
                            borderColor: "#BFDBFE",
                            fontFamily: FONT,
                            transition: MORPH_TRANSITION,
                          }}
                          aria-label="Created from Procurement Planner"
                        >
                          <FlaskConical style={{ width: isScrolled ? 10 : 12, height: isScrolled ? 10 : 12 }} />
                          From Planner
                          <span style={{ opacity: 0.7, fontWeight: 500, fontSize: isScrolled ? 9 : 10 }}>
                            · {po.linkedDemandIds.length}
                          </span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[280px]">
                        <div style={{ fontSize: 11.5, fontFamily: FONT }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            Created to cover {po.linkedDemandIds.length} demand event{po.linkedDemandIds.length === 1 ? "" : "s"}
                          </div>
                          <div style={{ color: "#64748b", marginBottom: 6 }}>
                            Designed in the Procurement Planner Sandbox.
                          </div>
                          <div className="flex flex-col gap-0.5" style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 10.5 }}>
                            {po.linkedDemandIds.slice(0, 8).map((id) => (
                              <span key={id} style={{ color: "#475569" }}>· {id}</span>
                            ))}
                            {po.linkedDemandIds.length > 8 && (
                              <span style={{ color: "#94a3b8" }}>+ {po.linkedDemandIds.length - 8} more</span>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Version dropdown */}
                  <POVersionDropdown
                    currentVersion={po.currentVersion}
                    currentStatus={po.status}
                    viewingVersion={viewingVersion}
                    onViewVersion={setViewingVersion}
                    onEditAsDraft={isVersionLocked || isCancelled ? undefined : (fromVersion) => {
                      /* Route through the SO-style revert confirmation
                         modal (buyer 2026-07-22) instead of firing
                         `revertPOToVersion` immediately. The modal
                         collects an optional reason before committing. */
                      setDropdownRevertVersion(fromVersion);
                    }}
                    materialChangesCount={po.versions.length > 0 ? po.versions[po.versions.length - 1]?.changes?.length : undefined}
                    versions={po.versions}
                    compact={isScrolled}
                  />
                  </div>{/* /info block */}

                </div>

                {/* Right block — gap morphs 8 → 6 on scroll (Partners verbatim
                    `Partners/.../VendorDetailsPage.tsx:897`). */}
                {/* Actions — single Actions menu + single primary CTA (Partners pattern).
                    Layout: `[⋯] [Primary CTA]`. The Actions menu consolidates everything
                    that *isn't* the primary verb for this status:
                      • alternate state transitions (Mark as Confirmed, Revert to X, …)
                      • utility actions: Print, Download, Duplicate
                      • destructive actions: Cancel PO, Archive PO (grouped at the bottom)
                    Mirrors VendorDetailsPage (`Partners/.../VendorDetailsPage.tsx:732-916`):
                    one Actions dropdown to the left of one solid primary button. Replaces
                    the previous row of four standalone icon buttons + split combo CTA,
                    saving ~140px of header real estate. */}
                <div className="flex items-center flex-shrink-0 ml-4" style={{ gap: isScrolled ? 6 : 8, transition: MORPH_TRANSITION }}>
                  {(() => {
                    const openReceiving = () => {
                      const init: Record<string, number> = {};
                      const initRaw: Record<string, string> = {};
                      const initC: Record<string, "good" | "damaged" | "rejected"> = {};
                      const initN: Record<string, string> = {};
                      po.lineItems.forEach((li) => { init[li.id] = 0; initRaw[li.id] = "0"; initC[li.id] = "good"; initN[li.id] = ""; });
                      setReceivingQtys(init);
                      setReceivingQtyInputs(initRaw);
                      setReceivingConditions(initC);
                      setReceivingNotes(initN);
                      setReceivingOpen(true);
                    };

                    type StateAction = {
                      label: string;
                      icon: React.ElementType;
                      action: () => void;
                      destructive?: boolean;
                      /** When set, the button is rendered visually disabled, its
                       *  click is short-circuited, and the string is shown as a
                       *  Tooltip on hover. Used to gate `Send to Vendor` until
                       *  every prerequisite (line items, due dates, credit
                       *  limit) is satisfied. */
                      disabledReason?: string;
                    };

                    /* ── Send-to-Vendor prerequisites (Draft only) ──
                       The vendor-facing Send action is the irreversible
                       moment a PO leaves the buyer's workspace, so we
                       gate it on three buyer-side prerequisites before
                       allowing the click. Reasons are surfaced via the
                       button's hover tooltip — see the render block below.
                       Note that we check these as a *cascade* (line items
                       → dates → credit) so the message describes the
                       earliest blocker rather than dumping a list. */
                    const sendDisabledReason: string | undefined = (() => {
                      if (po.lineItems.length === 0) {
                        return "Add at least one line item to send this PO.";
                      }
                      /* Expected Delivery Date used to be a required
                         gate here, but per buyer 2026-08-03 it's now an
                         auto-calculated derived field (today + vendor
                         lead time in OrderFlow.tsx). Since every line
                         can derive one, the gate was blocking Draft →
                         Sent for legacy mock POs whose lineItems were
                         created before the field was written through
                         the cart/checkout wiring. Drop the check —
                         line-item count and credit limit are the only
                         remaining blockers. */
                      if (po.total > creditLimit) {
                        // Inline format — `fmtMoney` lives inside the Credit-
                        // card IIFE further down the JSX tree, so it's not
                        // reachable from here.
                        const formattedLimit = `${moneyPrefix(fx.currency)}${Math.round(creditLimit).toLocaleString("en-US")}`;
                        return `PO total exceeds the available credit limit of ${formattedLimit}.`;
                      }
                      return undefined;
                    })();

                    // Per-status config (single source of truth):
                    //   primary     → the rightmost solid CTA, or `null` for terminal states
                    //                 (Fully Received / Fully Received w/ Cancellations) where
                    //                 the StatusBadge in the title row already conveys state.
                    //   alts        → non-destructive state transitions that move into the
                    //                 Actions menu. The primary verb is *not* repeated here.
                    //   cancellable → adds "Cancel PO" to the destructive bucket.
                    const cancelAction: StateAction = {
                      label: "Cancel PO",
                      icon: X,
                      action: () => {
                        if (!canCancelArchivePO) return;
                        setCancelPOMode("po");
                        setCancelPOOpen(true);
                      },
                      destructive: true,
                      disabledReason: canCancelArchivePO
                        ? undefined
                        : permissionReason("po.cancel_archive"),
                    };
                    /* Once receiving has started, "Cancel remaining" replaces both
                       Cancel PO and Mark as Fully Received (Eli, 2026-10-26:
                       "Fully Received has to mean everything arrived"). */
                    const cancelRemainingAction: StateAction = {
                      label: "Cancel remaining",
                      icon: X,
                      action: () => {
                        if (!canCancelArchivePO) return;
                        setCancelPOMode("remaining");
                        setCancelPOOpen(true);
                      },
                      destructive: true,
                      disabledReason: canCancelArchivePO
                        ? undefined
                        : permissionReason("po.cancel_archive"),
                    };

                    /* Inactive items never block a Draft (the PO already
                       exists), but moving it to an active state asks the
                       buyer to acknowledge them first. */
                    const hasInactiveLines = po.lineItems.some((li) => li.inactive && !li.cancelled);
                    const withInactiveCheck = (mode: InactiveWarningMode, run: () => void) => () => {
                      if (hasInactiveLines) setInactiveWarning({ mode, run });
                      else run();
                    };

                    // secondary → outline button beside the primary CTA.
                    const stateConfig: Record<string, { primary: StateAction | null; secondary?: StateAction; alts: StateAction[]; cancellable: boolean; cancelRemaining?: boolean }> = {
                      Draft: {
                        primary: {
                          label: "Send to Vendor",
                          icon: Send,
                          action: withInactiveCheck("send", () => sendPO(po.id)),
                          disabledReason: sendDisabledReason,
                        },
                        /* No "Mark as Confirmed" on Draft — a PO only
                           goes Sent → Confirmed (buyer 2026-11-03). */
                        alts: [],
                        cancellable: true,
                      },
                      Sent: {
                        primary: { label: "Mark as Confirmed", icon: Check, action: () => confirmPO(po.id) },
                        /* No Start Receiving — only Confirmed POs can be received
                           (ERP-4797 AC 3/4/6, receiving AC 5.1.1-5.1.2). */
                        alts: [
                          { label: "Revert to Draft", icon: ArrowLeft, action: () => revertPOStatus(po.id, "Draft") },
                        ],
                        cancellable: true,
                      },
                      Confirmed: {
                        primary: { label: "Start Receiving", icon: PackageOpen, action: openReceiving },
                        secondary: { label: "Mark as Fully Received", icon: Package, action: () => markPOFullyReceived(po.id) },
                        alts: [
                          { label: "Revert to Sent", icon: ArrowLeft, action: () => revertPOStatus(po.id, "Sent") },
                        ],
                        cancellable: true,
                      },
                      "Partially Received": {
                        // ERP-4799: no Mark as Fully Received once receiving has
                        // started — Fully Received only happens when everything
                        // arrives. Cancel remaining closes out the rest.
                        primary: { label: "Continue Receiving", icon: PackageOpen, action: openReceiving },
                        alts: [],
                        cancellable: false,
                        cancelRemaining: true,
                      },
                      "Fully Received": {
                        primary: null,
                        alts: [
                          { label: "Revert to Partially Received", icon: ArrowLeft, action: () => revertPOStatus(po.id, "Partially Received") },
                        ],
                        cancellable: false,
                      },
                      Cancelled: {
                        primary: { label: "Reactivate PO", icon: ArrowLeft, action: () => { setReactivateReason(""); setReactivateError(false); setReactivatePOOpen(true); } },
                        alts: [],
                        cancellable: false,
                      },
                      "Active with Cancellations": {
                        // Same as Partially Received (ERP-4799).
                        primary: { label: "Continue Receiving", icon: PackageOpen, action: openReceiving },
                        alts: [],
                        cancellable: false,
                        cancelRemaining: true,
                      },
                      "Fully Received with Cancellations": {
                        primary: null,
                        alts: [
                          { label: "Revert to Partially Received", icon: ArrowLeft, action: () => revertPOStatus(po.id, "Active with Cancellations") },
                        ],
                        cancellable: false,
                      },
                    };

                    const config = stateConfig[po.status];
                    if (!config) return null;

                    const PrimaryIcon = config.primary?.icon;

                    // Utility actions — single source of truth for Print / Download /
                    // Duplicate. Order mirrors the previous standalone icon-button row.
                    const utilities: StateAction[] = [
                      { label: "Print", icon: Printer, action: () => setDocPreview("print") },
                      { label: "Download PO", icon: Download, action: () => setDocPreview("download") },
                      { label: "Duplicate PO", icon: Copy, action: () => setDuplicateDialogOpen(true) },
                    ];

                    // Destructive bucket grouped at the bottom of the menu under a separator
                    // so muscle-memory clicks on the most recently-used utility option never
                    // land on a destructive one.
                    const destructives: StateAction[] = [];
                    if (config.cancellable) destructives.push(cancelAction);
                    if (config.cancelRemaining) destructives.push(cancelRemainingAction);
                    // Archive PO only until something is received (Draft, Sent,
                    // Confirmed, Cancelled) — ERP-4744 / ERP-4772. Archived POs
                    // offer Restore from the archived banner instead.
                    if (canArchivePO(po)) destructives.push({
                      label: "Archive PO",
                      icon: Archive,
                      action: () => {
                        if (!canCancelArchivePO) return;
                        setArchivePOOpen(true);
                      },
                      destructive: true,
                      disabledReason: canCancelArchivePO
                        ? undefined
                        : permissionReason("po.cancel_archive"),
                    });

                    return (
                      <>
                        {/* Fullscreen toggle — verbatim port of Partners'
                            fullscreen button (`Partners/.../VendorDetailsPage.tsx:897-910`):
                            36×36 expanded / 32×32 compact, rounded-lg, border-border,
                            white bg, slate-500 icon at 16×16 expanded / 14×14 compact,
                            soft micro-shadow, slate-50 hover. Maximize2 ↔ Minimize2
                            depending on `isFullscreen`. Tooltip text swaps "Full Screen"
                            / "Exit Full Screen". */}
                        <Tooltip delayDuration={150}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => setIsFullscreen((v) => !v)}
                              aria-label={isFullscreen ? "Exit Full Screen" : "Full Screen"}
                              aria-pressed={isFullscreen}
                              className="flex items-center justify-center rounded-lg shrink-0 hover:bg-slate-50"
                              style={{
                                width: isScrolled ? 32 : 36,
                                height: isScrolled ? 32 : 36,
                                border: '1px solid hsl(var(--border))',
                                backgroundColor: '#FFFFFF',
                                color: '#64748B' /* slate-500 — matches Partners icon tint */,
                                boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)',
                                cursor: 'pointer',
                                transition: MORPH_TRANSITION,
                              }}
                            >
                              {isFullscreen ? (
                                <Minimize2 style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} strokeWidth={2} />
                              ) : (
                                <Maximize2 style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} strokeWidth={2} />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            {isFullscreen ? "Exit Full Screen" : "Full Screen"}
                          </TooltipContent>
                        </Tooltip>

                        {/* Actions ▾ — verbatim port of Partners' ActionsDropdown
                            trigger (`Partners/.../VendorDetailsPage.tsx:500-506`):
                              `rounded-lg border border-border bg-white hover:bg-slate-50
                               text-slate-700 inline-flex items-center gap-1.5 transition-all
                               duration-200 cursor-pointer shadow-sm h-9 px-3.5 text-[13px]`
                              + inline `fontWeight: 500` + ChevronDown w-3.5 h-3.5 text-slate-400.
                            Replaces the prior icon-only MoreHorizontal trigger — Partners uses
                            a labeled button so the menu's purpose is discoverable. */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              title="Actions"
                              aria-label="Actions"
                              className={`rounded-lg border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 ${isScrolled ? "h-8 px-3" : "h-9 px-3.5"} ${isClosed ? "opacity-60" : ""}`}
                              style={{
                                fontSize: isScrolled ? 12 : 13,
                                fontWeight: 500,
                                lineHeight: 1,
                                fontFamily: FONT,
                                borderColor: 'hsl(var(--border))',
                                transition: MORPH_TRANSITION,
                              }}
                            >
                              Actions
                              <ChevronDown style={{ width: isScrolled ? 12 : 14, height: isScrolled ? 12 : 14, color: '#94A3B8' /* slate-400 */ }} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[220px]">
                            {config.alts.map((opt, i) => {
                              const OptIcon = opt.icon;
                              return (
                                <DropdownMenuItem key={`alt-${i}`} onClick={opt.action}>
                                  <OptIcon className="size-3.5 mr-2" />
                                  <span style={st.uiLabel}>{opt.label}</span>
                                </DropdownMenuItem>
                              );
                            })}
                            {config.alts.length > 0 && <DropdownMenuSeparator />}
                            {utilities.map((opt, i) => {
                              const OptIcon = opt.icon;
                              return (
                                <DropdownMenuItem key={`util-${i}`} onClick={opt.action}>
                                  <OptIcon className="size-3.5 mr-2" />
                                  <span style={st.uiLabel}>{opt.label}</span>
                                </DropdownMenuItem>
                              );
                            })}
                            {destructives.length > 0 && <DropdownMenuSeparator />}
                            {destructives.map((opt, i) => {
                              const OptIcon = opt.icon;
                              return (
                                <DropdownMenuItem
                                  key={`dest-${i}`}
                                  onClick={opt.action}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <OptIcon className="size-3.5 mr-2 text-destructive" />
                                  <span style={st.uiLabel}>{opt.label}</span>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Primary CTA — verbatim port of Partners' EditCta
                            (`Partners/.../VendorDetailsPage.tsx:607-616`):
                              `rounded-lg bg-primary hover:bg-[#0862D0] text-white
                               inline-flex items-center gap-1.5 transition-all
                               duration-200 cursor-pointer shadow-sm h-9 px-4 text-[13px]`
                              + inline `fontWeight: 600`
                              + Pencil-equivalent icon `w-3.5 h-3.5` (14×14)
                            Replaces the prior h-44 / gap-2 / no-shadow recipe — Partners'
                            primary is 36px tall (h-9), not 44px, so it sits cleanly next
                            to the 36px Actions trigger without towering over the title row. */}
                        {/* Secondary CTA — outline button beside the primary
                            (Confirmed: Mark as Fully Received, ERP-4797). Same
                            chrome as the Actions trigger. */}
                        {config.secondary && (() => {
                          const SecondaryIcon = config.secondary.icon;
                          return (
                            <button
                              type="button"
                              onClick={config.secondary.action}
                              className={`rounded-lg border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 ${isScrolled ? "h-8 px-3" : "h-9 px-3.5"}`}
                              style={{
                                fontSize: isScrolled ? 12 : 13,
                                fontWeight: 500,
                                lineHeight: 1,
                                fontFamily: FONT,
                                borderColor: 'hsl(var(--border))',
                                transition: MORPH_TRANSITION,
                              }}
                            >
                              <SecondaryIcon style={{ width: isScrolled ? 12 : 14, height: isScrolled ? 12 : 14 }} strokeWidth={2} />
                              {config.secondary.label}
                            </button>
                          );
                        })()}

                        {config.primary && PrimaryIcon && (() => {
                          const reason = config.primary.disabledReason;
                          const isDisabled = !!reason;
                          /* Disabled treatment: dim the background, swap
                             cursor, freeze hover swap, and short-circuit
                             onClick. Keep the icon + label visible so
                             users still recognize the affordance — they
                             just can't fire it until the tooltip's
                             prerequisites are met. */
                          const btn = (
                            <button
                              type="button"
                              onClick={isDisabled ? undefined : config.primary!.action}
                              aria-disabled={isDisabled}
                              className={`rounded-lg inline-flex items-center gap-1.5 shadow-sm shrink-0 ${isScrolled ? "h-8 px-3.5" : "h-9 px-4"} ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                              style={{
                                backgroundColor: 'hsl(var(--primary))',
                                color: 'hsl(var(--primary-foreground))',
                                fontSize: isScrolled ? 12 : 13,
                                fontWeight: 600,
                                lineHeight: 1,
                                fontFamily: FONT,
                                border: 'none',
                                opacity: isDisabled ? 0.5 : 1,
                                transition: MORPH_TRANSITION,
                              }}
                              onMouseEnter={(e) => { if (!isDisabled) e.currentTarget.style.backgroundColor = '#0862D0' /* Partners hover (`hover:bg-[#0862D0]` verbatim) */; }}
                              onMouseLeave={(e) => { if (!isDisabled) e.currentTarget.style.backgroundColor = 'hsl(var(--primary))'; }}
                            >
                              <PrimaryIcon style={{ width: isScrolled ? 12 : 14, height: isScrolled ? 12 : 14 }} strokeWidth={2} />
                              {config.primary!.label}
                            </button>
                          );
                          // Wrap in a tooltip ONLY when blocked — keeps
                          // the happy path free of hover chrome.
                          if (!isDisabled) return btn;
                          return (
                            <Tooltip delayDuration={150}>
                              <TooltipTrigger asChild>
                                {/* span wrapper: shadcn tooltip won't fire
                                    on a child that's truly `disabled`; we
                                    use aria-disabled instead so the
                                    pointer events still register, but the
                                    span keeps things robust across browser
                                    quirks. */}
                                <span className="inline-flex">{btn}</span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[280px]">
                                {reason}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Row 2 (key metadata strip) removed 2026-05 — Vendor, Total, Due,
                  and Created By were duplicated verbatim in the right sidebar
                  (Vendor Information hero, Order Summary hero, Payment & Shipping,
                  Timeline). Removing it gives us a single-row title bar that mirrors
                  Partners' VendorDetailsPage header (`Partners/.../VendorDetailsPage.tsx:732-916`)
                  and reclaims ~36 px of vertical space on every PO view. */}
            </div>

            {/* Middle Section: Full-Width Stepper — unified with header, no separator */}
            <div className="px-5 pb-2.5 pt-0.5">
              <LifecycleTracker currentStatus={po.status} po={po} />
            </div>

            {/* Bottom Section: Detail tabs — moved inside the card 2026-05 to
                mirror Partners' VendorDetailsPage layout (`Partners/.../
                VendorDetailsPage.tsx:920-951`). The bottom radius is supplied
                here so the tab bar's `border-t` divides cleanly from the
                stepper above and the underline indicator anchors to the
                card's rounded corner. */}
            <div style={{ borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
              <PODetailTabs activeTab={activeTab} onTabChange={setActiveTab} compact={isScrolled} />
            </div>
          </div>
          </div>
        </div>
        {/* Bottom gradient fade — verbatim from Partners
            (`Partners/.../VendorDetailsPage.tsx:956-963`). Sits INSIDE the
            sticky wrapper so it pins with the header and provides a soft
            slate-50 edge as body content scrolls beneath. Only visible
            when the sentinel has scrolled out of view. */}
        <div
          className="pointer-events-none transition-opacity duration-300"
          style={{
            height: 8,
            background: 'linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)',
            opacity: isScrolled ? 1 : 0,
          }}
        />
      </div>

      {/*
        ════════════ STATUS BANNERS ════════════
        White card surface (`bg-white rounded-md border-border shadow-sm`) with
        a single 28×28 status-tinted icon chip on the left providing all of the
        colour. Mirrors the change-type icon-tile recipe used in the Versions
        tab (`POVersionHistoryTab.tsx`). Replaces the prior full-fill warning /
        accent washes that competed with the gradient-tinted header card just
        above. Palette per state:
          - Cancelled                       → red    (`#FEF2F2 / #991B1B / #FECACA`)
          - Active with Cancellations       → amber  (`#FFFBEB / #92400E / #FDE68A`)
          - Fully Received w/ Cancellations → emerald(`#ECFDF5 / #065F46 / #A7F3D0`)
      */}

      {/* ── Viewing Historical Version Banner ──
           Fires when the buyer has picked an older version in the header
           dropdown. Historical data is read-only in this codebase — the
           dropdown lets the buyer print / reference an older version, but
           the main page still reflects the current PO. The banner makes
           that state obvious and offers a one-click return to the current
           version. Mirrors the SO audit's read-only gating pattern in a
           way that fits PO's actual data flow. */}
      {viewingVersion != null && viewingVersion !== po.currentVersion && (
        <div className={DETAIL_PX}>
          <div className={`${maxWidthClass} mx-auto pt-4`}>
            <div
              className="flex items-start gap-3 rounded-md border bg-white shadow-sm px-4 py-3"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <div
                className="flex items-center justify-center shrink-0 rounded-md border"
                style={{
                  width: 28,
                  height: 28,
                  backgroundColor: "#FFFBEB",
                  borderColor: "#FDE68A",
                  marginTop: 1,
                }}
              >
                <FileText style={{ width: 14, height: 14, color: "#92400E" }} />
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className="text-foreground block tabular-nums"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.4,
                    fontFamily: FONT,
                  }}
                >
                  Viewing Version {viewingVersion} — read-only historical snapshot
                </span>
                <span
                  className="block mt-0.5"
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                    color: "#64748B",
                    lineHeight: 1.4,
                    fontFamily: FONT,
                  }}
                >
                  This page still reflects V{po.currentVersion} (the current PO). Use the header dropdown to print V{viewingVersion}, edit it as a new draft, or return to the current view.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingVersion(null)}
                className="shrink-0 h-8 px-3 rounded-md border inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors hover:bg-muted/60"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#334155",
                  backgroundColor: "#FFFFFF",
                  borderColor: "hsl(var(--border))",
                  fontFamily: FONT,
                  lineHeight: 1,
                }}
              >
                Switch to current
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Archived Banner (ERP-4744 / ERP-4772) ── */}
      {isPOArchived(po.id) && (
        <div className={DETAIL_PX}>
          <div className={`${maxWidthClass} mx-auto pt-4`}>
            <div className="flex items-center gap-3 rounded-md border bg-white shadow-sm px-4 py-3" style={{ borderColor: "hsl(var(--border))" }}>
              <div
                className="flex items-center justify-center shrink-0 rounded-md border"
                style={{ width: 28, height: 28, backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" }}
              >
                <Archive style={{ width: 14, height: 14, color: "#475569" }} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-foreground block tabular-nums" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, fontFamily: FONT }}>
                  This PO was archived{po.archivedDate ? ` on ${new Date(po.archivedDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </span>
                <span className="block mt-0.5" style={{ fontSize: 12, fontWeight: 400, color: "#64748B", lineHeight: 1.4, fontFamily: FONT }}>
                  It's out of your active list. Restore it to bring it back.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 shrink-0"
                style={st.uiLabel}
                onClick={() => {
                  restorePO(po.id);
                  toast.success(`PO ${po.poNumber} restored`, { style: { fontFamily: FONT } });
                }}
              >
                <ArchiveRestore className="size-3.5 mr-1" /> Restore PO
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancellation Banner ── */}
      {isCancelled && po.cancellationDate && (
        <div className={DETAIL_PX}>
          <div className={`${maxWidthClass} mx-auto pt-4`}>
            <div className="flex items-start gap-3 rounded-md border bg-white shadow-sm px-4 py-3" style={{ borderColor: "hsl(var(--border))" }}>
              <div
                className="flex items-center justify-center shrink-0 rounded-md border"
                style={{ width: 28, height: 28, backgroundColor: "#FEF2F2", borderColor: "#FECACA", marginTop: 1 }}
              >
                <AlertTriangle style={{ width: 14, height: 14, color: "#991B1B" }} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-foreground block tabular-nums" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, fontFamily: FONT }}>
                  This PO was cancelled on {new Date(po.cancellationDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {po.cancellationReason && (
                  <span className="block mt-0.5" style={{ fontSize: 12, fontWeight: 400, color: "#64748B" /* slate-500 */, lineHeight: 1.4, fontFamily: FONT }}>
                    Reason: {po.cancellationReason}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Active with Cancellations Banner ── */}
      {isActiveWithCancellations && hasCancelledItems && (
        <div className={DETAIL_PX}>
          <div className={`${maxWidthClass} mx-auto pt-4`}>
            <div className="flex items-start gap-3 rounded-md border bg-white shadow-sm px-4 py-3" style={{ borderColor: "hsl(var(--border))" }}>
              <div
                className="flex items-center justify-center shrink-0 rounded-md border"
                style={{ width: 28, height: 28, backgroundColor: "#FFFBEB", borderColor: "#FDE68A", marginTop: 1 }}
              >
                <AlertTriangle style={{ width: 14, height: 14, color: "#92400E" }} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-foreground block" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, fontFamily: FONT }}>
                  This PO has{" "}
                  <span className="tabular-nums">{po.lineItems.filter((li) => li.cancelled).length}</span> cancelled line item
                  {po.lineItems.filter((li) => li.cancelled).length > 1 ? "s" : ""}
                </span>
                <span className="block mt-0.5" style={{ fontSize: 12, fontWeight: 400, color: "#64748B", lineHeight: 1.4, fontFamily: FONT }}>
                  Cancelled items are excluded from the order total. The PO remains active for non-cancelled items.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Fully Received with Cancellations Banner ── */}
      {isFullyReceivedWithCancellations && hasCancelledItems && (
        <div className={DETAIL_PX}>
          <div className={`${maxWidthClass} mx-auto pt-4`}>
            <div className="flex items-start gap-3 rounded-md border bg-white shadow-sm px-4 py-3" style={{ borderColor: "hsl(var(--border))" }}>
              <div
                className="flex items-center justify-center shrink-0 rounded-md border"
                style={{ width: 28, height: 28, backgroundColor: "#ECFDF5", borderColor: "#A7F3D0", marginTop: 1 }}
              >
                <CheckCircle2 style={{ width: 14, height: 14, color: "#065F46" }} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-foreground block" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, fontFamily: FONT }}>
                  All non-cancelled items have been fully received
                </span>
                <span className="block mt-0.5" style={{ fontSize: 12, fontWeight: 400, color: "#64748B", lineHeight: 1.4, fontFamily: FONT }}>
                  <span className="tabular-nums">{cancelledLineCount}</span> item
                  {cancelledLineCount > 1 ? "s were" : " was"} fully or partly cancelled and excluded from the final total.
                  {po.cancellationReason && <> Reason: {po.cancellationReason}</>}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ BODY CONTENT ══════════
          The outer container is the scroll container (Partners pattern —
          single scroll surface for the entire detail page). This body
          wrapper is just a flex-1 spacer so the content fills the
          remaining vertical space and scrolls beneath the sticky header
          above. The sentinel that drives the scroll-morph lives at the
          very top of the outer scroll container. */}
      {(
      <div className="flex-1">

        {/* Body content padding matches Partners' detail-page ladder
            (`Partners/.../VendorDetailsPage.tsx:989`): `px-4 lg:px-6 xl:px-8`
            horizontally + `pt-3 pb-5` vertically. Replaces the prior
            `px-4 lg:px-8 2xl:px-16 3xl:px-24` recipe which gave huge
            gutters on 2xl/3xl viewports — much wider than Partners. */}
        <div className={`${DETAIL_PX} pt-3 pb-5`}>
          {/* ── Outdated configurations banner (Draft only) ──
             Full-width strip that sits above the tab content ladder,
             ported from Sales-Order-V5 SODetail. Amber refresh icon +
             count + "Review and sync" CTA. Auto-collapses when the PO
             leaves Draft (see effect above); the modal's Apply/Ignore
             flow also dismisses it via the shared outdatedConfigs
             state machine. */}
          {po.status === "Draft" && outdatedBannerVisible && outdatedUpdates.length > 0 && (
            <div className={`${maxWidthClass} mx-auto mb-3`}>
              <div
                className="rounded-xl bg-card"
                style={{
                  border: "1px solid rgba(245, 158, 11, 0.22)",
                  boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px 0 rgba(0,0,0,0.06)",
                  overflow: "hidden",
                }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex items-center justify-center shrink-0"
                      style={{ width: 32, height: 32, borderRadius: 8, background: "#FEF3C7", border: "1px solid #FDE68A" }}
                    >
                      <RefreshCw style={{ width: 16, height: 16, color: "#B45309" }} strokeWidth={2} />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--foreground))", lineHeight: 1.3, fontFamily: FONT }}>
                        {outdatedUpdates.length} outdated {outdatedUpdates.length === 1 ? "configuration" : "configurations"}
                      </span>
                      <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.45, fontFamily: FONT }}>
                        {po.vendor?.name
                          ? `Updated configurations are available for ${po.vendor.name}.`
                          : "Updated configurations are available for this partner."}{" "}
                        Review before continuing this draft.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowOutdatedConfigsModal(true)}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-md transition-colors cursor-pointer"
                    style={{ height: 32, padding: "0 14px", fontSize: 13, fontWeight: 500, backgroundColor: "hsl(var(--primary))", color: "#FFFFFF", border: "none", fontFamily: FONT }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0D5ED7"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "hsl(var(--primary))"; }}
                  >
                    <RefreshCw style={{ width: 12, height: 12 }} /> Review and sync
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Right column sized to match Partners detail page (`Partners/.../VendorDetailsPage.tsx:3358`).
              Partners uses `w-[280px] xl:w-[300px]` — we hold at 300px on lg+ so the
              sidebar reads as the same surface system across the suite. */}
          <div className={`${maxWidthClass} mx-auto grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start`}>

            {/* ━━━━━━ LEFT COLUMN ━━━━━━ */}
            <div key={activeTab} className="flex flex-col gap-5 animate-tab-fade-in min-w-0 overflow-hidden">

              {/* ─── TAB: ITEMS ─── */}
              {activeTab === "items" && (
                <>
                  {/* ── Editing Mode (Versioning) Banner ──
                       White card surface, primary-tinted 28×28 icon chip on
                       the left providing colour. Change tags use Partners'
                       Vendor-blue type-badge palette (same recipe as the
                       Versions tab change-tags) so they read as defined
                       chips, not low-contrast fills. */}
                  {editingSession?.confirmed && (
                    <div
                      className="flex items-center justify-between gap-3 rounded-md border bg-white shadow-sm px-4 py-3"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Primary-tinted icon chip */}
                        <div
                          className="flex items-center justify-center shrink-0 rounded-md border"
                          style={{ width: 28, height: 28, backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }}
                        >
                          <Pencil style={{ width: 14, height: 14, color: "#1E40AF" }} />
                        </div>
                        {/* Headline + meta */}
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="text-foreground" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, fontFamily: FONT }}>
                            Editing Version <span className="tabular-nums">{(po.currentVersion || 1) + 1}</span>
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 400, color: "#64748B" /* slate-500 */, lineHeight: 1.4, fontFamily: FONT }}>
                            {!isDraft ? `· PO will return to Draft on save · ` : "· "}
                            <span className="tabular-nums">{editingSession.changeCount}</span> change{editingSession.changeCount !== 1 ? "s" : ""} made
                          </span>
                          {editingSession.changeTags.size > 0 && (() => {
                            const allTags = [...editingSession.changeTags];
                            const MAX_VISIBLE = 4;
                            const visible = allTags.slice(0, MAX_VISIBLE);
                            const overflow = allTags.length - MAX_VISIBLE;
                            const tagPillStyle: React.CSSProperties = {
                              padding: "1px 6px",
                              fontSize: 10,
                              fontWeight: 500,
                              backgroundColor: "#EFF6FF",
                              color: "#1E40AF",
                              borderColor: "#BFDBFE",
                              borderWidth: 1,
                              borderStyle: "solid",
                              lineHeight: 1.4,
                              fontFamily: FONT,
                              whiteSpace: "nowrap",
                            };
                            return (
                              <div className="flex items-center gap-1.5 ml-1 min-w-0 overflow-hidden">
                                {visible.map(tag => (
                                  <span key={tag} className="inline-flex items-center rounded-md shrink-0" style={tagPillStyle}>
                                    {tag}
                                  </span>
                                ))}
                                {overflow > 0 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span
                                        className="inline-flex items-center rounded-md shrink-0 cursor-default"
                                        style={{
                                          padding: "1px 6px",
                                          fontSize: 10,
                                          fontWeight: 500,
                                          backgroundColor: "#F1F5F9" /* slate-100 */,
                                          color: "#475569" /* slate-600 */,
                                          borderColor: "#E2E8F0" /* slate-200 */,
                                          borderWidth: 1,
                                          borderStyle: "solid",
                                          lineHeight: 1.4,
                                          fontFamily: FONT,
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        +{overflow} more
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                      <div className="flex flex-col">
                                        {allTags.slice(MAX_VISIBLE).map(t => (
                                          <span key={t} className="py-0.5" style={{ fontSize: 12, color: "#0F172A", fontFamily: FONT }}>{t}</span>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      {/* Action area — Discard (ghost) + Save Version (filled primary) */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleDiscardChanges}
                          className="h-8 px-3 rounded-md inline-flex items-center cursor-pointer transition-colors duration-150 hover:bg-muted/60"
                          style={{ fontSize: 12, fontWeight: 500, color: "#64748B" /* slate-500 */, backgroundColor: "transparent", border: "none", fontFamily: FONT, lineHeight: 1 }}
                        >
                          Discard Changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setSaveVersionModalOpen(true)}
                          className="h-8 px-3 rounded-md inline-flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors duration-150"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "hsl(var(--primary-foreground))",
                            backgroundColor: "hsl(var(--primary))",
                            border: "none",
                            fontFamily: FONT,
                            lineHeight: 1,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#0862D0"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--primary))"; }}
                        >
                          <Save style={{ width: 12, height: 12 }} />
                          Save Version
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Version lock notice — receiving has started, so the PO
                      can no longer be revised (buyer 2026-10-15). */}
                  {isVersionLocked && !isCancelled && (
                    <div
                      className="flex items-start gap-2 px-3 py-2 mb-3 rounded-[var(--radius-md)] border border-border bg-secondary/40"
                      style={{ fontFamily: FONT }}
                    >
                      <Lock className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground" style={st.uiSmall}>
                        <span className="text-foreground" style={{ fontWeight: "var(--font-weight-medium)" }}>
                          Locked to Version {po.currentVersion || 1}
                        </span>
                        {" "}— receiving has started, so this PO can no longer be revised. Cancelled lines stay on the PO struck through.
                      </span>
                    </div>
                  )}
                  <LineItemsPanel
                    po={po}
                    canEdit={canEdit}
                    freeEdit={isDraft || (editingSession?.confirmed === true)}
                    onRequestEditSession={(tag) => guardEdit(() => {}, tag)}
                    onEditItem={(item) => guardEdit(() => handleEditItem(item), "Item Edit", {
                      type: "line-item-modified", action: "Changed",
                      subject: `Item Edit: ${item.itemNumber}`, detail: item.descriptiveName,
                    })}
                    onViewItem={(item) => {
                      setViewingItem(item);
                      setViewOpen(true);
                    }}
                    onThumbnailQuickView={(item) => {
                      // Open QuickViewPanel preview — mirrors CatalogueModal's
                      // `handleThumbnailQuickView` (`CatalogueModal.tsx:263-269`).
                      setQuickViewData({
                        type: "item",
                        item: { id: item.itemNumber, name: item.itemNumber, imageUrl: item.image, inactive: item.inactive },
                        vendorName: po.vendor.name,
                      });
                    }}
                    onImageClick={(src) => {
                      const li = po.lineItems.find((l) => l.image === src);
                      if (li) {
                        const catItem = CATALOG.find((c) => c.itemNumber === li.itemNumber);
                        const images = catItem ? getItemImages(catItem) : getItemImages({ id: li.itemNumber, image: li.image } as any);
                        setLightboxData({ images, partNumber: li.itemNumber, itemName: li.descriptiveName });
                      } else {
                        setLightboxData({ images: getItemImages({ id: "unknown", image: src } as any), partNumber: "", itemName: "" });
                      }
                    }}
                    onRemoveItem={(liId) => {
                      const li = po.lineItems.find(l => l.id === liId);
                      guardEdit(() => removeLineItemFromPO(po.id, liId), "Item Removed", li ? {
                        type: "line-item-removed", action: "Removed",
                        subject: li.itemNumber, detail: `${li.descriptiveName} — ${li.quantity} ${li.vendorUOM}`,
                      } : undefined);
                    }}
                    onChangeLineLocation={(li, location) => {
                      /* Per-line vendor ship-from swap. Logged as a
                         line-item-modified change so version history
                         picks up the per-line divergence. */
                      guardEdit(
                        () => updateLineItem(po.id, li.id, {
                          vendorLocationId: location.id,
                          vendorLocationName: location.name,
                        }),
                        "Ship-from Change",
                        {
                          type: "line-item-modified",
                          action: "Changed",
                          subject: `Ships from: ${li.itemNumber}`,
                          detail: `${li.vendorLocationName ?? "—"} → ${location.name}`,
                        },
                      );
                    }}
                    onQualifyLine={(li, scope) => {
                      const vendorName = li.needsQualificationForVendor;
                      if (!vendorName) return;
                      /* "vendor" scope also extends the global item↔vendor
                         mapping so future POs on this vendor see the item
                         as qualified without prompting. "po-only" leaves
                         the master data untouched. */
                      if (scope === "vendor") {
                        qualifyItemForVendorGlobally(li.itemNumber);
                      }
                      const scopeDetail =
                        scope === "vendor"
                          ? `Qualified for ${vendorName} globally — future POs on this vendor will inherit.`
                          : `Qualified for ${vendorName} on this PO only. Master item↔vendor mapping unchanged.`;
                      guardEdit(
                        () => updateLineItem(po.id, li.id, {
                          needsQualificationForVendor: undefined,
                          qualifiedForVendor: vendorName,
                          qualifiedScope: scope,
                        }),
                        "Item Qualified",
                        {
                          type: "line-item-modified",
                          action: "Changed",
                          subject: `Qualified: ${li.itemNumber}`,
                          detail: scopeDetail,
                        },
                      );
                    }}
                    onAddItems={() => guardEdit(() => setAddItemsOpen(true), "Item Added")}
                    onCancelItem={!isDraft && !isCancelled && po.status !== "Fully Received" && po.status !== "Fully Received with Cancellations" ? (liId) => setCancelLineItemId(liId) : undefined}
                    onUpdateQty={(li, vendorQty, quantity) => guardEdit(
                      () => updateLineItem(po.id, li.id, { vendorQty, quantity }),
                      "Qty Change",
                      { type: "line-item-modified", action: "Changed", subject: `Qty: ${li.itemNumber}`, detail: `${li.quantity} ${li.vendorUOM} → ${quantity} ${li.vendorUOM}` }
                    )}
                    onUpdatePrice={(li, unitPrice) => {
                      /* Apply price + log change record (existing behavior) */
                      const applyLocal = () => guardEdit(
                        () => updateLineItem(po.id, li.id, { unitPrice, discount: 0 }),
                        "Price Change",
                        { type: "pricing-changed", action: "Changed", subject: `Price: ${li.itemNumber}`, detail: `${li.vendorUOM}: ${formatMoney(li.unitPrice, fx.currency)} → ${formatMoney(unitPrice, fx.currency)}` }
                      );

                      // $0 / NaN — silent (zero-priced lines are first-class)
                      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
                        applyLocal();
                        return;
                      }

                      // Look up master tier for this vendor + this line's UOM
                      const catalogItem = CATALOG.find((c) => c.itemNumber === li.itemNumber);
                      const itemId = catalogItem?.id;
                      const vendorName = po.vendor?.name;
                      const unit = li.vendorUOM;
                      const masterTier = itemId && vendorName ? getVendorUnitPrice(itemId, vendorName, unit) : undefined;
                      /* The vendor's price book is in its currency (spec 4.2); the
                         line is in the PO's, which the buyer may have changed. */
                      const bookPrice = fromPOCurrency(unitPrice, vendorCurrency(vendorName), po);

                      const outcome = classifyPriceChange({
                        vendorName: vendorName || "",
                        unit,
                        enteredPrice: bookPrice,
                        existingMasterPrice: masterTier?.price,
                      });

                      if (outcome.kind === "silent" || !itemId || !vendorName) {
                        applyLocal();
                        return;
                      }

                      setPriceConfirmState({
                        open: true,
                        outcome,
                        onConfirmDefault: () => {
                          upsertVendorUnitPrice(itemId, vendorName, unit, bookPrice, {
                            markAsDefault: !masterTier || masterTier.isDefault,
                          });
                          applyLocal();
                        },
                        onUseOnce: () => {
                          applyLocal();
                        },
                      });
                    }}
                    pricingBreakdowns={pricingBreakdowns}
                    adjustmentBreakdowns={adjustmentsAPI.lineBreakdowns}
                  />
                </>
              )}

              {/* ─── TAB: INVOICES & PAYMENTS ───
                   Previously rendered 3 stacked placeholders (Invoices / Payments
                   / Receipts) which would have totalled ~1200px of empty state.
                   Consolidated to a single Partners-style PlaceholderTab matching
                   the GL-Accounts pattern (`Partners/.../VendorDetailsPage.tsx:1180`). */}
              {activeTab === "invoices-payments" && (
                <TabPlaceholderPanel
                  icon={FileText}
                  title="Invoices & Payments"
                  description="Vendor invoices, payments, and goods-receipt records linked to this purchase order will surface here once the billing module lands."
                />
              )}

              {/* ─── TAB: COMMUNICATIONS ─── */}
              {activeTab === "communications" && (
                <TabPlaceholderPanel
                  icon={Send}
                  title="Communications"
                  description="Email correspondence and messages between buyer + vendor for this purchase order will be threaded here."
                />
              )}

              {/* ─── TAB: VERSIONS ─── Compare now renders inline
                    below the version list (SO parity 2026-07-28), so
                    the tab no longer swaps out for a full-screen view. */}
              {activeTab === "versions" && (
                <POVersionHistoryTab
                  poNumber={po.poNumber}
                  versions={po.versions}
                  currentVersion={po.currentVersion}
                  canRevert={!isVersionLocked && !isCancelled}
                  onRevert={(version, reason) => {
                    const restored = revertPOToVersion(po.id, version, reason || `Reverted to Version ${version}`);
                    if (restored) {
                      setViewingVersion(null);
                      toast.success(`Reverted to Version ${version}`, {
                        description: `V${version} is now the current version.`,
                        style: { fontFamily: FONT },
                      });
                    }
                  }}
                />
              )}

              {/* ─── TAB: NOTES ─── */}
              {activeTab === "notes" && (
                <PONotesSection
                  poId={po.id}
                  allNotes={po.poNotes}
                  canEdit={!isCancelled}
                  onNoteChange={(action, noteType, subject) => {
                    // Notes aren't a revision — no version once the PO is locked.
                    if (isVersionLocked) return;
                    const tag = `Notes ${noteType === "vendor" ? "(Vendor)" : "(Internal)"}`;
                    const detail = `${action.charAt(0).toUpperCase() + action.slice(1)} ${noteType} ${subject || "note"}`;
                    guardEdit(() => {}, tag, {
                      type: "config-changed",
                      action: action === "added" ? "Added" : action === "edited" ? "Changed" : "Removed",
                      subject: `Notes Change: ${detail}`,
                    });
                  }}
                  defaultOpen={true}
                  embedded
                />
              )}

              {/* ─── TAB: COMMENTS ─── */}
              {activeTab === "comments" && (
                <TabPlaceholderPanel
                  icon={Clipboard}
                  title="Comments"
                  description="Internal comments and team discussion threads tied to this PO will appear here."
                />
              )}

              {/* ─── TAB: RECEIVING DOCS ─── */}
              {activeTab === "receiving-docs" && (
                <TabPlaceholderPanel
                  icon={ClipboardCheck}
                  title="Receiving Documents"
                  description="Packing slips, inspection reports, and other goods-receipt paperwork uploaded for this PO will surface here."
                />
              )}

              {/* ─── TAB: ATTACHMENTS ─── */}
              {/* Verbatim port of the SO Detail Attachments tab
                  (src/app/components/po/AttachmentsTab.tsx). The prior
                  Items-V2-style tab is retired for this surface — buyer
                  2026-08-04 asked to bring the SO design + functionality
                  1:1. `soId` / `soStatus` prop names are kept from the
                  SO source; PO passes its id/status through them. */}
              {activeTab === "attachments" && (() => {
                /* Bridge PO line items to the SOLine shape the ported
                   generator + tab expect. Only fields the generator
                   actually reads (`id`, `itemCode`, `cancelled`) are
                   populated; the rest are typed as `any`. Attachments
                   are seeded per PO id so switching POs shows a
                   distinct set. */
                const bridgedLines = po.lineItems.map((li) => ({
                  id: li.id,
                  itemCode: li.itemNumber,
                  cancelled: !!li.cancelled,
                }));
                const idxHash = (po.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0)) % 32;
                const seededAttachments = generatePoAttachments(idxHash, bridgedLines as any);
                /* Wrapper mirrors SO Detail's own render
                   (`so/SODetail.tsx:1798`) but adds a white background
                   so the tab reads as a distinct surface on the PO
                   detail page (buyer 2026-08-04). Keeps the rounded
                   border for parity with the other PO detail tab hosts. */
                return (
                  <div
                    className="flex-1 flex flex-col min-h-0 rounded-xl border bg-white overflow-hidden"
                    style={{ minHeight: 560, borderColor: "hsl(var(--border))" }}
                  >
                    <PODetailAttachmentsTab
                      soId={po.id}
                      soStatus={po.status}
                      createdViaUI={false}
                      attachments={seededAttachments}
                      lines={bridgedLines as any}
                    />
                  </div>
                );
              })()}

              {/* ─── TAB: RECENT ACTIVITIES ─── */}
              {activeTab === "recent-activities" && (
                <TabPlaceholderPanel
                  icon={AlertCircle}
                  title="Recent Activities"
                  description="A chronological audit trail of every status change, edit, and action on this purchase order is being designed in a separate workstream."
                />
              )}

              {/* Vendor, POC, and Notes are now in the right column */}
            </div>

            {/* ━━━━━━ RIGHT COLUMN ━━━━━━
                Sticky info-card stack — mirrors Partners' VendorDetailsPage
                right column (`:3358`): a 4-card stack of DashInfoCards with
                `space-y-4` breathing between cards, sticky at the top so the
                summary follows the buyer down the page. */}
            <div>
              <div className="lg:sticky lg:top-5 space-y-4">

                {/* ━━━━ 1. ORDER SUMMARY (highest priority — totals first) ━━━━
                    Visual recipe mirrors the Partners "Financial Summary"
                    DashInfoCard (`VendorDetailsPage.tsx:3485`): a prominent
                    label/value pair at the top followed by a divider and a
                    breakdown stack using DashInfoLabel (10px/500 slate-400)
                    + 12px/500 slate-700 values. */}
                <CollapsibleSection icon={CircleDollarSign} title="Order Summary" defaultOpen={true}>
                  <div className="px-3.5 py-3">
                    {/* Hero — Total Amount. Mirrors Partners' "Outstanding
                        Payables" hero pattern (`VendorDetailsPage.tsx:3534-3537`):
                        a 10/500 slate-400 label above a 16px-range bold
                        currency value + a 11/400 slate-500 caption beneath. */}
                    <div className="mb-3">
                      <p className="text-slate-400" style={{ fontSize: 10, fontWeight: 500 }}>
                        Total Amount
                      </p>
                      <p
                        className="text-slate-700 tracking-tight tabular-nums"
                        style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}
                      >
                        <DocMoney value={poPricing?.total ?? po.total} />
                      </p>
                      {/* What the PO is worth in the base currency, at its rate. */}
                      {!fx.isBase && (
                        <p className="text-slate-500 tabular-nums mt-0.5 truncate" style={{ fontSize: 11, fontWeight: 400 }}>
                          ≈ {formatMoney(toBase(poPricing?.total ?? po.total, fx.rate), BASE_CURRENCY)}
                          <span className="text-slate-400"> {BASE_CURRENCY} · base currency</span>
                        </p>
                      )}
                      <p
                        className="text-slate-500 mt-1 truncate"
                        style={{ fontSize: 11, fontWeight: 400 }}
                      >
                        {po.lineItems.filter((li) => !li.cancelled).length} active item{po.lineItems.filter((li) => !li.cancelled).length !== 1 ? "s" : ""}
                        {hasCancelledItems && <> · {po.lineItems.filter((li) => li.cancelled).length} cancelled</>}
                        {" "}from {po.vendor.name}
                      </p>
                    </div>

                    <POCurrencyFields po={po} canEdit={canEdit} onChange={handleCurrencyChange} />

                    {/* Breakdown — Partners' canonical breakdown row spec
                        (`:3431-3450`): 10/500 slate-400 label + 12/500
                        slate-700 value. Separator above is `border-t
                        border-muted` (matches Partners Financial Summary
                        divider at `:3507`). The redundant "Grand Total"
                        row was removed — the hero already surfaces it. */}
                    <div className="border-t border-muted pt-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-slate-400" style={{ fontSize: 10, fontWeight: 500 }}>Subtotal</p>
                        <p className="text-slate-700 tabular-nums" style={{ fontSize: 12, fontWeight: 500 }}><DocMoney value={po.subtotal} /></p>
                      </div>
                      {/* Discount + Premium pricing rules (buyer
                          2026-07-22 "everything is based on pricing rules
                          — either discount or premium; we need to update
                          the design accordingly"). Standalone "Discount"
                          row is removed; line-item discounts are folded
                          into "Discount pricing rules" so the buyer sees
                          one price-reduction row and one price-addition
                          row, both attributed to the pricing-rules
                          concept. Pencil affordance on either row opens
                          the manage modal. */}
                      {(() => {
                        /* Count distinct discount vs premium rules + their
                           unique impacted lines. Line-item discounts
                           (po.discountTotal) roll into the discount side
                           since they're conceptually a price reduction —
                           SO's model treats them the same. */
                        const discountRuleIds = new Set<string>();
                        const premiumRuleIds = new Set<string>();
                        const discountLineIds = new Set<string>();
                        const premiumLineIds = new Set<string>();
                        for (const [lineId, bd] of pricingBreakdowns.entries()) {
                          for (const ri of bd.ruleImpacts) {
                            if (ri.type === "discount") {
                              discountRuleIds.add(ri.ruleId);
                              discountLineIds.add(lineId);
                            } else {
                              premiumRuleIds.add(ri.ruleId);
                              premiumLineIds.add(lineId);
                            }
                          }
                        }
                        const discountTotal = totalRulesDiscount + po.discountTotal;
                        const discountLineCount = po.discountTotal > 0
                          ? new Set([
                              ...discountLineIds,
                              ...po.lineItems.filter((li) => li.discount > 0).map((li) => li.id),
                            ]).size
                          : discountLineIds.size;
                        const discountRuleCount = discountRuleIds.size + (po.discountTotal > 0 ? po.lineItems.filter((li) => li.discount > 0).length : 0);
                        const showDiscount = discountTotal > 0;
                        const showPremium = totalRulesPremium > 0;
                        if (!showDiscount && !showPremium) return null;
                        const rowClass = "flex items-start justify-between gap-3";
                        return (
                          <>
                            {showDiscount && (
                              <div className={rowClass}>
                                <div className="min-w-0">
                                  <p style={{ fontSize: 10, fontWeight: 500, color: "hsl(var(--success))" }}>
                                    Discount pricing rules
                                  </p>
                                  {discountRuleCount > 0 && (
                                    <div
                                      className="inline-flex items-center gap-1 mt-0.5"
                                      style={{ fontSize: 10, fontWeight: 400 }}
                                    >
                                      <span className="text-slate-500 truncate">
                                        {discountRuleCount} {discountRuleCount === 1 ? "rule" : "rules"}
                                        {" · "}applied to {discountLineCount} {discountLineCount === 1 ? "item" : "items"}
                                      </span>
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => canModifyPricingRules && setPricingRulesManageOpen(true)}
                                          aria-label="Manage pricing rules"
                                          title={canModifyPricingRules ? "Manage pricing rules" : permissionReason("po.modify_pricing_rules")}
                                          disabled={!canModifyPricingRules}
                                          className="inline-flex items-center justify-center w-4 h-4 rounded text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-slate-400 disabled:hover:bg-transparent shrink-0"
                                        >
                                          <Pencil style={{ width: 10, height: 10 }} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <p
                                  className="tabular-nums shrink-0"
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: "hsl(var(--success))",
                                  }}
                                >
                                  <DocMoney value={-discountTotal} />
                                </p>
                              </div>
                            )}
                            {showPremium && (
                              <div className={rowClass}>
                                <div className="min-w-0">
                                  <p style={{ fontSize: 10, fontWeight: 500, color: "#7C3AED" }}>
                                    Premium pricing rules
                                  </p>
                                  {premiumRuleIds.size > 0 && (
                                    <div
                                      className="inline-flex items-center gap-1 mt-0.5"
                                      style={{ fontSize: 10, fontWeight: 400 }}
                                    >
                                      <span className="text-slate-500 truncate">
                                        {premiumRuleIds.size} {premiumRuleIds.size === 1 ? "rule" : "rules"}
                                        {" · "}applied to {premiumLineIds.size} {premiumLineIds.size === 1 ? "item" : "items"}
                                      </span>
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() => canModifyPricingRules && setPricingRulesManageOpen(true)}
                                          aria-label="Manage pricing rules"
                                          title={canModifyPricingRules ? "Manage pricing rules" : permissionReason("po.modify_pricing_rules")}
                                          disabled={!canModifyPricingRules}
                                          className="inline-flex items-center justify-center w-4 h-4 rounded text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-slate-400 disabled:hover:bg-transparent shrink-0"
                                        >
                                          <Pencil style={{ width: 10, height: 10 }} />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <p
                                  className="tabular-nums shrink-0"
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: "#7C3AED",
                                  }}
                                >
                                  +<DocMoney value={totalRulesPremium} />
                                </p>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* One-Time Discounts/Premiums — Sales Orders Order
                          Summary row (`SOSidebar.tsx`): signed net (purple
                          premium / green discount), a `SummaryInfoRow`
                          link opening the manage modal when any exist,
                          else the dashed "+ Add order-level
                          discount/premium" shortcut. */}
                      {(() => {
                        const net = adjustmentsAPI.grandTotal.net;
                        const count = adjustmentsAPI.adjustments.length;
                        const orderLevel = adjustmentsAPI.adjustments.filter((a) => a.scope === "quote").length;
                        const color = net > 0 ? "#7C3AED" : net < 0 ? "hsl(var(--success))" : "#475569";
                        const sign = net > 0 ? "+" : net < 0 ? "−" : "";
                        const canAdd = canEdit && canOneTimeDiscounts;
                        return (
                          <div>
                            <div className="flex items-center justify-between gap-3">
                              <p style={{ fontSize: 10, fontWeight: 500, color: count > 0 ? color : "#94A3B8" }}>
                                One-Time Discounts/Premiums
                              </p>
                              <p className="tabular-nums shrink-0" style={{ fontSize: 12, fontWeight: 500, color }}>
                                {sign}<DocMoney value={Math.abs(net)} />
                              </p>
                            </div>
                            {count > 0 ? (
                              <SummaryInfoRow
                                label={`${count} discount${count === 1 ? "" : "s"}/premium${count === 1 ? "" : "s"} · ${orderLevel} order-level`}
                                onClick={() => setAdjustmentsManageOpen(true)}
                                color={net > 0 ? "#7C3AED" : net < 0 ? "hsl(var(--success))" : undefined}
                              />
                            ) : canAdd ? (
                              <button
                                type="button"
                                onClick={() => setAddOrderAdjustmentOpen(true)}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  marginTop: 7, padding: "5px 8px",
                                  borderRadius: 6, cursor: "pointer",
                                  borderWidth: 1, borderStyle: "dashed", borderColor: "hsl(var(--accent))",
                                  backgroundColor: "hsl(var(--background))",
                                  fontSize: 11, fontWeight: 500, color: "hsl(var(--primary))",
                                  lineHeight: 1, transition: "all 150ms",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--accent))"; e.currentTarget.style.borderColor = "rgba(10, 119, 255, 0.4)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "hsl(var(--background))"; e.currentTarget.style.borderColor = "hsl(var(--accent))"; }}
                              >
                                <Plus style={{ width: 11, height: 11 }} />
                                Add order-level discount/premium
                              </button>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </CollapsibleSection>

                {/* Standalone "Pricing Rules" sidebar card removed
                    2026-07-22 — the aggregated "Pricing Rules Applied"
                    row inside Order Summary above, plus its pencil
                    affordance opening POPricingRulesManageModal, is
                    the single entry point (matches SO's Order Summary
                    treatment). */}

                {/* ━━━━ 2. VENDOR INFORMATION (unified card) ━━━━ */}
                <VendorInfoCard
                  vendor={po.vendor}
                  poCurrency={fx.currency}
                  recipient={po.recipient}
                  payment={po.payment}
                  canEdit={canEdit}
                  secondaryContactNames={po.secondaryContactNames}
                  onEditContact={() => guardEdit(() => setVendorContactOpen(true), "Contact Change")}
                  onEditPayTo={() => guardEdit(() => setPayToDialogOpen(true), "Billing Change")}
                  onEditShipTo={() => guardEdit(() => setShipToDialogOpen(true), "Shipping Change")}
                  onEditFundedBy={() => guardEdit(() => setFundedByDialogOpen(true), "Funding Change")}
                  onEditPaymentTerms={() => guardEdit(() => setPaymentEditOpen(true), "Payment Terms Change")}
                  onEditPaymentMethod={() => guardEdit(() => setPaymentMethodOpen(true), "Payment Method Change")}
                  payToVendors={PAY_TO_VENDORS}
                  shippedToVendors={SHIPPED_TO_VENDORS}
                  fundedByVendors={FUNDED_BY_VENDORS}
                  defaultOpen={true}
                />

                {/* ━━━━ 3. CREDIT LIMITS ━━━━
                    Restructured around the Purchasing Manager persona's
                    workflow questions, ranked by frequency:
                      Q1. "Do I have room after this order?"  → `Available
                          After` is now the hero (16/700, single value)
                      Q2. "Is the vendor close to credit limit?"  → status
                          pill in the hero row + colored progress bar
                      Q3. "How much is this order eating?"  → "This PO" row
                          in the supporting breakdown
                      Q4. "What's the total limit?"  → "Credit Limit" row
                          in the supporting breakdown
                    Visual recipe — progress bar, threshold palette, status
                    label — still 1:1 with Partners' Credit Limits card
                    (`VendorDetailsPage.tsx:3542-3577`); only the row order
                    is reorganized to surface the PM's primary decision
                    signal first.
                    Parked behind `SHOW_PO_CREDIT_LIMITS_AND_PEOPLE` (buyer
                    2026-07-28) — kept intact so it can be flipped back on
                    without rewiring. */}
                {SHOW_PO_CREDIT_LIMITS_AND_PEOPLE && (() => {
                  // Same threshold-driven palette Partners uses
                  // (`VendorDetailsPage.tsx:2823-2825`).
                  const creditPct = Math.round(creditUsedPercent);
                  const creditStatusLabel =
                    creditPct > 80 ? "Critical" : creditPct > 50 ? "Warning" : "Healthy";
                  const creditStatusColor =
                    creditPct > 80
                      ? "hsl(var(--destructive))"
                      : creditPct > 50
                        ? "hsl(var(--warning))"
                        : "hsl(var(--success))";
                  const creditBarColor =
                    creditPct > 80 ? "#FEE2E2" : creditPct > 50 ? "#FEF3C7" : "#D1FAE5";
                  const statusPillBg =
                    creditPct > 80 ? "#FEF2F2" : creditPct > 50 ? "#FFFBEB" : "#ECFDF5";
                  const statusPillBorder =
                    creditPct > 80 ? "#FECACA" : creditPct > 50 ? "#FDE68A" : "#A7F3D0";
                  const fmtMoney = (n: number) =>
                    `${moneyPrefix(fx.currency)}${Math.round(n).toLocaleString("en-US")}`;

                  return (
                    <CollapsibleSection
                      icon={CreditCard}
                      title="Credit Limits"
                      defaultOpen={false}
                    >
                      <div className="px-3.5 py-3">
                        {/* Row 1 — Hero: `Available After` answers the PM's
                            primary question. Paired with the severity pill
                            so the buyer reads "how much room + how safe"
                            in one glance. Status pill uses the same Partners
                            Active/Inactive/Archived pill recipe
                            (`VendorDetailsPage.tsx:3361`) with pastel bg +
                            saturated text + matching border. */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p
                              className="text-slate-400"
                              style={{ fontSize: 10, fontWeight: 500 }}
                            >
                              Available After
                            </p>
                            <p
                              className="text-slate-700 truncate tabular-nums"
                              style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}
                              title={fmtMoney(creditRemaining)}
                            >
                              {fmtMoney(creditRemaining)}
                            </p>
                          </div>
                          {/* Severity pill — only shown when there's an actual
                              signal to communicate (Warning / Critical).
                              "Healthy" is redundant with the green bar so
                              we skip it. */}
                          {creditStatusLabel !== "Healthy" && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 shrink-0"
                              style={{
                                backgroundColor: statusPillBg,
                                borderColor: statusPillBorder,
                                color: creditStatusColor,
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            >
                              <span
                                className="size-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: creditStatusColor }}
                              />
                              {creditStatusLabel}
                            </span>
                          )}
                        </div>

                        {/* Row 2 — Progress bar with embedded percentage
                            (matches Partners line 3567-3571). The bar is the
                            primary visual signal alongside the pill; together
                            they answer the risk question without numbers. */}
                        <div
                          className="w-full h-3 rounded-full overflow-hidden flex"
                          style={{ backgroundColor: "hsl(var(--muted))" }}
                        >
                          <div
                            className="h-full rounded-full transition-all flex items-center justify-start pl-2"
                            style={{
                              width: `${Math.max(Math.min(creditPct, 100), 8)}%`,
                              backgroundColor: creditBarColor,
                            }}
                          >
                            <span
                              className="text-slate-700 whitespace-nowrap tabular-nums"
                              style={{ fontSize: 9, fontWeight: 600 }}
                            >
                              {creditPct}%
                            </span>
                          </div>
                        </div>

                        {/* Row 3 — 0% / 100% scale labels (matches Partners
                            line 3572-3576). Status moved to the hero pill so
                            the middle slot is now empty — the bar carries the
                            severity by color. */}
                        <div className="flex items-center justify-between mt-1.5">
                          <span
                            className="text-slate-400"
                            style={{ fontSize: 10, fontWeight: 500 }}
                          >
                            0%
                          </span>
                          <span
                            className="text-slate-400"
                            style={{ fontSize: 10, fontWeight: 500 }}
                          >
                            100%
                          </span>
                        </div>

                        {/* Row 4 — Supporting breakdown (the components that
                            compose the hero answer). PM reaches for these
                            when they need to explain or contextualize. Same
                            neutral key/value recipe Partners uses in the
                            Partner Information card (`:3431-3450`). */}
                        <div className="border-t border-muted pt-3 mt-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <p
                              className="text-slate-400"
                              style={{ fontSize: 10, fontWeight: 500 }}
                            >
                              This PO
                            </p>
                            <p
                              className="text-slate-700 tabular-nums"
                              style={{ fontSize: 12, fontWeight: 500 }}
                            >
                              {fmtMoney(po.total)}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p
                              className="text-slate-400"
                              style={{ fontSize: 10, fontWeight: 500 }}
                            >
                              Credit Limit
                            </p>
                            <p
                              className="text-slate-700 tabular-nums"
                              style={{ fontSize: 12, fontWeight: 500 }}
                            >
                              {fmtMoney(creditLimit)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CollapsibleSection>
                  );
                })()}

                {/* ━━━━ People — Created / Approved by ━━━━
                   Surfaces the two identities behind the PO: who
                   raised it (createdBy + createdAt) and who signed
                   off (approvedBy + approvedAt). Approval renders in
                   a Pending state on Draft POs since approval only
                   fires once the PO transitions out of Draft.
                   Parked behind `SHOW_PO_CREDIT_LIMITS_AND_PEOPLE`
                   (buyer 2026-07-28). */}
                {SHOW_PO_CREDIT_LIMITS_AND_PEOPLE && (
                <CollapsibleSection icon={Users} title="People" defaultOpen={true}>
                  {(() => {
                    const initials = (name: string) =>
                      name
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0]?.toUpperCase() ?? "")
                        .join("");
                    const formatWhen = (iso?: string) => {
                      if (!iso) return null;
                      try {
                        return new Date(iso).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                      } catch {
                        return null;
                      }
                    };
                    const createdWhen = formatWhen(po.createdAt);
                    const approvedWhen = formatWhen(po.approvedAt);
                    const rowStyle = "flex items-center gap-3 py-2";
                    const nameStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: "hsl(var(--foreground))", fontFamily: FONT };
                    const roleStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 500, color: "hsl(var(--muted-foreground))", fontFamily: FONT, textTransform: "uppercase", letterSpacing: "0.04em" };
                    const dateStyle: React.CSSProperties = { fontSize: 11, fontWeight: 400, color: "hsl(var(--muted-foreground))", fontFamily: FONT };
                    return (
                      <div className="px-3.5 py-1">
                        {/* Created by */}
                        <div className={rowStyle}>
                          <div
                            className="shrink-0 flex items-center justify-center rounded-full"
                            style={{ width: 32, height: 32, backgroundColor: "hsl(var(--primary-tint))", color: "hsl(var(--primary))", fontSize: 11, fontWeight: 700, fontFamily: FONT }}
                          >
                            {initials(po.createdBy)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p style={roleStyle}>Created by</p>
                            <p style={nameStyle} className="truncate">{po.createdBy}</p>
                            {createdWhen && <p style={dateStyle}>{createdWhen}</p>}
                          </div>
                        </div>
                        {/* Approved by — pending state on Draft. */}
                        <div className={`${rowStyle} border-t border-border/60`}>
                          {po.approvedBy ? (
                            <div
                              className="shrink-0 flex items-center justify-center rounded-full"
                              style={{ width: 32, height: 32, backgroundColor: "color-mix(in srgb, hsl(var(--success)) 12%, transparent)", color: "hsl(var(--success))", fontSize: 11, fontWeight: 700, fontFamily: FONT }}
                            >
                              {initials(po.approvedBy)}
                            </div>
                          ) : (
                            <div
                              className="shrink-0 flex items-center justify-center rounded-full"
                              style={{ width: 32, height: 32, backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--muted-foreground))" }}
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p style={roleStyle}>Approved by</p>
                            {po.approvedBy ? (
                              <>
                                <p style={nameStyle} className="truncate">{po.approvedBy}</p>
                                {approvedWhen && <p style={dateStyle}>{approvedWhen}</p>}
                              </>
                            ) : (
                              <p style={{ ...nameStyle, color: "hsl(var(--muted-foreground))", fontWeight: 400, fontStyle: "italic" }}>
                                Pending approval
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CollapsibleSection>
                )}

                {/* ━━━━ 3. TIMELINE (open by default, icon-style) ━━━━ */}
                <CollapsibleSection icon={CalendarDays} title="Timeline" defaultOpen={true}>
                  {(() => {
                    const formatShort = (dateStr: string | null) => {
                      if (!dateStr) return null;
                      const d = new Date(dateStr + "T00:00:00");
                      return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
                    };

                    /* Determine receiving label dynamically */
                    const receivingLabel = po.status === "Fully Received"
                      ? "Fully Received"
                      : po.status === "Partially Received"
                      ? "Partially Received"
                      : "Fully Received";

                    const receivingIcon = po.status === "Fully Received" ? Package : PackageOpen;

                    /* Step config with icons and semantic colors */
                    type TLStep = {
                      key: string;
                      label: string;
                      date: string | null;
                      icon: React.ElementType;
                      editable: boolean;
                      activeColor: string;
                      activeBg: string;
                      isDeliveryDate?: boolean;
                      stepIndex: number;
                    };

                    /* Timeline step palette — uses semantic tokens that are
                       actually saturated, not the very pale `--accent`
                       (`#EFF6FF`) which is the accent *background* token and
                       renders icons + circle washes as ~invisible against
                       white. Each step's tone reflects its lifecycle meaning:
                         · Sent       → primary blue (in-transit info)
                         · Confirmed  → success green (positive milestone)
                         · Delivery   → neutral foreground (date marker)
                         · Receiving  → success green when complete,
                                        warning amber when partial. */
                    const steps: TLStep[] = [
                      {
                        key: "sent", label: "Sent to Vendor", date: po.sentDate,
                        icon: Send, editable: false,
                        activeColor: "hsl(var(--primary))",
                        activeBg: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)",
                        stepIndex: 0,
                      },
                      {
                        key: "confirmed", label: "Confirmed", date: po.confirmationDate,
                        icon: Check, editable: false,
                        activeColor: "hsl(var(--success))",
                        activeBg: "color-mix(in srgb, hsl(var(--success)) 12%, transparent)",
                        stepIndex: 1,
                      },
                      {
                        /* Expected PO completion is derived (max of line
                           expectedDeliveryDate). Never editable — buyers
                           adjust the per-line Expected delivery date on
                           the Items Detail Modal to move it. Locked for
                           every PO status. */
                        key: "delivery", label: "Expected PO completion", date: po.deliveryDate,
                        icon: Truck, editable: false,
                        activeColor: "hsl(var(--foreground))",
                        activeBg: "color-mix(in srgb, hsl(var(--foreground)) 6%, transparent)",
                        stepIndex: -1, isDeliveryDate: true,
                      },
                      {
                        key: "receiving", label: receivingLabel, date: po.receivingStartDate,
                        icon: receivingIcon, editable: false,
                        activeColor: po.status === "Fully Received"
                          ? "hsl(var(--success))"
                          : "hsl(var(--warning))",
                        activeBg: po.status === "Fully Received"
                          ? "color-mix(in srgb, hsl(var(--success)) 12%, transparent)"
                          : "color-mix(in srgb, hsl(var(--warning)) 12%, transparent)",
                        stepIndex: 2,
                      },
                    ];

                    /* Lifecycle index */
                    const STATUS_ORDER2: POStatus[] = ["Draft", "Sent", "Confirmed", "Partially Received", "Fully Received"];
                    const currentIdx = STATUS_ORDER2.indexOf(po.status);

                    return (
                      <div className="px-3.5 py-3">
                        <div className="relative flex flex-col">
                          {/* Vertical connecting line — sits behind icons */}
                          <div
                            className="absolute w-px"
                            style={{
                              left: 11,
                              top: 14,
                              height: "calc(100% - 28px)",
                              backgroundColor: "hsl(var(--border))",
                            }}
                          />

                          {steps.map((step) => {
                            const hasDate = !!step.date;
                            const isCompleted = step.isDeliveryDate
                              ? hasDate
                              : (hasDate && step.stepIndex <= currentIdx);
                            const isCurrent = !step.isDeliveryDate && step.stepIndex === currentIdx;
                            const isPending = !step.isDeliveryDate && !hasDate && step.stepIndex > currentIdx;

                            const StepIcon = step.icon;

                            /* Icon circle styles */
                            const circleBg = isCompleted || isCurrent
                              ? step.activeBg
                              : "hsl(var(--secondary))";
                            const circleBorder = isPending
                              ? "1px solid hsl(var(--border))"
                              : "1px solid transparent";
                            const iconColor = isCompleted || isCurrent
                              ? step.activeColor
                              : "hsl(var(--muted-foreground))";
                            const iconOpacity = isPending ? 0.3 : 1;

                            /* Label / date colors — Partners' canonical
                               breakdown row spec (`VendorDetailsPage.tsx:3431`):
                                 · slate-700 for active / completed text
                                 · slate-400 for muted / pending text
                               Current step's date picks up the step's active
                               color so the "you are here" signal stays bright. */
                            const labelColor = isPending ? "#94A3B8" : "#334155";
                            const labelOpacity = isPending ? 0.7 : 1;

                            const dateColor = isCurrent
                              ? step.activeColor
                              : isCompleted
                                ? "#334155"
                                : "#94A3B8";

                            return (
                              <div
                                key={step.key}
                                className="relative flex items-center gap-2.5"
                                style={{ padding: "5px 0" }}
                              >
                                {/* Icon circle */}
                                <div
                                  className="relative z-10 flex items-center justify-center shrink-0 rounded-full"
                                  style={{
                                    width: 22,
                                    height: 22,
                                    backgroundColor: circleBg,
                                    border: circleBorder,
                                    transition: "all 0.3s ease",
                                  }}
                                >
                                  <StepIcon
                                    className="size-3"
                                    style={{ color: iconColor, opacity: iconOpacity, strokeWidth: 2.2 }}
                                  />
                                </div>

                                {/* Step label — 12px / 500 slate-700 to match the
                                    Partners DashInfoCard inner-value spec. Falls
                                    back to muted color + opacity for pending steps. */}
                                <span
                                  className="flex-1 min-w-0"
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    fontFamily: FONT,
                                    lineHeight: 1.35,
                                    color: labelColor,
                                    opacity: labelOpacity,
                                  }}
                                >
                                  {step.label}
                                </span>

                                {/* Date + actions (buyer 2026-07-29: info
                                    tooltip on Expected PO completion
                                    removed — the label + auto-calc
                                    behavior is self-explanatory). */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: (isCompleted || isCurrent) ? 600 : 500,
                                      fontFamily: FONT,
                                      lineHeight: 1.35,
                                      color: dateColor,
                                      opacity: isPending ? 0.4 : 1,
                                    }}
                                  >
                                    {hasDate ? formatShort(step.date) : "Pending"}
                                  </span>
                                  {step.editable && !isCancelled && (
                                    <button
                                      className="flex items-center justify-center size-5 rounded-[var(--radius-sm)] cursor-pointer transition-colors hover:bg-secondary"
                                      style={{ color: "hsl(var(--muted-foreground))", opacity: 0.4 }}
                                      onClick={() => {
                                        guardEdit(() => {
                                          setDeliveryDateDraft(po.deliveryDate);
                                          setDeliveryDateModalOpen(true);
                                        }, "Date Change");
                                      }}
                                    >
                                      <Pencil className="size-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Urgency alert banner */}
                        {po.status === "Draft" && (() => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const delivery = new Date(po.deliveryDate + "T00:00:00");
                          const daysUntil = Math.ceil((delivery.getTime() - today.getTime()) / 86400000);
                          if (daysUntil > 7) return null;
                          const urgencyText = daysUntil <= 0
                            ? "Delivery date has passed — send now"
                            : daysUntil <= 1
                            ? "Delivery due tomorrow — send now"
                            : `Delivery in ${daysUntil} days — send soon`;
                          return (
                            <div
                              className="mt-2.5 flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2"
                              style={{
                                backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)",
                                border: "1px solid color-mix(in srgb, hsl(var(--warning)) 25%, transparent)",
                              }}
                            >
                              <AlertCircle className="size-3.5 shrink-0" style={{ color: "hsl(var(--warning))" }} />
                              <span style={{ ...st.uiSmall, color: "hsl(var(--warning))" }}>
                                {urgencyText}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </CollapsibleSection>

                {/* ── Delivery Date Edit Modal ── */}
                <Dialog open={deliveryDateModalOpen} onOpenChange={setDeliveryDateModalOpen}>
                  <DialogContent className="sm:max-w-[380px] p-0 gap-0 rounded-xl overflow-hidden border border-border" style={{ backgroundColor: "hsl(var(--card))" }}>
                    <div className="px-5 pt-5 pb-3">
                      <DialogTitle style={{ ...st.sectionHeading, color: "hsl(var(--foreground))" }}>
                        Edit Expected PO Completion
                      </DialogTitle>
                      <DialogDescription style={{ ...st.uiSmall, color: "hsl(var(--muted-foreground))", marginTop: 4 }}>
                        This date is auto-calculated from the latest line item expected delivery. Override it below.
                      </DialogDescription>
                    </div>
                    <div className="px-5 pb-4 flex flex-col gap-3">
                      {/* Info banner */}
                      <div
                        className="flex items-start gap-2 rounded-[var(--radius-md)] px-3 py-2.5"
                        style={{
                          backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 6%, transparent)",
                          border: "1px solid color-mix(in srgb, hsl(var(--primary)) 15%, transparent)",
                        }}
                      >
                        <Info className="size-3.5 mt-0.5 shrink-0" style={{ color: "hsl(var(--primary))" }} />
                        <span style={{ ...st.tiny, color: "hsl(var(--primary))" }}>
                          Currently auto-calculated as the expected PO completion:{" "}
                          <strong>
                            {(() => {
                              const latest = computeExpectedPOCompletion(po) || po.deliveryDate;
                              const d = new Date(latest + "T00:00:00");
                              return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
                            })()}
                          </strong>
                        </span>
                      </div>
                      {/* Date input */}
                      <div className="flex flex-col gap-1.5">
                        <label style={{ ...st.fieldLabel, color: "hsl(var(--foreground))" }}>Expected PO completion</label>
                        <input
                          type="date"
                          className="w-full rounded-[var(--radius-md)] border border-border px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          style={st.fieldValue}
                          value={deliveryDateDraft}
                          onChange={(e) => setDeliveryDateDraft(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 rounded-[var(--radius-md)]"
                        style={st.uiLabel}
                        onClick={() => setDeliveryDateModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 px-3 rounded-[var(--radius-md)]"
                        style={st.uiLabel}
                        onClick={() => {
                          if (deliveryDateDraft && deliveryDateDraft !== po.deliveryDate) {
                            const oldDate = po.deliveryDate;
                            updatePODeliveryDate(po.id, deliveryDateDraft);
                            if (editingSession?.confirmed) {
                              const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
                              recordChangeDetail("Date Change", { type: "config-changed", action: "Changed", subject: "Delivery Date", detail: `${fmt(oldDate)} → ${fmt(deliveryDateDraft)}` });
                            }
                          }
                          setDeliveryDateModalOpen(false);
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Receiving Progress section removed — now inline on line items */}
                {/* Attachments section removed from sidebar per design — file management lives elsewhere */}

              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── Scroll-to-top FAB — verbatim port of Partners
          (`Partners/.../VendorDetailsPage.tsx:966-983`). Fixed bottom-right
          floating button that appears once the user has scrolled past the
          sentinel. Clicking smoothly scrolls the outer container back to
          the top so the header returns to its expanded state. */}
      <button
        type="button"
        onClick={() => {
          const el = scrollContainerRef.current;
          if (el) el.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-white border border-border flex items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-slate-300 active:scale-95"
        style={{
          width: 40,
          height: 40,
          opacity: isScrolled ? 1 : 0,
          transform: isScrolled ? "translateY(0) scale(1)" : "translateY(16px) scale(0.9)",
          pointerEvents: isScrolled ? "auto" : "none",
          boxShadow: "0 2px 12px -3px rgba(0,0,0,0.12), 0 4px 16px -4px rgba(0,0,0,0.08)",
          transition: "opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms ease, border-color 200ms ease",
          fontFamily: FONT,
        }}
        aria-label="Scroll to top"
      >
        <ChevronUp style={{ width: 20, height: 20, color: "#64748B" /* slate-500 */ }} strokeWidth={2} />
      </button>

      {/* ── Add Items — vendor-locked catalogue modal (all states) ── */}
      <ItemsCatalogueModal
        open={addItemsOpen}
        onClose={() => setAddItemsOpen(false)}
        initialVendor={po.vendor.name}
        lockedVendor={po.vendor.name}
        headingOverride={`Add Items from ${po.vendor.name}`}
        mode="po"
        addButtonLabel="Add Item"
        existingPOItemQtyByNumber={poItemQtyByNumber}
        onAddItem={handleAddCatalogItemToPO}
      />

      {/* ���─ Edit Line Item — OrderFlow modal (edit-po mode) ── */}
      <OrderFlow
        open={editOpen}
        onOpenChange={setEditOpen}
        item={editingItem ? poLineItemToOrderFlowItem(editingItem, po.vendor.name) : null}
        mode="edit-po"
        poId={po.id}
        lineItemId={editingItem?.id}
        prefill={editingItem ? {
          vendorQty: editingItem.vendorQty,
          shipmentMethod: editingItem.shipmentMethod,
          needByDate: editingItem.needByDate,
          promisedShipDate: editingItem.promisedShipDate,
          inboundLocation: editingItem.inboundLocation,
          oneTimeAdjustments: lineOneTimeAdjustmentsFor(po, editingItem.id),
        } : null}
        readOnlyAdjustments={!canEdit}
        onComplete={(result: OrderFlowResult) => {
          if (editingItem) {
            persistLineOneTimes(editingItem, result);
            updateLineItem(po.id, editingItem.id, {
              vendorQty: result.vendorQty,
              quantity: result.quantity,
              unitPrice: result.unitPrice,
              discount: result.discount,
              needByDate: result.needByDate,
              promisedShipDate: result.promisedShipDate,
              expectedDeliveryDate: result.expectedDeliveryDate,
              shipmentMethod: result.shipmentMethod,
              inboundLocation: result.inboundLocation,
            });
          }
        }}
        renderNotesTab={editingItem ? (
          <PONotesSection
            poId={po.id}
            lineItemId={editingItem.id}
            allNotes={po.poNotes}
            canEdit={canEdit}
            asCollapsible={false}
            onNoteChange={(action, noteType) => {
              const tag = `Notes ${noteType === "vendor" ? "(Vendor)" : "(Internal)"}`;
              guardEdit(() => {}, tag, {
                type: "config-changed",
                action: action === "added" ? "Added" : action === "edited" ? "Changed" : "Removed",
                subject: `Notes Change: ${action} ${noteType} note on ${editingItem.itemNumber}`,
              });
            }}
          />
        ) : undefined}
        notesCount={editingItem ? po.poNotes.filter(n => n.lineItemId === editingItem.id).length : 0}
      />

      {/* ── View Line Item — OrderFlow modal (view-only mode, reuses edit-po) ── */}
      <OrderFlow
        open={viewOpen}
        onOpenChange={setViewOpen}
        item={viewingItem ? poLineItemToOrderFlowItem(viewingItem, po.vendor.name) : null}
        mode="edit-po"
        poId={po.id}
        lineItemId={viewingItem?.id}
        prefill={viewingItem ? {
          vendorQty: viewingItem.vendorQty,
          shipmentMethod: viewingItem.shipmentMethod,
          needByDate: viewingItem.needByDate,
          promisedShipDate: viewingItem.promisedShipDate,
          inboundLocation: viewingItem.inboundLocation,
          oneTimeAdjustments: lineOneTimeAdjustmentsFor(po, viewingItem.id),
        } : null}
        readOnlyAdjustments={!canEdit}
        onComplete={(result: OrderFlowResult) => {
          if (viewingItem) persistLineOneTimes(viewingItem, result);
          setViewOpen(false);
        }}
        renderNotesTab={viewingItem ? (
          <PONotesSection
            poId={po.id}
            lineItemId={viewingItem.id}
            allNotes={po.poNotes}
            canEdit={canEdit}
            asCollapsible={false}
            onNoteChange={(action, noteType) => {
              const tag = `Notes ${noteType === "vendor" ? "(Vendor)" : "(Internal)"}`;
              guardEdit(() => {}, tag, {
                type: "config-changed",
                action: action === "added" ? "Added" : action === "edited" ? "Changed" : "Removed",
                subject: `Notes Change: ${action} ${noteType} note on ${viewingItem.itemNumber}`,
              });
            }}
          />
        ) : undefined}
        notesCount={viewingItem ? po.poNotes.filter(n => n.lineItemId === viewingItem.id).length : 0}
      />

      <Dialog open={receivingOpen} onOpenChange={setReceivingOpen}>
        <DialogContent className="sm:max-w-[640px] p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col" style={{ fontFamily: FONT }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border shrink-0">
            <div className="flex items-center justify-center size-10 rounded-[var(--radius-md)] bg-primary/8 shrink-0">
              <PackageOpen className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle style={{ ...st.fieldValueBold, fontSize: "var(--text-label)" }} className="text-foreground">
                Record Goods Receipt
              </DialogTitle>
              <DialogDescription style={st.uiSmall} className="text-muted-foreground mt-0.5">
                Enter the quantity received for each line item in this shipment.
              </DialogDescription>
            </div>
          </div>

          {/* Line items receiving form */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {po.lineItems.map((li) => {
              const remaining = li.quantity - li.receivedQuantity;
              const isAlreadyFull = remaining <= 0;
              const serializedLineItem = isSerializedLineItem(li);
              return (
                <div key={li.id} className={`rounded-[var(--radius-md)] border border-border p-3 flex flex-col gap-2.5 ${isAlreadyFull ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="shrink-0 w-10 h-10 rounded-[var(--radius-sm)] overflow-hidden border border-border bg-secondary">
                      <ImageWithFallback src={li.image} alt={li.descriptiveName} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-foreground" style={st.fieldValueBold}>{li.itemNumber}</span>
                        {isAlreadyFull && (
                          <span className="inline-flex items-center gap-0.5 text-accent" style={st.tiny}>
                            <Check className="size-3" /> Fully Received
                          </span>
                        )}
                      </div>
                      <span className="text-foreground/45 block truncate" style={st.tiny}>
                        Ordered: {li.quantity} {li.defaultUOM}s &middot; Received: {li.receivedQuantity} &middot; Remaining: {remaining}
                      </span>
                    </div>
                  </div>

                  {!isAlreadyFull && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-muted-foreground" style={st.fieldLabel}>Qty Received</Label>
                        <Input
                          type="text"
                          inputMode={serializedLineItem ? "numeric" : "decimal"}
                          value={receivingQtyInputs[li.id] ?? formatQuantityValue(receivingQtys[li.id] || 0, serializedLineItem)}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (!isValidQuantityDraft(raw, serializedLineItem)) return;

                            setReceivingQtyInputs((p) => ({ ...p, [li.id]: raw }));
                            setReceivingQtys((p) => ({
                              ...p,
                              [li.id]: Math.min(remaining, getDraftQuantityValue(raw, serializedLineItem)),
                            }));
                          }}
                          onKeyDown={(e) => {
                            preventInvalidQuantityKey(e, serializedLineItem);
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                          onBlur={() => {
                            const parsed = Math.min(remaining, parseQuantityDraft(receivingQtyInputs[li.id] ?? "", serializedLineItem) ?? 0);
                            setReceivingQtys((p) => ({ ...p, [li.id]: parsed }));
                            setReceivingQtyInputs((p) => ({ ...p, [li.id]: formatQuantityValue(parsed, serializedLineItem) }));
                          }}
                          onFocus={(e) => (e.target as HTMLInputElement).select()}
                          className="h-8"
                          style={st.fieldValue}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-muted-foreground" style={st.fieldLabel}>Condition</Label>
                        <Select
                          value={receivingConditions[li.id] || "good"}
                          onValueChange={(v) => setReceivingConditions((p) => ({ ...p, [li.id]: v as "good" | "damaged" | "rejected" }))}
                        >
                          <SelectTrigger className="h-8 w-full" style={st.fieldValue}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good" style={st.uiSmall}>Good</SelectItem>
                            <SelectItem value="damaged" style={st.uiSmall}>Damaged</SelectItem>
                            <SelectItem value="rejected" style={st.uiSmall}>Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-muted-foreground" style={st.fieldLabel}>Notes</Label>
                        <Input
                          type="text"
                          placeholder="Optional"
                          value={receivingNotes[li.id] || ""}
                          onChange={(e) => setReceivingNotes((p) => ({ ...p, [li.id]: e.target.value }))}
                          className="h-8"
                          style={st.fieldValue}
                        />
                      </div>
                    </div>
                  )}

                  {/* Quick fill button */}
                  {!isAlreadyFull && remaining > 0 && (
                    <button
                      className="self-start flex items-center gap-1 text-primary cursor-pointer hover:underline"
                      style={st.tiny}
                      onClick={() => {
                        setReceivingQtys((p) => ({ ...p, [li.id]: remaining }));
                        setReceivingQtyInputs((p) => ({ ...p, [li.id]: formatQuantityValue(remaining, serializedLineItem) }));
                      }}
                    >
                      <Check className="size-3" /> Receive all {remaining}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-secondary shrink-0">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="size-3.5 text-chart-3" />
              <span className="text-foreground/50" style={st.tiny}>
                {Object.values(receivingQtys).filter((q) => q > 0).length} of {po.lineItems.filter((li) => li.receivedQuantity < li.quantity).length} items to receive
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3" style={st.uiLabel} onClick={() => setReceivingOpen(false)}>
                <X className="size-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 px-4"
                style={st.uiLabel}
                disabled={Object.values(receivingQtys).every((q) => q <= 0)}
                onClick={() => {
                  const records = po.lineItems
                    .filter((li) => (receivingQtys[li.id] || 0) > 0)
                    .map((li) => ({
                      lineItemId: li.id,
                      quantityReceived: receivingQtys[li.id] || 0,
                      condition: receivingConditions[li.id] || "good" as const,
                      notes: receivingNotes[li.id] || "",
                    }));
                  recordReceiving(po.id, records);
                  setReceivingOpen(false);
                }}
              >
                <Clipboard className="size-3.5" />
                Confirm Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Point of Contact picker — full POC directory table ported from
           Partners' Vendor Detail → Point of Contact tab → All POCs sub-tab.
           Shell mirrors `BrowsePaymentTermsModal` (Full view toggle, X close,
           header + body + footer). The primary contact (`po.recipient.name`)
           is locked and stays applied; selected POCs from the table become
           the new secondary contact set. ── */}
      <SelectPOCsModal
        open={vendorContactOpen}
        onOpenChange={setVendorContactOpen}
        initialSelectedNames={[po.recipient.name, ...po.secondaryContactNames]}
        lockedNames={[po.recipient.name]}
        onApply={(picked) => {
          const prevSecondaries = new Set(po.secondaryContactNames);
          // Drop the primary out of the picked set (defensive — `lockedNames`
          // already keeps it merged) and persist whatever remains as the new
          // secondary contact list.
          const newSecondaryNames = picked
            .map((c) => c.name)
            .filter((n) => n !== po.recipient.name);
          updatePOContacts(po.id, po.recipient, newSecondaryNames);

          // Change log — record adds and removes against the prior secondary
          // contact list so the version history reads as a contact change.
          if (editingSession?.confirmed) {
            const added = newSecondaryNames.filter((n) => !prevSecondaries.has(n));
            const removed = Array.from(prevSecondaries).filter((n) => !newSecondaryNames.includes(n));
            if (added.length > 0) {
              recordChangeDetail("Contact Change", {
                type: "vendor-changed",
                action: "Added",
                subject: "Secondary Contact",
                detail: added.join(", "),
              });
            }
            if (removed.length > 0) {
              recordChangeDetail("Contact Change", {
                type: "vendor-changed",
                action: "Removed",
                subject: "Secondary Contact",
                detail: removed.join(", "),
              });
            }
          }
        }}
      />

      {/* ── Payment Terms — Browse Templates modal, ported from the
           Partners app's "Explore Presets" picker. Search + NET/Pre/
           Split type tabs + status FilterPills + sort popover + card
           grid + nested PaymentTermDetailModal. Picks store the term
           name so the existing payment store shape is unchanged. ── */}
      <BrowsePaymentTermsModal
        open={paymentEditOpen}
        onOpenChange={setPaymentEditOpen}
        selectedId={
          PAYMENT_TERM_PRESETS.find((t) => t.name === po.payment.paymentTerms)
            ?.id ?? null
        }
        onSelect={(term) => {
          const oldVal = po.payment.paymentTerms;
          updatePOPayment(po.id, { ...po.payment, paymentTerms: term.name });
          if (oldVal !== term.name && editingSession?.confirmed) {
            recordChangeDetail("Payment Terms Change", {
              type: "config-changed",
              action: "Changed",
              subject: "Payment Terms",
              detail: `${oldVal} → ${term.name}`,
            });
          }
        }}
      />

      {/* ── Payment Method Selection Modal — swapped 2026-06 to the
            new Payment-Terms-shell-based picker. Same `onConfirm`
            payload (bankName string) so the sidebar's
            `resolvePaymentMethodByName` continues to render the
            saved-method card without changes. ── */}
      <SelectPaymentMethodModal
        open={paymentMethodOpen}
        onOpenChange={setPaymentMethodOpen}
        currentMethod={po.payment.paymentMethod}
        onConfirm={(methodName) => {
          const oldVal = po.payment.paymentMethod;
          updatePOPayment(po.id, { ...po.payment, paymentMethod: methodName });
          if (oldVal !== methodName && editingSession?.confirmed) {
            recordChangeDetail("Payment Method Change", { type: "config-changed", action: "Changed", subject: "Payment Method", detail: `${oldVal} → ${methodName}` });
          }
        }}
      />

      {/* ── Save Version confirmation modal —
           opens before `handleSaveVersion()` so the buyer can review the
           itemised change list (Partners' "Changes you made" pattern). ── */}
      <POVersionSaveModal
        open={saveVersionModalOpen}
        onOpenChange={setSaveVersionModalOpen}
        poNumber={po.poNumber}
        nextVersion={(po.currentVersion || 1) + 1}
        changes={editingSession?.changeDetails ?? []}
        onConfirm={handleSaveVersion}
      />

      {/* ── Vendor Selection Dialogs (Pay To / Ship To / Funded By) ──
          All three use the Partners-aligned SelectPartnerLocationDialog.
          Pay To and Funded By are partner-level only (no locations,
          ERP-4790); Funded By leads with Our Company (the tenant default).
          Heading icon + tint per section match each card's identity:
            • Pay To    → Receipt, violet wash
            • Ship To   → Truck,   emerald wash
            • Funded By → Landmark, amber wash
      */}
      <SelectPartnerLocationDialog
        open={payToDialogOpen}
        onOpenChange={setPayToDialogOpen}
        partnersOnly
        searchPlaceholder="Search partners..."
        selectedId={
          PARTNER_LOCATION_ITEMS.find((i) => i.name === po.payment.payTo)
            ?.id ?? null
        }
        config={{
          icon: <Receipt className="w-4 h-4" style={{ color: "#8B5CF6" }} />,
          iconBg: "#F5F3FF",
          title: "Select Pay To",
          description: "Choose payment recipient",
        }}
        onSelect={(item) => {
          const oldVal = po.payment.payTo;
          updatePOPayment(po.id, { ...po.payment, payTo: item.name });
          if (oldVal !== item.name && editingSession?.confirmed) {
            recordChangeDetail("Billing Change", {
              type: "config-changed",
              action: "Changed",
              subject: "Pay To",
              detail: `${oldVal} → ${item.name}`,
            });
          }
        }}
      />
      {/* Ship To uses the Partners-aligned searchable accordion picker
          (partner + nested locations) so the PO Detail flow matches the
          configure-vendor experience users already know. Selection is
          stored as the chosen item's display name so the existing
          payment-store shape stays unchanged. */}
      <SelectPartnerLocationDialog
        open={shipToDialogOpen}
        onOpenChange={setShipToDialogOpen}
        selectedId={
          PARTNER_LOCATION_ITEMS.find((i) => i.name === po.payment.shippedTo)
            ?.id ?? null
        }
        onSelect={(item) => {
          const oldVal = po.payment.shippedTo;
          updatePOPayment(po.id, { ...po.payment, shippedTo: item.name });
          if (oldVal !== item.name && editingSession?.confirmed) {
            recordChangeDetail("Shipping Change", {
              type: "config-changed",
              action: "Changed",
              subject: "Ship To",
              detail: `${oldVal} → ${item.name}`,
            });
          }
        }}
      />
      <SelectPartnerLocationDialog
        open={fundedByDialogOpen}
        onOpenChange={setFundedByDialogOpen}
        partnersOnly
        searchPlaceholder="Search company & partners..."
        items={FUNDED_BY_PICKER_ITEMS}
        selectedId={
          FUNDED_BY_PICKER_ITEMS.find((i) => i.name === po.payment.fundedBy)
            ?.id ?? null
        }
        config={{
          icon: <Landmark className="w-4 h-4" style={{ color: "#F59E0B" }} />,
          iconBg: "#FFFBEB",
          title: "Select Funded By",
          description: "Choose funding source",
        }}
        onSelect={(item) => {
          const oldVal = po.payment.fundedBy;
          updatePOPayment(po.id, { ...po.payment, fundedBy: item.name });
          if (oldVal !== item.name && editingSession?.confirmed) {
            recordChangeDetail("Funding Change", {
              type: "config-changed",
              action: "Changed",
              subject: "Funded By",
              detail: `${oldVal} → ${item.name}`,
            });
          }
        }}
      />

      {/* ── Duplicate PO Dialog — user picks source version + vendor,
             confirm hands off to the animated overlay which plays before
             the real `duplicatePO` mutation + navigation. The
             "View details" button inside the Version section opens
             POVersionHistoryModal on top; closing it lands the buyer
             back on the Duplicate dialog with selection intact. */}
      <DuplicatePODialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        po={po}
        sourceVersion={duplicateSourceVersion}
        onSourceVersionChange={setDuplicateSourceVersion}
        onConfirm={({ sourceVersion, vendor }) => {
          setDuplicateDialogOpen(false);
          poTransitions.startDuplicate(po, {
            sourceVersion: sourceVersion !== po.currentVersion ? sourceVersion : undefined,
            vendor,
            /* Tag the navigation with `fromDuplicate` so the back
               button on the new draft goes straight to the listing
               (skips the source PO in the history stack). */
            onDone: (created) => navigate(`/purchase-orders/${created.id}`, { state: { fromDuplicate: true } }),
          });
        }}
        onViewDetails={(version) => {
          /* Sync the picked version to the shared source-version state
             so the Version History modal opens on that exact row (via
             `initialSelectedVersion`). Then open the modal. */
          setDuplicateSourceVersion(version);
          setDuplicateViewDetailsOpen(true);
        }}
      />

      {/* Version History modal, launched from the Duplicate dialog's
          "View details" affordance. Layers over the Duplicate modal
          without dismissing it (Radix Dialog handles nested stacks).
          Runs in duplicate-source-picker mode: the timeline opens on
          the currently-picked version, and the detail pane exposes a
          "Use V{n} for duplicate" button that syncs selection back to
          the Duplicate dialog and closes this modal. */}
      <POVersionHistoryModal
        poId={duplicateViewDetailsOpen ? po.id : null}
        poNumber={po.poNumber}
        onClose={() => setDuplicateViewDetailsOpen(false)}
        initialSelectedVersion={duplicateSourceVersion}
        onSelectForDuplicate={(v) => {
          setDuplicateSourceVersion(v);
          setDuplicateViewDetailsOpen(false);
        }}
      />

      {/* Revert confirmation modal for the header POVersionDropdown's
          hover-revealed revert button (buyer 2026-07-22). Shares the
          same SO-style destructive chrome as the Version History tab's
          revert flow. */}
      {dropdownRevertVersion !== null && (
        <POVersionRevertModal
          version={dropdownRevertVersion}
          snapshot={po.versions.find((v) => v.version === dropdownRevertVersion)?.snapshot}
          onClose={() => setDropdownRevertVersion(null)}
          onConfirm={(reason) => {
            const target = dropdownRevertVersion;
            const restored = revertPOToVersion(
              po.id,
              target,
              reason || `Reverted to Version ${target}`,
            );
            if (restored) {
              setViewingVersion(null);
              toast.success(`Reverted to Version ${target}`, {
                description: `V${target} is now the current version.`,
                style: { fontFamily: FONT },
              });
            }
            setDropdownRevertVersion(null);
          }}
        />
      )}

      {/* SO-parity animated overlay — mounted at page root so it stays
          visible while the URL changes on `onDone`. */}
      <StateTransitionOverlay
        isActive={poTransitions.overlay !== null}
        fromLabel={poTransitions.overlay?.fromLabel ?? ""}
        toLabel={poTransitions.overlay?.toLabel ?? ""}
        tone={poTransitions.overlay?.tone}
        Icon={poTransitions.overlay?.Icon}
        heading={poTransitions.overlay?.heading}
        meta={poTransitions.overlay?.meta}
        onComplete={poTransitions.onOverlayComplete}
      />

      {/* ── Cancel PO / Cancel remaining Window (ERP-4799) ──
          Glow-header chrome (POActionDialog). Reason dropdown + optional
          notes. "Cancel PO" is never disabled; a missing reason shows
          "Select a reason" on click (Eli's rule). */}
      <POActionDialog
        open={cancelPOOpen}
        onOpenChange={setCancelPOOpen}
        tone="red"
        icon={AlertTriangle}
        chipLabel={cancelPOMode === "remaining" ? "Cancel Remaining" : "Cancel PO"}
        title={cancelPOMode === "remaining" ? `Cancel remaining items on PO ${po.poNumber}?` : `Cancel PO ${po.poNumber}?`}
        description={cancelPOMode === "remaining"
          ? "Anything not yet received is cancelled and the vendor is notified. What arrived stays on the PO, and the PO moves to Closed with Cancellations."
          : "This removes all quantities from On Order and notifies the vendor. You can reactivate it later."}
        primaryLabel={cancelPOMode === "remaining" ? "Cancel remaining" : "Cancel PO"}
        secondaryLabel="Keep PO"
        onPrimary={() => {
          /* Reason is optional for Cancel remaining (ERP-4799). */
          const result = cancelPOReason.validate({ optional: cancelPOMode === "remaining" });
          if (!result) return;
          setCancelPOOpen(false);
          if (cancelPOMode === "remaining") {
            cancelRemaining(po.id, result.reason || undefined, result.notes);
            toast.success("Remaining items cancelled", { description: `PO ${po.poNumber} is Closed with Cancellations`, style: { fontFamily: FONT } });
          } else {
            cancelPO(po.id, result.reason, result.notes);
            toast.success("Purchase Order cancelled", { description: `PO ${po.poNumber} has been cancelled`, style: { fontFamily: FONT } });
          }
        }}
      >
        <CancelReasonFields state={cancelPOReason} optional={cancelPOMode === "remaining"} />
      </POActionDialog>

      {/* ── Print / Download PO preview ── */}
      <PODocumentPreviewDialog
        open={docPreview !== null}
        onOpenChange={(o) => { if (!o) setDocPreview(null); }}
        mode={docPreview ?? "print"}
        po={po}
        version={selectedPrintVersion}
      />

      {/* ── Archive PO Window ── */}
      <ArchivePODialog
        open={archivePOOpen}
        onOpenChange={setArchivePOOpen}
        poNumber={po.poNumber}
        status={po.status}
        onConfirm={(reason, notes) => {
          const cancels = ARCHIVE_CANCELS_STATUSES.has(po.status);
          archivePO(po.id, reason, notes);
          toast.success(`PO ${po.poNumber} archived`, {
            description: cancels ? "PO cancelled and vendor notified" : "Moved out of your active list",
            style: { fontFamily: FONT },
          });
        }}
      />

      {/* ── Inactive-item warning (non-blocking) ──
            Shown when a Draft containing inactive line items is sent or
            confirmed. The buyer can go back or proceed — it never blocks. */}
      <POInactiveItemsWarningModal
        open={!!inactiveWarning}
        mode={inactiveWarning?.mode ?? "send"}
        lines={po.lineItems.filter((li) => li.inactive && !li.cancelled)}
        onClose={() => setInactiveWarning(null)}
        onConfirm={() => {
          const pending = inactiveWarning;
          setInactiveWarning(null);
          pending?.run();
        }}
      />

      {/* ── Reactivate PO Dialog ── glow-header chrome; never disabled. */}
      <POActionDialog
        open={reactivatePOOpen}
        onOpenChange={setReactivatePOOpen}
        tone="blue"
        icon={ArrowLeft}
        chipLabel="Reactivate PO"
        title={`Reactivate PO ${po.poNumber}?`}
        description={`This restores the PO to its previous state: ${po.preCancellationStatus || "Draft"}.`}
        primaryLabel="Reactivate PO"
        secondaryLabel="Keep Cancelled"
        onPrimary={() => {
          if (!reactivateReason.trim()) { setReactivateError(true); return; }
          reactivatePO(po.id, reactivateReason.trim());
          setReactivatePOOpen(false);
          toast.success("Purchase Order reactivated", { description: `PO ${po.poNumber} has been restored`, style: { fontFamily: FONT } });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" style={st.fieldLabel}>Reactivation Reason *</Label>
          <textarea
            className="w-full rounded-[var(--radius-md)] border border-border px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            rows={3}
            placeholder="Provide a reason for reactivation..."
            value={reactivateReason}
            onChange={(e) => { setReactivateReason(e.target.value); setReactivateError(false); }}
            style={{ ...st.fieldValue, ...(reactivateError ? { borderColor: "hsl(var(--destructive))" } : {}) }}
          />
          {reactivateError && (
            <span style={{ ...st.uiSmall, color: "hsl(var(--destructive))" }} role="alert">Enter a reason</span>
          )}
        </div>
      </POActionDialog>

      {/* ── Cancel Line Item Confirmation Dialog ── glow-header chrome,
          same reason dropdown as Cancel PO; never disabled. */}
      <POActionDialog
        open={!!cancelLineItemId}
        onOpenChange={(open) => { if (!open) setCancelLineItemId(null); }}
        tone="red"
        icon={X}
        chipLabel="Cancel Item"
        title={`Cancel ${po.lineItems.find((li) => li.id === cancelLineItemId)?.itemNumber ?? "item"}?`}
        description={isVersionLocked
          ? "Receiving has started, so this PO is locked to its current version. The line stays on the PO struck through, keeps its line number, and is excluded from the order total."
          : `This item will be removed from the PO and a new version (V${(po.currentVersion || 1) + 1}) will be created and returned to Draft for re-sending.`}
        primaryLabel="Cancel Item"
        secondaryLabel="Keep Item"
        onPrimary={() => {
          const result = cancelLineReason.validate();
          if (!result || !cancelLineItemId) return;
          const newVer = cancelLineItem(
            po.id,
            cancelLineItemId,
            result.notes ? `${result.reason} — ${result.notes}` : result.reason,
          );
          setCancelLineItemId(null);
          toast.success(
            newVer ? `Line item removed — Version ${newVer} created` : "Line item cancelled",
            { description: newVer ? "PO returned to Draft" : undefined, style: { fontFamily: FONT } },
          );

          // Check if all items are now cancelled
          const updatedPo = getPO(po.id);
          if (updatedPo && updatedPo.lineItems.every((li) => li.cancelled)) {
            setAllCancelledPromptOpen(true);
          }
        }}
      >
        <CancelReasonFields state={cancelLineReason} />
      </POActionDialog>

      {/* ── All Items Cancelled Prompt ── glow-header chrome. */}
      <POActionDialog
        open={allCancelledPromptOpen}
        onOpenChange={setAllCancelledPromptOpen}
        tone="red"
        icon={AlertTriangle}
        chipLabel="All Items Cancelled"
        title="Cancel the entire PO?"
        description="All line items are now cancelled. Do you want to cancel the entire Purchase Order?"
        primaryLabel="Cancel Entire PO"
        secondaryLabel="Keep PO"
        onPrimary={() => {
          cancelPO(po.id, "All line items cancelled");
          setAllCancelledPromptOpen(false);
          toast.success("Purchase Order cancelled", { description: "All items were cancelled", style: { fontFamily: FONT } });
        }}
      />

      {/* ── Version Confirm Modal ── */}
      <Dialog open={showVersionConfirmModal} onOpenChange={(open) => { if (!open) { setShowVersionConfirmModal(false); setPendingEditAction(null); } }}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
            <div className="flex items-center justify-center size-10 rounded-[var(--radius-md)] shrink-0" style={{ backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 12%, transparent)" }}>
              <AlertTriangle className="size-5" style={{ color: "hsl(var(--warning))" }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle style={{ ...st.fieldValueBold, fontSize: "var(--text-label)" }} className="text-foreground">
                This will create a new version
              </DialogTitle>
              <DialogDescription style={st.uiSmall} className="text-muted-foreground mt-0.5">
                You are editing PO {po.poNumber} which is currently in <Badge variant="outline" className="mx-0.5 text-[10px] px-1.5 py-0">{po.status}</Badge> state. Saving these changes will create Version {(po.currentVersion || 1) + 1} and return this PO to Draft state. You will need to resend it to the vendor for confirmation.
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/30">
            <Button variant="outline" size="sm" className="h-8 px-3" style={st.uiLabel} onClick={() => { setShowVersionConfirmModal(false); setPendingEditAction(null); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 px-4"
              style={st.uiLabel}
              onClick={() => {
                const snapshot = buildVersionSnapshot(po);
                const tag = pendingEditAction?.tag;
                const action = pendingEditAction?.action;
                const cd = pendingEditAction?.changeDetail;
                const initDetail: ChangeDetail | undefined = (tag && cd)
                  ? { ...cd, tag }
                  : undefined;
                setEditingSession({
                  confirmed: true,
                  changeTags: tag ? new Set([tag]) : new Set(),
                  changeCount: initDetail ? 1 : 0,
                  changeDetails: initDetail ? [initDetail] : [],
                  snapshot,
                });
                setShowVersionConfirmModal(false);
                setPendingEditAction(null);
                if (action) action();
              }}
            >
              Continue Editing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TransitionOverlay
        visible={transitionOverlay.visible}
        fromStatus={transitionOverlay.fromStatus}
        toStatus={transitionOverlay.toStatus}
        duration={1200}
        onDismiss={dismissTransitionOverlay}
      />

      {/* ── Image Lightbox ── */}
      <ImageLightbox
        open={!!lightboxData}
        onClose={() => setLightboxData(null)}
        images={lightboxData?.images ?? []}
        partNumber={lightboxData?.partNumber ?? ""}
        itemName={lightboxData?.itemName ?? ""}
      />

      {/* ── QuickView item preview — same modal opened from the items catalog
              / listing thumbnail (`CatalogueModal` + `PurchaseOrdersListing`).
              Renders via portal at z-50, dismisses on outside click / Escape. */}
      <QuickViewPanel data={quickViewData} onClose={() => setQuickViewData(null)} />

      {/* ── Price confirmation prompt — fires when an inline edited price
              differs from (or is missing on) the master vendor-item record. ── */}
      {priceConfirmState.outcome && priceConfirmState.outcome.kind !== "silent" && (
        <PriceConfirmationDialog
          open={priceConfirmState.open}
          onOpenChange={(o) => setPriceConfirmState((s) => ({ ...s, open: o }))}
          scenario={priceConfirmState.outcome.kind === "save-as-default" ? "save-as-default" : "update-default"}
          vendorName={priceConfirmState.outcome.vendorName}
          unit={priceConfirmState.outcome.unit}
          enteredPrice={priceConfirmState.outcome.enteredPrice}
          existingDefaultPrice={
            priceConfirmState.outcome.kind === "update-default" ? priceConfirmState.outcome.existingDefaultPrice : undefined
          }
          onConfirmDefault={priceConfirmState.onConfirmDefault}
          onUseOnce={priceConfirmState.onUseOnce}
        />
      )}

      {/* ── Discard / unsaved-changes prompt — fires when the buyer
              clicks Back / browser-back / external CTA while the PO
              has uncommitted edits. Visual treatment lifted verbatim
              from the partner module so the prompt looks identical
              across surfaces. ── */}
      <PODiscardDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirmDiscard={() => {
          setDiscardOpen(false);
          const exit = pendingExitRef.current;
          pendingExitRef.current = null;
          // Reset dirty first so any final renders before navigation
          // don't re-trigger the prompt mid-transition.
          setDirty(false);
          if (exit) exit();
          else performBackNavigation();
        }}
      />

      {/* Outdated-configs review modal — the buyer picks which
          upstream (Partner Management) updates to sync into this
          Draft PO. Applying drops those ids from the mock pool so
          the header pill count decrements or disappears. */}
      <OutdatedConfigsModal
        open={showOutdatedConfigsModal}
        onOpenChange={setShowOutdatedConfigsModal}
        updates={outdatedUpdates}
        partnerName={po.vendor.name}
        onApply={(ids) => {
          if (!id) return;
          const appliedCount = ids.length;
          markOutdatedApplied(id, ids);
          setOutdatedUpdates(getOutdatedForId(id));
          setOutdatedBannerVisible(shouldShowOutdatedBanner(id));
          /* Play the amber sync overlay in place of a toast — same
             beat/shape as the state-transition overlay, themed to
             the outdated-configs palette. */
          setSyncOverlay({ visible: true, count: appliedCount });
        }}
        onIgnore={(ids) => {
          if (!id) return;
          markOutdatedIgnored(id, ids);
          setOutdatedUpdates(getOutdatedForId(id));
          setOutdatedBannerVisible(shouldShowOutdatedBanner(id));
        }}
      />

      {/* Sync animation — mirrors TransitionOverlay (draft→sent
          etc.) but in the amber palette that owns the outdated-
          configs flow. Auto-dismisses after 1.6s or on click. */}
      <OutdatedSyncOverlay
        visible={syncOverlay.visible}
        count={syncOverlay.count}
        partnerName={po.vendor.name}
        onDismiss={() => setSyncOverlay((s) => ({ ...s, visible: false }))}
      />

      {/* ── One-time discounts/premiums (ported from Sales Orders) ── */}
      <ManageAdjustmentsModal
        isOpen={adjustmentsManageOpen}
        onClose={() => setAdjustmentsManageOpen(false)}
        readOnly={!canEdit || !canOneTimeDiscounts}
        lines={po.lineItems}
        adjustmentsAPI={adjustmentsAPI}
        onMaterialEvent={handleAdjustmentEvent}
      />
      <AddOrderLevelAdjustmentModal
        isOpen={addOrderAdjustmentOpen}
        onClose={() => setAddOrderAdjustmentOpen(false)}
        adjustmentsAPI={adjustmentsAPI}
        onMaterialEvent={handleAdjustmentEvent}
      />

      {/* ── Pricing rules manage modal (buyer feedback 2026-07-20). Lets
          the buyer wholesale-toggle vendor pricing rules on/off for
          this PO and per-line-toggle rules on the applicable items.
          The store helpers write back to the po row so the sidebar
          block, hover breakdowns, and Order-Summary totals update
          together.

          After every toggle we invoke enforceHundredPercentCap: if the
          new activation set would push the PO subtotal below zero, the
          heaviest-impact discount rules are auto-deactivated with the
          `EXCEEDS_100_PERCENT` reason (buyer can't manually reactivate
          them until they edit the PO to make room). Mirrors SO's
          same-name enforcement in PricingRulesManageModal.tsx. */}
      {po && po.id && (() => {
        const runCapEnforcement = () => {
          if (!po || !po.id) return;
          const fresh = getPO(po.id);
          if (!fresh) return;
          const vendorRules = getVendorRules(fresh.vendor.name);
          if (vendorRules.length === 0) return;
          const activationMap = new Map<string, Set<string>>();
          const currentDeactivated = fresh.deactivatedRuleIds ?? {};
          for (const rule of vendorRules) {
            if (currentDeactivated[rule.id]) continue;
            const activeLines = new Set<string>();
            for (const li of fresh.lineItems) {
              if (!rule.appliesToItemCodes.includes(li.itemNumber)) continue;
              const explicit = li.activatedRuleIds;
              const isActive = explicit ? explicit.includes(rule.id) : true;
              if (isActive) activeLines.add(li.id);
            }
            if (activeLines.size > 0) activationMap.set(rule.id, activeLines);
          }
          const linesForCompute = fresh.lineItems.map((li) => ({
            id: li.id,
            itemCode: li.itemNumber,
            orderedQty: li.quantity,
            unitPrice: li.unitPrice * (1 - li.discount / 100),
          }));
          // Flat rule amounts (USD) in the PO's currency, as the totals take them.
          const flatAmountFactor = ruleAmountFactor(poFx(fresh));
          const enforced = enforceHundredPercentCap(
            linesForCompute,
            vendorRules,
            activationMap,
            flatAmountFactor,
          );
          /* Also drop enforced rules that are no longer needed (buyer
             toggled OFF a rule that had previously been auto-capped,
             freeing headroom). Recompute the subtotal without the
             cap and check if any EXCEEDS_100_PERCENT rules could
             now be re-enabled without breaching zero. */
          const remaining: Record<string, "USER_UNAPPLIED" | "EXCEEDS_100_PERCENT"> = {};
          for (const [rid, reason] of Object.entries(currentDeactivated)) {
            if (reason === "USER_UNAPPLIED") remaining[rid] = reason;
            /* Recheck EXCEEDS_100_PERCENT rules — if reactivating this
               rule keeps the subtotal >= 0, drop the cap tag. */
            if (reason === "EXCEEDS_100_PERCENT") {
              const tentative = new Map(activationMap);
              const rule = vendorRules.find((r) => r.id === rid);
              if (rule) {
                const activeLines = new Set<string>();
                for (const li of fresh.lineItems) {
                  if (!rule.appliesToItemCodes.includes(li.itemNumber)) continue;
                  const explicit = li.activatedRuleIds;
                  const isActive = explicit ? explicit.includes(rule.id) : true;
                  if (isActive) activeLines.add(li.id);
                }
                if (activeLines.size > 0) tentative.set(rid, activeLines);
              }
              const bd = computeLineBreakdowns(linesForCompute, vendorRules, tentative, flatAmountFactor);
              const totalWithRule = computePOSubtotal(bd);
              if (totalWithRule < 0) remaining[rid] = reason;
            }
          }
          for (const [rid, reason] of enforced) {
            remaining[rid] = reason;
          }
          /* Only write when the deactivation map actually differs
             from the current one to avoid an infinite subscribe/render
             loop. */
          const currentKeys = Object.keys(currentDeactivated).sort().join(",");
          const nextKeys = Object.keys(remaining).sort().join(",");
          const currentValues = Object.entries(currentDeactivated).sort().map(([k, v]) => `${k}:${v}`).join(",");
          const nextValues = Object.entries(remaining).sort().map(([k, v]) => `${k}:${v}`).join(",");
          if (currentKeys !== nextKeys || currentValues !== nextValues) {
            /* Apply the new full deactivation map in one shot by
               diffing against the current one — call updater once per
               changed rule. */
            for (const rid of Object.keys(currentDeactivated)) {
              if (!remaining[rid]) updatePORulingDeactivation(fresh.id, rid, null);
            }
            for (const [rid, reason] of Object.entries(remaining)) {
              if (currentDeactivated[rid] !== reason) {
                updatePORulingDeactivation(fresh.id, rid, reason);
              }
            }
          }
        };
        return (
          <POPricingRulesManageModal
            open={pricingRulesManageOpen}
            onOpenChange={setPricingRulesManageOpen}
            vendorName={po.vendor.name}
            lineItems={po.lineItems}
            deactivatedRuleIds={po.deactivatedRuleIds ?? {}}
            onCatalogChanged={() => { setPricingCatalogRev((n) => n + 1); recalcPOTotals(po.id); }}
            onToggleRule={(ruleId, nextActive) => {
              updatePORulingDeactivation(
                po.id,
                ruleId,
                nextActive ? null : "USER_UNAPPLIED",
              );
              runCapEnforcement();
            }}
            onToggleRuleForLine={(ruleId, lineId, nextActive) => {
              const li = po.lineItems.find((x) => x.id === lineId);
              if (!li) return;
              const current = li.activatedRuleIds;
              /* Materialise the current activation set. If unset, seed
                 from every vendor rule that could apply to this line. */
              let materialised: Set<string>;
              if (current) {
                materialised = new Set(current);
              } else {
                materialised = new Set<string>();
                for (const r of getVendorRules(po.vendor.name)) {
                  if (r.appliesToItemCodes.includes(li.itemNumber)) {
                    materialised.add(r.id);
                  }
                }
              }
              if (nextActive) materialised.add(ruleId);
              else materialised.delete(ruleId);
              updateLineItem(po.id, lineId, {
                activatedRuleIds: Array.from(materialised),
              });
              runCapEnforcement();
            }}
          />
        );
      })()}
    </div>
    </DocCurrencyProvider>
    </AppShell>
  );
}