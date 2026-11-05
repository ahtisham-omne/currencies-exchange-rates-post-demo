/* SODetail — Sales Order detail view */
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useSOStore, getImportedAdjustments, getReleaseBlockers } from "./store";
import { focusFirstMissing } from "@/app/components/shared/fieldRequirements";
import { requiresNewDraftFirst } from "../../utils/versioningEngine";
import { usePricingRules } from "./usePricingRules";
import { useAdjustments } from "./useAdjustments";
import { usePersona } from "./PersonaContext";
import { SOStatusBadge, SO_STATUS_CSS_VAR } from "./StatusBadge";
import { LegacyImportPill } from "../import/LegacyImportPill";
import { InlineDescriptionEditor } from "@/app/components/shared/InlineDescriptionEditor";
import { DetailTabStrip } from "@/app/components/shared/DetailTabStrip";
import { SOLineGrid, uomScaleFactor } from "./SOLineGrid";
import { SOSidebar } from "./SOSidebar";
import { AllocateInventoryModal } from "./AllocateInventoryModalNew";
import { AddLineItemDialog } from "./AddLineItemDialog";
import { OutdatedConfigsModal } from "@/app/components/shared/OutdatedConfigsModal";
import {
  getOutdatedForId,
  markOutdatedApplied,
  markOutdatedIgnored,
  dismissOutdatedBanner,
  shouldShowOutdatedBanner,
} from "@/app/data/outdatedConfigs";
import { ShipmentsTab } from "./ShipmentsTab";
import { InvoicingTab } from "./InvoicingTab";

