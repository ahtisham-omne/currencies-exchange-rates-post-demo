import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
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
  AlertTriangle,
  Phone,
  Mail,
  Search,
  Star,
  Users,
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
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

/* ── Store ── */
import {
  getPO,
  subscribeToPOStore,
  updatePOStatus,
  updateLineItem,
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
  reactivatePO,
  cancelLineItem,
  recordPOVersion,
  revertPOToVersion,
  buildVersionSnapshot,
  restorePOFromSnapshot,
  getLineItemNoteCounts,
} from "./poStore";
import type { PurchaseOrderData, POStatus, POLineItem, POChangeRecord, POVersionEntry, POVersionSnapshot, PONoteType } from "./poStore";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import ItemsCatalogueModal from "./CatalogueModal";
import type { CatalogItem } from "./catalogData";
import { printPurchaseOrder } from "./PrintPurchaseOrder";
import { getVendorContacts, PAY_TO_VENDORS, SHIPPED_TO_VENDORS, FUNDED_BY_VENDORS, CATALOG } from "./catalogData";
import VendorSelectionDialog from "./VendorSelectionDialog";
import type { VendorSelection } from "./VendorSelectionDialog";
import PaymentTermsDialog from "./PaymentTermsDialog";
import PaymentMethodDialog from "./PaymentMethodDialog";
import { FONT } from "./designTokens";
import TransitionOverlay from "./TransitionOverlay";
import AppShell from "./layout/AppShell";
import {
  PX,
  PATTERN_C2_CONTENT,
} from "../../config/responsive-guidelines";
import {
  VendorInfoCard,
  CollapsibleSection,
} from "./POSidebarSections";
import PODetailTabs from "./PODetailTabs";
import OrderFlow from "./OrderFlow";
import type { OrderFlowItem, OrderFlowResult } from "./OrderFlow";
import TruncatedItemName from "./TruncatedItemName";
import BackButton from "./BackButton";
import ImageLightbox from "./ImageLightbox";
import POVersionHistoryTab from "./POVersionHistoryTab";
import POCompareFullScreen from "./POCompareFullScreen";
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
import type { POVersionEntry as POVersionEntryType } from "./poStore";
import { getItemImages } from "./catalogData";
import PONotesSection, { LineItemNoteIndicator } from "./PONotesSection";
import UserHoverCard from "./UserHoverCard";
import { POMoneyCell } from "./currency/POMoneyCell";
import { POCurrencyHeaderControls } from "./currency/POCurrencyHeaderControls";
import POCurrencyConfigModal from "./currency/POCurrencyConfigModal";
import { POLockedRateHelper } from "./currency/POLockedRateHelper";
import { poVendorCurrencyIsBase, getPOVendorCurrency } from "./poStore";
import { BASE_CURRENCY, convertBetween, getLibraryCurrency } from "@/app/data/currencyLibrary";

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

  stepLabel: {
    fontSize: "11px",
    fontWeight: "var(--font-weight-medium)" as string,
    lineHeight: "1.3",
    fontFamily: FONT,
  } as React.CSSProperties,

  stepLabelActive: {
    fontSize: "11px",
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

function StatusBadge({ status }: { status: POStatus }) {
  const isClosedWithCancellations = status === "Fully Received with Cancellations";
  return (
    <Badge
      variant="outline"
      className="rounded-[var(--radius-sm)] px-2.5 py-1 border-transparent gap-1.5"
      style={{ ...st.badgeMeta, ...(STATUS_INLINE[status] ?? STATUS_INLINE.Draft) }}
    >
      {status}
      {isClosedWithCancellations && (
        <span
          className="inline-block size-1.5 rounded-full shrink-0"
          style={{ backgroundColor: "var(--warning)" }}
        />
      )}
    </Badge>
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
    solid: "var(--muted-foreground)",
    tint: "color-mix(in srgb, var(--muted-foreground) 8%, transparent)",
    glow: "color-mix(in srgb, var(--muted-foreground) 14%, transparent)",
    label: "var(--muted-foreground)",
  },
  Sent: {
    solid: "var(--chart-4)",
    tint: "color-mix(in srgb, var(--chart-4) 10%, transparent)",
    glow: "color-mix(in srgb, var(--chart-4) 16%, transparent)",
    label: "var(--chart-4)",
  },
  Confirmed: {
    solid: "var(--primary)",
    tint: "color-mix(in srgb, var(--primary) 10%, transparent)",
    glow: "color-mix(in srgb, var(--primary) 16%, transparent)",
    label: "var(--primary)",
  },
  "Partially Received": {
    solid: "var(--warning)",
    tint: "color-mix(in srgb, var(--warning) 10%, transparent)",
    glow: "color-mix(in srgb, var(--warning) 14%, transparent)",
    label: "var(--warning)",
  },
  "Fully Received": {
    solid: "var(--accent)",
    tint: "color-mix(in srgb, var(--accent) 12%, transparent)",
    glow: "color-mix(in srgb, var(--accent) 16%, transparent)",
    label: "var(--accent)",
  },
  Cancelled: {
    solid: "var(--destructive)",
    tint: "color-mix(in srgb, var(--destructive) 10%, transparent)",
    glow: "color-mix(in srgb, var(--destructive) 14%, transparent)",
    label: "var(--destructive)",
  },
  "Active with Cancellations": {
    solid: "var(--warning)",
    tint: "color-mix(in srgb, var(--warning) 10%, transparent)",
    glow: "color-mix(in srgb, var(--warning) 14%, transparent)",
    label: "var(--warning)",
  },
  "Fully Received with Cancellations": {
    solid: "var(--accent)",
    tint: "color-mix(in srgb, var(--accent) 12%, transparent)",
    glow: "color-mix(in srgb, var(--accent) 16%, transparent)",
    label: "var(--accent)",
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
      background: `linear-gradient(90deg,
        color-mix(in srgb, var(--accent) 10%, transparent) 0%,
        color-mix(in srgb, var(--accent) 7%, transparent) 50%,
        color-mix(in srgb, var(--accent) 3%, transparent) 100%)`,
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
      background: `linear-gradient(180deg,
        color-mix(in srgb, var(--accent) 1%, transparent) 0%,
        color-mix(in srgb, var(--accent) 2%, transparent) 50%,
        color-mix(in srgb, var(--accent) 5%, transparent) 100%)`,
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

  // Map compound statuses to their base lifecycle position
  const effectiveStatus: POStatus = isCancelled
    ? (po?.preCancellationStatus || "Draft")
    : isActiveWithCancellations
    ? (po?.preCancellationStatus || "Confirmed")
    : isFullyReceivedWithCancellations
    ? "Fully Received"
    : currentStatus;

  const currentIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === effectiveStatus);

  const totalSteps = LIFECYCLE_STEPS.length;
  const allCompleted = effectiveStatus === "Fully Received" || isFullyReceivedWithCancellations;
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

        /* Simplified color logic:
           - Completed/passed → all green (accent)
           - Current active → its unique accent color
           - Future → gray */
        const greenSolid = "var(--accent)";
        const greenTint = "color-mix(in srgb, var(--accent) 12%, transparent)";
        const greenGlow = "color-mix(in srgb, var(--accent) 18%, transparent)";

        return (
          <div key={step.status} className="contents">
            {/* Circle + Label */}
            <div className="flex items-center gap-2 shrink-0">
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{
                  width: isCurrent ? 28 : isCompleted ? 24 : 22,
                  height: isCurrent ? 28 : isCompleted ? 24 : 22,
                  ...(isCompleted
                    ? {
                        backgroundColor: greenSolid,
                        boxShadow: `0 2px 6px ${greenTint}`,
                      }
                    : isCurrent
                    ? {
                        backgroundColor: activeColors.solid,
                        boxShadow: `0 0 0 4px ${activeColors.glow}, 0 2px 8px color-mix(in srgb, var(--foreground) 8%, transparent)`,
                      }
                    : {
                        backgroundColor: "transparent",
                        border: "2px solid var(--border)",
                      }),
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                {isCompleted ? (
                  <Check className="size-3" style={{ color: "var(--primary-foreground)", strokeWidth: 3 }} />
                ) : isCurrent ? (
                  <StepIcon className="size-3.5" style={{ color: "var(--primary-foreground)", strokeWidth: 2.5 }} />
                ) : (
                  <StepIcon className="size-3" style={{ color: "var(--muted-foreground)", opacity: 0.35, strokeWidth: 2 }} />
                )}
              </div>

              <span
                className="hidden sm:block whitespace-nowrap"
                style={{
                  ...(isCompleted
                    ? { ...st.stepLabelActive, color: greenSolid }
                    : isCurrent
                    ? { ...st.stepLabelActive, color: "var(--foreground)" }
                    : { ...st.stepLabel, color: "var(--muted-foreground)", opacity: 0.5 }),
                  transition: "all 0.3s ease",
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div className="flex-1 mx-2.5 lg:mx-3.5 min-w-[12px] relative" style={{ height: 4 }}>
                {idx < currentIndex - 1 || (allCompleted && idx < totalSteps - 1) ? (
                  /* Between two completed steps: solid green */
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundColor: greenSolid,
                      height: 2.5,
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                  />
                ) : idx === currentIndex - 1 && !allCompleted ? (
                  /* Last completed → current: solid green */
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      backgroundColor: greenSolid,
                      height: 2.5,
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
                      backgroundColor: "var(--border)",
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
                      backgroundColor: "var(--border)",
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

function TabPlaceholderPanel({
  icon: Icon,
  title,
  description,
  count,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  count: number;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] bg-primary/8">
            <Icon className="size-3.5 text-primary" />
          </div>
          <span className="text-foreground" style={st.sectionHeading}>{title}</span>
          <span
            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-[var(--radius-sm)] bg-secondary text-muted-foreground"
            style={st.tiny}
          >
            {count}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="flex items-center justify-center size-12 rounded-full bg-secondary">
          <Icon className="size-5 text-foreground/20" />
        </div>
        <div className="text-center max-w-[320px]">
          <span className="text-foreground/40 block" style={st.fieldValue}>{title}</span>
          <span className="text-muted-foreground block mt-1" style={st.uiSmall}>
            {description}
          </span>
        </div>
      </div>
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

  const detailCount = [
    mockStockData.belowMin,
    mockStockData.shortageDate,
    mockStockData.attachments > 0,
    item.shipmentMethod,
    item.dueDeliveryDate,
  ].filter(Boolean).length;

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-border overflow-hidden transition-all duration-150 group hover:shadow-[var(--elevation-sm)]"
      style={{ backgroundColor: "var(--card)", marginBottom: "8px", fontFamily: FONT }}
    >
      {/* ── Main row ── */}
      <div
        className="flex items-start gap-3 px-3 py-2.5"
      >
        {/* 1. Thumbnail — square 72×72 */}
        <div
          className="relative shrink-0 w-[72px] h-[72px] min-w-[72px] min-h-[72px] rounded-[var(--radius-md)] overflow-hidden cursor-pointer"
          style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}
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
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontSize: "8px", fontWeight: "var(--font-weight-semibold)", lineHeight: "1", fontFamily: FONT }}
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
                style={{ backgroundColor: "var(--warning-tint)", color: "var(--warning)", fontSize: "9px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px", fontFamily: FONT }}
              >
                <AlertTriangle className="size-2.5" />
                Low Stock
              </span>
            )}
            {hasReceiving && !isFullyReceived && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0 rounded-[var(--radius-sm)] shrink-0"
                style={{ backgroundColor: "var(--primary-tint)", color: "var(--primary)", fontSize: "9px", fontWeight: "var(--font-weight-semibold)", lineHeight: "16px", fontFamily: FONT }}
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
              <span style={{ color: "var(--muted-foreground)" }}> — {item.description}</span>
            )}
          </span>

          {/* Price per unit + Quantity */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <div className="flex items-baseline gap-1">
              <span className="text-foreground" style={{ fontSize: "12px", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px", fontFamily: FONT }}>
                ${effectivePrice.toFixed(2)}
              </span>
              <span className="text-muted-foreground" style={{ fontSize: "10px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
                per {item.defaultUOM}
              </span>
            </div>
            <span style={{ color: "var(--border)" }}>·</span>
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
            ${item.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          {item.discount > 0 ? (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[var(--radius-sm)]"
              style={{ backgroundColor: "var(--success-tint)", color: "var(--success)", fontSize: "10px", fontWeight: "var(--font-weight-semibold)", lineHeight: "1", fontFamily: FONT }}
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
        style={{ borderTop: "1px solid var(--border)" }}
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
                <span style={{ color: "var(--foreground)", opacity: 0.3, fontFamily: FONT }}>—</span>
              )}
            </span>
            <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
              Shortage:{" "}
              {mockStockData.shortageDate ? (
                <span className="text-foreground" style={{ fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>{mockStockData.shortageDate}</span>
              ) : (
                <span style={{ color: "var(--foreground)", opacity: 0.3, fontFamily: FONT }}>—</span>
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

          {/* Shipment method, Due date */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <Truck className="size-2.5" style={{ color: "var(--muted-foreground)", opacity: 0.5 }} />
              <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
                {getShipmentMethodLabel(item.shipmentMethod)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <CalendarClock className="size-2.5" style={{ color: "var(--muted-foreground)", opacity: 0.5 }} />
              <span className="text-muted-foreground" style={{ fontSize: "11px", fontWeight: "var(--font-weight-normal)", lineHeight: "15px", fontFamily: FONT }}>
                Due <span className="text-foreground" style={{ fontWeight: "var(--font-weight-medium)", fontFamily: FONT }}>{item.dueDeliveryDate}</span>
              </span>
            </div>
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

function LineItemsPanel({
  po,
  canEdit,
  freeEdit,
  onRequestEditSession,
  onEditItem,
  onViewItem,
  onImageClick,
  onRemoveItem,
  onAddItems,
  onCancelItem,
  onUpdateQty,
  onUpdatePrice,
}: {
  po: PurchaseOrderData;
  canEdit: boolean;
  /** True when edits can proceed without version confirmation (Draft or active editing session) */
  freeEdit: boolean;
  /** Called when user tries to edit in a non-freeEdit state — triggers version confirmation modal */
  onRequestEditSession: (tag?: string) => void;
  onEditItem: (item: POLineItem) => void;
  /** Called when user clicks the row — opens Item Detail modal in view mode */
  onViewItem: (item: POLineItem) => void;
  onImageClick: (src: string) => void;
  onRemoveItem: (liId: string) => void;
  onAddItems: () => void;
  onCancelItem?: (liId: string) => void;
  onUpdateQty: (li: POLineItem, vendorQty: number, quantity: number) => void;
  onUpdatePrice: (li: POLineItem, unitPrice: number) => void;
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

  /* Inline price editing — stored in PKR (base); input reflects active viewMode */
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState<string>("");

  const poVendorCurrency = getPOVendorCurrency(po);
  const poVendorIsBase = poVendorCurrencyIsBase(po);
  const priceEditMode: "base" | "partner" =
    !poVendorIsBase && (po.viewMode ?? "base") === "partner" ? "partner" : "base";
  const priceEditCurrency = priceEditMode === "partner" ? poVendorCurrency : BASE_CURRENCY;
  const priceEditSymbol =
    getLibraryCurrency(priceEditCurrency)?.symbol ?? priceEditCurrency;

  const displayPriceInEditCurrency = (li: POLineItem): number => {
    const effectivePricePKR = li.unitPrice * (1 - li.discount / 100);
    if (priceEditMode === "base") return effectivePricePKR;
    if (li.lockedRate && li.lockedRate > 0) return effectivePricePKR / li.lockedRate;
    return convertBetween(effectivePricePKR, BASE_CURRENCY, priceEditCurrency);
  };

  const startPriceEdit = (li: POLineItem) => {
    setEditingPriceId(li.id);
    setEditingPriceValue(displayPriceInEditCurrency(li).toFixed(2));
  };

  const commitPriceEdit = (li: POLineItem) => {
    const parsed = parseFloat(editingPriceValue);
    const safeInputValue = Number.isFinite(parsed) && parsed > 0 ? parsed : displayPriceInEditCurrency(li);
    const valueInBase =
      priceEditMode === "base"
        ? safeInputValue
        : li.lockedRate && li.lockedRate > 0
          ? safeInputValue * li.lockedRate
          : convertBetween(safeInputValue, priceEditCurrency, BASE_CURRENCY);
    const newPrice = Math.max(0.01, valueInBase);
    onUpdatePrice(li, newPrice);
    setEditingPriceId(null);
  };

  const cancelPriceEdit = () => {
    setEditingPriceId(null);
  };

  /* Receiving state — show progress when PO is beyond Confirmed */
  const showReceiving = po.status === "Partially Received" || po.status === "Fully Received" || po.status === "Confirmed" || po.status === "Active with Cancellations" || po.status === "Fully Received with Cancellations";

  const totalUnits = po.lineItems.reduce((sum, li) => sum + li.quantity, 0);

  const COL_HEADER: React.CSSProperties = {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--font-weight-semibold)" as string,
    lineHeight: "16px",
    fontFamily: FONT,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: "var(--muted-foreground)",
  };

  /* Mock serialization — in production this comes from catalog */
  const isSerialized = isSerializedLineItem;

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card overflow-hidden">
      {/* ── Header / Summary Bar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] bg-primary/8">
            <ShoppingBag className="size-3.5 text-primary" />
          </div>
          <span className="text-foreground" style={st.sectionHeading}>Line Items</span>
          <span className="h-4 w-px bg-border mx-0.5" />
          <span className="text-muted-foreground" style={st.uiSmall}>
            <span className="text-foreground" style={{ fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>{po.lineItems.length}</span> items
          </span>
          <span className="text-muted-foreground" style={st.uiSmall}>&middot;</span>
          <span className="text-muted-foreground" style={st.uiSmall}>
            <span className="text-foreground" style={{ fontWeight: "var(--font-weight-semibold)", fontFamily: FONT }}>{totalUnits.toLocaleString()}</span> units
          </span>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary" style={st.uiLabel} onClick={() => {
            if (!freeEdit) { onRequestEditSession("Item Added"); return; }
            onAddItems();
          }}>
            <Plus className="size-3" /> Add Items
          </Button>
        )}
      </div>

      {/* ── Column Headers ── */}
      {po.lineItems.length > 0 && (
        <div
          className="grid items-center px-5 py-2 border-b border-border"
          style={{ gridTemplateColumns: showReceiving ? "1fr 100px 110px 110px 90px 72px" : "1fr 100px 110px 110px 72px", backgroundColor: "var(--secondary)" }}
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

        return (
          <div key={li.id} style={{ borderBottom: idx < po.lineItems.length - 1 ? "1px solid var(--border)" : undefined, opacity: isItemCancelled ? 0.5 : 1 }}>
            <div
              className="grid px-5 py-3 transition-colors cursor-pointer"
              style={{ gridTemplateColumns: showReceiving ? "1fr 100px 110px 110px 90px 72px" : "1fr 100px 110px 110px 72px", alignItems: "start" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--muted)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
              onClick={() => {
                const isInlineEditing = editingQtyId === li.id || editingPriceId === li.id;
                if (isInlineEditing) return;
                onViewItem(li);
              }}
            >
              {/* ── LINE ITEM column (contains both collapsed and expanded content) ── */}
              <div className="flex gap-3 min-w-0 pr-4">
                {/* Row number */}
                <span
                  className="text-muted-foreground shrink-0 w-[28px] text-right flex items-center justify-end"
                  style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-weight-normal)", lineHeight: "16px", fontFamily: FONT, opacity: 0.4, minHeight: "44px" }}
                >
                  {String(idx + 1).padStart(3, "0")}
                </span>

                {/* Square thumbnail — with image cycling when expanded */}
                <div
                  className="relative shrink-0 rounded-[var(--radius-md)] overflow-hidden cursor-pointer"
                  style={{ width: isExpanded ? 64 : 44, height: isExpanded ? 64 : 44, backgroundColor: "var(--secondary)", border: "1px solid var(--border)", transition: "width 0.15s, height 0.15s" }}
                  onClick={(e) => { e.stopPropagation(); onImageClick(li.image); }}
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
                  {/* Part number + serialization pill */}
                  <div className="flex items-center gap-2">
                    <span
                      className="text-foreground"
                      style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px", fontFamily: FONT, textDecoration: isItemCancelled ? "line-through" : undefined }}
                    >
                      {li.itemNumber}
                    </span>
                    {isItemCancelled && (
                      <span
                        className="inline-flex items-center px-1.5 py-0 rounded-[var(--radius-sm)] shrink-0"
                        style={{ backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)", color: "var(--destructive)", fontSize: "var(--text-3xs)", fontWeight: "var(--font-weight-semibold)" as string, lineHeight: "16px", fontFamily: FONT }}
                      >
                        Cancelled
                      </span>
                    )}
                    <span
                      className="inline-flex items-center px-1.5 py-0 rounded-[var(--radius-sm)] shrink-0"
                      style={{
                        backgroundColor: "var(--secondary)",
                        color: "var(--muted-foreground)",
                        fontSize: "var(--text-3xs)",
                        fontWeight: "var(--font-weight-semibold)" as string,
                        lineHeight: "16px",
                        fontFamily: FONT,
                      }}
                    >
                      {serialized ? "Serialized" : "Non-Serialized"}
                    </span>
                    {/* Note indicator */}
                    {(() => {
                      const nc = getLineItemNoteCounts(po.id, li.id);
                      return <LineItemNoteIndicator vendorCount={nc.vendor} internalCount={nc.internal} />;
                    })()}
                  </div>

                  {/* Item name with more/less */}
                  <TruncatedItemName
                    name={fullDescription}
                    maxChars={80}
                    style={{ fontSize: "var(--text-xs)", fontWeight: "var(--font-weight-normal)", lineHeight: "16px" }}
                    className="text-muted-foreground"
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
                      className={`w-[84px] h-7 px-1.5 text-right rounded-[var(--radius-sm)] border border-border bg-card text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors ${!freeEdit ? "cursor-pointer" : ""}`}
                      style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px", fontFamily: FONT }}
                    />
                    <span className="w-[84px] text-right" style={{ fontSize: "var(--text-3xs)", fontWeight: "var(--font-weight-medium)", lineHeight: "12px", fontFamily: FONT, color: "var(--muted-foreground)", textTransform: "uppercase" as const }}>
                      {li.vendorUOM}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className="text-foreground"
                      style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px", fontFamily: FONT }}
                    >
                      {li.vendorQty}
                    </span>
                    <span style={{ fontSize: "var(--text-3xs)", fontWeight: "var(--font-weight-medium)", lineHeight: "12px", fontFamily: FONT, color: "var(--muted-foreground)", textTransform: "uppercase" as const }}>
                      {li.vendorUOM}
                    </span>
                  </div>
                )}
              </div>

              {/* ── PRICE PER UNIT — editable in every non-cancelled state ── */}
              <div className="text-right pt-0.5">
                {canEdit ? (
                  <div className="relative inline-flex items-center">
                    <span className="absolute left-2 text-muted-foreground pointer-events-none" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)", lineHeight: "18px", fontFamily: FONT }}>{priceEditSymbol}</span>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={editingPriceId === li.id ? editingPriceValue : displayPriceInEditCurrency(li).toFixed(2)}
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
                      className={`w-[84px] h-7 pl-5 pr-1.5 text-right rounded-[var(--radius-sm)] border border-border bg-card text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors ${!freeEdit ? "cursor-pointer" : ""}`}
                      style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)", lineHeight: "18px", fontFamily: FONT }}
                    />
                  </div>
                ) : (
                  <span
                    className="text-foreground"
                    style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-normal)", lineHeight: "18px", fontFamily: FONT }}
                  >
                    <POMoneyCell
                      valuePKR={effectivePrice}
                      po={po}
                      lockedRate={li.lockedRate}
                      lockedAt={li.lockedAt}
                    />
                  </span>
                )}
              </div>

              {/* ── TOTAL ── */}
              <div className="text-right pt-0.5">
                <span
                  className="text-foreground"
                  style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)", lineHeight: "18px", fontFamily: FONT }}
                >
                  <POMoneyCell
                    valuePKR={isEditingQty ? previewLineTotal : li.lineTotal}
                    po={po}
                    lockedRate={li.lockedRate}
                    lockedAt={li.lockedAt}
                  />
                </span>
                {li.discount > 0 && (
                  <span
                    className="block mt-0.5"
                    style={{ fontSize: "var(--text-3xs)", fontWeight: "var(--font-weight-medium)", lineHeight: "14px", fontFamily: FONT, color: "var(--accent)" }}
                  >
                    -{li.discount}% off
                  </span>
                )}
              </div>

              {/* ── RECEIVED (inline column) ── */}
              {showReceiving && (() => {
                const recvPct = li.quantity > 0 ? Math.min(100, (li.receivedQuantity / li.quantity) * 100) : 0;
                const isFull = li.receivedQuantity >= li.quantity;
                const isPartial = li.receivedQuantity > 0 && !isFull;
                const statusColor = isFull ? "var(--accent)" : isPartial ? "var(--warning)" : "var(--muted-foreground)";
                return (
                  <div className="flex flex-col items-end gap-1 pt-0.5">
                    <span style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-bold)", lineHeight: "18px", fontFamily: FONT, color: statusColor }}>
                      {li.receivedQuantity}/{li.quantity}
                    </span>
                    <span style={{ fontSize: "var(--text-3xs)", fontWeight: "var(--font-weight-medium)", lineHeight: "12px", fontFamily: FONT, color: "var(--muted-foreground)", textTransform: "uppercase" as const }}>
                      {li.vendorUOM}
                    </span>
                    <div className="w-full max-w-[72px] h-[5px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${recvPct}%`, backgroundColor: isFull ? "var(--accent)" : isPartial ? "var(--warning)" : "transparent" }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* ── ACTIONS ── */}
              <div className="flex items-center justify-end gap-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
                {canEdit && !isItemCancelled && (
                  <>
                    <button
                      className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] text-muted-foreground hover:text-primary hover:bg-primary/[0.06] transition-all cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!freeEdit) { onRequestEditSession("Item Edit"); return; }
                        onEditItem(li);
                      }}
                      title="Edit item"
                    >
                      <Pencil className="size-3" />
                    </button>
                    {po.status === "Draft" ? (
                      <button
                        className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] text-muted-foreground hover:text-destructive hover:bg-destructive/[0.06] transition-all cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!freeEdit) { onRequestEditSession("Item Removed"); return; }
                          onRemoveItem(li.id);
                        }}
                        title="Remove item"
                      >
                        <X className="size-3.5" />
                      </button>
                    ) : onCancelItem ? (
                      <button
                        className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] text-muted-foreground hover:text-destructive hover:bg-destructive/[0.06] transition-all cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); onCancelItem(li.id); }}
                        title="Cancel item"
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

      {/* ── Empty State ── */}
      {canEdit && po.lineItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="flex items-center justify-center size-12 rounded-full bg-secondary">
            <Package className="size-5 text-foreground/20" />
          </div>
          <div className="text-center">
            <span className="text-foreground/40 block" style={st.fieldValue}>No items yet</span>
            <span className="text-foreground/25 block mt-0.5" style={st.uiSmall}>Click &quot;Add Items&quot; to browse the vendor&apos;s items</span>
          </div>
          <Button size="sm" className="h-8 gap-1.5 px-4 mt-1" style={st.uiLabel} onClick={onAddItems}>
            <Plus className="size-3.5" /> Browse Vendor Items
          </Button>
        </div>
      )}
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

/* ═════════════════════════════════════════════════════════════��═
   ADD ATTACHMENTS DIALOG
   ══════════════════════════════════════���════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   DUPLICATE PO DIALOG
   Shows a summary of what will be duplicated and creates a new Draft PO.
   ═══════════════════════════════════════════════════════════════ */

function DuplicatePODialog({
  open,
  onOpenChange,
  po,
  onDuplicate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  po: PurchaseOrderData;
  onDuplicate: (newPo: PurchaseOrderData) => void;
}) {
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleDuplicate = () => {
    const newPo = duplicatePO(po.id);
    if (newPo) onDuplicate(newPo);
  };

  const summaryRows: { label: string; value: string; icon: React.ElementType }[] = [
    { label: "Vendor", value: po.vendor.name, icon: Building2 },
    { label: "Primary Contact", value: po.recipient.name, icon: User },
    { label: "Line Items", value: `${po.lineItems.length} item${po.lineItems.length !== 1 ? "s" : ""}`, icon: Package },
    { label: "Total Value", value: fmt(po.total), icon: CircleDollarSign },
    { label: "Payment Terms", value: po.payment.paymentTerms, icon: CreditCard },
    { label: "Ship To", value: po.payment.shippedTo, icon: Truck },
    { label: "Delivery Date", value: po.deliveryDate ? new Date(po.deliveryDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Not set", icon: CalendarDays },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center size-10 rounded-[var(--radius-md)] shrink-0"
              style={{ backgroundColor: "var(--avatar-1-bg)" }}
            >
              <Copy className="size-5" style={{ color: "var(--primary)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-foreground" style={st.fieldValueBold}>
                Duplicate Purchase Order
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-0.5" style={st.uiSmall}>
                Create a new Draft PO with the same details as {po.poNumber}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Source PO badge */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <FileText className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground" style={st.uiSmall}>
              Duplicating from
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-[var(--radius-sm)] bg-secondary text-foreground"
              style={st.uiLabel}
            >
              {po.poNumber}
            </span>
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] text-muted-foreground uppercase"
              style={{ ...st.tiny, backgroundColor: "var(--secondary)" }}
            >
              {po.status}
            </span>
          </div>
        </div>

        {/* What will be copied */}
        <div className="px-5 py-3">
          <span className="text-muted-foreground/70 uppercase block mb-2.5" style={{ ...st.tiny, letterSpacing: "0.04em" }}>
            The new PO will include
          </span>
          <div className="rounded-[var(--radius-md)] border border-border bg-card overflow-hidden">
            {summaryRows.map((row, idx) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.label}
                  className={`flex items-center gap-3 px-3.5 py-2.5 ${idx < summaryRows.length - 1 ? "border-b border-border/60" : ""}`}
                >
                  <div
                    className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] shrink-0"
                    style={{ backgroundColor: "var(--secondary)" }}
                  >
                    <Icon className="size-3.5 text-muted-foreground" />
                  </div>
                  <span className="text-muted-foreground min-w-[110px]" style={st.uiSmall}>
                    {row.label}
                  </span>
                  <span className="text-foreground flex-1 truncate" style={st.uiLabel}>
                    {row.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* What will be different */}
        <div className="px-5 pb-4">
          <span className="text-muted-foreground/70 uppercase block mb-2" style={{ ...st.tiny, letterSpacing: "0.04em" }}>
            What will be different
          </span>
          <div className="flex flex-col gap-1.5">
            {[
              "New PO number will be assigned automatically",
              <>Status will be reset to <strong style={{ fontWeight: "var(--font-weight-semibold)" as string }}>Draft</strong></>,
              "Order date will be set to today",
              "All receiving records will be cleared (quantities reset to 0)",
            ].map((text, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center justify-center size-5 rounded-full shrink-0" style={{ backgroundColor: "var(--avatar-1-bg)" }}>
                  <Check className="size-3" style={{ color: "var(--primary)" }} />
                </div>
                <span className="text-foreground" style={st.uiSmall}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-secondary/30">
          <span className="text-muted-foreground" style={st.uiSmall}>
            You can edit all fields after duplicating
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3" style={st.uiLabel} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 gap-1.5 px-4" style={st.uiLabel} onClick={handleDuplicate}>
              <Copy className="size-3.5" />
              Duplicate PO
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface POAttachment {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
  addedAt: string;
}

function AddAttachmentDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (attachments: POAttachment[]) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<POAttachment[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setFiles([]);
  }, [open]);

  const processFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: POAttachment[] = Array.from(fileList).map((f, i) => ({
      id: `att-${Date.now()}-${i}`,
      name: f.name,
      size: f.size < 1024 * 1024
        ? `${(f.size / 1024).toFixed(1)} KB`
        : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      type: f.type || "application/octet-stream",
      url: URL.createObjectURL(f),
      addedAt: new Date().toISOString(),
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    processFiles(e.dataTransfer.files);
  };

  const handleSave = () => {
    onAdd(files);
    onOpenChange(false);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return "🖼";
    if (type.includes("pdf")) return "📄";
    if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) return "📊";
    if (type.includes("word") || type.includes("document")) return "📝";
    return "📎";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-center size-10 rounded-[var(--radius-md)] bg-primary/8 shrink-0">
            <Paperclip className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle style={{ ...st.fieldValueBold, fontSize: "var(--text-label)" }} className="text-foreground">
              Add Attachments
            </DialogTitle>
            <DialogDescription style={st.uiSmall} className="text-muted-foreground mt-0.5">
              Upload documents, images, or spreadsheets related to this PO.
            </DialogDescription>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Drop zone */}
          <div
            className={`relative flex flex-col items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed p-6 transition-all cursor-pointer ${
              dragActive
                ? "border-primary bg-primary/4"
                : "border-border hover:border-primary/30 hover:bg-secondary/30"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => processFiles(e.target.files)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.svg"
            />
            <div
              className="flex items-center justify-center size-10 rounded-full mb-3"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              <Plus className="size-5 text-muted-foreground" />
            </div>
            <span className="text-foreground" style={st.fieldValue}>
              {dragActive ? "Drop files here" : "Click or drag files to upload"}
            </span>
            <span className="text-muted-foreground mt-1" style={st.uiSmall}>
              PDF, DOC, XLS, CSV, PNG, JPG — max 25 MB each
            </span>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] border border-border"
                  style={{ backgroundColor: "var(--secondary)" }}
                >
                  <span style={{ fontSize: "16px", lineHeight: "1" }}>{getFileIcon(f.type)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground truncate block" style={st.fieldValue}>{f.name}</span>
                    <span className="text-muted-foreground" style={st.tiny}>{f.size}</span>
                  </div>
                  <button
                    className="flex items-center justify-center size-6 rounded-[var(--radius-sm)] text-foreground/30 hover:text-destructive hover:bg-destructive/8 transition-colors cursor-pointer shrink-0"
                    onClick={() => removeFile(f.id)}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-secondary">
          <span className="text-muted-foreground" style={st.uiSmall}>
            {files.length} file{files.length !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-3" style={st.uiLabel} onClick={() => onOpenChange(false)}>
              <X className="size-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 px-4"
              style={st.uiLabel}
              disabled={files.length === 0}
              onClick={handleSave}
            >
              <Paperclip className="size-3.5" />
              Attach {files.length > 0 ? `(${files.length})` : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
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

export default function PurchaseOrderDraft() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [po, setPO] = useState<PurchaseOrderData | undefined>(undefined);
  const [lightboxData, setLightboxData] = useState<{ images: string[]; partNumber: string; itemName: string } | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<POLineItem | null>(null);
  const [viewingItem, setViewingItem] = useState<POLineItem | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
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
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [extraAttachments, setExtraAttachments] = useState<POAttachment[]>([]);
  const [payToDialogOpen, setPayToDialogOpen] = useState(false);
  const [shipToDialogOpen, setShipToDialogOpen] = useState(false);
  const [fundedByDialogOpen, setFundedByDialogOpen] = useState(false);
  const [currencyConfigOpen, setCurrencyConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("items");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [deliveryDateModalOpen, setDeliveryDateModalOpen] = useState(false);
  const [deliveryDateDraft, setDeliveryDateDraft] = useState("");
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [cancelPOOpen, setCancelPOOpen] = useState(false);
  const [cancelPOReason, setCancelPOReason] = useState("");
  const [reactivatePOOpen, setReactivatePOOpen] = useState(false);
  const [reactivateReason, setReactivateReason] = useState("");
  const [cancelLineItemId, setCancelLineItemId] = useState<string | null>(null);
  const [allCancelledPromptOpen, setAllCancelledPromptOpen] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [compareFullScreen, setCompareFullScreen] = useState<{ v1: POVersionEntryType; v2: POVersionEntryType } | null>(null);
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

  /* Track status changes coming from any source (direct calls, receiving, etc.) */
  useEffect(() => {
    if (!po) return;
    const prev = prevStatusRef.current;
    if (prev && prev !== po.status) {
      setTransitionOverlay({ visible: true, fromStatus: prev, toStatus: po.status });
    }
    prevStatusRef.current = po.status;
  }, [po?.status]);

  const dismissTransitionOverlay = useCallback(() => {
    setTransitionOverlay((s) => ({ ...s, visible: false }));
  }, []);

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
        dueDeliveryDate: "",
        inboundLocation: "",
        category: item.category || "",
      });

      if (editingSession?.confirmed) {
        recordChangeDetail("Item Added", {
          type: "line-item-added", action: "Added",
          subject: item.itemNumber,
          detail: `${item.descriptiveName} — ${item.vendorUOMQty || 1} ${item.vendorUOM || "EA"}, $${item.unitPrice.toFixed(2)}/ea`,
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
  const hasCancelledItems = po.lineItems.some((li) => li.cancelled);

  /* ── Header gradient — subtle wash for the whole card ── */
  const effectiveHeaderStatus: POStatus = isCancelled
    ? (po.preCancellationStatus || "Draft")
    : isActiveWithCancellations ? "Confirmed" : isFullyReceivedWithCancellations ? "Fully Received" : po.status;
  const headerCurrentIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === effectiveHeaderStatus);
  const headerAllCompleted = effectiveHeaderStatus === "Fully Received" || isFullyReceivedWithCancellations;
  const headerGradient = getHeaderBackground(effectiveHeaderStatus, headerCurrentIndex, LIFECYCLE_STEPS.length, headerAllCompleted);
  const stepperBg = getStepperBackground(effectiveHeaderStatus, headerCurrentIndex, LIFECYCLE_STEPS.length, headerAllCompleted);

  /* ── Unified card gradient — originates from stepper (bottom), fades upward ── */
  const cardGradient = (() => {
    if (headerAllCompleted) {
      return `linear-gradient(180deg,
        color-mix(in srgb, var(--accent) 2%, transparent) 0%,
        color-mix(in srgb, var(--accent) 5%, transparent) 55%,
        color-mix(in srgb, var(--accent) 10%, transparent) 100%)`;
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

  /* ── Derived: show edit controls in every non-cancelled state ── */
  const canEdit = !isCancelled;
  const canManageAttachments = canEdit;

  /* ── guardEdit: intercept edits in post-Draft states ── */
  const guardEdit = (action: () => void, tag?: string, changeDetail?: Omit<ChangeDetail, "tag">) => {
    if (isDraft) { action(); return; }
    if (isCancelled) return;
    if (editingSession?.confirmed) {
      action();
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
        iconBg: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)",
        iconBorder: "color-mix(in srgb, var(--muted-foreground) 20%, transparent)",
        iconColor: "var(--muted-foreground)",
        textColor: "var(--muted-foreground)",
      }
    : {
        iconBg: "var(--primary-tint)",
        iconBorder: "color-mix(in srgb, var(--primary) 15%, transparent)",
        iconColor: "var(--primary)",
        textColor: "var(--foreground)",
      };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "\u2014";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  };

  const creditLimit = 125000;
  const creditUsedPercent = Math.min(100, (po.total / creditLimit) * 100);
  const creditRemaining = creditLimit - po.total;

  const allAttachments = po.lineItems.map((li) => ({
    id: li.id,
    itemNumber: li.itemNumber,
    descriptiveName: li.descriptiveName,
    image: li.image,
  }));

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

  return (
    <AppShell>
    <div className="flex flex-col h-full bg-secondary overflow-hidden animate-page-fade-in" style={{ fontFamily: FONT }}>

      {/* ══════════ STICKY HEADER — unified card: meta + stepper (quote-header design) ══════════ */}
      <div className="shrink-0 z-10 bg-secondary border-b border-border">
        <div className={`${PX} pt-3 pb-3 lg:pt-4 lg:pb-4`}>
          <div className="max-w-[1520px] mx-auto">
          <div className="rounded-xl" style={{ overflow: 'visible', marginBottom: '16px', background: cardGradient ? `${cardGradient}, var(--card)` : 'var(--card)', border: 'none', boxShadow: isClosed ? '0 2px 12px color-mix(in srgb, var(--muted-foreground) 15%, transparent)' : 'var(--elevation-card)', transition: 'background 0.6s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.4s ease' }}>
            {/* Top Section */}
            <div className="px-5" style={{ paddingTop: '16px', paddingBottom: '14px', borderRadius: '12px 12px 0 0' }}>
              {/* Row 1: Title + Version + Actions */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back link */}
                  <BackButton
                    onClick={() => navigate('/purchase-orders')}
                    title="Back to Purchase Orders"
                    muted={isClosed}
                  />
                  {/* Separator */}
                  <div style={{ width: '1px', height: '20px', backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 18%, transparent)' : 'var(--border)', flexShrink: 0 }} />
                  {/* Document icon */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-lg"
                    style={{ width: '32px', height: '32px', backgroundColor: headerColors.iconBg, border: `1px solid ${headerColors.iconBorder}`, transition: 'all 300ms ease' }}
                  >
                    <FileText style={{ width: '16px', height: '16px', color: headerColors.iconColor, transition: 'color 300ms ease' }} />
                  </div>
                  {/* PO Number */}
                  <h1 className="flex-shrink-0" style={{ fontSize: 'var(--text-h4)', fontWeight: 'var(--font-weight-semibold)', lineHeight: 1.2, color: headerColors.textColor, transition: 'color 300ms ease', fontFamily: FONT, letterSpacing: '-0.01em' }}>
                    {po.poNumber}
                  </h1>
                  {/* Status Badge */}
                  <StatusBadge status={po.status} />

                  {/* Version dropdown */}
                  <POVersionDropdown
                    currentVersion={po.currentVersion}
                    currentStatus={po.status}
                    viewingVersion={viewingVersion}
                    onViewVersion={setViewingVersion}
                    onEditAsDraft={(fromVersion) => {
                      const newVersion = revertPOToVersion(po.id, fromVersion, `Reverted to Version ${fromVersion}`);
                      if (newVersion) {
                        setViewingVersion(null);
                        toast.success(`Reverted to Version ${fromVersion}`, {
                          description: `Created Version ${newVersion} from revert`,
                          style: { fontFamily: FONT },
                        });
                      }
                    }}
                    materialChangesCount={po.versions.length > 0 ? po.versions[po.versions.length - 1]?.changes?.length : undefined}
                    versions={po.versions}
                  />

                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-4">
                  {/* Icon-only utility buttons */}
                  <button
                    onClick={() => printPurchaseOrder(po, { version: selectedPrintVersion })}
                    title="Print"
                    className="flex items-center justify-center rounded-md transition-colors"
                    style={{ width: '32px', height: '32px', border: isClosed ? '1px solid color-mix(in srgb, var(--muted-foreground) 18%, transparent)' : '1px solid var(--border)', backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 5%, transparent)' : 'var(--card)', color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 55%, transparent)' : 'var(--muted-foreground)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isClosed ? 'color-mix(in srgb, var(--muted-foreground) 10%, transparent)' : 'var(--secondary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isClosed ? 'color-mix(in srgb, var(--muted-foreground) 5%, transparent)' : 'var(--card)'; }}
                  >
                    <Printer style={{ width: '15px', height: '15px' }} />
                  </button>
                  <button
                    title="Download PO"
                    className="flex items-center justify-center rounded-md transition-colors"
                    style={{ width: '32px', height: '32px', border: isClosed ? '1px solid color-mix(in srgb, var(--muted-foreground) 18%, transparent)' : '1px solid var(--border)', backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 5%, transparent)' : 'var(--card)', color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 55%, transparent)' : 'var(--muted-foreground)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isClosed ? 'color-mix(in srgb, var(--muted-foreground) 10%, transparent)' : 'var(--secondary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isClosed ? 'color-mix(in srgb, var(--muted-foreground) 5%, transparent)' : 'var(--card)'; }}
                  >
                    <Download style={{ width: '15px', height: '15px' }} />
                  </button>
                  <button
                    title="Duplicate PO"
                    className="flex items-center justify-center rounded-md transition-colors"
                    style={{ width: '32px', height: '32px', border: isClosed ? '1px solid color-mix(in srgb, var(--muted-foreground) 18%, transparent)' : '1px solid var(--border)', backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 5%, transparent)' : 'var(--card)', color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 55%, transparent)' : 'var(--muted-foreground)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isClosed ? 'color-mix(in srgb, var(--muted-foreground) 10%, transparent)' : 'var(--secondary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isClosed ? 'color-mix(in srgb, var(--muted-foreground) 5%, transparent)' : 'var(--card)'; }}
                    onClick={() => setDuplicateDialogOpen(true)}
                  >
                    <Copy style={{ width: '15px', height: '15px' }} />
                  </button>
                  <button
                    title="Archive PO"
                    className="flex items-center justify-center rounded-md transition-colors"
                    style={{
                      width: '32px',
                      height: '32px',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 14%, transparent)' : 'color-mix(in srgb, var(--destructive) 40%, transparent)',
                      backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 4%, transparent)' : 'var(--card)',
                      color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 40%, transparent)' : 'var(--destructive)',
                      cursor: isClosed ? 'not-allowed' : 'pointer',
                      opacity: isClosed ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isClosed) {
                        e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--destructive) 5%, var(--card))';
                        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--destructive) 60%, transparent)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isClosed) {
                        e.currentTarget.style.backgroundColor = 'var(--card)';
                        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--destructive) 40%, transparent)';
                      }
                    }}
                    disabled={isClosed}
                  >
                    <Archive style={{ width: '15px', height: '15px' }} />
                  </button>

                  {/* Separator */}
                  <div style={{ width: '1px', height: '20px', backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 18%, transparent)' : 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

                  {/* Status Action — Combo/Split Button with State Dropdown */}
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

                    type StateAction = { label: string; icon: React.ElementType; action: () => void; destructive?: boolean };

                    const stateConfig: Record<string, { primary: StateAction; options: StateAction[] }> = {
                      Draft: {
                        primary: { label: "Send to Vendor", icon: Send, action: () => sendPO(po.id) },
                        options: [
                          { label: "Send to Vendor", icon: Send, action: () => sendPO(po.id) },
                          { label: "Mark as Confirmed", icon: Check, action: () => { updatePOStatus(po.id, "Sent"); updatePOStatus(po.id, "Confirmed"); } },
                          { label: "Cancel PO", icon: X, action: () => { setCancelPOReason(""); setCancelPOOpen(true); }, destructive: true },
                        ],
                      },
                      Sent: {
                        primary: { label: "Mark as Confirmed", icon: Check, action: () => confirmPO(po.id) },
                        options: [
                          { label: "Mark as Confirmed", icon: Check, action: () => confirmPO(po.id) },
                          { label: "Start Receiving", icon: PackageOpen, action: () => { confirmPO(po.id); openReceiving(); } },
                          { label: "Cancel PO", icon: X, action: () => { setCancelPOReason(""); setCancelPOOpen(true); }, destructive: true },
                          { label: "Revert to Draft", icon: ArrowLeft, action: () => revertPOStatus(po.id, "Draft") },
                        ],
                      },
                      Confirmed: {
                        primary: { label: "Start Receiving", icon: PackageOpen, action: openReceiving },
                        options: [
                          { label: "Start Receiving", icon: PackageOpen, action: openReceiving },
                          { label: "Cancel PO", icon: X, action: () => { setCancelPOReason(""); setCancelPOOpen(true); }, destructive: true },
                          { label: "Revert to Sent", icon: ArrowLeft, action: () => revertPOStatus(po.id, "Sent") },
                        ],
                      },
                      "Partially Received": {
                        primary: { label: "Continue Receiving", icon: PackageOpen, action: openReceiving },
                        options: [
                          { label: "Continue Receiving", icon: PackageOpen, action: openReceiving },
                          { label: "Mark as Fully Received", icon: Package, action: () => updatePOStatus(po.id, "Fully Received") },
                          { label: "Cancel PO", icon: X, action: () => { setCancelPOReason(""); setCancelPOOpen(true); }, destructive: true },
                        ],
                      },
                      "Fully Received": {
                        primary: { label: "Fully Received", icon: Check, action: () => {} },
                        options: [
                          { label: "Revert to Partially Received", icon: ArrowLeft, action: () => revertPOStatus(po.id, "Partially Received") },
                        ],
                      },
                      Cancelled: {
                        primary: { label: "Reactivate PO", icon: ArrowLeft, action: () => { setReactivateReason(""); setReactivatePOOpen(true); } },
                        options: [
                          { label: "Reactivate PO", icon: ArrowLeft, action: () => { setReactivateReason(""); setReactivatePOOpen(true); } },
                        ],
                      },
                      "Active with Cancellations": {
                        primary: { label: "Continue Receiving", icon: PackageOpen, action: openReceiving },
                        options: [
                          { label: "Continue Receiving", icon: PackageOpen, action: openReceiving },
                          { label: "Mark as Fully Received", icon: Package, action: () => updatePOStatus(po.id, "Fully Received with Cancellations") },
                          { label: "Cancel PO", icon: X, action: () => { setCancelPOReason(""); setCancelPOOpen(true); }, destructive: true },
                        ],
                      },
                      "Fully Received with Cancellations": {
                        primary: { label: "Fully Received", icon: Check, action: () => {} },
                        options: [
                          { label: "Revert to Partially Received", icon: ArrowLeft, action: () => revertPOStatus(po.id, "Active with Cancellations") },
                        ],
                      },
                    };

                    const config = stateConfig[po.status];
                    if (!config) return null;

                    const PrimaryIcon = config.primary.icon;
                    const isFullyReceived = po.status === "Fully Received" || po.status === "Fully Received with Cancellations";

                    if (isFullyReceived) {
                      return (
                        <div className="flex items-center">
                          <Badge variant="outline" className="border-transparent gap-1.5 py-1.5 px-3 rounded-l-[var(--radius-md)] rounded-r-none" style={{ ...st.uiLabel, backgroundColor: 'var(--status-received-bg)', color: 'var(--status-received-text)' }}>
                            <Check className="size-3.5" />
                            Fully Received
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="flex items-center justify-center h-[30px] w-7 rounded-r-[var(--radius-md)] rounded-l-none border-l transition-colors"
                                style={{ backgroundColor: 'var(--status-received-bg)', borderColor: 'color-mix(in srgb, var(--status-received-text) 20%, transparent)', color: 'var(--status-received-text)' }}
                              >
                                <ChevronDown className="size-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[200px]">
                              {config.options.map((opt, i) => {
                                const OptIcon = opt.icon;
                                return (
                                  <DropdownMenuItem key={i} onClick={opt.action} className={opt.destructive ? "text-destructive focus:text-destructive" : ""}>
                                    <OptIcon className="size-3.5 mr-2" />
                                    <span style={st.uiLabel}>{opt.label}</span>
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    }

                    return (
                      <div className="flex items-center">
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 px-3.5 rounded-r-none rounded-l-[var(--radius-md)] hover:opacity-90"
                          style={{ ...st.uiLabel, backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }}
                          onClick={config.primary.action}
                        >
                          <PrimaryIcon className="size-3.5" /> {config.primary.label}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex items-center justify-center h-8 w-7 rounded-r-[var(--radius-md)] rounded-l-none border-l transition-colors hover:opacity-90"
                              style={{ backgroundColor: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent-foreground) 20%, transparent)', color: 'var(--accent-foreground)' }}
                            >
                              <ChevronDown className="size-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[200px]">
                            {config.options.map((opt, i) => {
                              const OptIcon = opt.icon;
                              return (
                                <React.Fragment key={i}>
                                  {opt.destructive && i > 0 && <DropdownMenuSeparator />}
                                  <DropdownMenuItem onClick={opt.action} className={opt.destructive ? "text-destructive focus:text-destructive" : ""}>
                                    <OptIcon className="size-3.5 mr-2" />
                                    <span style={st.uiLabel}>{opt.label}</span>
                                  </DropdownMenuItem>
                                </React.Fragment>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Row 2: Key metadata strip — subtle container for visual grounding */}
              <div
                className="flex items-center flex-wrap gap-x-3.5 gap-y-1.5"
                style={{
                  marginTop: '12px',
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 4%, transparent)' : 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                  border: isClosed ? '1px solid color-mix(in srgb, var(--muted-foreground) 10%, transparent)' : '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
                }}
              >
                {/* Vendor */}
                <div className="flex items-center gap-1.5">
                  <Building2 style={{ width: '12px', height: '12px', color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 50%, transparent)' : 'var(--muted-foreground)', flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--text-label)', fontFamily: FONT, fontWeight: 'var(--font-weight-medium)', color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 75%, transparent)' : 'var(--foreground)', lineHeight: 1.3 }}>
                    {po.vendor.name}
                  </span>
                </div>
                {/* Separator dot */}
                <div style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 22%, transparent)' : 'color-mix(in srgb, var(--muted-foreground) 25%, transparent)', flexShrink: 0 }} />
                {/* Total */}
                <div className="flex items-center gap-1.5">
                  <CircleDollarSign style={{ width: '12px', height: '12px', color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 50%, transparent)' : 'var(--muted-foreground)', flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--text-label)', fontFamily: FONT, fontWeight: 'var(--font-weight-semibold)', color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 75%, transparent)' : 'var(--foreground)', lineHeight: 1.3 }}>
                    <POMoneyCell valuePKR={po.total} po={po} />
                  </span>
                  <span style={{ fontSize: 'var(--text-label)', fontFamily: FONT, color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 50%, transparent)' : 'var(--muted-foreground)', lineHeight: 1.3 }}>
                    · {po.lineItems.length} item{po.lineItems.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Separator dot */}
                <div style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 22%, transparent)' : 'color-mix(in srgb, var(--muted-foreground) 25%, transparent)', flexShrink: 0 }} />
                {/* Delivery date */}
                <div className="flex items-center gap-1.5">
                  <Truck style={{ width: '12px', height: '12px', color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 50%, transparent)' : 'var(--muted-foreground)', flexShrink: 0 }} />
                  <span style={{ fontSize: 'var(--text-label)', fontFamily: FONT, color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 60%, transparent)' : 'var(--muted-foreground)', lineHeight: 1.3 }}>
                    Due {formatDate(po.deliveryDate)}
                  </span>
                </div>
                {/* Separator dot */}
                <div className="hidden md:block" style={{ width: '3px', height: '3px', borderRadius: '50%', backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 22%, transparent)' : 'color-mix(in srgb, var(--muted-foreground) 25%, transparent)', flexShrink: 0 }} />
                {/* Created by */}
                <UserHoverCard name={po.createdBy}>
                  <div className="hidden md:flex items-center gap-1.5 cursor-pointer">
                    <User style={{ width: '12px', height: '12px', color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 50%, transparent)' : 'var(--muted-foreground)', flexShrink: 0 }} />
                    <span style={{ fontSize: 'var(--text-label)', fontFamily: FONT, color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 60%, transparent)' : 'var(--muted-foreground)', lineHeight: 1.3 }}>
                      {po.createdBy}
                    </span>
                  </div>
                </UserHoverCard>
                {/* Currency controls — pushed right. Toggle hides for PKR-native vendors; configurator always visible. */}
                <div className="ml-auto flex items-center">
                  <POCurrencyHeaderControls po={po} onOpenConfig={() => setCurrencyConfigOpen(true)} />
                </div>
              </div>
            </div>

            {/* Bottom Section: Full-Width Stepper — unified with header, no separator */}
            <div
              className="px-5 pb-2.5 pt-0.5"
              style={{
                borderRadius: '0 0 12px 12px',
              }}
            >
              <LifecycleTracker currentStatus={po.status} po={po} />
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* ══════════ DETAIL TABS ═════════�� */}
      <PODetailTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={{
          items: po.lineItems.length,
          versions: po.versions.length,
          notes: po.poNotes.length,
          invoices: 2,
          payments: 1,
          receipts: 3,
          emails: 4,
          comments: 6,
          "receiving-docs": 2,
          "recent-activities": 8,
        }}
      />

      {/* ── Cancellation Banner ── */}
      {isCancelled && po.cancellationDate && (
        <div className={PX}>
          <div className="max-w-[1520px] mx-auto pt-4">
            <div
              className="flex items-start gap-2.5 rounded-[var(--radius-md)] px-4 py-3"
              style={{ backgroundColor: "color-mix(in srgb, var(--warning) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--warning) 25%, transparent)" }}
            >
              <AlertTriangle className="size-4 mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
              <div className="flex-1 min-w-0">
                <span className="text-foreground block" style={st.uiLabel}>
                  This PO was cancelled on {new Date(po.cancellationDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {po.cancellationReason && (
                  <span className="text-muted-foreground block mt-0.5" style={st.uiSmall}>
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
        <div className={PX}>
          <div className="max-w-[1520px] mx-auto pt-4">
            <div
              className="flex items-start gap-2.5 rounded-[var(--radius-md)] px-4 py-3"
              style={{ backgroundColor: "color-mix(in srgb, var(--warning) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--warning) 25%, transparent)" }}
            >
              <AlertTriangle className="size-4 mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
              <div className="flex-1 min-w-0">
                <span className="text-foreground block" style={st.uiLabel}>
                  This PO has {po.lineItems.filter((li) => li.cancelled).length} cancelled line item{po.lineItems.filter((li) => li.cancelled).length > 1 ? "s" : ""}
                </span>
                <span className="text-muted-foreground block mt-0.5" style={st.uiSmall}>
                  Cancelled items are excluded from the order total. The PO remains active for non-cancelled items.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Fully Received with Cancellations Banner ── */}
      {isFullyReceivedWithCancellations && hasCancelledItems && (
        <div className={PX}>
          <div className="max-w-[1520px] mx-auto pt-4">
            <div
              className="flex items-start gap-2.5 rounded-[var(--radius-md)] px-4 py-3"
              style={{ backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)" }}
            >
              <AlertTriangle className="size-4 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
              <div className="flex-1 min-w-0">
                <span className="text-foreground block" style={st.uiLabel}>
                  All non-cancelled items have been fully received
                </span>
                <span className="text-muted-foreground block mt-0.5" style={st.uiSmall}>
                  {po.lineItems.filter((li) => li.cancelled).length} item{po.lineItems.filter((li) => li.cancelled).length > 1 ? "s were" : " was"} cancelled and excluded from the final total.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ SCROLLABLE CONTENT ══════════ */}
      {(
      <div className="flex-1 overflow-y-auto">
        <div className={PATTERN_C2_CONTENT}>
          <div className="max-w-[1520px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">

            {/* ━━━━━━ LEFT COLUMN ━━━━━━ */}
            <div key={activeTab} className="flex flex-col gap-5 animate-tab-fade-in min-w-0 overflow-hidden">

              {/* ─── TAB: ITEMS ─── */}
              {activeTab === "items" && (
                <>
                  {/* ── Editing Mode Banner ── */}
                  {editingSession?.confirmed && (
                    <div
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] px-4 py-2.5"
                      style={{ backgroundColor: "color-mix(in srgb, var(--primary) 6%, var(--background))", border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)", borderLeft: "3px solid var(--primary)" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Pencil className="size-3.5 shrink-0" style={{ color: "var(--primary)" }} />
                        <span className="text-foreground" style={st.uiLabel}>
                          Editing Version {(po.currentVersion || 1) + 1}
                        </span>
                        <span className="text-muted-foreground" style={st.uiSmall}>
                          {!isDraft ? `— PO will return to Draft on save — ` : "— "}{editingSession.changeCount} change{editingSession.changeCount !== 1 ? "s" : ""} made
                        </span>
                        {editingSession.changeTags.size > 0 && (() => {
                          const allTags = [...editingSession.changeTags];
                          const MAX_VISIBLE = 4;
                          const visible = allTags.slice(0, MAX_VISIBLE);
                          const overflow = allTags.length - MAX_VISIBLE;
                          const tagPillStyle: React.CSSProperties = { backgroundColor: "color-mix(in srgb, var(--primary) 8%, var(--background))", color: "var(--primary)", fontSize: "10px", fontWeight: 500, fontFamily: FONT, border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)", whiteSpace: "nowrap" };
                          return (
                            <div className="flex items-center gap-2 ml-1 min-w-0 overflow-hidden">
                              {visible.map(tag => (
                                <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] shrink-0" style={tagPillStyle}>
                                  {tag}
                                </span>
                              ))}
                              {overflow > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-[var(--radius-sm)] shrink-0 cursor-default" style={tagPillStyle}>
                                      +{overflow} more
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-3 text-gray-700">
                                    <div className="flex flex-col">
                                      {allTags.slice(MAX_VISIBLE).map(t => (
                                        <span key={t} className="py-1" style={{ fontSize: "12px", color: "hsl(var(--foreground))" }}>{t}</span>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 px-2.5 text-muted-foreground" style={st.uiLabel} onClick={handleDiscardChanges}>
                          Discard Changes
                        </Button>
                        <Button size="sm" className="h-7 px-3 gap-1" style={st.uiLabel} onClick={handleSaveVersion}>
                          <Save className="size-3" />
                          Save Version
                        </Button>
                      </div>
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
                    onAddItems={() => guardEdit(() => setAddItemsOpen(true), "Item Added")}
                    onCancelItem={!isDraft && !isCancelled && po.status !== "Fully Received" && po.status !== "Fully Received with Cancellations" ? (liId) => setCancelLineItemId(liId) : undefined}
                    onUpdateQty={(li, vendorQty, quantity) => guardEdit(
                      () => updateLineItem(po.id, li.id, { vendorQty, quantity }),
                      "Qty Change",
                      { type: "line-item-modified", action: "Changed", subject: `Qty: ${li.itemNumber}`, detail: `${li.quantity} ${li.vendorUOM} → ${quantity} ${li.vendorUOM}` }
                    )}
                    onUpdatePrice={(li, unitPrice) => guardEdit(
                      () => updateLineItem(po.id, li.id, { unitPrice, discount: 0 }),
                      "Price Change",
                      { type: "pricing-changed", action: "Changed", subject: `Price: ${li.itemNumber}`, detail: `$${li.unitPrice.toFixed(2)} → $${unitPrice.toFixed(2)}` }
                    )}
                  />
                </>
              )}

              {/* ─── TAB: INVOICES & PAYMENTS ─── */}
              {activeTab === "invoices-payments" && (
                <div className="space-y-6">
                  {/* Invoices section */}
                  <TabPlaceholderPanel
                    icon={FileText}
                    title="Invoices"
                    description="Vendor invoices linked to this purchase order will appear here."
                    count={2}
                  />
                  {/* Payments section */}
                  <TabPlaceholderPanel
                    icon={CreditCard}
                    title="Payments"
                    description="Payment records and transaction history for this order."
                    count={1}
                  />
                  {/* Receipts section */}
                  <TabPlaceholderPanel
                    icon={PackageCheck}
                    title="Receipts"
                    description="Goods receipt confirmations and receiving records."
                    count={3}
                  />
                </div>
              )}

              {/* ─── TAB: COMMUNICATIONS ─── */}
              {activeTab === "communications" && (
                <TabPlaceholderPanel
                  icon={Send}
                  title="Communications"
                  description="Email correspondence and communications related to this purchase order."
                  count={4}
                />
              )}

              {/* ─── TAB: VERSIONS ─── */}
              {activeTab === "versions" && !compareFullScreen && (
                <POVersionHistoryTab
                  poNumber={po.poNumber}
                  versions={po.versions}
                  onRevert={(version, reason) => {
                    const newVersion = revertPOToVersion(po.id, version, reason || `Reverted to Version ${version}`);
                    if (newVersion) {
                      setViewingVersion(null);
                      toast.success(`Reverted to Version ${version}`, {
                        description: `Created Version ${newVersion} from revert`,
                        style: { fontFamily: FONT },
                      });
                    }
                  }}
                  onCompareFullScreen={(v1, v2) => setCompareFullScreen({ v1, v2 })}
                />
              )}

              {/* ─── TAB: VERSIONS — Inline Comparison ─── */}
              {activeTab === "versions" && compareFullScreen && (
                <POCompareFullScreen
                  v1={compareFullScreen.v1}
                  v2={compareFullScreen.v2}
                  onClose={() => setCompareFullScreen(null)}
                />
              )}

              {/* ─── TAB: NOTES ─── */}
              {activeTab === "notes" && (
                <PONotesSection
                  poId={po.id}
                  allNotes={po.poNotes}
                  canEdit={canEdit}
                  onNoteChange={(action, noteType, subject) => {
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
                  description="Internal notes and comments from team members."
                  count={6}
                />
              )}

              {/* ─── TAB: RECEIVING DOCS ─── */}
              {activeTab === "receiving-docs" && (
                <TabPlaceholderPanel
                  icon={ClipboardCheck}
                  title="Receiving Documents"
                  description="Packing slips, inspection reports, and receiving documentation."
                  count={2}
                />
              )}

              {/* ─── TAB: RECENT ACTIVITIES ─── */}
              {activeTab === "recent-activities" && (
                <TabPlaceholderPanel
                  icon={AlertCircle}
                  title="Recent Activities"
                  description="Audit trail showing all changes and actions on this order."
                  count={8}
                />
              )}

              {/* Vendor, POC, and Notes are now in the right column */}
            </div>

            {/* ━━━━━━ RIGHT COLUMN ━━━━━━ */}
            <div>
              <div className="lg:sticky lg:top-5 flex flex-col gap-2">

                {/* ━━━━ 1. ORDER SUMMARY (highest priority — totals first) ━━━━ */}
                <CollapsibleSection icon={CircleDollarSign} title="Order Summary" defaultOpen={true}>
                  {/* Grand Total — compact centered */}
                  <div className="px-4 pt-2.5 pb-2 flex flex-col items-center gap-0.5 border-b border-border">
                    <span className="text-muted-foreground" style={st.fieldLabel}>Total Amount</span>
                    <span className="text-foreground" style={st.grandTotal}>
                      <POMoneyCell valuePKR={po.total} po={po} />
                    </span>
                    <span className="text-foreground/30" style={st.tiny}>
                      {po.lineItems.filter((li) => !li.cancelled).length} active item{po.lineItems.filter((li) => !li.cancelled).length !== 1 ? "s" : ""}
                      {hasCancelledItems && <> · {po.lineItems.filter((li) => li.cancelled).length} cancelled</>}
                      {" "}from {po.vendor.name}
                    </span>
                  </div>

                  {/* Breakdown — tighter spacing */}
                  <div className="px-4 py-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/55" style={st.summaryLabel}>Subtotal</span>
                      <span className="text-foreground" style={st.summaryValue}>
                        <POMoneyCell valuePKR={po.subtotal} po={po} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-foreground/55" style={st.summaryLabel}>Shipping &amp; Handling</span>
                      <span className="text-foreground" style={st.summaryValue}>
                        <POMoneyCell valuePKR={po.shippingFee} po={po} />
                      </span>
                    </div>
                    {po.discountTotal > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-accent" style={st.summaryLabel}>Discount</span>
                        <span className="text-accent" style={st.summaryValue}>
                          −<POMoneyCell valuePKR={po.discountTotal} po={po} />
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-foreground" style={st.totalLabel}>Grand Total</span>
                      <span className="text-foreground" style={st.totalLabel}>
                        <POMoneyCell valuePKR={po.total} po={po} />
                      </span>
                    </div>
                    {!poVendorCurrencyIsBase(po) && (
                      <div className="flex items-center justify-end pt-0.5">
                        <POLockedRateHelper po={po} />
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                {/* ━━━━ 2. VENDOR INFORMATION (unified card) ━━━━ */}
                <VendorInfoCard
                  vendor={po.vendor}
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

                {/* ━━━━ 3. CREDIT UTILIZATION (collapsed by default) ━━━━ */}
                <CollapsibleSection icon={Info} title="Credit Utilization" defaultOpen={false}
                  badge={<span className="text-primary" style={st.tiny}>{creditUsedPercent.toFixed(1)}%</span>}
                >
                  <div className="px-4 py-2.5 flex flex-col gap-2.5">
                    {/* Visual bar */}
                    <div className="relative">
                      <Progress value={creditUsedPercent} className="h-2 bg-border rounded-full" />
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-primary" style={st.tiny}>
                          <POMoneyCell valuePKR={po.total} po={po} /> used
                        </span>
                        <span className="text-accent" style={st.tiny}>
                          <POMoneyCell valuePKR={creditRemaining} po={po} /> remaining
                        </span>
                      </div>
                    </div>

                    <Separator />

                    {/* Breakdown — smaller fonts */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-foreground/45 inline-flex items-center gap-1.5" style={st.tiny}>
                          Credit Limit
                          {!poVendorCurrencyIsBase(po) && <POLockedRateHelper po={po} dense />}
                        </span>
                        <span className="text-foreground" style={st.uiSmall}>
                          <POMoneyCell valuePKR={creditLimit} po={po} />
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-foreground/45" style={st.tiny}>This PO</span>
                        <span className="text-primary" style={{ ...st.uiSmall, fontWeight: "var(--font-weight-medium)" as string }}>
                          <POMoneyCell valuePKR={po.total} po={po} />
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-foreground/45" style={st.tiny}>Available After</span>
                        <span className="text-accent" style={{ ...st.uiSmall, fontWeight: "var(--font-weight-medium)" as string }}>
                          <POMoneyCell valuePKR={creditRemaining} po={po} />
                        </span>
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* ━━━━ 3. TIMELINE (open by default, icon-style) ━━━━ */}
                <CollapsibleSection icon={CalendarDays} title="Timeline" defaultOpen={true}>
                  {(() => {
                    /* Compute the latest line-item delivery date for auto-calc info */
                    const latestLineItemDate = po.lineItems.length > 0
                      ? po.lineItems.reduce((latest, li) => li.dueDeliveryDate > latest ? li.dueDeliveryDate : latest, po.lineItems[0].dueDeliveryDate)
                      : po.deliveryDate;

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

                    const steps: TLStep[] = [
                      {
                        key: "sent", label: "Sent to Vendor", date: po.sentDate,
                        icon: Send, editable: false,
                        activeColor: "var(--chart-4)", activeBg: "color-mix(in srgb, var(--chart-4) 10%, transparent)",
                        stepIndex: 0,
                      },
                      {
                        key: "confirmed", label: "Confirmed", date: po.confirmationDate,
                        icon: Check, editable: false,
                        activeColor: "var(--accent)", activeBg: "color-mix(in srgb, var(--accent) 10%, transparent)",
                        stepIndex: 1,
                      },
                      {
                        key: "delivery", label: "Due Delivery Date", date: po.deliveryDate,
                        icon: Truck, editable: true,
                        activeColor: "var(--foreground)", activeBg: "color-mix(in srgb, var(--foreground) 6%, transparent)",
                        stepIndex: -1, isDeliveryDate: true,
                      },
                      {
                        key: "receiving", label: receivingLabel, date: po.receivingStartDate,
                        icon: receivingIcon, editable: false,
                        activeColor: po.status === "Fully Received" ? "var(--accent)" : "var(--warning)",
                        activeBg: po.status === "Fully Received"
                          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                          : "color-mix(in srgb, var(--warning) 10%, transparent)",
                        stepIndex: 2,
                      },
                    ];

                    /* Lifecycle index */
                    const STATUS_ORDER2: POStatus[] = ["Draft", "Sent", "Confirmed", "Partially Received", "Fully Received"];
                    const currentIdx = STATUS_ORDER2.indexOf(po.status);

                    return (
                      <div className="px-4 py-3">
                        <div className="relative flex flex-col">
                          {/* Vertical connecting line — sits behind icons */}
                          <div
                            className="absolute w-px"
                            style={{
                              left: 11,
                              top: 14,
                              height: "calc(100% - 28px)",
                              backgroundColor: "var(--border)",
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
                              : "var(--secondary)";
                            const circleBorder = isPending
                              ? "1px solid var(--border)"
                              : "1px solid transparent";
                            const iconColor = isCompleted || isCurrent
                              ? step.activeColor
                              : "var(--muted-foreground)";
                            const iconOpacity = isPending ? 0.3 : 1;

                            /* Label styles */
                            const labelColor = isPending
                              ? "var(--muted-foreground)"
                              : "var(--foreground)";
                            const labelOpacity = isPending ? 0.5 : 1;

                            /* Date styles */
                            const dateColor = isCurrent
                              ? step.activeColor
                              : isCompleted
                              ? "var(--foreground)"
                              : "var(--muted-foreground)";

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

                                {/* Label */}
                                <span
                                  className="flex-1 min-w-0"
                                  style={{
                                    ...st.uiSmall,
                                    color: labelColor,
                                    opacity: labelOpacity,
                                  }}
                                >
                                  {step.label}
                                </span>

                                {/* Date + actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {step.isDeliveryDate && (
                                    <div className="relative group/info mr-0.5">
                                      <Info
                                        className="size-3 cursor-help"
                                        style={{ color: "var(--muted-foreground)", opacity: 0.4 }}
                                      />
                                      <div
                                        className="absolute bottom-full right-0 mb-1.5 w-[210px] rounded-[var(--radius-md)] px-2.5 py-2 opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none z-20"
                                        style={{
                                          backgroundColor: "var(--foreground)",
                                          color: "var(--background)",
                                          boxShadow: "var(--elevation-card)",
                                        }}
                                      >
                                        <span style={{ ...st.tiny, color: "var(--background)" }}>
                                          Auto-calculated from the latest line item delivery date ({formatShort(latestLineItemDate)}). You can override it manually.
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  <span
                                    style={{
                                      ...st.fieldValue,
                                      fontWeight: (isCompleted || isCurrent) ? "var(--font-weight-medium)" as string : "var(--font-weight-normal)" as string,
                                      color: dateColor,
                                      opacity: isPending ? 0.4 : 1,
                                    }}
                                  >
                                    {hasDate ? formatShort(step.date) : "Pending"}
                                  </span>
                                  {step.editable && canEdit && (
                                    <button
                                      className="flex items-center justify-center size-5 rounded-[var(--radius-sm)] cursor-pointer transition-colors hover:bg-secondary"
                                      style={{ color: "var(--muted-foreground)", opacity: 0.4 }}
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
                                backgroundColor: "color-mix(in srgb, var(--warning) 10%, transparent)",
                                border: "1px solid color-mix(in srgb, var(--warning) 25%, transparent)",
                              }}
                            >
                              <AlertCircle className="size-3.5 shrink-0" style={{ color: "var(--warning)" }} />
                              <span style={{ ...st.uiSmall, color: "var(--warning)" }}>
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
                  <DialogContent className="sm:max-w-[380px] p-0 gap-0 rounded-xl overflow-hidden border border-border" style={{ backgroundColor: "var(--card)" }}>
                    <div className="px-5 pt-5 pb-3">
                      <DialogTitle style={{ ...st.sectionHeading, color: "var(--foreground)" }}>
                        Edit Expected Delivery Date
                      </DialogTitle>
                      <DialogDescription style={{ ...st.uiSmall, color: "var(--muted-foreground)", marginTop: 4 }}>
                        This date is auto-calculated from the latest line item delivery date. Override it below.
                      </DialogDescription>
                    </div>
                    <div className="px-5 pb-4 flex flex-col gap-3">
                      {/* Info banner */}
                      <div
                        className="flex items-start gap-2 rounded-[var(--radius-md)] px-3 py-2.5"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--primary) 6%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--primary) 15%, transparent)",
                        }}
                      >
                        <Info className="size-3.5 mt-0.5 shrink-0" style={{ color: "var(--primary)" }} />
                        <span style={{ ...st.tiny, color: "var(--primary)" }}>
                          Currently auto-calculated as the latest line item due date:{" "}
                          <strong>
                            {(() => {
                              const latest = po.lineItems.length > 0
                                ? po.lineItems.reduce((l, li) => li.dueDeliveryDate > l ? li.dueDeliveryDate : l, po.lineItems[0].dueDeliveryDate)
                                : po.deliveryDate;
                              const d = new Date(latest + "T00:00:00");
                              return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
                            })()}
                          </strong>
                        </span>
                      </div>
                      {/* Date input */}
                      <div className="flex flex-col gap-1.5">
                        <label style={{ ...st.fieldLabel, color: "var(--foreground)" }}>Delivery Date</label>
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

                {/* ━━━━ 6. ATTACHMENTS (closed by default) ━━━━ */}
                <CollapsibleSection
                  icon={Paperclip}
                  title={`Attachments (${allAttachments.length + extraAttachments.length})`}
                  defaultOpen={false}
                >
                  <div className="px-3 py-2.5">
                    {(allAttachments.length > 0 || extraAttachments.length > 0) ? (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {allAttachments.map((att) => (
                            <div
                              key={att.id}
                              className="relative aspect-square rounded-[var(--radius-md)] overflow-hidden border border-border bg-secondary cursor-pointer group"
                              onClick={() => setLightboxData({ images: [att.image], partNumber: att.itemNumber, itemName: att.descriptiveName })}
                            >
                              <ImageWithFallback src={att.image} alt={att.descriptiveName} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-all duration-200 flex items-end justify-start p-1.5">
                                <span className="text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity truncate drop-shadow-sm" style={st.tiny}>
                                  {att.itemNumber}
                                </span>
                              </div>
                            </div>
                          ))}
                          {extraAttachments.map((att) => (
                            <div
                              key={att.id}
                              className="relative aspect-square rounded-[var(--radius-md)] overflow-hidden border border-border bg-secondary cursor-pointer group"
                              onClick={() => {
                                if (att.type.startsWith("image/")) setLightboxData({ images: [att.url], partNumber: att.name, itemName: "" });
                              }}
                            >
                              {att.type.startsWith("image/") ? (
                                <ImageWithFallback src={att.url} alt={att.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                                  <Paperclip className="size-5 text-foreground/20" />
                                  <span className="text-foreground/40 text-center truncate w-full" style={st.tiny}>{att.name}</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-all duration-200 flex items-end justify-start p-1.5">
                                <span className="text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity truncate drop-shadow-sm" style={st.tiny}>
                                  {att.name}
                                </span>
                              </div>
                              {canManageAttachments && (
                                <button
                                  className="absolute top-1 right-1 flex items-center justify-center size-5 rounded-full bg-foreground/60 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-destructive"
                                  onClick={(e) => { e.stopPropagation(); guardEdit(() => setExtraAttachments((prev) => prev.filter((a) => a.id !== att.id)), "Attachment Removed"); }}
                                >
                                  <X className="size-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {canManageAttachments && (
                          <button
                            className="flex items-center gap-1 text-primary cursor-pointer hover:underline mt-2"
                            style={st.uiSmall}
                            onClick={() => guardEdit(() => setAttachmentOpen(true), "Attachment Added")}
                          >
                            <Plus className="size-3" />
                            Add more
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 gap-1.5">
                        <Paperclip className="size-4 text-foreground/15" />
                        <span className="text-foreground/30" style={st.uiSmall}>No attachments yet</span>
                        {canManageAttachments && (
                          <button
                            className="flex items-center gap-1.5 text-primary cursor-pointer hover:underline mt-1"
                            style={st.uiLabel}
                            onClick={() => guardEdit(() => setAttachmentOpen(true), "Attachment Added")}
                          >
                            <Plus className="size-3" />
                            Upload files
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleSection>



              </div>
            </div>
          </div>
        </div>
      </div>
      )}

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
        prefill={editingItem ? {
          vendorQty: editingItem.vendorQty,
          shipmentMethod: editingItem.shipmentMethod,
          dueDeliveryDate: editingItem.dueDeliveryDate,
          inboundLocation: editingItem.inboundLocation,
        } : null}
        onComplete={(result: OrderFlowResult) => {
          if (editingItem) {
            updateLineItem(po.id, editingItem.id, {
              vendorQty: result.vendorQty,
              quantity: result.quantity,
              unitPrice: result.unitPrice,
              discount: result.discount,
              dueDeliveryDate: result.dueDeliveryDate,
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
        prefill={viewingItem ? {
          vendorQty: viewingItem.vendorQty,
          shipmentMethod: viewingItem.shipmentMethod,
          dueDeliveryDate: viewingItem.dueDeliveryDate,
          inboundLocation: viewingItem.inboundLocation,
        } : null}
        onComplete={() => { setViewOpen(false); }}
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

      {/* ── Change Vendor Contact Dialog ── */}
      <ChangeVendorContactDialog
        open={vendorContactOpen}
        onOpenChange={setVendorContactOpen}
        poId={po.id}
        vendorName={po.vendor.name}
        currentRecipient={po.recipient}
        currentSecondaryNames={po.secondaryContactNames}
        onSaved={(newPrimaryName) => {
          if (editingSession?.confirmed && newPrimaryName !== po.recipient.name) {
            recordChangeDetail("Contact Change", {
              type: "vendor-changed",
              action: "Changed",
              subject: "Primary Contact",
              detail: `${po.recipient.name} → ${newPrimaryName}`,
            });
          }
        }}
      />

      {/* ── Payment Terms Selection Dialog ── */}
      <PaymentTermsDialog
        open={paymentEditOpen}
        onOpenChange={setPaymentEditOpen}
        currentTermName={po.payment.paymentTerms}
        onSelect={(termName) => {
          const oldVal = po.payment.paymentTerms;
          updatePOPayment(po.id, { ...po.payment, paymentTerms: termName });
          if (oldVal !== termName && editingSession?.confirmed) {
            recordChangeDetail("Payment Terms Change", { type: "config-changed", action: "Changed", subject: "Payment Terms", detail: `${oldVal} → ${termName}` });
          }
        }}
      />

      {/* ── Payment Method Selection Dialog ── */}
      <PaymentMethodDialog
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

      {/* ── Add Attachment Dialog ── */}
      <AddAttachmentDialog
        open={attachmentOpen}
        onOpenChange={setAttachmentOpen}
        onAdd={(newAtts) => setExtraAttachments((prev) => [...prev, ...newAtts])}
      />

      {/* ── Vendor Selection Dialogs (Pay To / Ship To / Funded By) ── */}
      <VendorSelectionDialog
        open={payToDialogOpen}
        onOpenChange={setPayToDialogOpen}
        title="Select Pay To Vendor"
        description="Choose the financial entity for payment processing."
        icon={BadgeDollarSign}
        vendors={PAY_TO_VENDORS}
        currentVendorName={po.payment.payTo}
        onSelect={(sel: VendorSelection) => {
          const oldVal = po.payment.payTo;
          updatePOPayment(po.id, { ...po.payment, payTo: sel.vendorName });
          if (oldVal !== sel.vendorName && editingSession?.confirmed) {
            recordChangeDetail("Billing Change", { type: "config-changed", action: "Changed", subject: "Pay To", detail: `${oldVal} → ${sel.vendorName}` });
          }
        }}
      />
      <VendorSelectionDialog
        open={shipToDialogOpen}
        onOpenChange={setShipToDialogOpen}
        title="Select Shipping Destination"
        description="Choose the warehouse or location for delivery."
        icon={Truck}
        vendors={SHIPPED_TO_VENDORS}
        currentVendorName={po.payment.shippedTo}
        onSelect={(sel: VendorSelection) => {
          const oldVal = po.payment.shippedTo;
          updatePOPayment(po.id, { ...po.payment, shippedTo: sel.vendorName });
          if (oldVal !== sel.vendorName && editingSession?.confirmed) {
            recordChangeDetail("Shipping Change", { type: "config-changed", action: "Changed", subject: "Ship To", detail: `${oldVal} → ${sel.vendorName}` });
          }
        }}
      />
      <VendorSelectionDialog
        open={fundedByDialogOpen}
        onOpenChange={setFundedByDialogOpen}
        title="Select Funding Entity"
        description="Choose the internal division or entity funding this order."
        icon={Building2}
        vendors={FUNDED_BY_VENDORS}
        currentVendorName={po.payment.fundedBy}
        onSelect={(sel: VendorSelection) => {
          const oldVal = po.payment.fundedBy;
          updatePOPayment(po.id, { ...po.payment, fundedBy: sel.vendorName });
          if (oldVal !== sel.vendorName && editingSession?.confirmed) {
            recordChangeDetail("Funding Change", { type: "config-changed", action: "Changed", subject: "Funded By", detail: `${oldVal} → ${sel.vendorName}` });
          }
        }}
      />

      {/* ── Duplicate PO Dialog ── */}
      <DuplicatePODialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        po={po}
        onDuplicate={(newPo) => {
          setDuplicateDialogOpen(false);
          navigate(`/purchase-orders/${newPo.id}`);
        }}
      />

      {/* ── Currency Configuration Modal ── */}
      <POCurrencyConfigModal
        open={currencyConfigOpen}
        onOpenChange={setCurrencyConfigOpen}
        po={po}
      />

      {/* ── Cancel PO Dialog ── */}
      <Dialog open={cancelPOOpen} onOpenChange={setCancelPOOpen}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
            <div className="flex items-center justify-center size-10 rounded-[var(--radius-md)] shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)" }}>
              <AlertTriangle className="size-5" style={{ color: "var(--destructive)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle style={{ ...st.fieldValueBold, fontSize: "var(--text-label)" }} className="text-foreground">
                Cancel Purchase Order
              </DialogTitle>
              <DialogDescription style={st.uiSmall} className="text-muted-foreground mt-0.5">
                Are you sure you want to cancel this Purchase Order? This will remove all quantities from On Order.
              </DialogDescription>
            </div>
          </div>
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-foreground" style={st.fieldLabel}>Cancellation Reason *</Label>
              <textarea
                className="w-full rounded-[var(--radius-md)] border border-border px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                style={st.fieldValue}
                rows={3}
                placeholder="Provide a reason for cancellation..."
                value={cancelPOReason}
                onChange={(e) => setCancelPOReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/30">
            <Button variant="outline" size="sm" className="h-8 px-3" style={st.uiLabel} onClick={() => setCancelPOOpen(false)}>
              Keep Active
            </Button>
            <Button
              size="sm"
              className="h-8 px-4"
              style={{ ...st.uiLabel, backgroundColor: "var(--destructive)", color: "var(--destructive-foreground)" }}
              disabled={!cancelPOReason.trim()}
              onClick={() => {
                cancelPO(po.id, cancelPOReason.trim());
                setCancelPOOpen(false);
                toast.success("Purchase Order cancelled", { description: `PO ${po.poNumber} has been cancelled`, style: { fontFamily: FONT } });
              }}
            >
              <X className="size-3.5 mr-1" /> Cancel PO
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reactivate PO Dialog ── */}
      <Dialog open={reactivatePOOpen} onOpenChange={setReactivatePOOpen}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
            <div className="flex items-center justify-center size-10 rounded-[var(--radius-md)] bg-primary/8 shrink-0">
              <ArrowLeft className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle style={{ ...st.fieldValueBold, fontSize: "var(--text-label)" }} className="text-foreground">
                Reactivate Purchase Order
              </DialogTitle>
              <DialogDescription style={st.uiSmall} className="text-muted-foreground mt-0.5">
                This will restore the PO to its previous state: {po.preCancellationStatus || "Draft"}.
              </DialogDescription>
            </div>
          </div>
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-foreground" style={st.fieldLabel}>Reactivation Reason *</Label>
              <textarea
                className="w-full rounded-[var(--radius-md)] border border-border px-3 py-2 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                style={st.fieldValue}
                rows={3}
                placeholder="Provide a reason for reactivation..."
                value={reactivateReason}
                onChange={(e) => setReactivateReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/30">
            <Button variant="outline" size="sm" className="h-8 px-3" style={st.uiLabel} onClick={() => setReactivatePOOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 px-4"
              style={st.uiLabel}
              disabled={!reactivateReason.trim()}
              onClick={() => {
                reactivatePO(po.id, reactivateReason.trim());
                setReactivatePOOpen(false);
                toast.success("Purchase Order reactivated", { description: `PO ${po.poNumber} has been restored`, style: { fontFamily: FONT } });
              }}
            >
              Reactivate PO
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Line Item Confirmation Dialog ── */}
      <Dialog open={!!cancelLineItemId} onOpenChange={(open) => { if (!open) setCancelLineItemId(null); }}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
            <div className="flex items-center justify-center size-10 rounded-[var(--radius-md)] shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)" }}>
              <X className="size-5" style={{ color: "var(--destructive)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle style={{ ...st.fieldValueBold, fontSize: "var(--text-label)" }} className="text-foreground">
                Cancel Line Item
              </DialogTitle>
              <DialogDescription style={st.uiSmall} className="text-muted-foreground mt-0.5">
                This item will be marked as cancelled and removed from the order total. You can add it back as a new line item if needed.
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/30">
            <Button variant="outline" size="sm" className="h-8 px-3" style={st.uiLabel} onClick={() => setCancelLineItemId(null)}>
              Keep Item
            </Button>
            <Button
              size="sm"
              className="h-8 px-4"
              style={{ ...st.uiLabel, backgroundColor: "var(--destructive)", color: "var(--destructive-foreground)" }}
              onClick={() => {
                if (cancelLineItemId) {
                  cancelLineItem(po.id, cancelLineItemId);
                  setCancelLineItemId(null);
                  toast.success("Line item cancelled", { style: { fontFamily: FONT } });

                  // Check if all items are now cancelled
                  const updatedPo = getPO(po.id);
                  if (updatedPo && updatedPo.lineItems.every((li) => li.cancelled)) {
                    setAllCancelledPromptOpen(true);
                  }
                }
              }}
            >
              Cancel Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── All Items Cancelled Prompt ── */}
      <Dialog open={allCancelledPromptOpen} onOpenChange={setAllCancelledPromptOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
            <div className="flex items-center justify-center size-10 rounded-[var(--radius-md)] shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--warning) 10%, transparent)" }}>
              <AlertTriangle className="size-5" style={{ color: "var(--warning)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle style={{ ...st.fieldValueBold, fontSize: "var(--text-label)" }} className="text-foreground">
                All Items Cancelled
              </DialogTitle>
              <DialogDescription style={st.uiSmall} className="text-muted-foreground mt-0.5">
                All line items are now cancelled. Do you want to cancel the entire Purchase Order?
              </DialogDescription>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-secondary/30">
            <Button variant="outline" size="sm" className="h-8 px-3" style={st.uiLabel} onClick={() => setAllCancelledPromptOpen(false)}>
              Keep PO Active
            </Button>
            <Button
              size="sm"
              className="h-8 px-4"
              style={{ ...st.uiLabel, backgroundColor: "var(--destructive)", color: "var(--destructive-foreground)" }}
              onClick={() => {
                cancelPO(po.id, "All line items cancelled");
                setAllCancelledPromptOpen(false);
                toast.success("Purchase Order cancelled", { description: "All items were cancelled", style: { fontFamily: FONT } });
              }}
            >
              Cancel Entire PO
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Version Confirm Modal ── */}
      <Dialog open={showVersionConfirmModal} onOpenChange={(open) => { if (!open) { setShowVersionConfirmModal(false); setPendingEditAction(null); } }}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden" style={{ fontFamily: FONT }}>
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
            <div className="flex items-center justify-center size-10 rounded-[var(--radius-md)] shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--warning) 12%, transparent)" }}>
              <AlertTriangle className="size-5" style={{ color: "var(--warning)" }} />
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
    </div>
    </AppShell>
  );
}