import { LinkedTransactionsTab } from "./LinkedTransactionsTab";
import { AttachmentsTab } from "./AttachmentsTab";
import { DealInformationTab } from "./DealInformationTab";
import { VersionHistoryTab } from "./VersionHistoryTab";
import { SourcingProductionTab } from "./SourcingProductionTab";
import { CancellationModal } from "./CancellationModal";
import { CancelSODraftModal } from "./CancelSODraftModal";
import { AdvancedConfiguratorModal } from "./AdvancedConfiguratorModal";
import { ConfirmSOModal } from "./ConfirmSOModal";
import { StageTransitionOverlay } from "./StageTransitionOverlay";
import { FulfillmentModal } from "./FulfillmentModal";
import { CreateShipmentModal } from "./CreateShipmentModal";
import { ExportSOModal } from "./ExportSOModal";
import { ArchiveModal } from "./ArchiveModal";
import { printSalesOrder } from "./PrintSalesOrder";
import { VersionHistoryModal } from "./VersionHistoryModal";
import { AutoVersionConfirmModal } from "./AutoVersionConfirmModal";
import { SOVersionDropdown } from "./SOVersionDropdown";
import { AutoVersionOverlay } from "./AutoVersionOverlay";
import { SendToCustomerModal } from "./SendToCustomerModal";
import { ConfirmationModal } from "./ConfirmationModal";
import { DuplicateSOModal } from "./DuplicateSOModal";
import { buildDuplicateSOPayload, isDuplicateBlockedByOps, duplicateBlockedReason } from "./duplicateSO";
import { StateTransitionOverlay } from "@/app/components/shared/StateTransitionOverlay";
import { StatusNoticeBanner } from "@/app/components/shared/StatusNoticeBanner";
import { NoticeBannerStack } from "@/app/components/shared/NoticeBannerStack";
import { StatusTimelineHoverCard, type StatusTimelineEntry } from "@/app/components/shared/StatusTimelineHoverCard";
import { RejectSOModal } from "./RejectSOModal";
import { ReactivateChoiceModal } from "./ReactivateChoiceModal";
import { DisabledCTATooltip } from "./DisabledCTATooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/app/components/ui/tooltip";
import { toast } from "sonner";
import { StagePopover } from "./StagePopover";
import {
  Pencil, Clock, Archive, ArchiveRestore, ChevronLeft, FileText,
  GitBranch, ChevronDown, Flag, Check, Ban, Scissors,
  MessageSquare, AlertTriangle, Truck, Download, Copy, History,
  Package, ArrowUpRight, Receipt, Paperclip, Link2, Zap, DollarSign, Plus,
  Send, CheckCircle2, XCircle, Printer, RotateCcw,
  Maximize2, Minimize2, StickyNote, Upload, RefreshCw, X, ThumbsDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import { DateEditModal, type SODateType, type DateConfig } from "./ui/DateEditModal";
import type { SOLine, CancellationReason, SOPriority } from "./types";
import { ARCHIVABLE_STATES } from "./types";
import { getLineItemImage } from "./lineItemImage";
import { InactiveItemsWarningModal, type InactiveWarningMode } from "../shared/InactiveItemsWarningModal";
import { isItemInactive } from "../shared/inactiveItems";

/* ── Inline editable description — wraps the shared InlineDescriptionEditor
   so the SO header has the same multi-line, more/less, Partner-style
   expanding textarea experience as the Quote header. ── */
function SODescriptionEditor({ soId: _soId, initialDescription }: { soId: string; initialDescription: string }) {
  const [desc, setDesc] = useState(initialDescription);
  return (
    <InlineDescriptionEditor
      value={desc}
      onChange={setDesc}
      placeholder="Add a description..."
    />
  );
}

const TABS = [
  { id: "lines", label: "Line Items" },
  { id: "deal", label: "Deal Information" },
  { id: "sourcing", label: "Sourcing & Procurement" },
  { id: "shipping", label: "Shipping" },
  { id: "invoicing", label: "Invoicing" },
  { id: "attachments", label: "Attachments" },
  { id: "linked", label: "Linked Transactions" },
  { id: "comms", label: "Communications" },
  { id: "activity", label: "Activity" },
  { id: "versions", label: "Versions" },
];

export function SODetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useSOStore();
  
  const { isCreator, isReviewer } = usePersona();
  const so = store.salesOrders.find(s => s.id === id);

  /* Shared pricing-rules state: one instance lives at SODetail and is
     passed down to both the summary modal (via SOSidebar) and the line
     item configurator. Activating / deactivating a rule (or per-item
     toggling it) from either surface updates this single source of
     truth, so totals + applicability stay in lockstep. Safe defaults
     when `so` hasn't resolved yet so we don't break rules-of-hooks. */
  const pricingAPI = usePricingRules(so?.customer ?? '', so?.lines ?? []);

  /* Shared one-time-adjustments state — parallel to pricingAPI, lifted
     here so the summary modal and the line item configurator share the
     same list of adjustments. Newly-created SOs (created through the
     in-app flow, not the mock seed) start with zero adjustments — the
     user adds them via the empty state. */
  /* An imported order opens with the adjustments its file carried;
     anything else follows the existing rule (demo seed for mocks, empty
     for orders created in-app). */
  const importedAdjustments = so ? getImportedAdjustments(so.id) : undefined;
  const adjustmentsAPI = useAdjustments(so?.lines ?? [], {
    skipSeed: !!so?.createdViaUI,
    seed: importedAdjustments as any,
  });

  const [activeTab, setActiveTab] = useState("lines");

  /* Track the right sidebar's live height so the Attachments tab card
     can be capped at that height (dynamically — closing / opening any
     sidebar section reflows and the observer refreshes). Wired via
     ResizeObserver on the sidebar column wrapper. */
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarHeight, setSidebarHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    /* Below lg the sidebar stacks under the body instead of beside it,
       so there is no column height to match: drop the cap. Crossing the
       breakpoint resizes the sidebar, which re-runs this. */
    const beside = window.matchMedia("(min-width: 1024px)");
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setSidebarHeight(beside.matches ? entry.contentRect.height : null);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [allocationLine, setAllocationLine] = useState<SOLine | null>(null);
  const [showAddLine, setShowAddLine] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [cancelModalMode, setCancelModalMode] = useState<"full" | "partial" | null>(null);
  const [cancelPreselectedLineIds, setCancelPreselectedLineIds] = useState<string[]>([]);
  /* Draft sales orders haven't been allocated, picked, shipped, or
     cleared by ops, so the full CancellationModal (with its shipped-vs
     unshipped reasoning) is overkill. Mirror the Quote-side
     CancelQuoteModal here: a single confirmation with an optional
     reason. Non-Draft statuses keep the full modal so cancellation
     still surfaces inventory/fulfillment impact. */
  const [showDraftCancelModal, setShowDraftCancelModal] = useState(false);
  const isDraftStatus = so?.status === "Draft";
  const requestFullCancel = () => {
    if (isDraftStatus) setShowDraftCancelModal(true);
    else setCancelModalMode("full");
  };
  const [configureLine, setConfigureLine] = useState<SOLine | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCTADropdown, setShowCTADropdown] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFulfillmentModal, setShowFulfillmentModal] = useState(false);
  const [showCreateShipmentModal, setShowCreateShipmentModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReactivateChoice, setShowReactivateChoice] = useState(false);
  /* Per-session dismiss for the rejection banner. The underlying
     rejection reason on the SO persists so the banner reappears on
     the next visit / reload; this flag just lets the current user
     collapse it while they're working in the reactivated draft. */
  const [rejectionBannerDismissed, setRejectionBannerDismissed] = useState(false);
  /* Partner-Management propagation payload keyed by SO id — only the
     hero demo SO (id `so-outdated-demo`) surfaces the pill; every
     other SO returns [] and reads as up-to-date. Applied ids drop
     out of both local state and the shared registry so navigating
     away + back doesn't resurrect them. */
  const [outdatedUpdates, setOutdatedUpdates] = useState(() => getOutdatedForId(so?.id));
  const [showOutdatedConfigsModal, setShowOutdatedConfigsModal] = useState(false);
  /* Version card visibility. Drives the X-close affordance the user
     can hit to hide the whole bar for the session (saves vertical
     space). Also refreshed whenever the outdated banner is dismissed
     so the bar re-renders to the plain version-status content. */
  const [versionBannerHidden, setVersionBannerHidden] = useState(false);
  const [outdatedBannerVisible, setOutdatedBannerVisible] = useState(() =>
    shouldShowOutdatedBanner(so?.id),
  );
  /* Auto-dismiss the outdated banner the moment the SO leaves Draft.
     Submitting for review, clearing, shipping, or forking a new
     version all move the record out of Draft; keeping the banner
     around after that would nag the user about a sync that no longer
     applies. Treated as an implicit "ignore" so it goes away and
     never resurfaces. */
  useEffect(() => {
    if (so && so.status !== "Draft" && outdatedBannerVisible) {
      dismissOutdatedBanner(so.id);
      setOutdatedBannerVisible(false);
    }
  }, [so, outdatedBannerVisible]);
  /* When the SO status doesn't require a new-draft fork (Draft path),
     applying skips AutoVersionOverlay and would otherwise be silent.
     This drives a StateTransitionOverlay for that path so the sync
     lands with the same visual acknowledgement as version bumps. */
  const [outdatedSyncOverlay, setOutdatedSyncOverlay] = useState<{ count: number; label: string } | null>(null);
  /* Success toast that has to wait until the material-change flow
     actually finishes on the Cleared / Shipped path. AutoVersionOverlay's
     onComplete drains it after the version toast so both messages
     land in sequence. If the user cancels the version confirm modal,
     the pending toast is cleared so nothing fires. */
  const [pendingSyncSuccessToast, setPendingSyncSuccessToast] = useState<string | null>(null);
  /* Auto-open the review modal when the user landed here via
     `?outdated=1` (clicked the pill from the SO listing). */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('outdated') === '1' && outdatedUpdates.length > 0) {
      setShowOutdatedConfigsModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Holds the overlay metadata while the duplicate animation plays.
     We build the new SO synchronously, then show the overlay; when it
     finishes we navigate to the duplicate. Mirrors the Quote-side
     `actionOverlay` pattern. */
  const [duplicateOverlay, setDuplicateOverlay] = useState<{
    soNumber: string;
    customerName: string;
    targetId: string;
    versionLabel: string;
  } | null>(null);
  const [showSendToCustomer, setShowSendToCustomer] = useState(false);
  const [isSendResend, setIsSendResend] = useState(false);
  /* Inactive-items guard (PO \`withInactiveCheck\`). The action the user
     started is held in \`run\` and replayed on "anyway". Declared here,
     above the not-found early return, so hook order never changes. */
  const [inactiveWarning, setInactiveWarning] = useState<{ mode: InactiveWarningMode; run: () => void } | null>(null);
  const [sendModalMode, setSendModalMode] = useState<"send" | "print">("send");
  const ctaDropdownRef = useRef<HTMLDivElement>(null);
  const suppressNextTransitionRef = useRef(false);

  /* Scroll state for header compression */
  const contentScrollRef = useRef<HTMLDivElement>(null);
  // Tracks the last version number we already showed the "draft created"
  // toast for, so re-renders / strict-mode double-fires of the
  // AutoVersionOverlay onComplete don't spam duplicate toasts.
  const toastedForVersionRef = useRef<number | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    // Detail page is no longer its own scroll container; AppLayout's
    // <main> element owns the single page scrollbar. Find that ancestor
    // via contentScrollRef and listen to its scrollTop so the sticky
    // header still morphs as the page scrolls.
    const el = contentScrollRef.current;
    if (!el) return;
    const scrollEl = el.closest("main") as HTMLElement | null;
    if (!scrollEl) return;
    const handler = () => setIsScrolled(scrollEl.scrollTop > 10);
    scrollEl.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => scrollEl.removeEventListener("scroll", handler);
  }, []);

  /* Date state for editable date cards in detail header */
  const [editingDateType, setEditingDateType] = useState<SODateType | null>(null);
  const [detailDateConfigs, setDetailDateConfigs] = useState({
    request: { dateType: "absolute" as const, absoluteValue: so?.createdDate || "03/16/2026", relativeValue: "", relativeUnit: "days" },
    estShip: { dateType: "relative" as const, absoluteValue: "", relativeValue: "20", relativeUnit: "days after order" },
    dueDelivery: { dateType: "relative" as const, absoluteValue: "", relativeValue: "30", relativeUnit: "days after order" },
  });

  useEffect(() => {
    if (!showCTADropdown) return;
    const handler = (e: MouseEvent) => {
      if (ctaDropdownRef.current && !ctaDropdownRef.current.contains(e.target as Node)) setShowCTADropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showCTADropdown]);

  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showAutoVersionConfirm, setShowAutoVersionConfirm] = useState(false);
  const [autoVersionField, setAutoVersionField] = useState("");
  const [showAutoVersionOverlay, setShowAutoVersionOverlay] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<SOPriority>(so?.priority ?? "Standard");

  // Pending change for auto-versioning: stores the action to apply after version draft is created
  const [pendingVersionChange, setPendingVersionChange] = useState<{
    fieldLabel: string;
    oldValue?: string;
    newValue?: string;
    action: () => void;
    /* Called when the user DISCARDS the version prompt. Lets the
       originating modal undo the mutation it already applied (e.g.
       remove a discount that was added to adjustmentsAPI). Without
       this, rejecting the prompt left the adjustment in place. */
    onRevert?: () => void;
    isRevert?: boolean;
    revertToVersion?: number;
    revertOriginalStatus?: string;
  } | null>(null);

  /* Set when a release is blocked by an empty required field (see
     FIELD_RULES requiredAt "release"). The sidebar outlines those
     fields in red until they are filled. */
  const [releaseAttempted, setReleaseAttempted] = useState(false);
  useEffect(() => { setReleaseAttempted(false); }, [so?.id]);

  /* `?action=submit` / `?action=release` come from the listing row menu.
     They run the header's own flow (inactive-items warning, then the
     submit or the release confirm modal), so a row never jumps an order
     forward without the steps the page asks for. Read once, then dropped
     from the URL so a refresh does not run it again. */
  const [searchParams, setSearchParams] = useSearchParams();
  const [rowAction] = useState(() => searchParams.get("action"));
  useEffect(() => {
    if (searchParams.get("action")) {
      const next = new URLSearchParams(searchParams);
      next.delete("action");
      setSearchParams(next, { replace: true });
    }
    if (!so) return;
    if (rowAction === "submit" && so.status === "Draft" && isCreator) {
      withInactiveCheck("submit", () => handleMarkUnconfirmed());
    } else if (rowAction === "release" && (so.status === "Draft" || so.status === "Pending Review") && isReviewer) {
      withInactiveCheck("release", () => setShowConfirmModal(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!so) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-foreground" style={{ fontSize: "var(--text-h4)", fontWeight: "var(--font-weight-semibold)" }}>Sales Order not found</h2>
          <button onClick={() => navigate("/sales-orders")} className="mt-3 text-primary" style={{ fontSize: "var(--text-caption)" }}>&larr; Back to list</button>
        </div>
      </div>
    );
  }

  const soShipments = store.shipments.filter(s => so.shipmentIds.includes(s.id));

  // ===== Action permissions =====
  const isDraft = so.status === "Draft";
  /* Cancelled lines are left out, as PO does: they no longer travel. */
  const inactiveWarningLines = so.lines
    .filter((l) => !l.cancelled)
    .map((l) => ({ id: l.id, code: l.itemCode, name: l.itemName, image: getLineItemImage(l.itemCode) }));
  /* Only a Draft is checked: that is the move toward an active state. An
     order already under review or released is resent as it stands. */
  const withInactiveCheck = (mode: InactiveWarningMode, run: () => void) => {
    if (isDraft && inactiveWarningLines.some((l) => isItemInactive(l.code))) setInactiveWarning({ mode, run });
    else run();
  };
  const isUnconfirmed = so.status === "Pending Review";
  const isShipped = so.status === "Shipped";
  const canAllocate = !["Cancelled", "Shipped", "Archived"].includes(so.status);
  const canCancel = !["Cancelled", "Archived", "Shipped"].includes(so.status);
  const canArchive = ARCHIVABLE_STATES.includes(so.status);
  const canUnarchive = so.status === "Archived";
  const canReactivate = ["Cancelled", "Partially Cancelled", "Archived"].includes(so.status);
  const isPostConfirmed = ["Cleared", "Partially Shipped", "Shipped"].includes(so.status);

  /* Cancellation mode availability for CTA dropdown */
  const hasAnyShippedLine = so.lines.some(l => !l.cancelled && l.shippedQty > 0);
  const cancellableLinesForCTA = so.lines.filter(l => !l.cancelled && l.shippedQty < l.orderedQty);
  const isPartialCancelMeaningless = cancellableLinesForCTA.length === 0 || (
    cancellableLinesForCTA.length === 1 &&
    (cancellableLinesForCTA[0].orderedQty - cancellableLinesForCTA[0].shippedQty - (cancellableLinesForCTA[0].cancelledQty || 0)) <= 1
  );
  const isFullCancelBlocked = hasAnyShippedLine;

  /* Projected SO total = post-rule line subtotal + adjustment net impact.
     If pricing rules + one-time discounts push this below $0, the SO
     can't legally proceed — we'd be invoicing a negative number. Used
     to gate stage transitions out of Draft. */
  const projectedTotal = pricingAPI.soSubtotal + adjustmentsAPI.grandTotal.net;
  const totalIsNegative = projectedTotal < 0;
  const blockTransitionIfNegative = (intent: string): boolean => {
    if (!totalIsNegative) return false;
    toast.error(
      `Cannot ${intent}. Projected total is ${
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(projectedTotal)
      }. Deactivate one or more rules or one-time discounts to bring the total back to $0 or above.`,
      { duration: 6000 },
    );
    return true;
  };

  const handleMarkUnconfirmed = () => {
    if (blockTransitionIfNegative('send for review')) return;
    store.markUnconfirmed(so.id);
  };

  const handleConfirm = () => {
    if (blockTransitionIfNegative('approve')) return;
    const result = store.confirmSO(so.id);
    if (result.valid) { setShowConfirmModal(false); return; }
    result.errors.forEach(e => toast.error(e));
    const blockers = getReleaseBlockers(so);
    if (blockers.length > 0) {
      /* Close the confirm modal so the outlined fields are visible. */
      setShowConfirmModal(false);
      setReleaseAttempted(true);
      focusFirstMissing(blockers);
    }
  };

  const handleCancelFull = (reason: CancellationReason, reasonText: string) => {
    if (so.status === "Cancelled" || so.status === "Archived") {
      toast.error(`Sales Order ${so.soNumber} can't be cancelled from ${so.status}`);
      return;
    }
    store.cancelSO(so.id, reason, reasonText);
    // Toast complements the StageTransitionOverlay so the user gets
    // confirmation even when the status visual flashes by quickly. Delay
    // matches the overlay so the toast lands as the new status settles.
    setTimeout(() => toast.success(`Sales Order ${so.soNumber} cancelled`), 1400);
  };

  const handleCancelPartial = (lineIds: string[], cancelQtys: Record<string, number>, reason: CancellationReason, reasonText: string) => {
    if (so.status === "Cancelled" || so.status === "Archived") {
      toast.error(`Sales Order ${so.soNumber} can't be cancelled from ${so.status}`);
      return;
    }
    if (lineIds.length === 0) {
      toast.error("No lines selected to cancel");
      return;
    }
    store.cancelSOLines(so.id, lineIds, reason === "Other" && reasonText ? `${reason}: ${reasonText}` : reason, cancelQtys);
    // Same delay pattern as full cancel: by 1.4s the SO has either moved
    // to Cancelled (all remaining qty cancelled) or Partially Cancelled,
    // and the toast confirms the action. Without this, cancelling the
    // remaining items on a Partially Shipped SO gave no feedback at all.
    const totalCancelledQty = Object.values(cancelQtys).reduce((s, n) => s + (n || 0), 0);
    setTimeout(() => {
      const lineLabel = `${lineIds.length} line${lineIds.length === 1 ? "" : "s"}`;
      const qtyLabel = totalCancelledQty > 0 ? ` (${totalCancelledQty} unit${totalCancelledQty === 1 ? "" : "s"})` : "";
      toast.success(`Cancelled ${lineLabel}${qtyLabel} on ${so.soNumber}`);
    }, 1400);
  };

  const handleArchive = () => {
    store.archiveSO(so.id);
    // No toast — StageTransitionOverlay animation provides visual feedback
  };
  const handleUnarchive = () => { store.unarchiveSO(so.id); toast.success("Sales Order unarchived"); };
  const handleReactivate = () => {
    store.reactivateSO(so.id);
    // No toast — StageTransitionOverlay animation provides visual feedback
  };
  const handleCancelLines = (lineIds: string[]) => {
    setCancelPreselectedLineIds(lineIds);
    setCancelModalMode("partial");
  };

  // ===== Stepper — icon-based, matching Quotes module =====
  const ALL_SO_STEPS = [
    { id: "Draft", label: "Draft", icon: FileText, fillColor: "#4B5563", ringColor: "#9CA3AF" },
    { id: "Pending Review", label: "Pending Review", icon: Send, fillColor: "#F59E0B", ringColor: "#FCD34D" },
    { id: "Cleared", label: "Released", icon: CheckCircle2, fillColor: "#0A77FF", ringColor: "#7BB7FF" },
    { id: "Partially Shipped", label: "Partially Shipped", icon: Truck, fillColor: "#7C3AED", ringColor: "#C4B5FD" },
    { id: "Shipped", label: "Shipped", icon: Package, fillColor: "#047857", ringColor: "#34D399" },
  ];
  // Approver View is the reviewer, so the "Pending Review" step is redundant
  // for them: Draft moves directly to Released. Keep the step visible when
  // the SO is currently in that state OR when it was in that state before
  // a terminal (Rejected fork lives here), so the stepper's completed / in-
  // progress fills stay accurate against the record's real path.
  const isOwnSO = so.salesRep === "Current User";
  const soPassedThroughPendingReview = so.status === "Pending Review" || so.previousStatus === "Pending Review";
  const SO_STEPS = isReviewer && !soPassedThroughPendingReview
    ? ALL_SO_STEPS.filter(s => s.id !== "Pending Review")
    : ALL_SO_STEPS;
  const TERMINAL_STATES_MAP: Record<string, { label: string; icon: typeof XCircle; fillColor: string; ringColor: string }> = {
    Rejected: { label: "Rejected", icon: ThumbsDown, fillColor: "#DC2626", ringColor: "#FCA5A5" },
    Cancelled: { label: "Cancelled", icon: XCircle, fillColor: "#DC2626", ringColor: "#FCA5A5" },
    "Partially Cancelled": { label: "Partially Cancelled", icon: XCircle, fillColor: "#DC2626", ringColor: "#FCA5A5" },
    Archived: { label: "Archived", icon: Archive, fillColor: "#DC2626", ringColor: "#FCA5A5" },
  };
  const isTerminalStatus = !!TERMINAL_STATES_MAP[so.status];
  const terminalConfig = isTerminalStatus ? TERMINAL_STATES_MAP[so.status] : null;
  const currentStepIndex = (() => {
    return SO_STEPS.findIndex(s => s.id === so.status);
  })();
  const terminalBranchIndex = isTerminalStatus ? (() => {
    if (so.previousStatus) {
      const idx = SO_STEPS.findIndex(s => s.id === so.previousStatus);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  })() : -1;
  const resolvedStepIdx = isTerminalStatus ? terminalBranchIndex : currentStepIndex;
  const statusCssVar = SO_STATUS_CSS_VAR[so.status] || "var(--foreground)";

  const soVersion = so.version ?? { number: 1, label: "Latest" as const, date: so.createdDate };
  const soVersions = so.versions ?? [soVersion];
  const soPriority = so.priority ?? "Standard";

  const confirmedStatuses = ["Cleared", "Partially Shipped", "Shipped"];
  const isConfirmedOrBeyond = confirmedStatuses.includes(so.status);
  const displayVersionLabel = isConfirmedOrBeyond ? (soVersion.label === "Latest" ? "Last Approved" : soVersion.label) : "Latest";
  const displayVersionLabelColor = displayVersionLabel === "Latest" ? "bg-success/10 text-success" : displayVersionLabel === "Last Approved" ? "bg-primary/10 text-primary" : "bg-secondary text-foreground/50";


  // Tokens match the Quote and SO PriorityBadge so the pill chrome is
  // identical across the detail header, list table, and Kanban cards.
  const priorityConfig: Record<SOPriority, { cssVar: string; textColor: string; bgStyle: string; borderColor: string }> = {
    Low:      { cssVar: "#475569", textColor: "text-[#475569]", bgStyle: "bg-[#F1F5F9]", borderColor: "#E2E8F0" },
    Standard: { cssVar: "#1E40AF", textColor: "text-[#1E40AF]", bgStyle: "bg-[#EFF6FF]", borderColor: "#BFDBFE" },
    High:     { cssVar: "#991B1B", textColor: "text-[#991B1B]", bgStyle: "bg-[#FEF2F2]", borderColor: "#FECACA" },
  };

  const sourcingCount = so.procurementOrders.length + so.backorders.length;
  /* Mirror the visibility rules used in the LinkedTransactionsTab render
     so the tab badge never advertises rows the tab itself hides. */
  const linkedCount = (() => {
    if (so.createdViaUI) return 0;
    if (so.status === "Draft") return 0;
    const baseExcluded = ["Invoice", "Credit Memo", "Payment Receipt"];
    const hasShipped = so.status === "Partially Shipped" || so.status === "Shipped";
    return so.linkedTransactions.filter(t => {
      if (baseExcluded.includes(t.type)) return false;
      if (!hasShipped && (t.type === "Shipment" || t.type === "Delivery Confirmation")) return false;
      return true;
    }).length;
  })();
  const tabCounts: Record<string, number> = {
    lines: so.lines.length,
    linked: linkedCount,
    activity: so.activityLog.length,
    shipping: soShipments.length,
    attachments: so.attachments.length,
    sourcing: sourcingCount,
    versions: so.versions?.length ?? (so.version?.number ?? 1),
  };

  const statusMessage = getStatusMessage(so);

  /* ── Timeline date display helpers ── */
  const fmtNow = () => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  };
  const getRequestDisplay = () => detailDateConfigs.request.absoluteValue || fmtNow();
  const getEstShipDisplay = () =>
    (detailDateConfigs.estShip as any).dateType === "absolute"
      ? detailDateConfigs.estShip.absoluteValue || fmtNow()
      : `${detailDateConfigs.estShip.relativeValue} ${detailDateConfigs.estShip.relativeUnit}`;
  const getDueDeliveryDisplay = () =>
    (detailDateConfigs.dueDelivery as any).dateType === "absolute"
      ? detailDateConfigs.dueDelivery.absoluteValue || fmtNow()
      : `${detailDateConfigs.dueDelivery.relativeValue} ${detailDateConfigs.dueDelivery.relativeUnit}`;

  /* Date configs are managed via the sidebar timeline card — see SOSidebar */

  /* ── Stepper uses resolvedStepIdx from above ── */

  return (
    <>
      {/* Page container — Partner Management `VendorDetailsPage` parity.
          The OUTER wrapper spans the full width of the AppLayout's
          `<main>` scroll container and paints a slate-50 page
          background. Each child section (the sticky header card + the
          body/sidebar row) then bounds its OWN content with an inner
          `max-w-[1440px] 2xl:max-w-[1600px]` wrapper. That keeps the
          sticky bar's full-bleed background on wide screens while
          centering the actual card and tab rail at the 1440 / 1600
          ceiling. Fullscreen mode (the header maximise toggle) flips
          those inner caps to `max-w-full`. */}
      <div className="bg-slate-50" style={{ width: "100%", minHeight: "100%" }}>

        {/* Cancellation banner removed — cancellation is instant, no pending state */}

        {/* Archived banner removed — Reactivate CTA is in header */}

        {/* ═══════════════════════════════════════════════
            UNIFIED HEADER CARD — PO-style: full-height gradient, icon back, 4 action buttons
           ═══════════════════════════════════════════════ */}
        {(() => {

          // Compute total value from lines
          const totalValue = so.lines.reduce((sum: number, l: SOLine) => sum + (l.orderedQty * l.unitPrice), 0);

          // Header card chrome — Partner Management pattern (VendorDetailsPage):
          // every non-draft lifecycle state gets a vertical gradient that
          // tints the bottom edge and fades to white moving upward, so the
          // header communicates state at a glance without overwhelming the
          // content area. Tint hues reuse the existing flat SOStatusBadge
          // colors below so card + pill stay coherent. Border colors stay
          // saturated so the outline reads clearly against the tinted bottom
          // edge of the card.
          const statusTints: Record<typeof so.status, { bg: string; border: string }> = {
            // Draft is intentionally untinted — edits-in-flight state uses
            // plain white so the focus stays on the form.
            Draft:                 { bg: "#FFFFFF", border: "var(--border)" },
            "Pending Review":      { bg: "linear-gradient(to top, #FEFBF3 0%, #FFFFFF 55%, #FFFFFF 100%)", border: "#FCD34D" },
            Cleared:               { bg: "linear-gradient(to top, #F4F8FF 0%, #FFFFFF 55%, #FFFFFF 100%)", border: "#93C5FD" },
            Rejected:              { bg: "linear-gradient(to top, #FEF7F7 0%, #FFFFFF 55%, #FFFFFF 100%)", border: "#FCA5A5" },
            "Partially Shipped":   { bg: "linear-gradient(to top, #FAF7FF 0%, #FFFFFF 55%, #FFFFFF 100%)", border: "#C4B5FD" },
            Shipped:               { bg: "linear-gradient(to top, #F4FBF7 0%, #FFFFFF 55%, #FFFFFF 100%)", border: "#86EFAC" },
            "Partially Cancelled": { bg: "linear-gradient(to top, #FEF7F7 0%, #FFFFFF 55%, #FFFFFF 100%)", border: "#FCA5A5" },
            Cancelled:             { bg: "linear-gradient(to top, #FEF7F7 0%, #FFFFFF 55%, #FFFFFF 100%)", border: "#FCA5A5" },
            Archived:              { bg: "linear-gradient(to top, #FEF2F2 0%, #FFFFFF 55%, #FFFFFF 100%)", border: "#FECACA" },
          };
          const tint = statusTints[so.status] ?? { bg: "#FFFFFF", border: "var(--border)" };
          const cardBackground = tint.bg;
          const cardBorderColor = tint.border;
          const cardBorderWidth = so.status === "Draft" ? 1 : 1.5;




          // ── Determine if PO-like "closed" dimmed state ──
          const isClosed = isTerminalStatus || isShipped;

          return (
            <>
            <div
              className="shrink-0 relative"
              style={{
                // Sticky-compact pattern — the bar spans the full width
                // of the page so the slate-50 backdrop reads cleanly to
                // the viewport edges; the inner `max-w-[1440px]`
                // wrapper just below bounds the actual card content.
                // Padding-bottom hides the version banner (and any
                // other content directly below the card) once scrolled
                // past — without it the banner peeks through the gap
                // between the sticky bar and its sibling on the way up.
                position: "sticky",
                top: 0,
                /* Partner `VendorDetailsPage` spacing tokens: 12px top /
                   4px bottom at rest, 8px / 4px when scrolled. The 12px
                   breathing room above the card stops the header from
                   sitting flush against the top app-bar; the body gap
                   below comes from the body wrapper's `pt-3` (12px) so
                   the total nav→body rhythm matches Partner exactly. */
                padding: `${isScrolled ? "8px" : "12px"} 0 4px`,
                transition: "padding 200ms ease",
                zIndex: 30,
                background: isScrolled ? "rgb(248, 250, 252)" : "transparent",
              }}
            >
              <div className={`mx-auto transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"} px-4 lg:px-6 xl:px-8`}>
              <div
                className="relative transition-all duration-200"
                style={{
                  borderRadius: 12,
                  boxShadow: "var(--elevation-sm)",
                  background: cardBackground,
                  border: `${cardBorderWidth}px solid ${cardBorderColor}`,
                  transition: "background 0.4s ease, border-color 0.4s ease",
                  overflow: "visible",
                }}
              >
                {/* ── Row 1: Back + Doc icon + (SO#/badges/description column) | Right: actions + CTA ── */}
                {/* Below md the title block takes the whole row and the
                    actions drop to a row of their own, right-aligned
                    (on a phone the CTA takes a line of its own).
                    PO keeps both on one line at every width, which
                    breaks the record number apart below ~768px. */}
                <div
                  className="flex items-center justify-between max-md:flex-wrap transition-all duration-200"
                  style={{ padding: isScrolled ? "6px 16px" : "12px 16px", gap: 12 }}
                >
                  {/* Left: Back icon + doc icon + (number+badges+description column) */}
                  <div className={`flex items-center min-w-0 max-md:w-full ${isScrolled ? "gap-2" : "gap-2.5"}`}>
                    {/* Back button — Partner-exact dimensions (32/44, rounded-xl). */}
                    <button
                      onClick={() => navigate("/sales-orders")}
                      className="shrink-0 flex items-center justify-center rounded-xl border border-border bg-white hover:bg-slate-50 cursor-pointer transition-all duration-250"
                      title="Back to Sales Orders"
                      style={{
                        width: isScrolled ? 32 : 44,
                        height: isScrolled ? 32 : 44,
                        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                        color: isClosed ? "color-mix(in srgb, var(--muted-foreground) 55%, transparent)" : "var(--muted-foreground)",
                      }}
                    >
                      <ChevronLeft className="text-slate-400 transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
                    </button>

                    {/* Document icon — Partner-exact dimensions (32/44, rounded-xl).
                        Decorative, so it gives its width to the title below sm. */}
                    <div
                      className="max-sm:hidden shrink-0 flex items-center justify-center rounded-xl border border-border bg-muted"
                      style={{
                        width: isScrolled ? 32 : 44,
                        height: isScrolled ? 32 : 44,
                        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)",
                        transition: "width 250ms ease, height 250ms ease",
                      }}
                    >
                      <Receipt className="text-slate-500" style={{ width: isScrolled ? 16 : 22, height: isScrolled ? 16 : 22 }} />
                    </div>

                    {/* SO number + badges (line 1) + description (line 2) — verbatim
                        Partner pattern from VendorDetailsPage: a single column
                        sitting next to the back/icon, with the description tucked
                        directly underneath the badges row. */}
                    <div className="min-w-0 flex-1">
                      {/* Line 1: SO# + version + priority + status */}
                      <div className="flex items-center flex-wrap" style={{ gap: isScrolled ? 6 : 8 }}>
                        {/* SO ID typography mirrors Partner detail header
                            `vendor.displayName` (VendorDetailsPage): 16/13
                            sizes, 700/600 weights, 22/18 line heights —
                            same scale Partner / Quote use. */}
                        <span className="text-foreground" style={{
                          fontSize: isScrolled ? 13 : 16,
                          fontWeight: isScrolled ? 600 : 700,
                          lineHeight: isScrolled ? "18px" : "22px",
                          letterSpacing: "-0.01em",
                          color: isClosed ? "var(--muted-foreground)" : undefined,
                        }}>{so.soNumber}</span>

                        <SOVersionDropdown
                          currentVersion={soVersion.number}
                          currentStatus={so.status}
                          onViewVersion={(v) => { /* TODO: hook up version viewing */ }}
                          /* Revert-as-draft locked once units ship.
                             Passing `undefined` causes the dropdown to
                             hide its "Edit as VN+1" / revert items so
                             the user can't trigger a new draft. */
                          onEditAsDraft={hasAnyShippedLine ? undefined : (fromVersion, originalStatus) => {
                            setPendingVersionChange({
                              fieldLabel: `Revert to V${fromVersion}`,
                              action: () => {
                                store.revertToVersion(so.id, fromVersion);
                              },
                              isRevert: true,
                              revertToVersion: fromVersion,
                              revertOriginalStatus: originalStatus,
                            });
                            setAutoVersionField(`Revert to V${fromVersion}`);
                            setShowAutoVersionConfirm(true);
                          }}
                          materialChangesCount={0}
                          isScrolled={isScrolled}
                        />

                        <div className="relative">
                          <button
                            onClick={() => { setShowPriorityDropdown(!showPriorityDropdown); setShowVersionDropdown(false); }}
                            className={`flex items-center gap-1 transition-colors whitespace-nowrap ${priorityConfig[selectedPriority].bgStyle}`}
                            style={{
                              height: isScrolled ? 22 : 24,
                              paddingLeft: 10,
                              paddingRight: 8,
                              borderRadius: 999,
                              border: `1px solid ${priorityConfig[selectedPriority].borderColor}`,
                            }}
                          >
                            <span className={priorityConfig[selectedPriority].textColor} style={{ fontSize: 11, fontWeight: 600 }}>{selectedPriority}</span>
                            <ChevronDown className={`w-3 h-3 opacity-70 ${priorityConfig[selectedPriority].textColor}`} />
                          </button>
                          {showPriorityDropdown && (
                            <div className="absolute top-full left-0 mt-1 w-[140px] bg-card border border-border rounded-xl py-1" style={{ zIndex: "var(--z-dropdown)", boxShadow: "var(--elevation-sm)" }}>
                              {(["Low", "Standard", "High"] as SOPriority[]).map(p => (
                                <button key={p} onClick={() => { setSelectedPriority(p); setShowPriorityDropdown(false); store.updateSO(so.id, { priority: p }); }} className={`w-full flex items-center gap-2 px-3 py-1.5 transition-colors ${p === selectedPriority ? "bg-accent" : "hover:bg-accent/60"}`} style={{ fontSize: 12 }}>
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: priorityConfig[p].cssVar }} />
                                  <span className="text-foreground" style={{ fontWeight: 500 }}>{p}</span>
                                  {p === selectedPriority && <Check className="w-3 h-3 text-primary ml-auto" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {(() => {
                          /* Timeline hover card — Partner-style dark
                             header + scrollable body listing every
                             state transition on this SO. Filters the
                             activity log to transition actions only
                             (Created / Status Change / Cleared /
                             Rejected / Reactivated / Cancelled /
                             Lines Cancelled / Archived / Unarchived
                             / Version Created / Shipped / Partially
                             Shipped). */
                          const TRANSITION_ACTIONS: Record<string, StatusTimelineEntry["tone"]> = {
                            "Created": "neutral",
                            "Status Change": "warning",
                            "Cleared": "info",
                            "Rejected": "destructive",
                            "Reactivated": "info",
                            "Cancelled": "destructive",
                            "Lines Cancelled": "warning",
                            "Archived": "destructive",
                            "Unarchived": "info",
                            "Version Created": "neutral",
                            "Partially Shipped": "warning",
                            "Shipped": "success",
                          };
                          const TRANSITION_LABEL: Record<string, string> = {
                            "Created": "Draft created",
                            "Status Change": "Pending Review",
                            "Cleared": "Released",
                            "Rejected": "Rejected on Review",
                            "Reactivated": "Reactivated",
                            "Cancelled": "Cancelled",
                            "Lines Cancelled": "Lines Cancelled",
                            "Archived": "Archived",
                            "Unarchived": "Unarchived",
                            "Version Created": "New draft version",
                            "Partially Shipped": "Partially Shipped",
                            "Shipped": "Shipped",
                          };
                          /* Scope the trail to the CURRENT version only.
                             The activity log spans every version the SO
                             has been through; showing V1's Draft entry
                             on V2's hover card was misleading. We use
                             the version's `date` as the boundary and
                             drop everything before it. If the resulting
                             set is empty (fresh new-draft with no
                             transitions yet), we synthesize a "Draft
                             created" opener so the card is never
                             blank. */
                          const versionNum = so.version?.number ?? 1;
                          const versionStart = so.version?.date ? new Date(so.version.date) : null;
                          const parseTs = (t: string): Date => {
                            /* Accept both "2025/03/10 09:00" (seed
                               format) and ISO strings. */
                            const normalized = t.replace(/\//g, '-').replace(' ', 'T');
                            const d = new Date(normalized);
                            return Number.isNaN(d.getTime()) ? new Date(0) : d;
                          };
                          const rawEntries = (so.activityLog || [])
                            .filter((a) => a.action in TRANSITION_ACTIONS)
                            .map((a) => ({
                              timestamp: a.timestamp,
                              label: TRANSITION_LABEL[a.action] ?? a.action,
                              detail: `${a.user} · ${a.details}`,
                              tone: TRANSITION_ACTIONS[a.action],
                            }));
                          const scopedEntries = versionStart
                            ? rawEntries.filter((e) => parseTs(e.timestamp) >= versionStart)
                            : rawEntries;
                          const entries: StatusTimelineEntry[] = scopedEntries.length > 0
                            ? scopedEntries
                            : [{
                                timestamp: so.version?.date || so.createdDate,
                                label: `V${versionNum} draft created`,
                                tone: 'neutral' as const,
                              }];
                          return (
                            <StatusTimelineHoverCard entries={entries} versionLabel={`V${versionNum}`}>
                              {/* Wrapper signals hoverability the same way
                                  Partner's PocPill trigger does — help
                                  cursor, subtle brightness dip, and a
                                  lift shadow on hover so users discover
                                  the timeline overlay without a click.
                                  Trailing Clock glyph only surfaces when
                                  there's actually a multi-step history to
                                  reveal (matches Partner's
                                  icon-inside-pill idiom from
                                  `PaymentTermDetailModal`). */}
                              <span
                                style={{
                                  display: "inline-flex",
                                  borderRadius: 9999,
                                  cursor: "help",
                                  transition: "filter 150ms, box-shadow 150ms, transform 150ms",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.filter = "brightness(0.96)";
                                  e.currentTarget.style.boxShadow = "0 2px 8px -2px rgba(15, 23, 42, 0.14)";
                                  e.currentTarget.style.transform = "translateY(-0.5px)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.filter = "";
                                  e.currentTarget.style.boxShadow = "";
                                  e.currentTarget.style.transform = "";
                                }}
                              >
                                <SOStatusBadge
                                  status={so.status}
                                  trailingIcon={entries.length > 1 ? (
                                    <Clock style={{ width: 11, height: 11, opacity: 0.7, marginLeft: 1 }} strokeWidth={2.25} />
                                  ) : undefined}
                                />
                              </span>
                            </StatusTimelineHoverCard>
                          );
                        })()}

                        {/* Provenance, next to the state pills: this
                            record came from another system, so the header
                            says so rather than letting it pass as
                            something created here. */}
                        {so.legacyImport && (
                          <LegacyImportPill meta={so.legacyImport} isScrolled={isScrolled} recordNoun="order" />
                        )}
                      </div>

                      {/* Line 2: Description — animated max-height + opacity
                          in the scrolled state so the description fades out
                          smoothly. When NOT scrolled, the cap is effectively
                          unlimited (2000px) so the inline "Show less"
                          expanded view never gets clipped — the
                          InlineDescriptionEditor itself controls its own
                          height. The 2000px ceiling stays so CSS can still
                          animate to/from the 0px collapsed state. */}
                      <div
                        style={{
                          maxHeight: isScrolled ? 0 : 2000,
                          opacity: isScrolled ? 0 : 1,
                          overflow: "hidden",
                          transition: "max-height 220ms ease, opacity 180ms ease",
                        }}
                      >
                        <SODescriptionEditor soId={so.id} initialDescription={so.description || `Sales order for ${so.customer}. ${so.lines.length} line items.`} />
                      </div>
                    </div>
                  </div>

                  {/* Right: Fullscreen + Actions dropdown + separator + CTA — mirrors Quotes' QuoteDetails header pattern */}
                  <div className="flex items-center shrink-0 max-md:w-full max-md:justify-end max-md:flex-wrap" style={{ gap: isScrolled ? 6 : 8 }}>
                    {/* Fullscreen toggle (nothing to widen on a phone) */}
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      title={isFullscreen ? "Exit Full Screen" : "Full Screen"}
                      className="max-sm:hidden rounded-lg border border-border bg-white hover:bg-slate-50 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-200 shrink-0"
                      style={{ width: isScrolled ? 32 : 36, height: isScrolled ? 32 : 36 }}
                    >
                      {isFullscreen ? (
                        <Minimize2 className="text-slate-500 transition-all duration-200" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                      ) : (
                        <Maximize2 className="text-slate-500 transition-all duration-200" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                      )}
                    </button>

                    {/* Actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? "h-8 px-3 text-[12px]" : "h-9 px-3.5 text-[13px]"}`}
                          style={{ fontWeight: 500 }}
                        >
                          Actions
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[200] w-56">
                        <DropdownMenuItem onClick={() => { setSendModalMode("print"); setShowSendToCustomer(true); }}>
                          <Printer className="w-4 h-4 mr-2 text-slate-500" />
                          Print
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowExportModal(true)}>
                          <Download className="w-4 h-4 mr-2 text-slate-500" />
                          Download Sales Order
                        </DropdownMenuItem>
                        {/* Duplicate — blocked once ops has cleared the SO
                            (Cleared / Partially Shipped / Shipped / Partially
                             Cancelled), since cloning past that point would
                            start a parallel procurement run without ops
                            sign-off. The row is rendered disabled with a
                            tooltip so the option stays discoverable. */}
                        {(() => {
                          const blockedReason = duplicateBlockedReason(so.status);
                          if (blockedReason) {
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuItem
                                    disabled
                                    onSelect={(e) => { e.preventDefault(); }}
                                    className="opacity-60"
                                  >
                                    <Copy className="w-4 h-4 mr-2 text-slate-400" />
                                    Duplicate Sales Order
                                  </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="left" sideOffset={8} className="max-w-[280px] text-[11.5px] leading-relaxed">
                                  {blockedReason}
                                </TooltipContent>
                              </Tooltip>
                            );
                          }
                          return (
                            <DropdownMenuItem onClick={() => setShowDuplicateModal(true)}>
                              <Copy className="w-4 h-4 mr-2 text-slate-500" />
                              Duplicate Sales Order
                            </DropdownMenuItem>
                          );
                        })()}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied to clipboard"); }}>
                          <Link2 className="w-4 h-4 mr-2 text-slate-500" />
                          Copy Link
                        </DropdownMenuItem>
                        {/* Archive is available on every non-archived
                            state — including the terminal Shipped stage,
                            which previously hid this option. Keeps parity
                            with the user-stated final-state actions:
                            Archive / Cancel (if possible) / Duplicate. */}
                        {so.status !== "Archived" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setShowArchiveModal(true)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Archive className="w-4 h-4 mr-2 text-destructive" />
                              Archive Sales Order
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* CTA — sits flush with Actions, no separator (Partner pattern) */}
                    {/* Draft → Send to Customer (Creator)
                        IMPORTANT: this primary action does TWO things in one click —
                        it emails the SO PDF to the customer AND submits the SO for
                        review. The dropdown's "Submit for Review" is the alt path
                        that only submits without emailing. The button label alone can't
                        carry that nuance, so the tooltip surfaces it on hover. */}
                    {isDraft && isCreator && (
                      <div ref={!isUnconfirmed && !isPostConfirmed ? ctaDropdownRef : undefined} className="relative flex items-center ml-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => withInactiveCheck("send", () => { setIsSendResend(false); setSendModalMode("send"); setShowSendToCustomer(true); })} className={`flex items-center gap-1.5 text-white transition-colors ${canCancel ? "rounded-l-lg" : "rounded-lg"} ${isScrolled ? "h-7 pl-2.5 pr-2" : "h-9 pl-3.5 pr-3"}`} style={{ fontSize: 13, fontWeight: 600, backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}>
                              <Send className="w-3.5 h-3.5" />Send to Customer
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="!bg-white !text-slate-700 !border !border-border/80 !shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)] z-[400] max-w-[280px] rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed">
                            <div style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>Send to Customer &amp; Submit for Review</div>
                            <div style={{ color: "var(--muted-foreground)" }}>Emails the SO document to the customer and submits it for review at the same time.</div>
                          </TooltipContent>
                        </Tooltip>
                        {canCancel && (
                          <>
                            <div className={`w-px bg-white/20 ${isScrolled ? "h-7" : "h-9"}`} />
                            <button onClick={() => setShowCTADropdown(!showCTADropdown)} className={`flex items-center px-2 text-white rounded-r-lg transition-colors ${isScrolled ? "h-7" : "h-9"}`} style={{ backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCTADropdown ? "rotate-180" : ""}`} /></button>
                          </>
                        )}
                        {showCTADropdown && isDraft && (
                          <div className="absolute top-full right-0 mt-1 bg-card border border-border z-50" style={{ width: 280, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                            <div style={{ padding: 4 }}>
                              <button onClick={() => { setShowCTADropdown(false); withInactiveCheck("submit", () => handleMarkUnconfirmed()); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Check style={{ width: 14, height: 14, color: "#1E40AF" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Submit for Review</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Submit directly for review without sending</div>
                                </div>
                              </button>
                              <button onClick={() => { requestFullCancel(); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ban style={{ width: 14, height: 14, color: "#991B1B" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "#991B1B", lineHeight: 1, marginBottom: 5 }}>Cancel Order</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Permanently cancel this sales order</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Draft view for reviewer — the Approver acts on the SO,
                        so any move beyond Draft lands on Released. Clear
                        for Processing is the primary; Send to Customer stays
                        available in the dropdown but only emails the document
                        (no status change). Applies regardless of who created
                        the SO so ops doesn't loop through Pending Review to
                        themselves. */}
                    {isDraft && isReviewer && (
                      <div ref={ctaDropdownRef} className="relative flex items-center ml-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => withInactiveCheck("release", () => setShowConfirmModal(true))} className={`flex items-center gap-1.5 text-white transition-colors ${canCancel ? "rounded-l-lg" : "rounded-lg"} ${isScrolled ? "h-7 pl-2.5 pr-2" : "h-9 pl-3.5 pr-3"}`} style={{ fontSize: 13, fontWeight: 600, backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}>
                              <Check className="w-3.5 h-3.5" />Release for Fulfillment
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="!bg-white !text-slate-700 !border !border-border/80 !shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)] z-[400] max-w-[280px] rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed">
                            <div style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>Release for Fulfillment</div>
                            <div style={{ color: "var(--muted-foreground)" }}>Approves this SO and releases it for fulfillment. To email the SO document, use the dropdown.</div>
                          </TooltipContent>
                        </Tooltip>
                        {canCancel && (
                          <>
                            <div className={`w-px bg-white/20 ${isScrolled ? "h-7" : "h-9"}`} />
                            <button onClick={() => setShowCTADropdown(!showCTADropdown)} className={`flex items-center px-2 text-white rounded-r-lg transition-colors ${isScrolled ? "h-7" : "h-9"}`} style={{ backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCTADropdown ? "rotate-180" : ""}`} /></button>
                          </>
                        )}
                        {showCTADropdown && isDraft && (
                          <div className="absolute top-full right-0 mt-1 bg-card border border-border z-50" style={{ width: 280, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                            <div style={{ padding: 4 }}>
                              <button onClick={() => { setShowCTADropdown(false); withInactiveCheck("send", () => { setIsSendResend(false); setSendModalMode("send"); setShowSendToCustomer(true); }); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Send style={{ width: 14, height: 14, color: "#1E40AF" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Send to Customer</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Send SO document for customer review</div>
                                </div>
                              </button>
                              <button onClick={() => { requestFullCancel(); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ban style={{ width: 14, height: 14, color: "#991B1B" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "#991B1B", lineHeight: 1, marginBottom: 5 }}>Cancel Order</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Permanently cancel this sales order</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* CTA: Pending Review → Clear by Ops (Reviewer only) */}
                    {isUnconfirmed && isReviewer && (
                      <div ref={isUnconfirmed ? ctaDropdownRef : undefined} className="relative flex items-center ml-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button onClick={() => setShowConfirmModal(true)} className={`flex items-center gap-1.5 text-white transition-colors ${canCancel ? "rounded-l-lg" : "rounded-lg"} ${isScrolled ? "h-7 pl-2.5 pr-2" : "h-9 pl-3.5 pr-3"}`} style={{ fontSize: 13, fontWeight: 600, backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}>
                              <Check className="w-3.5 h-3.5" />Release for Fulfillment
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" sideOffset={6} className="!bg-white !text-slate-700 !border !border-border/80 !shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12),0_4px_12px_-4px_rgba(0,0,0,0.05)] z-[400] max-w-[280px] rounded-xl px-3.5 py-2.5 text-[11px] leading-relaxed">
                            <div style={{ fontWeight: 600, color: "var(--foreground)", marginBottom: 2 }}>Release for Fulfillment</div>
                            <div style={{ color: "var(--muted-foreground)" }}>Approves this SO after review and releases it for fulfillment.</div>
                          </TooltipContent>
                        </Tooltip>
                        {canCancel && (
                          <>
                            <div className={`w-px bg-white/20 ${isScrolled ? "h-7" : "h-9"}`} />
                            <button onClick={() => setShowCTADropdown(!showCTADropdown)} className={`flex items-center px-2 text-white rounded-r-lg transition-colors ${isScrolled ? "h-7" : "h-9"}`} style={{ backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCTADropdown ? "rotate-180" : ""}`} /></button>
                          </>
                        )}
                        {showCTADropdown && isUnconfirmed && (
                          <div className="absolute top-full right-0 mt-1 bg-card border border-border z-50" style={{ width: 280, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                            <div style={{ padding: 4 }}>
                              <button onClick={() => { setIsSendResend(true); setSendModalMode("send"); setShowSendToCustomer(true); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Send style={{ width: 14, height: 14, color: "#1E40AF" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Resend to Customer</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Send updated SO document to customer</div>
                                </div>
                              </button>
                              {/* Reject Order dropdown item is hidden while
                                  the SO rejection flow is disabled. Quotes
                                  still own the reject-and-reactivate loop. */}
                              <button onClick={() => { requestFullCancel(); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ban style={{ width: 14, height: 14, color: "#991B1B" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "#991B1B", lineHeight: 1, marginBottom: 5 }}>Cancel Order</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Permanently cancel this sales order</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Pending Review — Cancel SO as primary CTA (Creator) with resend in dropdown */}
                    {isUnconfirmed && isCreator && (
                      <div ref={ctaDropdownRef} className="relative flex items-center ml-1">
                        <button onClick={() => requestFullCancel()} className={`flex items-center gap-1.5 bg-card text-destructive border border-destructive/40 transition-colors hover:bg-destructive/8 hover:border-destructive/60 ${isScrolled ? "h-7 px-2.5 rounded-l-lg" : "h-9 px-3 rounded-l-lg"}`} style={{ fontSize: 13, fontWeight: 600 }}>
                          <Ban className="w-3.5 h-3.5" />Cancel SO
                        </button>
                        <div className={`w-px bg-destructive/20 ${isScrolled ? "h-7" : "h-9"}`} />
                        <button onClick={() => setShowCTADropdown(!showCTADropdown)} className={`flex items-center px-2 bg-card text-destructive border border-destructive/40 border-l-0 rounded-r-lg transition-colors hover:bg-destructive/8 ${isScrolled ? "h-7" : "h-9"}`}><ChevronDown className={`w-3.5 h-3.5 transition-transform ${showCTADropdown ? "rotate-180" : ""}`} /></button>
                        {showCTADropdown && (
                          <div className="absolute top-full right-0 mt-1 bg-card border border-border z-50" style={{ width: 280, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                            <div style={{ padding: 4 }}>
                              <button onClick={() => { setIsSendResend(true); setSendModalMode("send"); setShowSendToCustomer(true); setShowCTADropdown(false); }} className="flex items-center gap-3 w-full text-left transition-colors" style={{ padding: "8px 10px", borderRadius: 6, border: "none", backgroundColor: "transparent", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--secondary)"; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Send style={{ width: 14, height: 14, color: "#1E40AF" }} /></div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--foreground)", lineHeight: 1, marginBottom: 5 }}>Resend to Customer</div>
                                  <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1 }}>Send updated SO document to customer</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* CTA: Post-Confirmed → Cancel Sales Order */}
                    {isPostConfirmed && canCancel && !isShipped && (() => {
                      const noCancellableLines = cancellableLinesForCTA.length === 0;
                      return (
                        <div className="flex items-center ml-1">
                          <DisabledCTATooltip
                            disabled={noCancellableLines}
                            reason="All line items are fully shipped and cannot be cancelled."
                            action="Use Returns / RMA for shipped items."
                          >
                            <button
                              onClick={() => {
                                if (noCancellableLines) return;
                                if (isFullCancelBlocked) setCancelModalMode("partial");
                                else requestFullCancel();
                              }}
                              disabled={noCancellableLines}
                              className={`flex items-center gap-1.5 bg-card text-destructive border border-destructive/40 rounded-lg transition-colors ${isScrolled ? "h-7 px-2.5" : "h-9 px-3"} ${noCancellableLines ? "opacity-40 cursor-not-allowed" : "hover:bg-destructive/8 hover:border-destructive/60"}`}
                              style={{ fontSize: 12, fontWeight: 500 }}
                            >
                              <Ban className="w-3 h-3" />Cancel Sales Order
                            </button>
                          </DisabledCTATooltip>
                        </div>
                      );
                    })()}

                    {/* CTA: Shipped → Archive */}
                    {isShipped && canArchive && (
                      <div className="flex items-center ml-1.5">
                        <button onClick={() => setShowArchiveModal(true)} className={`flex items-center gap-1.5 bg-card text-destructive border border-destructive/40 rounded-lg transition-colors ${isScrolled ? "h-7 px-2.5" : "h-9 px-3"} hover:bg-destructive/8 hover:border-destructive/60`} style={{ fontSize: 13, fontWeight: 600 }}>
                          <Archive className="w-3.5 h-3.5" />Archive
                        </button>
                      </div>
                    )}

                    {/* CTA: Archived → Reactivate SO */}
                    {canUnarchive && (
                      <div className="flex items-center ml-1.5">
                        <button onClick={handleReactivate} className={`flex items-center gap-1.5 text-white rounded-lg transition-colors ${isScrolled ? "h-7 px-2.5" : "h-9 px-3"}`} style={{ fontSize: 13, fontWeight: 600, backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}>
                          <RotateCcw className="w-3.5 h-3.5" />Reactivate SO
                        </button>
                      </div>
                    )}

                    {/* CTA: Cancelled/Partially Cancelled → Reactivate SO */}
                    {!canUnarchive && canReactivate && (
                      <div className="flex items-center ml-1.5">
                        <button onClick={handleReactivate} className={`flex items-center gap-1.5 text-white rounded-lg transition-colors ${isScrolled ? "h-7 px-2.5" : "h-9 px-3"}`} style={{ fontSize: 13, fontWeight: 600, backgroundColor: "#16A34A" }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#15803D"; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#16A34A"; }}>
                          <RotateCcw className="w-3.5 h-3.5" />Reactivate SO
                        </button>
                      </div>
                    )}

                    {canCancel && !isPostConfirmed && !isDraft && !isUnconfirmed && (
                      <button onClick={() => requestFullCancel()} className={`flex items-center gap-1 ml-1 border border-destructive/30 text-destructive rounded-lg hover:bg-destructive/5 transition-colors ${isScrolled ? "h-7 px-2" : "h-9 px-2.5"}`} style={{ fontSize: 12, fontWeight: 500 }}>
                        <Ban className="w-3 h-3" />Cancel Order
                      </button>
                    )}
                  </div>
                </div>

                {/* (Description moved into the title-row column above so it
                    sits directly below the SO# / badges line — Partner pattern.) */}

                {/* ── Row 2: Lifecycle stepper — divider stroke above (Partner
                       pattern — same hairline that sits above the tabs).
                       Animated max-height + opacity so the morph between
                       full and compact is smooth instead of a hard render
                       flip — keeps the sticky header from snapping when
                       isScrolled flips. */}
                {(
                  <div
                    className="relative"
                    style={{
                      padding: isScrolled ? "0 20px" : "8px 20px 10px",
                      overflow: "hidden",
                      borderRadius: "0 0 12px 12px",
                      /* Balanced section stroke — sits between
                         `var(--border)` (too heavy) and `var(--muted)`
                         (too faint). Transparent slate-ink at 7%
                         reads as a clean section divider on every
                         status-tinted card background and matches the
                         sibling stroke above the tabs below. */
                      borderTop: isScrolled ? "1px solid transparent" : "1px solid rgba(15, 23, 42, 0.07)",
                      maxHeight: isScrolled ? 0 : 80,
                      opacity: isScrolled ? 0 : 1,
                      transition: "max-height 220ms ease, opacity 180ms ease, padding 200ms ease, border-color 200ms ease",
                    }}
                  >
                    <div className="relative" style={{ display: "flex", alignItems: "center", width: "100%", padding: "2px 0" }}>
                      {/* Stepper section — when a terminal chip is shown,
                          the steps occupy 78% of the row and the chip takes
                          the rest, so the last step doesn't crowd the chip. */}
                      <div
                        className="relative"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flex: isTerminalStatus && terminalConfig ? "0 0 78%" : "1 1 auto",
                          minWidth: 0,
                        }}
                      >
                      {SO_STEPS.map((step, i) => {
                        const Icon = step.icon;
                        let state: "completed" | "current" | "pending" | "terminated" = "pending";
                        if (isTerminalStatus) {
                          if (i <= terminalBranchIndex) state = "completed";
                          else state = "terminated";
                        } else {
                          if (i < currentStepIndex) state = "completed";
                          else if (i === currentStepIndex) state = "current";
                        }
                        const isLast = i === SO_STEPS.length - 1;

                        const greenSolid = "var(--success)";
                        const greenGlow = "color-mix(in srgb, var(--success) 18%, transparent)";

                        const circleStyle: React.CSSProperties = state === "completed"
                          ? { backgroundColor: greenSolid, boxShadow: `0 2px 6px ${greenGlow}` }
                          : state === "current"
                            ? { backgroundColor: step.fillColor, boxShadow: `0 0 0 4px color-mix(in srgb, ${step.fillColor} 16%, transparent), 0 2px 8px color-mix(in srgb, var(--foreground) 8%, transparent)` }
                            : state === "terminated"
                              ? { backgroundColor: "transparent", border: "2px solid var(--border)" }
                              : { backgroundColor: "transparent", border: "2px solid var(--border)" };

                        const terminatedTextColor = isTerminalStatus ? "rgba(0,0,0,0.25)" : "var(--muted-foreground)";
                        const terminatedIconColor = isTerminalStatus ? "rgba(0,0,0,0.2)" : "var(--muted-foreground)";

                        return (
                          <div key={step.id} className="contents">
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, padding: "2px 4px" }}>
                              <div style={{
                                width: state === "current" ? 28 : state === "completed" ? 24 : 22,
                                height: state === "current" ? 28 : state === "completed" ? 24 : 22,
                                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                                ...circleStyle,
                              }}>
                                {state === "completed"
                                  ? <Check style={{ width: 12, height: 12, color: "var(--primary-foreground)" }} strokeWidth={3} />
                                  : <Icon style={{ width: state === "current" ? 14 : 12, height: state === "current" ? 14 : 12, color: state === "current" ? "var(--primary-foreground)" : state === "terminated" ? terminatedIconColor : "var(--muted-foreground)", opacity: state === "pending" ? 0.35 : 1, strokeWidth: state === "current" ? 2.5 : 2 }} />
                                }
                              </div>
                              <span style={{
                                fontSize: 12, whiteSpace: "nowrap", lineHeight: 1, letterSpacing: "-0.01em",
                                fontWeight: state === "current" ? 600 : state === "completed" ? 500 : 450,
                                color: state === "completed" ? greenSolid
                                  : state === "current" ? "var(--foreground)"
                                  : state === "terminated" ? terminatedTextColor
                                  : "var(--muted-foreground)",
                                opacity: state === "pending" ? 0.5 : 1,
                                transition: "all 0.3s ease",
                              }}>
                                {step.label}
                              </span>
                            </div>
                            {!isLast && (
                              <div style={{ flex: "1 1 0%", margin: "0 10px", minWidth: 12, height: 4, position: "relative" }}>
                                {(state === "completed" && (i + 1 <= currentStepIndex || (isTerminalStatus && i + 1 <= terminalBranchIndex))) ? (
                                  <div style={{ position: "absolute", inset: 0, height: 2.5, top: "50%", transform: "translateY(-50%)", borderRadius: 2, backgroundColor: greenSolid }} />
                                ) : (
                                  <div style={{
                                    position: "absolute", inset: 0, height: 2, top: "50%", transform: "translateY(-50%)", borderRadius: 2,
                                    backgroundColor: state === "terminated" ? "rgba(0,0,0,0.08)" : "var(--border)",
                                    WebkitMaskImage: "repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)",
                                    maskImage: "repeating-linear-gradient(90deg, black 0px, black 5px, transparent 5px, transparent 10px)",
                                    opacity: 0.65,
                                  }} />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      </div>

                      {/* Terminal state badge — gapped from the last step so the
                          cancelled/archived chip reads as separate from the
                          stepper rather than crowding the final node. */}
                      {isTerminalStatus && terminalConfig && (
                        <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingLeft: 24, paddingRight: 4 }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            backgroundColor: terminalConfig.fillColor, boxShadow: `0 2px 6px color-mix(in srgb, ${terminalConfig.fillColor} 18%, transparent)`,
                          }}>
                            <terminalConfig.icon style={{ width: 12, height: 12, color: "var(--primary-foreground)" }} strokeWidth={2.5} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: terminalConfig.fillColor, whiteSpace: "nowrap", lineHeight: 1, letterSpacing: "-0.01em" }}>{terminalConfig.label}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab bar — shared `DetailTabStrip` so every detail
                    page in the suite renders the same chrome,
                    typography, hover, and morph-on-scroll behaviour
                    as Partner Management's VendorDetailsPage. */}
                <DetailTabStrip
                  tabs={TABS as any}
                  activeId={activeTab}
                  onSelect={(id) => setActiveTab(id as any)}
                  isScrolled={isScrolled}
                />

              </div>
              </div>{/* close inner max-w wrapper */}
            </div>
            {/* Bottom gradient fade — fades in when scrolled so the
                body content doesn't pop sharply against the header
                card's bottom edge. Mirrors the Vendor Invoicing
                details surface. */}
            <div
              className="pointer-events-none transition-opacity duration-300"
              style={{
                height: 8,
                background:
                  "linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)",
                opacity: isScrolled ? 1 : 0,
              }}
            />
            </>
          );
        })()}

        {/* Date Edit Modal */}
        {editingDateType && (
          <DateEditModal
            type={editingDateType}
            isOpen={true}
            onClose={() => setEditingDateType(null)}
            onSave={(config) => {
              setDetailDateConfigs(prev => ({ ...prev, [editingDateType]: config }));
              setEditingDateType(null);
            }}
            initialConfig={detailDateConfigs[editingDateType]}
          />
        )}

        {/* Body wrapper — Vertical T-B order:
            Header → Version Box → Tabs (full width) → Body | Sidebar.
            No internal scroll; the AppLayout's <main> element owns the
            single page scrollbar so the sticky header and sidebar both
            pin against the same viewport (Partner parity). */}
        <div
          style={{ marginTop: 0 }}
          ref={contentScrollRef}
        >
          {/* `space-y-4` mirrors Partner Management's `VendorDetailsPage`
              body wrapper (16px between every direct child) so the
              status banner and the body+sidebar row share the same
              vertical rhythm Partner ships with. The body+sidebar flex
              row also dropped its inline `marginTop: 16` because this
              token handles the gap below the sticky header now. */}
          <div className={`mx-auto space-y-4 transition-all duration-300 ${isFullscreen ? "max-w-full" : "max-w-[1440px] 2xl:max-w-[1600px]"} px-4 lg:px-6 xl:px-8 pt-3 pb-5`}>
          {/* Rejection + version banners share a deck: when both are
              eligible the rejection banner sits on top and the version
              banner peeks behind. Dismissing the top card rotates the
              version banner forward. */}
          <NoticeBannerStack>
          {/* Rejection banner hidden — SO rejection flow is disabled;
              suppressing renders even if seed data still carries the
              fields. Re-enable by dropping the `false &&` guard. */}
          {false && so.rejectionReason && !rejectionBannerDismissed && (so.status === "Rejected" || so.status === "Draft" || so.status === "Pending Review") && (() => {
            /* Two visual states for the same banner:
                 - Rejected: destructive tone (active problem)
                 - Post-reactivation (Draft / Pending Review with the
                   reason still on the record): warning tone —
                   there's no live problem anymore, just a nudge to
                   revise before resubmitting. */
            const isRejected = so.status === "Rejected";
            const bannerTone: "destructive" | "warning" = isRejected ? "destructive" : "warning";
            const bannerIcon = isRejected ? ThumbsDown : RefreshCw;
            const pillTintBg = isRejected ? "rgba(220, 38, 38, 0.10)" : "rgba(245, 158, 11, 0.14)";
            const pillTintBgHover = isRejected ? "rgba(220, 38, 38, 0.16)" : "rgba(245, 158, 11, 0.22)";
            const pillTextColor = isRejected ? "var(--destructive)" : "#B45309";
            let stamp = "";
            if (so.rejectedAt) {
              const d = new Date(so.rejectedAt);
              const mm = String(d.getMonth() + 1).padStart(2, "0");
              const dd = String(d.getDate()).padStart(2, "0");
              const yyyy = d.getFullYear();
              const hh = String(d.getHours()).padStart(2, "0");
              const mi = String(d.getMinutes()).padStart(2, "0");
              stamp = ` · ${mm}/${dd}/${yyyy} at ${hh}:${mi}`;
            }
            /* Attribution (who rejected) moves into the pill's native
               tooltip so the primary banner line stays clean and only
               the reason + timestamp show inline. */
            const pillTitle = so.rejectedBy
              ? `Recorded by ${so.rejectedBy}${stamp ? ` — ${stamp.replace(/^ · /, "")}` : ""}`
              : "Reason recorded on this sales order";
            /* REASON chip — compact tinted pill, tint follows the
               banner tone (red on Rejected, amber on post-
               reactivation). No outline, no icon. */
            const reasonPill = (
              <>
                <span
                  className="reason-chip"
                  title={pillTitle}
                  style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "1px 6px", borderRadius: 4,
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", lineHeight: 1.3,
                    textTransform: "uppercase",
                    backgroundColor: pillTintBg,
                    color: pillTextColor,
                    flexShrink: 0,
                    cursor: "default",
                    transition: "background-color 120ms",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = pillTintBgHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = pillTintBg;
                  }}
                >
                  Reason
                </span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {so.rejectionReason}
                  {so.rejectionReasonText && (
                    <span style={{ fontStyle: "italic", opacity: 0.75, marginLeft: 6 }}>
                      ({so.rejectionReasonText})
                    </span>
                  )}
                  {stamp}
                </span>
              </>
            );
            return (
            <StatusNoticeBanner
              tone={bannerTone}
              Icon={bannerIcon}
              title={isRejected ? "Order Rejected on Review" : "Previously rejected. Revise and resubmit."}
              subtitle={reasonPill}
              onDismiss={() => setRejectionBannerDismissed(true)}
              action={so.status === "Rejected"
                ? {
                    label: "Reactivate",
                    icon: RotateCcw,
                    /* Opens the two-option choice modal — same
                       version restore OR new draft version. The
                       modal's callbacks route to the corresponding
                       store method. */
                    onClick: () => setShowReactivateChoice(true),
                  }
                : undefined}
            />
            );
          })()}

          {/* ── Version/Status Banner — Partner-style icon chip + title + subtitle.
                Sits inside the scroll container so it scrolls with the rest of
                the content (matches the Quote module behaviour). Chip background
                and icon colour follow the status accent. ── */}
          {/* Version banner — always eligible whenever its state
              condition matches; deck stacking handles coexistence
              with the rejection banner above. */}
          {!versionBannerHidden && (statusMessage || (outdatedBannerVisible && so.status === "Draft")) && (() => {
            const accent = statusMessage?.accentColor ?? "var(--primary)";
            const ACCENT_TINTS: Record<string, { bg: string; border: string }> = {
              "var(--primary)":     { bg: "rgba(27, 110, 243, 0.10)", border: "rgba(27, 110, 243, 0.20)" },
              "var(--success)":     { bg: "rgba(16, 185, 129, 0.10)", border: "rgba(16, 185, 129, 0.20)" },
              "var(--destructive)": { bg: "rgba(220, 38, 38, 0.10)", border: "rgba(220, 38, 38, 0.18)" },
              "var(--chart-3)":     { bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.22)" },
              "var(--chart-4)":     { bg: "rgba(124, 58, 237, 0.12)", border: "rgba(124, 58, 237, 0.22)" },
            };
            const tint = ACCENT_TINTS[accent] ?? ACCENT_TINTS["var(--primary)"];
            const showOutdated = outdatedBannerVisible && so.status === "Draft";
            return (
              <div
                className="rounded-xl"
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  backgroundColor: "var(--card)",
                  border: `1px solid ${tint.border}`,
                  boxShadow: "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px 0 rgba(0,0,0,0.06)",
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1, padding: "12px 16px", gap: 12, flexWrap: "wrap" as const, minWidth: 0 }}>
                  {showOutdated ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{ width: 32, height: 32, borderRadius: 8, background: "#FEF3C7", border: "1px solid #FDE68A" }}
                      >
                        <RefreshCw style={{ width: 16, height: 16, color: "#B45309" }} strokeWidth={2} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.3 }}>
                          {outdatedUpdates.length} outdated {outdatedUpdates.length === 1 ? "configuration" : "configurations"}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.45 }}>
                          {so.customer ? `Updated configurations are available for ${so.customer}.` : "Updated configurations are available for this customer."} Review before continuing this draft.
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Icon chip lifted to 40×40 with a two-tone
                       treatment (tinted bg + accent border) so it
                       reads as substantial next to the copy — the
                       32×32 chip felt visually lost against the
                       title/subtitle stack. Matches Partner's
                       card-header chip chrome. */
                    <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: tint.bg,
                          border: `1px solid ${tint.border}`,
                        }}
                      >
                        {statusMessage && <statusMessage.icon style={{ width: 18, height: 18, color: accent }} strokeWidth={2} />}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", lineHeight: 1.25, letterSpacing: "-0.01em" }}>{statusMessage?.title}</span>
                        <span style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }}>{statusMessage?.subtitle}</span>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {showOutdated && (
                      <button
                        onClick={() => setShowOutdatedConfigsModal(true)}
                        className="inline-flex items-center gap-1.5 shrink-0 rounded-md transition-colors"
                        style={{ height: 32, padding: "0 14px", fontSize: 13, fontWeight: 500, backgroundColor: "var(--primary)", color: "#FFFFFF", border: "none", cursor: "pointer" }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#0D5ED7"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--primary)"; }}
                      >
                        <RefreshCw style={{ width: 12, height: 12 }} /> Review and sync
                      </button>
                    )}
                    {/* "Edit as VN+1" CTA is locked once any unit has
                        shipped. Same gating as the customer-change
                        flow and the version-tab revert button. */}
                    {!showOutdated && (statusMessage as any)?.cta && !hasAnyShippedLine && (
                      <button
                        onClick={() => {
                          setPendingVersionChange({ fieldLabel: "Manual Edit", action: () => {} });
                          setAutoVersionField("Manual Edit");
                          setShowAutoVersionConfirm(true);
                        }}
                        className="inline-flex items-center gap-1.5 shrink-0 rounded-md transition-colors"
                        style={{ height: 32, padding: "0 14px", fontSize: 13, fontWeight: 500, backgroundColor: "var(--primary)", color: "#FFFFFF", border: "none", cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#0D5ED7"; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = "var(--primary)"; }}
                      >
                        <Pencil style={{ width: 12, height: 12 }} /> {(statusMessage as any).cta.label}
                      </button>
                    )}
                    {!showOutdated && (statusMessage as any)?.cta && hasAnyShippedLine && (
                      <span
                        title="New versions are locked once units are shipped"
                        className="inline-flex items-center gap-1.5 shrink-0 rounded-md"
                        style={{ height: 32, padding: "0 14px", fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", border: "1px solid var(--border)", backgroundColor: "var(--muted)", cursor: "not-allowed" }}
                      >
                        <Pencil style={{ width: 12, height: 12 }} /> Locked. Units shipped.
                      </span>
                    )}
                    <button
                      onClick={() => {
                        /* Two-stage close. Outdated variant collapses to
                           the plain version message on first X; a second
                           X hides the whole bar. Both states persist
                           per-session so the user does not have to
                           dismiss again on every re-render. */
                        if (showOutdated) {
                          dismissOutdatedBanner(so.id);
                          setOutdatedBannerVisible(false);
                        } else {
                          setVersionBannerHidden(true);
                        }
                      }}
                      aria-label={showOutdated ? "Hide outdated configurations" : "Hide version bar"}
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 26, height: 26, borderRadius: 6,
                        border: "1px solid transparent",
                        backgroundColor: "transparent",
                        color: "#94A3B8",
                        cursor: "pointer",
                        transition: "color 120ms",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--primary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "#94A3B8"; }}
                    >
                      <X style={{ width: 14, height: 14 }} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          </NoticeBannerStack>

          {/* Body | Sidebar row — tabs now live inside the sticky
              header card above, so the body wrapper starts directly
              below the header. Uses `alignItems: stretch` so the body
              column grows to the sidebar's height when the sidebar is
              the taller of the two — the Attachments tab flexes to
              fill that height so it never sits shorter than the
              sidebar and no inner scrollbar appears. */}
          {/* PO's breakpoint: beside the body at lg and up, stacked under
              it below (PO hides nothing, so neither do we). */}
          <div className="flex flex-col lg:flex-row lg:items-stretch gap-5">
          <div className="flex-1 min-w-0 flex flex-col lg:pb-6">
            <div className="flex-1 flex flex-col min-h-0" style={{ paddingTop: 0 }}>
            {activeTab === "lines" && (
              <SOLineGrid so={so} pricingAPI={pricingAPI} adjustmentsAPI={adjustmentsAPI} onAddLine={() => {
                  if (requiresNewDraftFirst(so.status)) {
                    setPendingVersionChange({ fieldLabel: "Add Line Item", action: () => setShowAddLine(true) });
                    setAutoVersionField("Add Line Item");
                    setShowAutoVersionConfirm(true);
                  } else setShowAddLine(true);
                }} onAllocateLine={canAllocate ? setAllocationLine : undefined} onAllocateAll={canAllocate ? () => setShowAllocateModal(true) : undefined}
                onDeleteLine={(lineId) => {
                  const line = so.lines.find(l => l.id === lineId);
                  if (requiresNewDraftFirst(so.status)) {
                    setPendingVersionChange({ fieldLabel: "Delete Line Item", oldValue: line?.itemCode, action: () => { const ok = store.deleteSOLine(so.id, lineId); if (!ok) toast.error("Cannot delete line with shipped quantities"); else toast.success("Line removed"); } });
                    setAutoVersionField("Delete Line Item");
                    setShowAutoVersionConfirm(true);
                  } else {
                    const ok = store.deleteSOLine(so.id, lineId); if (!ok) toast.error("Cannot delete line with shipped quantities"); else toast.success("Line removed");
                  }
                }}
                onCancelLines={canCancel ? handleCancelLines : undefined} onConfigureLine={setConfigureLine}
                onUpdateLine={(lineId, updates) => {
                  const line = so.lines.find(l => l.id === lineId);
                  const isMaterial = updates.orderedQty !== undefined || updates.unitPrice !== undefined;
                  if (isMaterial && requiresNewDraftFirst(so.status)) {
                    const oldVal = updates.orderedQty !== undefined ? `Qty: ${line?.orderedQty}` : updates.unitPrice !== undefined ? `$${line?.unitPrice}` : undefined;
                    const newVal = updates.orderedQty !== undefined ? `Qty: ${updates.orderedQty}` : updates.unitPrice !== undefined ? `$${updates.unitPrice}` : undefined;
                    setPendingVersionChange({ fieldLabel: updates.orderedQty !== undefined ? "Quantity" : "Unit Price", oldValue: oldVal, newValue: newVal, action: () => store.updateSOLine(so.id, lineId, updates) });
                    setAutoVersionField(updates.orderedQty !== undefined ? "Quantity" : "Unit Price");
                    setShowAutoVersionConfirm(true);
                  } else {
                    store.updateSOLine(so.id, lineId, updates);
                  }
                }}
                onDuplicateLine={(line) => {
                  if (requiresNewDraftFirst(so.status)) {
                    setPendingVersionChange({ fieldLabel: "Duplicate Line Item", oldValue: line.itemCode, action: () => { store.addSOLine(so.id, { itemCode: line.itemCode, itemName: line.itemName, itemType: line.itemType, orderedQty: line.orderedQty, unitPrice: line.unitPrice, taxRate: line.taxRate }); toast.success(`Duplicated ${line.itemCode}`); } });
                    setAutoVersionField("Duplicate Line Item");
                    setShowAutoVersionConfirm(true);
                  } else {
                    store.addSOLine(so.id, { itemCode: line.itemCode, itemName: line.itemName, itemType: line.itemType, orderedQty: line.orderedQty, unitPrice: line.unitPrice, taxRate: line.taxRate });
                    toast.success(`Duplicated ${line.itemCode}`);
                  }
                }}
                requiresVersionFirst={requiresNewDraftFirst(so.status)}
                onRequestPriceVersionConfirm={(lineId, newPrice, applyCallback) => {
                  // Editing PPU on a post-Cleared SO is a "read-only" edit
                  // until the user agrees to fork a new draft. We open
                  // AutoVersionConfirm first; the scope modal opens via
                  // applyCallback only after the user confirms.
                  const line = so.lines.find(l => l.id === lineId);
                  setPendingVersionChange({
                    fieldLabel: "Unit Price",
                    oldValue: `$${line?.unitPrice}`,
                    newValue: `$${newPrice}`,
                    action: applyCallback,
                  });
                  setAutoVersionField("Unit Price");
                  setShowAutoVersionConfirm(true);
                }}
                onRequestUomChange={(line, newUom) => {
                  /* Unit change rescales PPU by `newMult / oldMult` so
                     the per-line total stays consistent (swapping EA→BOX
                     with multiplier 12 turns $10/EA into $120/BOX). The
                     mutation is a material change: store.updateSOLine
                     stamps it on the line and the order's grand-total
                     useMemo recomputes against the new unitPrice. On
                     post-Draft SOs we route the change through the
                     auto-version confirm flow so the user explicitly
                     forks a new draft (cancelling rolls back to the
                     original unit AND original PPU; nothing is applied
                     until the user agrees). */
                  if (!line.uom || line.uom === newUom) return;
                  const scale = uomScaleFactor(line.uom, newUom);
                  const scaledPpu = Math.round(line.unitPrice * scale * 100) / 100;
                  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const apply = () => {
                    store.updateSOLine(so.id, line.id, { uom: newUom, unitPrice: scaledPpu });
                    toast.success(`Unit changed to ${newUom} (PPU rescaled to ${fmt(scaledPpu)} / ${newUom})`);
                  };
                  if (requiresNewDraftFirst(so.status)) {
                    setPendingVersionChange({
                      fieldLabel: `UOM · ${line.itemCode}`,
                      oldValue: `${line.uom} · ${fmt(line.unitPrice)} / ${line.uom}`,
                      newValue: `${newUom} · ${fmt(scaledPpu)} / ${newUom}`,
                      action: apply,
                    });
                    setAutoVersionField("UOM");
                    setShowAutoVersionConfirm(true);
                    return;
                  }
                  apply();
                }} />
            )}
            {activeTab === "deal" && (
              <DealInformationTab so={so} createdViaUI={!!so.createdViaUI} />
            )}
            {activeTab === "linked" && (
              /* Linked-transactions visibility rules:
                 - Draft SOs have no real downstream artefacts yet,
                   hide the whole list (Bug B2 — mock seed used to
                   surface Quote/Contract rows for Draft SOs that
                   have no real sourceQuoteRef).
                 - Shipment / Delivery Confirmation rows only make
                   sense once at least one shipment has actually
                   moved (Partially Shipped / Shipped). Before that
                   the warehouse hasn't sent anything, so surfacing
                   a Shipment row would be a lie. Strip them here.
                 - Invoice / Credit Memo / Payment Receipt belong
                   to the Invoicing tab; LinkedTransactionsTab
                   already filters those internally. */
              <LinkedTransactionsTab
                transactions={
                  so.status === "Draft"
                    ? []
                    : (so.status === "Partially Shipped" || so.status === "Shipped")
                      ? so.linkedTransactions
                      : so.linkedTransactions.filter(t => t.type !== "Shipment" && t.type !== "Delivery Confirmation")
                }
                createdViaUI={!!so.createdViaUI}
              />
            )}
            {activeTab === "comms" && (
              <>
                <div className="bg-card rounded-xl border border-border" style={{ padding: "48px var(--space-card-padding)", boxShadow: "var(--elevation-1)" }}>
                  <div className="flex flex-col items-center justify-center" style={{ gap: "var(--space-inline-gap)" }}>
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-foreground" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>Communications</div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-chart-3/10 text-chart-3" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>Coming Soon</span>
                    <div className="text-muted-foreground text-center max-w-[340px]" style={{ fontSize: "var(--text-caption)", lineHeight: 1.5 }}>
                      Track internal notes, customer emails, and external communications related to this sales order.
                    </div>
                  </div>
                </div>
              </>
            )}
            {activeTab === "activity" && (
              <>
                <div className="bg-card rounded-xl border border-border" style={{ padding: "48px var(--space-card-padding)", boxShadow: "var(--elevation-1)" }}>
                  <div className="flex flex-col items-center justify-center" style={{ gap: "var(--space-inline-gap)" }}>
                    <div className="w-11 h-11 rounded-lg bg-chart-4/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-chart-4" />
                    </div>
                    <div className="text-foreground" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>Activity</div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-chart-3/10 text-chart-3" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>Coming Soon</span>
                    <div className="text-muted-foreground text-center max-w-[340px]" style={{ fontSize: "var(--text-caption)", lineHeight: 1.5 }}>
                      View a detailed log of all changes, updates, and actions taken on this sales order.
                    </div>
                  </div>
                </div>
              </>
            )}
            {activeTab === "shipping" && (
              <ShipmentsTab
                shipments={soShipments}
                soId={so.id}
                so={so}
                createdViaUI={!!so.createdViaUI}
                soStatus={so.status}
                onNewShipment={() => setShowCreateShipmentModal(true)}
              />
            )}
            {activeTab === "invoicing" && (
              <InvoicingTab so={so} createdViaUI={!!so.createdViaUI} soStatus={so.status} />
            )}
            {activeTab === "attachments" && (
              <div
                className="flex-1 flex flex-col min-h-0"
                style={sidebarHeight ? { maxHeight: sidebarHeight } : undefined}
              >
                <AttachmentsTab attachments={so.attachments} lines={so.lines} createdViaUI={!!so.createdViaUI} soStatus={so.status} soId={so.id} />
              </div>
            )}
            {activeTab === "versions" && (
              <VersionHistoryTab so={so} onEditAsDraft={hasAnyShippedLine ? undefined : (fromVersion) => {
                setPendingVersionChange({
                  fieldLabel: `Revert to V${fromVersion}`,
                  action: () => {
                    store.revertToVersion(so.id, fromVersion);
                  },
                  isRevert: true,
                  revertToVersion: fromVersion,
                });
                setAutoVersionField(`Revert to V${fromVersion}`);
                setShowAutoVersionConfirm(true);
              }} />
            )}
            {activeTab === "sourcing" && (
              // Sourcing & Procurement temporarily hidden behind a
              // Coming Soon panel. Same chrome as Communications /
              // Activity. The SourcingProductionTab component stays in
              // the codebase, ready to be swapped back in when the
              // feature is unhidden.
              <>
                <div className="bg-card rounded-xl border border-border" style={{ padding: "48px var(--space-card-padding)", boxShadow: "var(--elevation-1)" }}>
                <div className="flex flex-col items-center justify-center" style={{ gap: "var(--space-inline-gap)" }}>
                  <div className="w-11 h-11 rounded-lg bg-chart-2/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-chart-2" />
                  </div>
                  <div className="text-foreground" style={{ fontSize: "var(--text-label)", fontWeight: "var(--font-weight-semibold)" }}>Sourcing &amp; Procurement</div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-chart-3/10 text-chart-3" style={{ fontSize: "var(--text-caption)", fontWeight: "var(--font-weight-semibold)" }}>Coming Soon</span>
                  <div className="text-muted-foreground text-center max-w-[340px]" style={{ fontSize: "var(--text-caption)", lineHeight: 1.5 }}>
                    Track procurement orders, backorders, and supplier coordination for this sales order's inventory needs.
                  </div>
                </div>
                </div>
              </>
            )}
            </div>{/* close paddingTop:24 wrapper */}
          </div>
          {/* Right sidebar — flows with the page. Both the body column and
              the sidebar scroll together via the page's main scrollbar;
              once the body's content is exhausted the page keeps scrolling
              against the taller column (typically the sidebar) so the user
              always reaches its bottom without a second scrollbar
              appearing. No `sticky`, no `max-height`, no `overflow-y` —
              the row's natural height = max(body, sidebar). */}
          <div
            ref={sidebarRef}
            className="shrink-0 w-full lg:w-[300px] lg:self-start"
            style={{ paddingBottom: "var(--space-page-x)" }}
          >
            <SOSidebar
              so={so}
              releaseAttempted={releaseAttempted}
              pricingAPI={pricingAPI}
              adjustmentsAPI={adjustmentsAPI}
              onOpenInvoicing={() => setActiveTab("invoicing")}
              onMaterialEvent={(description, onRevert) => {
                /* Pricing-rule and adjustment changes from the sidebar's
                   Manage modals → if post-draft, fire the new-version
                   confirm; otherwise surface as an info toast.
                   `onRevert` is captured so a discarded version prompt
                   can roll back the adjustment that was already added. */
                if (requiresNewDraftFirst(so.status)) {
                  setPendingVersionChange({ fieldLabel: "Pricing / Adjustments", newValue: description, action: () => toast.success(description), onRevert });
                  setAutoVersionField("Pricing / Adjustments");
                  setShowAutoVersionConfirm(true);
                } else {
                  toast.info(description);
                }
              }}
            />
          </div>
          </div>{/* close flex row */}
          </div>{/* close body max-w wrapper */}
        </div>
      </div>

      {/* Modals */}
      {allocationLine && <AllocateInventoryModal so={so} onClose={() => setAllocationLine(null)} initialLineId={allocationLine.id} singleLineMode />}
      {showAddLine && <AddLineItemDialog soId={so.id} onClose={() => setShowAddLine(false)} />}
      {showAllocateModal && <AllocateInventoryModal so={so} onClose={() => setShowAllocateModal(false)} />}
      {cancelModalMode && <CancellationModal so={so} mode={cancelModalMode} preselectedLineIds={cancelPreselectedLineIds} onConfirmFull={handleCancelFull} onConfirmPartial={handleCancelPartial} onClose={() => { setCancelModalMode(null); setCancelPreselectedLineIds([]); }} />}
      {/* Draft-only short cancel — mirrors the Quote CancelQuoteModal so
          both modules read the same when the record is still pre-ops. */}
      {showDraftCancelModal && (
        <CancelSODraftModal
          isOpen={showDraftCancelModal}
          soNumber={so.soNumber}
          onCancel={() => setShowDraftCancelModal(false)}
          onConfirm={(reason) => {
            setShowDraftCancelModal(false);
            handleCancelFull("Other", reason);
          }}
        />
      )}
      {configureLine && (
        <AdvancedConfiguratorModal line={configureLine} inventory={store.inventory} onClose={() => setConfigureLine(null)}
          /* Line-level lock: cancelled lines are read-only AND lines that
             have any shipped qty lock too (Partially Shipped freezes the
             pricing per line). Terminal SO states (Shipped, Cancelled,
             Archived) also force the modal into view-only mode so users
             can still inspect the configuration but can't modify it. */
          readOnly={
            configureLine.cancelled ||
            configureLine.shippedQty > 0 ||
            ["Shipped", "Cancelled", "Archived"].includes(so.status)
          }
          isPostDraft={!["Draft"].includes(so.status)}
          /* Once the SO leaves Draft, library mutations only edit the
             customer rule book — they don't touch this line. This is
             distinct from requiresNewDraftFirst (which gates ops-approval
             version prompts on per-rule / per-item / qty / price edits). */
          stageLibraryChanges={so.status !== 'Draft'}
          customerName={so.customer}
          pricingAPI={pricingAPI}
          adjustmentsAPI={adjustmentsAPI}
          /* Enable the internal-notes link picker on the adjustment
             form modal by handing down the SO id + current user. */
          docId={so.id}
          currentUser="Sarah Chen"
          /* Split-context props enable the same Partner-style "Split and
             switch to per-line" confirmation the FreightBreakdownModal
             uses. Source of truth is the store: `so.freightCost` for the
             order-level default and `line.shipmentCost` for siblings. */
          orderDefaultFreight={typeof so.freightCost === 'number' ? so.freightCost : 0}
          siblingLineCount={so.lines.length}
          anyOtherLineHasOverride={so.lines.some((l) => l.id !== configureLine.id && typeof l.shipmentCost === 'number')}
          onSeedSiblingFreightShares={(sharePerLine) => {
            /* Seed every other SOLine with the same share via the
               store. This drives both the FreightBreakdownModal and the
               SO total recalculation in one pass. */
            so.lines.forEach((l) => {
              if (l.id !== configureLine.id) {
                store.updateSOLine(so.id, l.id, { shipmentCost: sharePerLine });
              }
            });
          }}
          onMaterialEvent={(description, onRevert) => {
            /* Post-draft pricing-rule and adjustment changes from the
               configurator should also gate behind the new-version prompt
               — mirrors the qty/price onSave path below. `onRevert`
               is captured so a discarded prompt rolls the change back. */
            if (requiresNewDraftFirst(so.status)) {
              setPendingVersionChange({ fieldLabel: "Line Item Pricing", newValue: description, action: () => toast.success(description), onRevert });
              setAutoVersionField("Line Item Pricing");
              setShowAutoVersionConfirm(true);
            } else {
              toast.info(description);
            }
          }}
          onSave={({ orderedQty, unitPrice, shipmentCost }) => {
            /* Build the line update from all three fields the
               configurator can return. shipmentCost is included as
               `undefined` when the user reset the override; the store
               just spreads it onto the SOLine, so the absent value
               needs to be explicitly forwarded. */
            const updates: Partial<typeof configureLine> = { orderedQty, unitPrice, shipmentCost };
            if (requiresNewDraftFirst(so.status)) {
              const oldVal = `Qty: ${configureLine.orderedQty}, $${configureLine.unitPrice}`;
              const newVal = `Qty: ${orderedQty}, $${unitPrice}`;
              setPendingVersionChange({ fieldLabel: "Line Item Configuration", oldValue: oldVal, newValue: newVal, action: () => { store.updateSOLine(so.id, configureLine.id, updates); toast.success(`${configureLine.itemCode} updated`); } });
              setAutoVersionField("Line Item Configuration");
              setConfigureLine(null);
              setShowAutoVersionConfirm(true);
            } else {
              store.updateSOLine(so.id, configureLine.id, updates); toast.success(`${configureLine.itemCode} updated`); setConfigureLine(null);
            }
          }}
          onDelete={() => {
            if (requiresNewDraftFirst(so.status)) {
              setPendingVersionChange({ fieldLabel: "Delete Line Item", oldValue: configureLine.itemCode, action: () => { const ok = store.deleteSOLine(so.id, configureLine.id); if (ok) { toast.success(`${configureLine.itemCode} removed`); } else toast.error("Cannot delete line with shipped quantities"); } });
              setAutoVersionField("Delete Line Item");
              setConfigureLine(null);
              setShowAutoVersionConfirm(true);
            } else {
              const ok = store.deleteSOLine(so.id, configureLine.id); if (ok) { toast.success(`${configureLine.itemCode} removed`); setConfigureLine(null); } else toast.error("Cannot delete line with shipped quantities");
            }
          }} />
      )}
      {showConfirmModal && <ConfirmSOModal so={so} onConfirm={() => handleConfirm()} onClose={() => setShowConfirmModal(false)} />}
      {showFulfillmentModal && <FulfillmentModal
        open={showFulfillmentModal}
        so={so}
        onClose={() => setShowFulfillmentModal(false)}
        onConfirm={(deliveryQtys, proofFiles, invoiceNote) => {
          store.deliverSO(so.id, deliveryQtys);
          setShowFulfillmentModal(false);
          if (deliveryQtys) {
            const count = Object.values(deliveryQtys).reduce((s: number, v: any) => s + (v as number), 0);
            toast.success(`${count} unit(s) confirmed delivered · partial fulfillment`);
          } else {
            toast.success("All shipments confirmed delivered. Order complete.");
          }
          if (proofFiles && proofFiles.length > 0) {
            toast.info(`${proofFiles.length} proof of delivery file(s) attached`);
          }
          if (invoiceNote) {
            toast.info("Payment invoice generated");
          }
        }}
      />}
      {showExportModal && <ExportSOModal
        open={showExportModal}
        so={so}
        onClose={() => setShowExportModal(false)}
      />}

      {/* Create Shipment — SO-scoped picker. The modal itself owns
          the line/qty selection UI; SODetail just wires the confirm
          into `createShipment` and closes on success. */}
      {showCreateShipmentModal && (
        <CreateShipmentModal
          so={so}
          shipments={soShipments}
          onClose={() => setShowCreateShipmentModal(false)}
          onConfirm={(lines, method, carrier, pickupLocation) => {
            const warehouse = soShipments[0]?.warehouse || "Main Warehouse";
            const created = store.createShipment(so.id, lines, warehouse, method as any, carrier, pickupLocation);
            if (created) {
              toast.success(`Shipment ${created.shipmentNumber} created`);
            } else {
              toast.error("Could not create shipment. Order must be released first.");
            }
            setShowCreateShipmentModal(false);
          }}
        />
      )}
      {showArchiveModal && <ArchiveModal
        so={so}
        onClose={() => setShowArchiveModal(false)}
        onConfirm={() => { handleArchive(); setShowArchiveModal(false); }}
      />}

      {/* Reject Order — approver-only reject flow. Pushes the SO to
          Rejected + records the reason + comments + releases held
          allocations back to available stock. The banner takes over
          from here and offers Reactivate to spin a new draft version. */}
      {/* SO rejection flow is disabled — Quotes still own the
          reject/reactivate loop. Modals below are dead code paths
          left intact for a fast re-enable later; the CTA that opens
          them is hidden above. */}
      {false && showRejectModal && (
        <RejectSOModal
          soNumber={so.soNumber}
          onClose={() => setShowRejectModal(false)}
          onConfirm={(reason, reasonText, attachments) => {
            store.rejectSO(so.id, reason, reasonText, attachments);
            setShowRejectModal(false);
            setRejectionBannerDismissed(false);
            toast.success(`${so.soNumber} rejected`, {
              description: attachments.length
                ? `${reasonText ? `${reason}. ${reasonText}` : reason} · ${attachments.length} attachment${attachments.length === 1 ? "" : "s"} added`
                : reasonText ? `${reason}. ${reasonText}` : reason,
            });
          }}
        />
      )}

      {false && (<ReactivateChoiceModal
        isOpen={showReactivateChoice}
        recordLabel={so.soNumber}
        restoreToStatus={(so.previousStatus as string) || "Pending Review"}
        newVersionNumber={(so.version?.number ?? 1) + 1}
        onCancel={() => setShowReactivateChoice(false)}
        onRestore={() => {
          setShowReactivateChoice(false);
          store.reactivateRejectedSO(so.id);
          setRejectionBannerDismissed(false);
          toast.success(`Sales Order reactivated on V${so.version?.number ?? 1}`, {
            description: `Restored to ${(so.previousStatus as string) || "Pending Review"}. The rejection reason stays visible above until you re-submit.`,
          });
        }}
        onNewDraft={() => {
          setShowReactivateChoice(false);
          store.reactivateRejectedAsNewDraft(so.id);
          setRejectionBannerDismissed(false);
          toast.success(`Started V${(so.version?.number ?? 1) + 1} draft`, {
            description: "Revise line items or terms, then submit for review when ready.",
          });
        }}
      />)}


      {/* Duplicate SO — modal asks for customer + version, then overlay
          plays while the new SO is created via the store. When the
          overlay completes we navigate to the new SO's detail page.
          The new SO persists in the store's React state (the standard
          createSO path) so the listing reflects it until a hard refresh
          tears the provider down. */}
      {showDuplicateModal && (
        <DuplicateSOModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          soNumber={so.soNumber}
          currentCustomer={so.customer}
          /* The Latest version represents the SO's current operational
             state. When the SO has reached a non-duplicable state
             (shipped, partially shipped, cancelled, partially cancelled,
             archived), mark Latest as non-duplicable so the version
             dropdown only surfaces earlier revisions that pre-date the
             lock. Older Superseded / Last Approved versions stay open
             since they captured a duplicable snapshot. */
          availableVersions={(so.versions || []).map(v => {
            const nonDuplicableStatuses = ['Shipped', 'Partially Shipped', 'Cancelled', 'Partially Cancelled', 'Archived'];
            const latestNum = so.version?.number ?? so.versions?.[so.versions.length - 1]?.number;
            const isLatest = v.number === latestNum;
            return isLatest && nonDuplicableStatuses.includes(so.status) ? { ...v, canDuplicate: false } : v;
          })}
          currentVersion={so.version?.number}
          onConfirm={({ customerId, customerName, versionMode, selectedVersion }) => {
            setShowDuplicateModal(false);
            const payload = buildDuplicateSOPayload(so, {
              newCustomerId: customerId,
              newCustomerName: customerName,
              versionMode,
              selectedVersion,
            });
            const dup = store.createSO(payload);
            const versionLabel = versionMode === 'all'
              ? 'all versions copied'
              : `from V${selectedVersion}`;
            setDuplicateOverlay({
              soNumber: dup.soNumber,
              customerName: customerName || so.customer,
              targetId: dup.id,
              versionLabel,
            });
          }}
        />
      )}
      <StateTransitionOverlay
        isActive={duplicateOverlay !== null}
        fromLabel={so.soNumber}
        toLabel={duplicateOverlay?.soNumber ?? ''}
        tone="info"
        Icon={Copy}
        heading="Duplicating Sales Order"
        meta={duplicateOverlay?.versionLabel}
        duration={2000}
        onComplete={() => {
          if (!duplicateOverlay) return;
          const targetId = duplicateOverlay.targetId;
          const newNumber = duplicateOverlay.soNumber;
          setDuplicateOverlay(null);
          toast.success(`Sales Order duplicated → ${newNumber}`);
          navigate(`/sales-orders/${targetId}`);
        }}
      />


      {/* Inactive-items warning, before the send / submit / release it
          guards, the way PO puts it before Send to Vendor. */}
      <InactiveItemsWarningModal
        open={!!inactiveWarning}
        mode={inactiveWarning?.mode ?? "send"}
        lines={inactiveWarningLines}
        noun="sales order"
        onClose={() => setInactiveWarning(null)}
        onConfirm={() => {
          const pending = inactiveWarning;
          setInactiveWarning(null);
          pending?.run();
        }}
      />

      {/* Send to Customer Modal */}
      <SendToCustomerModal
        isOpen={showSendToCustomer}
        so={so}
        isResend={isSendResend}
        mode={sendModalMode}
        advancesToPendingReview={isCreator}
        onClose={() => setShowSendToCustomer(false)}
        onSend={() => {
          /* Guard the Draft → next-stage path that runs through this
             modal: same negative-total rule as handleMarkUnconfirmed /
             handleConfirm. Print mode is a no-op, no guard needed. Ops
             View sending doesn't advance status, so it skips the guard. */
          if (sendModalMode !== "print" && isDraft && !isSendResend && isCreator) {
            if (blockTransitionIfNegative('send for review')) return;
          }
          setShowSendToCustomer(false);
          if (sendModalMode === "print") {
            // Print triggered — no toast needed
          } else if (isDraft && !isSendResend) {
            if (isReviewer) {
              /* Approver View is the reviewer. Sending the document doesn't
                 advance status; Release for Fulfillment is the dedicated
                 verb for moving the SO to Released. */
              toast.success(`${so.soNumber} sent to customer`);
            } else {
              // The SendToCustomerModal already showed the glassmorphism overlay
              // with next state (Pending Review) — suppress StageTransitionOverlay
              suppressNextTransitionRef.current = true;
              store.markUnconfirmed(so.id);
            }
          } else {
            toast.success(`${so.soNumber} resent to customer`);
          }
        }}
      />

      <StageTransitionOverlay status={so.status} suppressNextRef={suppressNextTransitionRef} />

      {/* Version History Modal */}
      {showVersionModal && (
        <VersionHistoryModal
          soNumber={so.soNumber}
          currentVersion={soVersion.number}
          onClose={() => setShowVersionModal(false)}
        />
      )}

      {/* Auto Version Confirm Modal */}
      <AutoVersionConfirmModal
        isOpen={showAutoVersionConfirm}
        fieldLabel={autoVersionField}
        oldValue={pendingVersionChange?.oldValue}
        newValue={pendingVersionChange?.newValue}
        currentVersion={soVersion.number}
        fromStatus={so.status}
        onConfirm={() => {
          setShowAutoVersionConfirm(false);
          setShowAutoVersionOverlay(true);
          const isRevert = pendingVersionChange?.isRevert;
          if (!isRevert) {
            store.createVersionDraft(so.id);
          }
          const pendingAction = pendingVersionChange?.action;
          setPendingVersionChange(null);
          if (pendingAction) {
            setTimeout(() => pendingAction(), 300);
          }
        }}
        onDiscard={() => {
          /* User rejected the new-version prompt — run the revert
             handler (if the originating mutation supplied one) so a
             rejected discount/premium add doesn't linger in the
             sidebar list. */
          pendingVersionChange?.onRevert?.();
          setShowAutoVersionConfirm(false);
          setPendingVersionChange(null);
        }}
      />

      {/* Auto Version Overlay — toast fires exactly once per draft
          creation, guarded by `toastedForVersionRef` so re-renders or
          strict-mode double-fires of `onComplete` cannot duplicate it. */}
      <AutoVersionOverlay
        show={showAutoVersionOverlay}
        newVersion={soVersion.number + 1}
        fromStatus={so.previousStatus || so.status}
        onComplete={() => {
          setShowAutoVersionOverlay(false);
          const v = soVersion.number;
          if (toastedForVersionRef.current !== v) {
            toastedForVersionRef.current = v;
            toast.success(`Version ${v} draft created`);
          }
          /* Drain the Partner-sync success toast if one was stashed.
             Delay lets the version toast paint first so both stack
             cleanly instead of animating in on top of each other. */
          if (pendingSyncSuccessToast) {
            const msg = pendingSyncSuccessToast;
            setPendingSyncSuccessToast(null);
            setTimeout(() => {
              toast.success(msg);
            }, 400);
          }
        }}
      />

      {/* Sync overlay — Draft-path acknowledgement when the user
          applies updates from the Outdated Configurations modal.
          Shares the same StateTransitionOverlay chrome as the
          version-revert / state-transition surfaces on this page.
          Toast fires on complete so the outcome is visible after the
          animation. */}
      <StateTransitionOverlay
        isActive={!!outdatedSyncOverlay}
        fromLabel="Outdated"
        toLabel="Up to date"
        tone="success"
        heading={outdatedSyncOverlay
          ? outdatedSyncOverlay.count === 1
            ? "Syncing configuration"
            : `Syncing ${outdatedSyncOverlay.count} configurations`
          : ""}
        meta={outdatedSyncOverlay?.label}
        duration={1600}
        onComplete={() => {
          if (outdatedSyncOverlay) {
            toast.success(outdatedSyncOverlay.label);
          }
          setOutdatedSyncOverlay(null);
        }}
      />

      <OutdatedConfigsModal
        open={showOutdatedConfigsModal}
        onOpenChange={setShowOutdatedConfigsModal}
        updates={outdatedUpdates}
        customerName={so.customer}
        documentType="order"
        onApply={(ids) => {
          if (ids.length === 0) return;
          const applied = outdatedUpdates.filter((u) => ids.includes(u.id));
          const successToast = applied.length === 1
            ? `1 outdated configuration updated`
            : `${applied.length} outdated configurations updated`;

          /* Draft-only flow. Applying the sync commits directly and
             plays the sync overlay; the overlay's onComplete drains
             the toast so the outcome lands after the animation.
             markOutdatedApplied also flips the banner-dismissed flag
             in the shared registry so the version-card banner does
             not resurface for the remaining un-synced items — this
             is a single-time choice per draft. */
          setOutdatedUpdates((prev) => prev.filter((u) => !ids.includes(u.id)));
          markOutdatedApplied(so.id, ids);
          setOutdatedBannerVisible(false);
          setOutdatedSyncOverlay({ count: applied.length, label: successToast });
        }}
        onIgnore={(ids) => {
          /* Ignore permanently marks these ids as dismissed for this
             record — they will not resurface even if the modal is
             reopened manually. Also flips banner-dismissed so the
             version-card banner does not come back. */
          markOutdatedIgnored(so.id, ids);
          setOutdatedUpdates((prev) => prev.filter((u) => !ids.includes(u.id)));
          setOutdatedBannerVisible(false);
        }}
      />
    </>
  );
}

/* ── Status message config ── */
function getStatusMessage(so: { status: string; cancellationReason?: string; cancellationReasonText?: string; previousStatus?: string; version?: { number: number } }) {
  type IconComponent = typeof Pencil;
  interface StatusMsg { icon: IconComponent; title: string; subtitle: string; accentColor: string; cta?: { label: string; action: string } }
  const v = so.version?.number ?? 1;
  // Suppress the Draft banner for a newly created V1 SO that has never
  // advanced past Draft. The banner is meaningful when there's a prior
  // active version (V2+ being re-cut) or when the SO came back to Draft
  // from a later status, but on a brand-new order it just adds noise.
  const isFreshV1Draft = v <= 1 && !so.previousStatus;
  const map: Record<string, StatusMsg | null> = {
    Draft: isFreshV1Draft
      ? null
      : { icon: Pencil, title: `Editing Version ${v} draft`, subtitle: `Submit for review when ready to finalize V${v}.`, accentColor: "var(--primary)" },
    "Pending Review": { icon: AlertTriangle, title: "Pending Review", subtitle: "Sales Order submitted. Awaiting clearance.", accentColor: "var(--chart-3)" },
    /* Status belongs to the Sales Order, not the version. Version
       is separately conveyed via the header pill + version dropdown;
       these banner titles read as SO-scoped state. */
    Cleared: { icon: Check, title: `Order released for fulfillment`, subtitle: `Any material change creates a new draft version (V${v + 1}).`, accentColor: "var(--primary)", cta: { label: `Edit as V${v + 1}`, action: "createDraft" } },
    Shipped: { icon: Truck, title: `Order shipped`, subtitle: `Any material change creates a new draft version (V${v + 1}).`, accentColor: "var(--success)", cta: { label: `Edit as V${v + 1}`, action: "createDraft" } },
    "Partially Shipped": { icon: Truck, title: `Order partially shipped`, subtitle: `Any material change creates a new draft version (V${v + 1}).`, accentColor: "var(--chart-4)", cta: { label: `Edit as V${v + 1}`, action: "createDraft" } },
    Cancelled: { icon: Ban, title: "Order cancelled", subtitle: so.cancellationReason ? `Reason: ${so.cancellationReason}${so.cancellationReasonText ? `. ${so.cancellationReasonText}` : ""}` : "Already-shipped units remain shipped. Archive to finalize.", accentColor: "var(--destructive)" },
    "Partially Cancelled": { icon: Ban, title: "Line items marked as cancelled", subtitle: "Cancelled lines are frozen. Remaining active lines continue processing.", accentColor: "var(--chart-3)" },
    Archived: { icon: Archive, title: `Archived (previously ${so.previousStatus || "Shipped"})`, subtitle: "Hidden from default listing.", accentColor: "var(--destructive)" },
  };
  return map[so.status] || null;
}

export default SODetail;