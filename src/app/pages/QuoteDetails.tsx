// @ts-nocheck
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { InactiveItemsWarningModal, type InactiveWarningMode } from '../components/shared/InactiveItemsWarningModal';
import { isItemInactive } from '../components/shared/inactiveItems';
import { getLineItemImage } from '../data/lineItemImage';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Package, ArrowUpRight, Zap, Pencil, Paperclip, MessageSquare, GitBranch, Copy, Archive, X, Download, FileText, Printer, CheckCircle2, Clock, AlertTriangle, Link2, Ban, MoreHorizontal, Receipt, Maximize2, Minimize2, ChevronDown, StickyNote, Upload, ExternalLink, RefreshCw, RotateCcw, ThumbsDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { QuoteLifecycleStatus, ModernStatusStepper, getStepperBackground } from '../components/quote-details/ModernStatusStepper';
import { DetailTabStrip } from '../components/shared/DetailTabStrip';
import { getCustomerDefaults } from '../components/shared/customerDefaults';
import { StatusActionButton } from '../components/quote-details/StatusActionButton';
import { ReactivateChoiceModal } from '../components/quote-details/ReactivateChoiceModal';
import { SendToCustomerModal } from '../components/quote-details/SendToCustomerModal';
import { StatusTransitionOverlay, CustomActionConfig } from '../components/quote-details/StatusTransitionOverlay';
import { StatusNoticeBanner } from '../components/shared/StatusNoticeBanner';
import { NoticeBannerStack } from '../components/shared/NoticeBannerStack';
import { StatusTimelineHoverCard, type StatusTimelineEntry } from '../components/shared/StatusTimelineHoverCard';
import { InlineDescriptionEditor } from '../components/shared/InlineDescriptionEditor';
import { VersionDropdown } from '../components/quote-details/VersionDropdown';
import { PriorityDropdown } from '../components/quote-details/PriorityDropdown';
import { ItemsTabTableClean } from '../components/quote-details/ItemsTabTableClean';
import { ComingSoonTab } from '../components/quote-details/ComingSoonTab';
import { OverviewTab } from '../components/quote-details/OverviewTab';
import { RightSidebar } from '../components/quote-details/RightSidebar';
import { AttachmentsTab as LinkedTransactionsTab, getInitialQuoteAttachmentsCount } from '../components/quote-details/AttachmentsTab';
import { TransactionsTab } from '../components/quote-details/TransactionsTab';
import { VersionHistoryTab } from '../components/quote-details/VersionHistoryTab';
import { DuplicateQuoteModal } from '../components/quote-details/DuplicateQuoteModal';
import { PDFPreviewModal } from '../components/quote-details/PDFPreviewModal';
import { ConvertToSOModal } from '../components/quote-details/ConvertToSOModal';
import { DraftConflictModal } from '../components/quote-details/DraftConflictModal';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { CancelConvertedQuoteModal } from '../components/quote-details/CancelConvertedQuoteModal';
import { ConfirmDiscardModal } from '../components/shared/ConfirmDiscardModal';
import { StateTransitionOverlay } from '../components/shared/StateTransitionOverlay';
import { ReviveQuoteModal } from '../components/quote-details/ReviveQuoteModal';
import { ReviveCancelledModal } from '../components/quote-details/ReviveCancelledModal';
import { VersionChangePromptModal } from '../components/quote-details/VersionChangePromptModal';
import { showNonMaterialChangeToast, showMaterialChangeAccumulatedToast } from '../components/quote-details/versionToasts';
import { AutoVersionOverlay } from '../components/quote-details/AutoVersionOverlay';
import { AutoVersionConfirmModal } from '../components/quote-details/AutoVersionConfirmModal';
import { OutdatedConfigsModal } from '../components/shared/OutdatedConfigsModal';
import {
  getOutdatedForId,
  markOutdatedApplied,
  markOutdatedIgnored,
  dismissOutdatedBanner,
  shouldShowOutdatedBanner,
} from '../data/outdatedConfigs';
import { isEditableStatus, requiresNewDraftFirst } from '../utils/versioningEngine';
import { mockQuotes } from '../data/mockQuotes';
import { LegacyImportPill } from '../components/import/LegacyImportPill';
/* The summary modals and the line item configurator need to share the
   exact same line list the items table renders. ItemsTabTableClean
   expands QUOTE_LINES into a 50-item MOCK_LINE_ITEMS dataset; we
   pull that here so adjustments + pricing rules operate over the full
   list (not the 13-row base subset). */
import { MOCK_LINE_ITEMS as QUOTE_LINES } from '../components/quote-details/ItemsTabTableClean';
import { usePricingRules } from '../components/quote-details/usePricingRules';
import { useAdjustments } from '../components/quote-details/useAdjustments';
import { getCreatedQuote, getCreatedQuoteAdjustments, setQuoteStatusOverride, clearQuoteStatusOverride, applyQuoteOverride, addRejectionDoc } from '../data/quoteStore';
import type { QuoteRejectionReason } from '../types/quote';
import { getQuoteDescription, setQuoteDescription } from '../data/quoteStore';
import { duplicateQuote } from '../data/duplicateQuote';
import { QuoteStatus } from '../types/quote';
import { summarizeQuote } from '../data/summarizeQuote';

// Map from listing QuoteStatus → lifecycle status used in detail page
function mapToLifecycleStatus(status: QuoteStatus): QuoteLifecycleStatus {
  switch (status) {
    case 'Draft': return 'draft';
    case 'Sent to Customer': return 'sent';
    case 'Unconfirmed SO': return 'confirmed';
    case 'Confirmed SO': return 'converted';
    case 'Rejected': return 'rejected';
    case 'Cancelled': return 'cancelled';
    case 'Archived': return 'archived';
    case 'Expired': return 'expired';
    default: return 'draft';
  }
}

interface QuoteDetailsProps {
  quoteId?: string;
  onBack?: () => void;
}


/* Bill to / Ship to / terms / method for the PDF, Print and Send
   previews. Prefers the quote record; an explicitly empty field ('')
   passes through as '' so the document shows the empty label. Records
   that predate these fields use the customer defaults (null for a
   name-only customer). */
function pdfCommercialFromRecord(
  quote: { billingAddress?: string; shippingAddress?: string; paymentTerms?: string; paymentMethod?: string } | undefined,
  defaults: ReturnType<typeof getCustomerDefaults>,
) {
  const fromDefaults = (a: { street: string; city: string; state: string; zip: string } | null) =>
    a?.street ? { line: a.street, cityStateZip: `${a.city}, ${a.state} ${a.zip}` } : undefined;
  const fromRecord = (v: string) => (v.trim() ? { line: v, cityStateZip: '' } : undefined);
  return {
    billingAddress: quote?.billingAddress !== undefined ? fromRecord(quote.billingAddress) : fromDefaults(defaults.billingAddress),
    shippingAddress: quote?.shippingAddress !== undefined ? fromRecord(quote.shippingAddress) : fromDefaults(defaults.shippingAddress),
    paymentTerms: quote?.paymentTerms !== undefined ? quote.paymentTerms : (defaults.paymentTerms?.name ?? ''),
    paymentMethod: quote?.paymentMethod !== undefined ? quote.paymentMethod : (defaults.paymentMethod?.name ?? ''),
  };
}

export function QuoteDetails({ quoteId: propQuoteId, onBack }: QuoteDetailsProps) {
  const navigate = useNavigate();
  /* `?action=next` comes from the listing row menu's status items
     (Send to Customer, Confirmed by Customer, Reactivate Quote) and runs
     the header button's primary flow. `?action=convert` comes from the
     row's Convert to Sales Order (Draft, Sent or Confirmed), and opens
     the same Convert to SO modal the lifecycle uses. Read once, then
     dropped from the URL so a refresh does not run it again. */
  const [searchParams, setSearchParams] = useSearchParams();
  const [autoRunNext] = useState(() => searchParams.get('action') === 'next');
  const [autoConvert] = useState(() => searchParams.get('action') === 'convert');
  useEffect(() => {
    if (searchParams.get('action')) {
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Look up quote from mock data or created quotes store, then layer
  // any runtime status override (e.g. after Reject) so the detail page
  // reads the same source of truth as the listing.
  const mockQuote = propQuoteId ? mockQuotes.find(q => q.id === propQuoteId) : undefined;
  const createdQuote = propQuoteId && !mockQuote ? getCreatedQuote(propQuoteId) : undefined;
  const rawQuote = mockQuote || createdQuote;
  const quote = rawQuote ? applyQuoteOverride(rawQuote) : undefined;
  /* Newly-created quotes (those that came from the creation flow's
     in-memory store) start clean — no seeded one-time adjustments,
     no seeded pricing rules. Mock demo quotes keep the seed so the
     populated-quote screens still demo correctly. */
  const isNewlyCreatedQuote = !!createdQuote;

  const quoteNumber = quote?.quoteNumber || 'Q-000-000-000';
  const customerName = quote?.customer?.name || 'Unknown Customer';

  /* Shared pricing-rules state for the quote — one instance lives here
     and is forwarded to both the summary modal (via RightSidebar) and
     the line-item configurator (via ItemsTabTableClean). Mirrors the SO
     module's SODetail pattern. */
  const pricingAPI = usePricingRules(customerName, QUOTE_LINES);

  /* One-time adjustments — parallel to pricingAPI, lifted here so the
     summary modal and the line-item configurator share the same list. */
  /* Live mirror of the items table's line state. The table owns mutations
     (qty, price, shipmentConfig, etc.) and reports the latest list via
     onLinesChange. The sidebar reads from this so the header Ship By +
     divergence warning reflect the dates the user actually picked instead
     of the stale seed constant. */
  const [liveLines, setLiveLines] = useState<any[]>(QUOTE_LINES as any);

  /* An imported quote opens with the adjustments its file carried;
     anything else follows the existing rule (demo seed for mocks, empty
     for quotes created in-app). */
  const importedAdjustments = propQuoteId ? getCreatedQuoteAdjustments(propQuoteId) : undefined;
  /* Item-scope adjustments resolve against the lines they are applied to,
     so this reads `liveLines` rather than the mock seed constant. For a
     mock quote the two are the same list; for a created or imported quote
     `liveLines` is the record's real lines, which is what an item-level
     discount on an imported line has to be measured against. */
  const adjustmentsAPI = useAdjustments(liveLines as any, {
    skipSeed: isNewlyCreatedQuote,
    seed: importedAdjustments as any,
  });

  /* Live subtotal — sum of each line's `subtotal` (qty × unitPrice
     after the picker's UoM rescale). Replaces the previously stale
     `summarizeQuote(quote).grandTotal` that read from the static
     mockQuotes record. Re-runs whenever the items table writes back. */
  const liveSubtotal = useMemo(
    () => liveLines.reduce((sum: number, l: any) => sum + Number(l?.subtotal ?? l?.total ?? 0), 0),
    [liveLines],
  );

  /* Sync the headline `totalValue` on the underlying quote record
     so the listings + kanban (which read `q.totalValue` directly off
     the shared mock) reflect line edits the moment we leave the
     detail page. Safe to mutate here because both `mockQuotes` and
     the created-quotes store are mock in-memory arrays; the proper
     fix would be a store action, but this keeps the listing in sync
     without a reload. */
  useEffect(() => {
    if (!quote) return;
    (quote as { totalValue: number }).totalValue = liveSubtotal;
  }, [quote, liveSubtotal]);

  /* Projected quote total = post-rule subtotal + adjustment net impact.
     If pricing-rule and one-time discounts together push this negative,
     we block the draft → next-stage transition with an error toast. */
  const projectedTotal = pricingAPI.quoteSubtotal + adjustmentsAPI.grandTotal.net;
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
  /* '' for a real quote with no contact, so downstream surfaces show
     the empty state instead of "Unknown Contact". */
  const contactName = quote?.primaryPoC?.name || (quote ? '' : 'Unknown Contact');
  const initialCreatedDate = quote?.createdDate
    ? quote.createdDate.toISOString().split('T')[0]
    : '2026-02-05';
  const quoteExpiryDate = quote?.expiryDate || new Date(2026, 1, 28);
  
  // Data from creation flow → OverviewTab
  const quoteTags = quote?.tags || undefined;
  const quotePriority = quote?.priority || undefined;
  const quoteWinProbability = quote?.winProbability ?? undefined;
  const quoteSalesRep = quote?.salesRep || undefined;

  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'linked_transactions' | 'transactions' | 'communications' | 'version_history' | 'activity'>('items');

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
  const [quoteStatus, setQuoteStatus] = useState<QuoteLifecycleStatus>(
    quote ? mapToLifecycleStatus(quote.status) : 'sent'
  );
  // Version is stateful — starts from quote data or 3 (matching dropdown's initial data)
  const [quoteVersion, setQuoteVersion] = useState(quote?.version || 3);
  const [quoteMaxVersion, setQuoteMaxVersion] = useState(quote?.version || 3);

  // Sales order number — populated when quote is converted to SO
  const [salesOrderNumber, setSalesOrderNumber] = useState<string | null>(
    (quote && mapToLifecycleStatus(quote.status) === 'converted') ? 'SO-2026-0142' : null
  );

  // Created-on date state (editable, defaults to creation moment)
  const [createdDate, setCreatedDate] = useState(initialCreatedDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Header action modals
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showPDFVisibilityModal, setShowPDFVisibilityModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showConvertToSOModal, setShowConvertToSOModal] = useState(false);
  const [showSendToCustomer, setShowSendToCustomer] = useState(false);
  const [isSendResend, setIsSendResend] = useState(false);
  /* Inactive-items guard (PO `withInactiveCheck`). Moving a Draft forward
     with an inactive item on it asks first; it never blocks. `run` is the
     action the user started, replayed on "anyway". Only Drafts are
     checked, because that is the move toward an active state: a quote
     already sent is resent as it stands. */
  const [inactiveWarning, setInactiveWarning] = useState<{ mode: InactiveWarningMode; run: () => void } | null>(null);
  const inactiveWarningLines = useMemo(
    () => (liveLines as any[]).map((l) => ({
      id: String(l.id),
      code: l.productId,
      name: l.productName,
      image: l.image || getLineItemImage(l.productId),
    })),
    [liveLines],
  );
  const withInactiveCheck = (mode: InactiveWarningMode, run: () => void) => {
    const hasInactive = inactiveWarningLines.some((l) => isItemInactive(l.code));
    if (quoteStatus === 'draft' && hasInactive) setInactiveWarning({ mode, run });
    else run();
  };
  
  // Status transition overlay state
  const [transitionOverlay, setTransitionOverlay] = useState<{
    fromStatus: QuoteLifecycleStatus;
    toStatus: QuoteLifecycleStatus;
    pendingStatus: QuoteLifecycleStatus;
  } | null>(null);

  // Custom action overlay state (duplicate, archive)
  const [actionOverlay, setActionOverlay] = useState<{
    config: CustomActionConfig;
    onComplete: () => void;
  } | null>(null);

  // Archive confirmation modal state
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  
  // Description state
  const descriptionKey = propQuoteId || quoteNumber;
  const [description, setDescription] = useState(getQuoteDescription(descriptionKey) || quote?.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  // Version viewing state — when viewing an old version, page becomes read-only
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const isViewingOldVersion = viewingVersion !== null;

  /* Header revert flow (shown when the user is viewing an old version
     and clicks the header button). Mirrors the dropdown + history-tab
     reverts: a shared RevertConfirmModal gates the action, then a
     StateTransitionOverlay plays for ~2 s before committing through
     `doRevertToVersion`. Without this, the header button used to fire
     `handleEditAsDraft` directly, skipping both the confirmation and
     the transition overlay — inconsistent with every other revert
     entry point. */
  const [headerRevertConfirm, setHeaderRevertConfirm] = useState<{ version: number } | null>(null);
  const [headerRevertOverlay, setHeaderRevertOverlay] = useState<{ toVersion: number; fromVersion: number } | null>(null);

  // Draft conflict modal state — shown when reverting/editing while a draft already exists
  const [draftConflict, setDraftConflict] = useState<{ fromVersion: number } | null>(null);

  // Cancel converted quote modal
  const [showCancelConvertedModal, setShowCancelConvertedModal] = useState(false);

  // Archive converted quote modal (same as cancel but for archive action)
  const [showArchiveConvertedModal, setShowArchiveConvertedModal] = useState(false);

  // Revive expired quote modal
  const [showReviveModal, setShowReviveModal] = useState(false);

  // Revive cancelled quote modal
  const [showReviveCancelledModal, setShowReviveCancelledModal] = useState(false);
  /* Outdated Partner Management configurations that have been pushed
     for this quote's customer since the quote was last saved. Looked
     up per-quote so only the hero demo record (id `q-outdated-demo`)
     surfaces the amber pill — every other quote reads as up to date.
     Applied ids drop out of both local state and the shared registry
     so navigating away + back doesn't resurrect them. */
  const [outdatedUpdates, setOutdatedUpdates] = useState(() => getOutdatedForId(propQuoteId ?? quote?.id));
  const [showOutdatedConfigsModal, setShowOutdatedConfigsModal] = useState(false);
  /* Version card visibility. Drives the X-close affordance the user
     can hit to hide the whole bar for the session (saves vertical
     space). Also refreshed whenever the outdated banner is dismissed
     so the bar re-renders to the plain version-status content. */
  const [versionBannerHidden, setVersionBannerHidden] = useState(false);
  const [outdatedBannerVisible, setOutdatedBannerVisible] = useState(() =>
    shouldShowOutdatedBanner(propQuoteId ?? quote?.id),
  );
  /* Auto-dismiss the outdated banner the moment the quote leaves
     Draft. Sending to customer, converting, or creating a new version
     all move the record out of Draft; keeping the banner around after
     that would either render an empty version card (no matching
     status branch would fire) or nag the user about a sync that no
     longer applies. Treated as an implicit "ignore" so the banner
     goes away and never resurfaces. */
  useEffect(() => {
    if (quoteStatus !== 'draft' && outdatedBannerVisible) {
      dismissOutdatedBanner(propQuoteId ?? quote?.id ?? '');
      setOutdatedBannerVisible(false);
    }
  }, [quoteStatus, outdatedBannerVisible, propQuoteId, quote?.id]);
  /* When the apply routes through the material-change flow (Sent /
     Confirmed), AutoVersionOverlay plays and this stays null. When
     it lands on a Draft (no version fork), we still want the user to
     see something happen — this drives a lightweight sync overlay
     with the same StateTransitionOverlay chrome used elsewhere. */
  const [outdatedSyncOverlay, setOutdatedSyncOverlay] = useState<{ count: number; label: string } | null>(null);
  /* Success toast that has to wait until the material-change flow
     actually finishes on the Sent / Confirmed path. If the user
     cancels the version confirm modal (revert callback), we clear
     this and never fire it. If they confirm, AutoVersionOverlay's
     onComplete drains it after the version toast, so the two land
     in sequence rather than fighting for the same spot. */
  const [pendingSyncSuccessToast, setPendingSyncSuccessToast] = useState<string | null>(null);

  /* Auto-open the review modal when the user landed here via
     `?outdated=1` (clicking the pill from the listing). Only fires
     once per mount and only when there's something to review. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('outdated') === '1' && outdatedUpdates.length > 0) {
      setShowOutdatedConfigsModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the status before cancellation — used to decide whether to bump version on revive
  const [statusBeforeCancellation, setStatusBeforeCancellation] = useState<QuoteLifecycleStatus | null>(null);
  const [statusBeforeArchive, setStatusBeforeArchive] = useState<QuoteLifecycleStatus | null>(null);

  // Cancellation reason state — populated from mock data or set when user cancels
  const [cancellationReason, setCancellationReason] = useState<string | null>(
    quote?.cancellationReason || null
  );

  // Archive reason state
  const [archiveReason, setArchiveReason] = useState<string | null>(null);
  const [archiveReasonInput, setArchiveReasonInput] = useState('');

  /* Rejection reason state — captured on "Rejected by Customer" and
     carried forward onto the reactivated draft so the banner stays
     visible while the rep revises the quote. Cleared once the rep
     re-sends the reactivated draft to the customer. */
  /* Reason label and comments are kept as two separate pieces of
     state so the banner can render them with distinct typography
     (no em-dash / "--" separator jammed between them). */
  const [rejectionReason, setRejectionReason] = useState<string | null>(quote?.rejectionReason ?? null);
  const [rejectionReasonText, setRejectionReasonText] = useState<string | null>(quote?.rejectionReasonText ?? null);
  const [rejectionBannerDismissed, setRejectionBannerDismissed] = useState(false);
  /* Reactivate flow — choice modal with inline dates on the new-
     draft option. No separate follow-up modal any more. */
  const [showReactivateChoice, setShowReactivateChoice] = useState(false);
  /* Rejected quotes reactivate from the rejection banner, not the status
     button, so the listing's "Reactivate Quote" next step opens it here. */
  useEffect(() => {
    if (autoRunNext && quoteStatus === 'rejected') setShowReactivateChoice(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Row menu's Convert to Sales Order: the conversion modal, behind the
     inactive-items warning a Draft gets before it moves forward. */
  useEffect(() => {
    if (autoConvert && (quoteStatus === 'draft' || quoteStatus === 'sent' || quoteStatus === 'confirmed')) {
      withInactiveCheck('convert', () => setShowConvertToSOModal(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Track the status the quote was in before it was rejected, so
     Reactivate can restore it on the same version (mirrors the
     Cancel + Archive reactivation semantics). Defaults to `sent`
     when the record was seeded as Rejected from mock data. */
  const [statusBeforeRejection, setStatusBeforeRejection] = useState<QuoteLifecycleStatus | null>(
    quote?.status === 'Rejected' ? 'sent' : null,
  );

  // Priority state — lifted to header level. Accepts the canonical
  // High/Standard/Low terms and legacy Urgent/Medium values so older
  // mock data still resolves cleanly.
  const mapPriority = (p?: 'High' | 'Standard' | 'Low' | 'Urgent' | 'Medium'): 'low' | 'standard' | 'high' => {
    if (p === 'High' || p === 'Urgent') return 'high';
    if (p === 'Low') return 'low';
    return 'standard';
  };
  const [headerPriority, setHeaderPriority] = useState<'low' | 'standard' | 'high'>(mapPriority(quotePriority));

  // ═══ Responsive Layout State ═══════════════════════════════════════════════
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const isDraggingTabs = useRef(false);
  const tabsDragMoved = useRef(false);
  const tabsDragStart = useRef({ x: 0, scrollLeft: 0 });
  const [isScrolled, setIsScrolled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabsCanScrollLeft, setTabsCanScrollLeft] = useState(false);
  const [tabsCanScrollRight, setTabsCanScrollRight] = useState(false);

  // Detect narrow viewport
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 860);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Scroll compression for header — the detail page is no longer its
  // own scroll container; the AppLayout's <main> element is the only
  // scrolling surface (single page scrollbar). Find that ancestor via
  // contentScrollRef and listen to its scrollTop.
  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    const scrollEl = el.closest('main') as HTMLElement | null;
    if (!scrollEl) return;
    const handler = () => setIsScrolled(scrollEl.scrollTop > 10);
    scrollEl.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => scrollEl.removeEventListener('scroll', handler);
  }, []);

  // Close more-actions dropdown on outside click
  useEffect(() => {
    if (!showMoreActions) return;
    const handleClick = (e: MouseEvent) => {
      if (moreActionsRef.current && !moreActionsRef.current.contains(e.target as Node)) {
        setShowMoreActions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMoreActions]);

  // Tabs scroll detection
  const updateTabsScroll = useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setTabsCanScrollLeft(el.scrollLeft > 2);
    setTabsCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateTabsScroll();
    const el = tabsContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateTabsScroll);
    window.addEventListener('resize', updateTabsScroll);
    return () => {
      el.removeEventListener('scroll', updateTabsScroll);
      window.removeEventListener('resize', updateTabsScroll);
    };
  }, [updateTabsScroll]);

  // Tabs drag-to-scroll handlers
  const handleTabsMouseDown = useCallback((e: React.MouseEvent) => {
    const el = tabsContainerRef.current;
    if (!el) return;
    isDraggingTabs.current = true;
    tabsDragMoved.current = false;
    tabsDragStart.current = { x: e.pageX, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  const handleTabsMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingTabs.current) return;
    const el = tabsContainerRef.current;
    if (!el) return;
    const dx = e.pageX - tabsDragStart.current.x;
    if (Math.abs(dx) > 3) tabsDragMoved.current = true;
    el.scrollLeft = tabsDragStart.current.scrollLeft - dx;
  }, []);

  const handleTabsMouseUp = useCallback(() => {
    isDraggingTabs.current = false;
    const el = tabsContainerRef.current;
    if (el) {
      el.style.cursor = 'grab';
      el.style.userSelect = '';
    }
    // Reset drag flag after a tick so the click event can check it first
    requestAnimationFrame(() => {
      tabsDragMoved.current = false;
    });
  }, []);

  // Status label helper for compact badge
  const getStatusLabel = (status: QuoteLifecycleStatus) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'sent': return 'Sent';
      case 'confirmed': return 'Confirmed';
      case 'converted': return 'Converted';
      case 'rejected': return 'Rejected';
      case 'cancelled': return 'Cancelled';
      case 'archived': return 'Archived';
      case 'expired': return 'Expired';
      default: return status;
    }
  };

  /* Quote status pill — same chrome as SO `SOStatusBadge` and Partner
     `StatusPill`: rounded-full, soft tinted bg, hairline border tinted
     by the dot color, `text-[11px]` weight 500. */
  const getStatusPillStyle = (status: QuoteLifecycleStatus): React.CSSProperties => {
    const palette: Record<QuoteLifecycleStatus, { bg: string; text: string; dot: string }> = {
      draft:     { bg: '#F1F5F9', text: '#334155', dot: '#64748B' },
      sent:      { bg: '#E5F0FF', text: '#0F62D6', dot: '#0A77FF' },
      confirmed: { bg: '#ECFDF5', text: '#065F46', dot: '#059669' },
      converted: { bg: '#ECFDF5', text: '#065F46', dot: '#059669' },
      rejected:  { bg: '#FEF2F2', text: '#991B1B', dot: '#DC2626' },
      cancelled: { bg: '#FEF2F2', text: '#991B1B', dot: '#DC2626' },
      archived:  { bg: '#FEF2F2', text: '#991B1B', dot: '#DC2626' },
      expired:   { bg: '#FFFBEB', text: '#92400E', dot: '#D97706' },
    };
    const c = palette[status] ?? palette.draft;
    /* Dimensions match `PriorityDropdown`'s pill (24px tall, 10px
       horizontal padding, lineHeight 1) so the two header pills
       read as a matched pair. Weight stays at 500 to align with
       Partner's status-pill convention (`fontWeight: 500` in
       Partner `SalesOrdersTable` / `LinkedPartnersTable`). Metadata
       pills like `ModifiedPill` / `PrimaryPill` are the ones that
       go 600 — status pills stay medium. */
    return {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      height: 24,
      padding: '0 10px',
      borderRadius: 9999,
      fontSize: 11, fontWeight: 500, lineHeight: 1,
      whiteSpace: 'nowrap', flexShrink: 0,
      backgroundColor: c.bg,
      color: c.text,
      border: `1px solid ${c.dot}33`,
    };
  };

  // ═══ Versioning Engine State ═══════════════════════════════════════════════
  // Tracks number of material changes accumulated in the current draft version.
  // Resets when status transitions away from draft.
  const [materialChangesInDraft, setMaterialChangesInDraft] = useState(0);

  /* Quote-level freight cost lifted up here so the freight breakdown
     modal (RightSidebar) and the line item configurator (via
     ItemsTabTableClean) share the same source of truth. Per-line
     overrides are stored as a map keyed by line id; an absent entry
     means that line inherits the quote-level default. */
  const [quoteDefaultFreight, setQuoteDefaultFreight] = useState<number>(2000);
  const [lineFreightCosts, setLineFreightCosts] = useState<Record<string, number>>({});
  const setLineFreightCost = useCallback((lineId: string, cost: number | undefined) => {
    setLineFreightCosts((prev) => {
      const next = { ...prev };
      if (typeof cost === 'number') next[lineId] = cost;
      else delete next[lineId];
      return next;
    });
  }, []);
  const seedLineFreightCosts = useCallback((map: Record<string, number>) => {
    /* Used by the configurator's onSeedSiblingFreightShares when
       converting from quote-level to per-line. Merges the supplied
       shares into the existing map without wiping unrelated entries. */
    setLineFreightCosts((prev) => ({ ...prev, ...map }));
  }, []);
  const clearAllLineFreightCosts = useCallback(() => setLineFreightCosts({}), []);

  // Auto-version overlay state
  const [autoVersionOverlay, setAutoVersionOverlay] = useState<{
    show: boolean; newVersion: number; fromStatus: string;
  }>({ show: false, newVersion: 0, fromStatus: '' });

  // Auto-version confirmation modal state — gates before overlay animation
  const [autoVersionConfirm, setAutoVersionConfirm] = useState<{
    show: boolean;
    fieldKey: string;
    fieldLabel: string;
    oldValue?: string;
    newValue?: string;
    fromStatus: string;
    /* Called when the user discards the version prompt. Lets the
       originating modal undo the mutation it already applied (e.g.
       reactivate a deactivated pricing rule, remove a just-added
       adjustment). Without this, rejecting the prompt left the
       material change in place. */
    onRevert?: () => void;
  }>({ show: false, fieldKey: '', fieldLabel: '', fromStatus: '' });

  // Deferred callback fired after a version-first edit (PPU change on a
  // post-Confirmation quote) is confirmed. Lets the line-items table
  // open its PPU scope modal AFTER the new draft has been created so
  // the edit doesn't happen on a read-only version.
  const [pendingPostVersionApply, setPendingPostVersionApply] = useState<(() => void) | null>(null);

  // Ask-user prompt state (for instructions / attachments)
  const [versionPrompt, setVersionPrompt] = useState<{
    fieldKey: string;
    fieldLabel: string;
    changeDescription: string;
    onComplete: (createVersion: boolean) => void;
  } | null>(null);

  // ═══ Versioning Handlers ═══════════════════════════════════════════════════

  /**
   * Handle a MATERIAL change.
   * - If sent/confirmed → show confirmation modal first, then auto-create new draft on confirm.
   * - If draft → accumulate within current draft version.
   * - If converted/cancelled/archived → ignore (read-only).
   */
  const handleMaterialChange = useCallback((fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string, onRevert?: () => void) => {
    if (!isEditableStatus(quoteStatus)) return;

    if (requiresNewDraftFirst(quoteStatus)) {
      // Show confirmation modal before creating new version. Triggers
      // from Sent to Customer onwards — once the proposal is out, any
      // material change has to fork a new version so the original sent
      // revision stays intact.
      setAutoVersionConfirm({
        show: true,
        fieldKey,
        fieldLabel,
        oldValue,
        newValue,
        fromStatus: quoteStatus === 'confirmed' ? 'Confirmed' : 'Sent',
        onRevert,
      });
    } else {
      /* Already in draft — accumulate silently. No per-edit toast:
         once the draft has been forked, each subsequent material edit
         on the same draft is just "more work on this version" and the
         user doesn't need a toast for every keystroke. Action-specific
         toasts (rule deactivated, scope chosen on a PPU change) still
         fire from the originating modal where the context is richer
         than a generic "field updated" string. */
      setMaterialChangesInDraft(prev => prev + 1);
    }
  }, [quoteStatus, quoteVersion]);

  /** Called when user confirms auto-version creation from the confirmation modal */
  const handleAutoVersionConfirmed = useCallback((reason?: string) => {
    const newVer = quoteMaxVersion + 1;
    setQuoteMaxVersion(newVer);
    const prevStatus = autoVersionConfirm.fromStatus;
    setAutoVersionConfirm(prev => ({ ...prev, show: false }));

    setQuoteVersion(newVer);
    setQuoteStatus('draft');
    setMaterialChangesInDraft(1);

    // Notify version dropdown — auto-drafts from material changes are
    // NOT reverts, so route through the non-revert add path so the
    // "Revert" pill and "Reverted from vN" prefix don't appear.
    if ((window as any).__versionDropdownAddNewDraft) {
      const trimmed = reason?.trim();
      const label = trimmed
        ? `Auto-draft: ${autoVersionConfirm.fieldLabel}. Reason: ${trimmed}`
        : `Auto-draft: ${autoVersionConfirm.fieldLabel}`;
      (window as any).__versionDropdownAddNewDraft(label);
    }

    setAutoVersionOverlay({ show: true, newVersion: newVer, fromStatus: prevStatus });

    // If the trigger was a version-first PPU edit, run its deferred
    // apply callback now that the new draft exists. We delay so the
    // overlay animation has a chance to mount before the scope modal
    // stacks on top.
    if (pendingPostVersionApply) {
      const cb = pendingPostVersionApply;
      setPendingPostVersionApply(null);
      setTimeout(() => cb(), 300);
    }
  }, [quoteVersion, autoVersionConfirm, pendingPostVersionApply]);

  /** Called when user discards the material change from the confirmation modal */
  const handleAutoVersionDiscarded = useCallback(() => {
    /* Run the originating modal's revert callback (if it supplied
       one) so the local mutation is undone — without this, cancelling
       a version prompt after, say, deactivating a pricing rule or
       adding a discount left the change sitting in the modal even
       though the user explicitly backed out. */
    const reverted = !!autoVersionConfirm.onRevert;
    autoVersionConfirm.onRevert?.();
    setAutoVersionConfirm(prev => ({ ...prev, show: false, onRevert: undefined }));
    setPendingPostVersionApply(null);
    toast('Change discarded', {
      description: reverted
        ? `No new version created. The ${autoVersionConfirm.fieldLabel.toLowerCase()} change was rolled back.`
        : `No new version created. The ${autoVersionConfirm.fieldLabel.toLowerCase()} change was not applied.`,
      position: 'top-right',
    });
  }, [autoVersionConfirm]);

  /** Version-first PPU edit gate — called by the line-items table BEFORE
   *  it opens its scope modal. Opens AutoVersionConfirm; on confirm,
   *  the apply callback runs (which opens the scope modal). On discard,
   *  the edit is dropped entirely. */
  const handleRequestPriceVersionConfirm = useCallback((fieldLabel: string, oldValue: string, newValue: string, applyCallback: () => void) => {
    if (!requiresNewDraftFirst(quoteStatus)) {
      // Shouldn't happen — the table only calls this when version-first
      // is needed — but fall through gracefully if status changed under us.
      applyCallback();
      return;
    }
    setPendingPostVersionApply(() => applyCallback);
    setAutoVersionConfirm({
      show: true,
      fieldKey: 'unit_price',
      fieldLabel,
      oldValue,
      newValue,
      fromStatus: quoteStatus === 'confirmed' ? 'Confirmed' : 'Sent',
    });
  }, [quoteStatus]);

  /**
   * Handle a NON-MATERIAL change.
   * Always just logs — no version bump regardless of status.
   */
  const handleNonMaterialChange = useCallback((_fieldKey: string, fieldLabel: string, _oldValue?: string, _newValue?: string) => {
    showNonMaterialChangeToast(fieldLabel);
  }, []);

  /**
   * Handle an ASK-USER change (pricing rules / adjustments / etc.).
   *
   * Stage-aware:
   * - Sent/Confirmed → show the version prompt. The only forward path is
   *   creating a new version; cancelling discards the intent ("record
   *   only" was removed because internal-only edits would let V{N} in the
   *   customer's hands diverge from V{N} in our system).
   * - Draft → the user is already iterating on a draft; accumulate as a
   *   material change without re-prompting on every edit.
   * - Anything else (read-only) → ignore.
   */
  const handleAskUserChange = useCallback((fieldKey: string, fieldLabel: string, changeDescription: string, onRevert?: () => void) => {
    if (!isEditableStatus(quoteStatus)) return;
    if (!requiresNewDraftFirst(quoteStatus)) {
      /* In draft — show the caller-provided action description ("Rule
         deactivated", "Adjustment removed", etc.) so the user sees what
         actually happened. The accumulator still ticks so we know the
         draft has unsaved material edits, but no version-tracking
         toast is needed here. */
      setMaterialChangesInDraft(prev => prev + 1);
      toast.success(changeDescription, { position: 'top-right' });
      return;
    }
    setVersionPrompt({
      fieldKey,
      fieldLabel,
      changeDescription,
      onComplete: (createVersion: boolean) => {
        setVersionPrompt(null);
        if (createVersion) {
          /* Forward the originating modal's revert callback so it
             also fires if the user later backs out of the auto-version
             confirmation modal. Without this, the version prompt was
             reversible but the auto-version confirm was not — leaving
             material changes (a 5% one-time discount, a deactivated
             rule) in the parent modal after a second-stage cancel. */
          handleMaterialChange(fieldKey, fieldLabel, undefined, undefined, onRevert);
        } else {
          /* User cancelled the prompt. If the caller supplied a
             revert callback, run it now so the mutation is undone;
             otherwise just warn that the change is local-only.
             Adjustments and pricing-rule edits supply revert paths;
             generic field edits don't (yet). */
          if (onRevert) {
            onRevert();
            toast('Change discarded', {
              description: `No new version created. The ${fieldLabel.toLowerCase()} change was rolled back.`,
              position: 'top-right',
            });
          } else {
            toast('Change not committed', {
              description: `No new version created — re-open ${fieldLabel.toLowerCase()} to undo the local change.`,
              position: 'top-right',
            });
          }
        }
      },
    });
  }, [handleMaterialChange, quoteStatus]);

  // Reset of material change counter when leaving draft status is
  // handled in handleTransitionComplete above.

  const handleRevertFromViewing = () => {
    if (viewingVersion === null) return;
    // Check for existing draft conflict
    if (quoteStatus === 'draft') {
      setDraftConflict({ fromVersion: viewingVersion });
      setShowRevertModal(false);
      return;
    }
    setQuoteStatus('draft');
    if ((window as any).__versionDropdownAddRevert) {
      (window as any).__versionDropdownAddRevert(viewingVersion, revertReason.trim());
    }
    toast.success(`Reverted to Version ${viewingVersion} as new Draft`, {
      description: revertReason.trim(),
      position: 'top-right',
    });
    setShowRevertModal(false);
    setRevertReason('');
    setViewingVersion(null);
  };

  // Revert in place: V[fromVersion] becomes the "latest" pointer
  // without pushing a new draft entry. Status is restored to whatever
  // V[fromVersion] historically had. A subsequent material change will
  // create V[max+1] via the normal auto-version flow.
  const doRevertToVersion = (fromVersion: number, originalStatus?: 'draft' | 'sent' | 'confirmed') => {
    setQuoteVersion(fromVersion);
    if (originalStatus) {
      setQuoteStatus(originalStatus as QuoteLifecycleStatus);
    }
    setMaterialChangesInDraft(0);
    toast.success(`Reverted to V${fromVersion}`, {
      description: 'V' + fromVersion + ' is now the latest version.',
      position: 'top-right',
    });
    setViewingVersion(null);
  };

  // Core logic to overwrite the existing draft with reverted data
  const doOverwriteDraft = (fromVersion: number) => {
    // Keep same version number, just reset to draft with new source data
    setQuoteStatus('draft');
    if ((window as any).__versionDropdownOverwriteDraft) {
      (window as any).__versionDropdownOverwriteDraft(fromVersion);
    }
    toast.success(`Updated V${quoteVersion} Draft with data from V${fromVersion}`, {
      description: 'Draft content replaced. Send when ready.',
      position: 'top-right',
    });
    setViewingVersion(null);
  };

  // Revert flow — no draft conflict check needed because we don't
  // create a new draft anymore; we just promote V[fromVersion] to latest.
  const handleEditAsDraft = (fromVersion: number, originalStatus?: 'draft' | 'sent' | 'confirmed') => {
    doRevertToVersion(fromVersion, originalStatus);
  };

  // Intercept status changes to show transition overlay + Convert to SO modal
  const handleStatusChange = (newStatus: QuoteLifecycleStatus, reason?: string, attachments?: File[]) => {
    if (newStatus === 'converted') {
      setShowConvertToSOModal(true);
    } else {
      // Reactivating from archive: restore the pre-archive status on
      // the same version instead of forcing whatever the button asked
      // for. Archive is a paused snapshot, so coming back should resume
      // exactly where the quote left off.
      let effectiveStatus = newStatus;
      if (quoteStatus === 'archived' && newStatus !== 'archived' && statusBeforeArchive) {
        effectiveStatus = statusBeforeArchive;
      }
      // Store cancellation reason if transitioning to cancelled
      if (effectiveStatus === 'cancelled' && reason) {
        setCancellationReason(reason);
      }
      /* Store rejection reason if transitioning to rejected. The reason
         persists across the "Reactivate" transition so the banner still
         shows on the new draft version — that's the point of the flow.
         Also mirror the transition into the shared quote-status
         override registry so the listing reflects the state without a
         reload. */
      if (effectiveStatus === 'rejected') {
        setRejectionBannerDismissed(false);
        /* Track the paused state so Reactivate can restore it on the
           same version — matches Cancel + Archive semantics. */
        setStatusBeforeRejection(quoteStatus);
        /* Reason arrives as "Picked Reason. Additional comments"
           (period + space) when both are set. Both are optional now
           — the packed string could be:
             - "" (nothing supplied)
             - "Comments only"
             - "Reason only"
             - "Reason. Comments"
           Split on the first ". "; if there's no separator, treat
           the whole thing as the reason unless it starts with a
           known non-reason pattern. */
        const raw = reason || '';
        const sep = raw.indexOf('. ');
        const pickedReason = (sep === -1 ? raw : raw.slice(0, sep)) as QuoteRejectionReason;
        const comments = sep === -1 ? '' : raw.slice(sep + 2);
        setRejectionReason(pickedReason);
        setRejectionReasonText(comments || null);
        if (propQuoteId) {
          setQuoteStatusOverride(propQuoteId, {
            status: 'Rejected',
            rejectionReason: pickedReason,
            rejectionReasonText: comments,
            rejectedAt: new Date(),
          });
          /* Persist any attachments the approver staged in the reject
             modal to the rejection-doc registry so the Attachments tab
             can surface them under the "Rejection Attachments" source.
             Key by `quoteNumber` (not `propQuoteId`) to match the
             reader in AttachmentsTab — this mirrors how pre-quote
             docs are keyed via `OverviewTab`'s `storeKey =
             quoteNumber`. Using different keys on write vs read was
             causing the tab to look empty even though writes landed. */
          if (attachments && attachments.length > 0) {
            const today = new Date().toISOString().slice(0, 10);
            attachments.forEach((f, idx) => {
              const ext = (f.name.split('.').pop() || 'pdf').toLowerCase();
              const sizeStr = f.size < 1024 ? `${f.size} B`
                : f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(1)} KB`
                : `${(f.size / (1024 * 1024)).toFixed(1)} MB`;
              const isImage = ext === 'png' || ext === 'jpg' || ext === 'jpeg';
              addRejectionDoc(quoteNumber, {
                id: `REJ-${quoteNumber}-${Date.now()}-${idx}`,
                name: f.name,
                size: sizeStr,
                type: ext,
                uploadedBy: 'Current User',
                uploadedAt: today,
                previewUrl: isImage ? URL.createObjectURL(f) : undefined,
              });
            });
          }
        }
      }
      /* Mirror cancellation into the shared override registry too so
         the listing stays in sync (matches the Rejected flow). */
      if (effectiveStatus === 'cancelled' && reason && propQuoteId) {
        setQuoteStatusOverride(propQuoteId, { status: 'Cancelled', cancellationReason: reason });
      }
      // Track the pre-cancellation status so revive can restore it
      if (effectiveStatus === 'cancelled') {
        setStatusBeforeCancellation(quoteStatus);
      }
      // Clear cancellation reason if leaving cancelled status
      if (effectiveStatus !== 'cancelled') {
        setCancellationReason(null);
      }
      /* Clear the rejection reason once the reactivated draft is re-sent
         to the customer (or beyond). While the quote sits on Draft after
         reactivation, the reason stays so the banner reminds the rep
         what to fix. */
      if (effectiveStatus !== 'rejected' && effectiveStatus !== 'draft') {
        setRejectionReason(null);
        setRejectionReasonText(null);
      }
      // Clear archive reason + captured pre-archive status if leaving archived
      if (quoteStatus === 'archived' && effectiveStatus !== 'archived') {
        setArchiveReason(null);
        setStatusBeforeArchive(null);
      }
      // Trigger transition overlay, then apply the status change on completion
      setTransitionOverlay({
        fromStatus: quoteStatus,
        toStatus: effectiveStatus,
        pendingStatus: effectiveStatus,
      });
    }
  };

  const handleTransitionComplete = useCallback(() => {
    if (transitionOverlay) {
      const { pendingStatus } = transitionOverlay;
      setQuoteStatus(pendingStatus);
      setTransitionOverlay(null);
      // Reset material changes counter when leaving draft
      if (pendingStatus !== 'draft') {
        setMaterialChangesInDraft(0);
      }
      // Surface a confirmation toast for cancellation so the user has a
      // persistent acknowledgement after the transition animation fades.
      // The overlay alone was missed when users were focused on the body
      // of the page.
      if (pendingStatus === 'cancelled') {
        toast.success(`Quote ${quoteNumber} cancelled`, { position: 'top-right' });
      }
    }
  }, [transitionOverlay, quoteNumber]);

  const getStatusBadgeColor = (status: QuoteLifecycleStatus) => {
    switch(status) {
      case 'draft': return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'sent': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'confirmed': return 'bg-teal-50 text-teal-700 border-teal-100';
      case 'converted': return 'bg-green-50 text-green-700 border-green-100';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-100';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-100';
      case 'archived': return 'bg-red-50 text-red-700 border-red-100';
      case 'expired': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  // Status-aware colors for the header icon badge + quote number
  const getHeaderStatusColors = (status: QuoteLifecycleStatus) => {
    switch (status) {
      case 'draft':     return { iconBg: 'var(--muted)', iconBorder: 'var(--border)', iconColor: 'var(--muted-foreground)', textColor: 'var(--foreground)' };
      case 'sent':      return { iconBg: 'var(--accent)', iconBorder: 'var(--accent)', iconColor: 'var(--primary)', textColor: 'var(--primary)' };
      case 'confirmed': return { iconBg: 'rgba(124, 58, 237, 0.1)', iconBorder: 'rgba(124, 58, 237, 0.3)', iconColor: 'var(--violet)', textColor: 'var(--violet)' };
      case 'converted': return { iconBg: 'rgba(255,255,255,0.2)', iconBorder: 'rgba(255,255,255,0.35)', iconColor: 'var(--background)', textColor: 'var(--background)' };
      case 'cancelled': return { iconBg: 'rgba(220, 38, 38, 0.2)', iconBorder: 'rgba(220, 38, 38, 0.3)', iconColor: 'var(--destructive)', textColor: 'var(--destructive)' };
      case 'archived':  return { iconBg: 'rgba(220, 38, 38, 0.2)', iconBorder: 'rgba(220, 38, 38, 0.3)', iconColor: 'var(--destructive)', textColor: 'var(--destructive)' };
      case 'expired':   return { iconBg: 'rgba(220, 38, 38, 0.2)', iconBorder: 'rgba(220, 38, 38, 0.3)', iconColor: 'var(--destructive)', textColor: 'var(--destructive)' };
      default:          return { iconBg: 'var(--accent)', iconBorder: 'var(--accent)', iconColor: 'var(--primary)', textColor: 'var(--foreground)' };
    }
  };

  const headerColors = getHeaderStatusColors(quoteStatus);
  const isConverted = quoteStatus === 'converted';
  // Fully read-only when viewing an old version OR when status is a terminal state
  const isFullyReadOnly = isViewingOldVersion || quoteStatus === 'converted' || quoteStatus === 'cancelled' || quoteStatus === 'archived' || quoteStatus === 'expired';

  return (
    /* Page chrome — Partner Management `VendorDetailsPage` parity.
       The scroll container paints a slate-50 page background and lets
       each child section bound its own content with an inner
       `max-w-[1440px] 2xl:max-w-[1600px]` wrapper. That keeps the
       sticky bar's slate-50 backdrop full-bleed on wide screens while
       centering the card and tab rail at the 1440 / 1600 ceiling.
       Fullscreen mode flips those inner caps to `max-w-full`. */
    <div ref={contentScrollRef} className="font-sans bg-slate-50">
      <div className="w-full">{/* outer wrapper — full width; bounding happens inside each section */}



          {/* 2. Header Card — SO V5-style: gradient, scroll-compressing */}
          {(() => {
            const QUOTE_STEP_COLORS: Record<string, string> = {
              draft: 'var(--foreground)', sent: 'var(--primary)', confirmed: 'var(--violet)', converted: 'var(--success)',
            };
            const TERMINAL_COLORS: Record<string, string> = {
              cancelled: 'var(--destructive)', archived: 'var(--destructive)', expired: 'var(--warning)', converted: 'var(--success)',
            };
            const isTerminal = ['cancelled', 'archived', 'expired', 'converted'].includes(quoteStatus);
            const isClosed = isTerminal;
            const terminalFill = TERMINAL_COLORS[quoteStatus] || 'var(--foreground)';
            const stepIdxMap: Record<string, number> = { draft: 0, sent: 1, confirmed: 2, converted: 3 };
            const currentIdx = stepIdxMap[quoteStatus] ?? -1;

            // Header card chrome — Partner Management pattern (VendorDetailsPage):
            // every non-draft lifecycle state gets a vertical gradient that
            // tints the bottom edge and fades to white moving upward, so the
            // header communicates state at a glance without overwhelming the
            // content area. Tint hues reuse the existing flat colors below
            // so card + status pill stay coherent.
            // Border colors stay saturated so the outline reads clearly against
            // the tinted bottom edge of the card.
            const statusTints: Record<QuoteLifecycleStatus, { bg: string; border: string }> = {
              // Draft is intentionally untinted — edits-in-flight state uses
              // plain white so the focus stays on the form.
              draft:     { bg: '#FFFFFF', border: 'var(--border)' },
              sent:      { bg: 'linear-gradient(to top, #F4F8FF 0%, #FFFFFF 55%, #FFFFFF 100%)', border: '#93C5FD' },
              confirmed: { bg: 'linear-gradient(to top, #F5F3FF 0%, #FFFFFF 55%, #FFFFFF 100%)', border: '#C4B5FD' },
              converted: { bg: 'linear-gradient(to top, #F4FBF7 0%, #FFFFFF 55%, #FFFFFF 100%)', border: '#86EFAC' },
              rejected:  { bg: 'linear-gradient(to top, #FEF7F7 0%, #FFFFFF 55%, #FFFFFF 100%)', border: '#FCA5A5' },
              cancelled: { bg: 'linear-gradient(to top, #FEF7F7 0%, #FFFFFF 55%, #FFFFFF 100%)', border: '#FCA5A5' },
              archived:  { bg: 'linear-gradient(to top, #FEF2F2 0%, #FFFFFF 55%, #FFFFFF 100%)', border: '#FECACA' },
              expired:   { bg: 'linear-gradient(to top, #FEFBF3 0%, #FFFFFF 55%, #FFFFFF 100%)', border: '#FCD34D' },
            };
            const tint = statusTints[quoteStatus] ?? { bg: '#FFFFFF', border: 'var(--border)' };
            const cardBackground = tint.bg;
            const cardBorderColor = tint.border;
            const cardBorderWidth = quoteStatus === 'draft' ? 1 : 1.5;

            const hdrBtnSize = isScrolled ? 'w-7 h-7' : 'w-8 h-8';

            return (
              <>
              <div
                className="shrink-0 relative"
                style={{
                  // Sticky-compact pattern — the bar spans the full
                  // width of the scroll container so the slate-50
                  // backdrop reads cleanly to the viewport edges; the
                  // inner `max-w-[1440px]` wrapper just below bounds
                  // the actual card content.
                  // Padding-bottom (instead of margin-bottom) so the
                  // sticky element's opaque region extends past the
                  // card — anything scrolling underneath stays fully
                  // hidden behind the sticky bg instead of peeking
                  // through a margin gap.
                  position: 'sticky',
                  top: 0,
                  /* Sticky bar padding matches Partner Management's
                     `VendorDetailsPage` (12px top / 4px bottom in the
                     non-scrolled state, 8px / 4px when scrolled). The
                     12px breathing room above the card stops the header
                     from sitting flush against the top app-bar; the body
                     gap below the card comes from the body wrapper's
                     `pt-3` (12px) further down so the total nav→body
                     rhythm matches Partner exactly. */
                  padding: `${isScrolled ? '8px' : '12px'} 0 4px`,
                  transition: 'padding 200ms ease',
                  zIndex: 30,
                  background: isScrolled ? 'rgb(248, 250, 252)' : 'transparent',
                }}
              >
                <div className={`mx-auto px-4 lg:px-6 xl:px-8 transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-[1440px] 2xl:max-w-[1600px]'}`}>
                <div
                  className="relative overflow-hidden transition-all duration-200 rounded-xl"
                  style={{
                    /* Partner Management's lighter card shadow — keeps the
                       header crisp without the heavier elevation lift. */
                    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04), 0 4px 12px -4px rgba(0,0,0,0.05)',
                    background: cardBackground,
                    border: `${cardBorderWidth}px solid ${cardBorderColor}`,
                    transition: 'background 0.4s ease, border-color 0.4s ease',
                  }}
                >
                  {/* ── Row 1: Back + sep + icon + Quote# + Version + Priority | Actions + sep + CTA ── */}
                  {/* Below md the title block takes the whole row and the
                      actions drop to a row of their own, right-aligned
                      (on a phone the CTA takes a line of its own).
                      PO keeps both on one line at every width, which
                      breaks the record number apart below ~768px. */}
                  <div
                    className="flex items-center justify-between max-md:flex-wrap transition-all duration-200"
                    style={{ padding: isScrolled ? '6px 16px' : '16px 20px 12px', gap: 12 }}
                  >
                    {/* Left */}
                    <div className={`flex items-center min-w-0 max-md:w-full ${isScrolled ? 'gap-2' : 'gap-2.5'}`}>
                      {/* Back button — Partner-style: white, rounded-xl, larger when expanded, subtle shadow */}
                      <button
                        onClick={() => onBack ? onBack() : navigate('/')}
                        className="shrink-0 flex items-center justify-center rounded-xl border border-border bg-white hover:bg-slate-50 cursor-pointer transition-all duration-250 shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)]"
                        title="Back to Quotes"
                        style={{
                          width: isScrolled ? 32 : 44,
                          height: isScrolled ? 32 : 44,
                          color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 55%, transparent)' : 'var(--muted-foreground)',
                        }}
                      >
                        <ChevronLeft className="text-slate-400 transition-all duration-250" style={{ width: isScrolled ? 16 : 20, height: isScrolled ? 16 : 20 }} />
                      </button>

                      {/* Quote-domain icon — gray view-only chip matching Partner's
                          Initial-box dimensions/radius/shadow but with the gray treatment
                          (not the blue tint). NOT a button. */}
                      {!isNarrow && (() => {
                        const size = isScrolled ? 32 : 44;
                        return (
                          <div
                            className="shrink-0 flex items-center justify-center rounded-xl border border-border bg-muted"
                            style={{
                              width: size,
                              height: size,
                              boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.03)',
                              transition: 'width 250ms ease, height 250ms ease',
                            }}
                          >
                            <FileText
                              className="text-slate-500"
                              style={{
                                width: isScrolled ? 16 : 22,
                                height: isScrolled ? 16 : 22,
                              }}
                            />
                          </div>
                        );
                      })()}

                      {/* Quote number + badges (line 1) + description (line 2) — verbatim
                          Partner pattern from VendorDetailsPage: a single column
                          sitting next to the back/icon, with the description tucked
                          directly underneath the badges row. */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center flex-wrap" style={{ gap: isScrolled ? 6 : 8 }}>
                          {/* Quote ID typography mirrors Partner detail
                              header `vendor.displayName` (VendorDetailsPage):
                              16/13 sizes, 700/600 weights, 22/18 line
                              heights — same scale Partner / SO use. */}
                          <span className="text-foreground" style={{
                            fontSize: isScrolled ? 13 : 16,
                            fontWeight: isScrolled ? 600 : 700,
                            lineHeight: isScrolled ? '18px' : '22px',
                            letterSpacing: '-0.01em',
                            color: isClosed ? 'var(--muted-foreground)' : undefined,
                          }}>
                            {quoteNumber}
                          </span>

                          <VersionDropdown
                            currentVersion={quoteVersion}
                            currentStatus={quoteStatus}
                            viewingVersion={viewingVersion}
                            onViewVersion={setViewingVersion}
                            onEditAsDraft={quoteStatus !== 'converted' ? handleEditAsDraft : undefined}
                            materialChangesCount={materialChangesInDraft}
                            /* Seed the dropdown's roster from the quote
                               record so it reflects the same version
                               count as the listing badge. */
                            initialVersions={quote?.versions?.map((v) => ({
                              version: v.version,
                              versionStatus: v.versionStatus,
                              date: v.date,
                              sentAt: v.sentAt,
                              confirmedAt: v.confirmedAt,
                              author: v.author,
                              summary: v.summary,
                              isRevert: v.isRevert,
                              revertedFrom: v.revertedFrom,
                            }))}
                          />

                          {!isNarrow && (
                            <PriorityDropdown
                              priority={headerPriority}
                              onPriorityChange={setHeaderPriority}
                              readOnly={isFullyReadOnly}
                            />
                          )}

                          {/* Timeline hover card — Partner-style dark
                              header + scrollable body listing every
                              state transition on this quote. Sourced
                              from `quote.statusHistory`; falls back to
                              a single-entry current-state list when
                              the record was created in-app and doesn't
                              carry a seeded history. */}
                          {(() => {
                            const seeded = quote?.statusHistory ?? [];
                            /* Scope the trail to the CURRENT version only.
                               `quote.statusHistory` accumulates every
                               transition the record has been through, but
                               each version should carry its own timeline.
                               `quote.versionCreatedAt` (falling back to
                               the record's created date) marks the
                               boundary; earlier entries belong to prior
                               versions. Reactivations that spin a new
                               draft see a fresh trail starting with a
                               synthesized "V<n> draft created" entry. */
                            const parseTs = (t: string | Date): Date => {
                              const d = t instanceof Date ? t : new Date(t);
                              return Number.isNaN(d.getTime()) ? new Date(0) : d;
                            };
                            const versionStart = (quote as any)?.versionCreatedAt
                              ? new Date((quote as any).versionCreatedAt)
                              : quote?.createdDate ? new Date(quote.createdDate as any) : null;
                            const rawEntries: StatusTimelineEntry[] = seeded.map((h) => ({
                              timestamp: h.timestamp, label: h.label, detail: h.detail, tone: h.tone,
                            }));
                            const scopedEntries = versionStart
                              ? rawEntries.filter((e) => parseTs(e.timestamp) >= versionStart)
                              : rawEntries;
                            const entries: StatusTimelineEntry[] = scopedEntries.length > 0
                              ? scopedEntries
                              : [{
                                  timestamp: versionStart ? versionStart.toISOString() : (quote?.createdDate ?? new Date()).toString(),
                                  label: `V${quoteVersion} draft created`,
                                  tone: 'neutral' as const,
                                }];
                            return (
                              <StatusTimelineHoverCard entries={entries} versionLabel={`V${quoteVersion}`}>
                                {/* Hoverability cues — help cursor, subtle
                                    brightness dip + lift shadow — mirror
                                    Partner's PocPill hover chrome. Trailing
                                    Clock glyph only surfaces when there's
                                    a multi-step history to reveal — matches
                                    the icon-inside-pill idiom Partner uses
                                    in `PaymentTermDetailModal`. */}
                                <span
                                  style={{
                                    ...getStatusPillStyle(quoteStatus),
                                    cursor: 'help',
                                    transition: 'filter 150ms, box-shadow 150ms, transform 150ms',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.filter = 'brightness(0.96)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px -2px rgba(15, 23, 42, 0.14)';
                                    e.currentTarget.style.transform = 'translateY(-0.5px)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.filter = '';
                                    e.currentTarget.style.boxShadow = '';
                                    e.currentTarget.style.transform = '';
                                  }}
                                >
                                  {getStatusLabel(quoteStatus)}
                                  {entries.length > 1 && (
                                    <Clock style={{ width: 11, height: 11, opacity: 0.7, marginLeft: 1 }} strokeWidth={2.25} />
                                  )}
                                </span>
                              </StatusTimelineHoverCard>
                            );
                          })()}

                          {/* Provenance, next to the state pills: this
                              record came from another system, so the
                              header says so rather than letting it pass
                              as something created here. */}
                          {quote?.legacyImport && (
                            <LegacyImportPill meta={quote.legacyImport} isScrolled={isScrolled} recordNoun="quote" />
                          )}
                        </div>

                        {/* Line 2: Description — animated max-height +
                            opacity in the scrolled state so the description
                            fades out smoothly. When NOT scrolled, the cap is
                            effectively unlimited (2000px) so the inline
                            "Show less" expanded view never gets clipped —
                            the InlineDescriptionEditor itself controls its
                            own height. The 2000px ceiling stays so CSS can
                            still animate to/from the 0px collapsed state. */}
                        <div
                          style={{
                            maxHeight: isScrolled ? 0 : 2000,
                            opacity: isScrolled ? 0 : 1,
                            overflow: 'hidden',
                            transition: 'max-height 220ms ease, opacity 180ms ease',
                          }}
                        >
                          <InlineDescriptionEditor
                            value={description}
                            onChange={(next) => { setDescription(next); setQuoteDescription(descriptionKey, next); }}
                            editable={!isFullyReadOnly}
                            placeholder="Add a description..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right: Fullscreen + Actions dropdown + separator + CTA — Partner pattern */}
                    <div className="flex items-center shrink-0 max-md:w-full max-md:justify-end max-md:flex-wrap" style={{ gap: isScrolled ? 6 : 8 }}>
                      {/* Fullscreen toggle (nothing to widen on a phone) */}
                      <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                        className="max-sm:hidden rounded-lg border border-border bg-white hover:bg-slate-50 flex items-center justify-center cursor-pointer shadow-sm transition-all duration-250 shrink-0"
                        style={{ width: isScrolled ? 32 : 36, height: isScrolled ? 32 : 36 }}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="text-slate-500 transition-all duration-250" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                        ) : (
                          <Maximize2 className="text-slate-500 transition-all duration-250" style={{ width: isScrolled ? 14 : 16, height: isScrolled ? 14 : 16 }} />
                        )}
                      </button>

                      {/* Actions dropdown — Partner pattern */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`rounded-lg border border-border bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-all duration-200 cursor-pointer shadow-sm ${isScrolled ? 'h-8 px-3 text-[12px]' : 'h-9 px-3.5 text-[13px]'}`}
                            style={{ fontWeight: 500 }}
                          >
                            Actions
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-[200] w-56">
                          <DropdownMenuItem onClick={() => setShowPrintModal(true)}>
                            <Printer className="w-4 h-4 mr-2 text-slate-500" />
                            Print
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowPDFVisibilityModal(true)}>
                            <Download className="w-4 h-4 mr-2 text-slate-500" />
                            Download Quote
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setShowDuplicateModal(true)}>
                            <Copy className="w-4 h-4 mr-2 text-slate-500" />
                            Duplicate Quote
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied to clipboard'); }}>
                            <Link2 className="w-4 h-4 mr-2 text-slate-500" />
                            Copy Link
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => { if (isConverted) setShowArchiveConvertedModal(true); else setShowArchiveConfirm(true); }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Archive className="w-4 h-4 mr-2 text-destructive" />
                            Archive Quote
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* CTA — sits flush with Actions, no separator (Partner pattern) */}
                      {!isViewingOldVersion && (
                        <StatusActionButton
                          currentStatus={quoteStatus}
                          onStatusChange={handleStatusChange}
                          onCancelConverted={quoteStatus === 'converted' ? () => setShowCancelConvertedModal(true) : undefined}
                          onReviveExpired={quoteStatus === 'expired' ? () => setShowReviveModal(true) : undefined}
                          onDuplicate={quoteStatus === 'cancelled' ? () => setShowDuplicateModal(true) : undefined}
                          onReviveCancelled={quoteStatus === 'cancelled' ? () => setShowReviveCancelledModal(true) : undefined}
                          onSendToCustomer={() => withInactiveCheck('send', () => { setIsSendResend(false); setShowSendToCustomer(true); })}
                          beforeAdvance={(mode, run) => withInactiveCheck(mode, run)}
                          onResendToCustomer={() => { setIsSendResend(true); setShowSendToCustomer(true); }}
                          salesOrderNumber={salesOrderNumber}
                          autoRunPrimary={autoRunNext}
                        />
                      )}

                      {isViewingOldVersion && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {quoteStatus !== 'converted' && viewingVersion !== null && (
                            <button
                              onClick={() => setHeaderRevertConfirm({ version: viewingVersion })}
                              className="flex items-center gap-1.5 text-white transition-colors rounded-lg"
                              style={{ height: isScrolled ? 28 : 32, padding: '0 14px', fontSize: 13, fontWeight: 600, backgroundColor: 'var(--warning)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                            >
                              <GitBranch style={{ width: 12, height: 12 }} />
                              {isNarrow ? `Revert to V${viewingVersion}` : `Revert to V${viewingVersion}`}
                            </button>
                          )}
                          <button
                            onClick={() => setViewingVersion(null)}
                            className="border border-border bg-card text-foreground hover:bg-secondary transition-colors rounded-lg"
                            style={{ height: isScrolled ? 28 : 32, padding: '0 14px', fontSize: 13, fontWeight: 500 }}
                          >
                            {isNarrow ? 'Exit' : 'Exit Version View'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* (Description moved into the title-row column above so it
                      sits directly below the Quote# / badges line — Partner pattern.) */}

                  {/* ── Row 2: Lifecycle stepper — divider stroke above
                         (Partner pattern — same hairline that sits above the
                         tabs in Partner detail headers). Animated max-height
                         + opacity so the morph between full and compact is
                         smooth instead of a hard render flip — keeps the
                         sticky header from snapping when isScrolled flips. */}
                  {!isNarrow && (
                    <div
                      className="relative"
                      style={{
                        padding: isScrolled ? '0 20px' : '8px 20px 10px',
                        overflow: 'hidden',
                        borderRadius: '0 0 12px 12px',
                        /* Balanced section stroke — sits between the
                           original `var(--border)` (too heavy, slate-200
                           on white) and `var(--muted)` (almost invisible,
                           slate-100). A transparent slate-ink at 7%
                           reads as a clean section divider on every
                           status-tinted card background and matches the
                           sibling stroke above the tabs below. */
                        borderTop: isScrolled ? '1px solid transparent' : '1px solid rgba(15, 23, 42, 0.07)',
                        maxHeight: isScrolled ? 0 : 80,
                        opacity: isScrolled ? 0 : 1,
                        transition: 'max-height 220ms ease, opacity 180ms ease, padding 200ms ease, border-color 200ms ease',
                      }}
                    >
                      <ModernStatusStepper currentStatus={quoteStatus} />
                    </div>
                  )}

                  {/* Tab bar — sits at the bottom of the header card,
                      mirrors the approved Vendor Invoicing details
                      layout. `border-t border-muted` provides the
                      stroke above the tabs; padding + font-size morph
                      on `isScrolled` so the bar gets denser as the
                      user scrolls past the header. Drag-to-scroll is
                      preserved from the previous detached tab strip
                      (useful when 8+ tabs overflow on narrow widths). */}
                  {/* Tab bar — shared `DetailTabStrip` so the chrome,
                      typography, hover, and morph-on-scroll behaviour
                      stay identical to Partner Management's
                      VendorDetailsPage tab row. */}
                  <DetailTabStrip
                    tabs={[
                      { id: 'items', label: 'Line Items' },
                      { id: 'overview', label: 'Deal Information' },
                      { id: 'invoicing', label: 'Invoicing' },
                      { id: 'linked_transactions', label: 'Attachments' },
                      { id: 'transactions', label: 'Linked Transactions' },
                      { id: 'communications', label: 'Communications' },
                      { id: 'activity', label: 'Activity' },
                      { id: 'version_history', label: 'Versions' },
                    ]}
                    activeId={activeTab}
                    onSelect={(id) => setActiveTab(id as any)}
                    isScrolled={isScrolled}
                  />
                </div>
                </div>{/* close inner max-w wrapper for sticky header */}
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
                    'linear-gradient(to bottom, rgba(248,250,252,0.8) 0%, rgba(248,250,252,0.4) 40%, rgba(248,250,252,0) 100%)',
                  opacity: isScrolled ? 1 : 0,
                }}
              />
            </>
            );
          })()}

          {/* Notices + tabs sit directly on the page background. Top
              gap is handled by the sticky header's padding-bottom so
              this wrapper doesn't add its own margin (which would create
              a transparent strip the banner can peek through on scroll).
              Wrapped in the same `max-w-[1440px]` inner cap as the
              sticky header above so body content stays centered on
              wide screens. */}
          {/* `space-y-4` mirrors Partner Management's `VendorDetailsPage`
              body wrapper (16px between every direct child) so the
              version-status banner, notices stack, body+sidebar row, and
              any future body card share the same vertical rhythm Partner
              ships with. The earlier ad-hoc `marginTop: 16` on the body
              row was dropped because this token now handles it. */}
          <div className={`mx-auto px-4 lg:px-6 xl:px-8 pt-3 pb-5 space-y-4 transition-all duration-300 ${isFullscreen ? 'max-w-full' : 'max-w-[1440px] 2xl:max-w-[1600px]'}`}>
          <div>
          {/* Cancellation Reason Banner — Partner-style "icon chip + title + subtitle" row.
              Replaces the old left-stripe + tiny inline icon layout so the
              notice matches every other Partner-aligned card surface. */}
          {quoteStatus === 'cancelled' && cancellationReason && (
            <StatusNoticeBanner
              tone="destructive"
              Icon={Ban}
              title="Quote Cancelled"
              subtitle={cancellationReason}
              isNarrow={isNarrow}
              action={{ label: isNarrow ? 'Duplicate' : 'Duplicate Quote', icon: Copy, onClick: () => setShowDuplicateModal(true) }}
            />
          )}

          {/* Archive Reason Banner — same Partner-style chip pattern. */}
          {quoteStatus === 'archived' && (
            <StatusNoticeBanner
              tone="destructive"
              Icon={Archive}
              title="Quote Archived"
              subtitle={archiveReason ?? undefined}
              isNarrow={isNarrow}
              action={{ label: isNarrow ? 'Duplicate' : 'Duplicate Quote', icon: Copy, onClick: () => setShowDuplicateModal(true) }}
            />
          )}

          {/* Rejection + version-context banners share a deck: when
              both are eligible, the rejection banner sits on top and
              the version strip peeks behind. Dismissing the top card
              rotates the version strip forward. Terminal-state
              cancellation/archive banners above are exclusive to
              their own states and stay outside the deck. */}
          <NoticeBannerStack>
          {/* Rejected quotes ALWAYS surface the banner (even without a
              reason recorded) because it carries the Reactivate CTA.
              Post-reactivation states (draft/sent/confirmed) show the
              banner only while a reason is still on record — that's
              the "revise before resending" nudge. */}
          {!rejectionBannerDismissed && (quoteStatus === 'rejected' || (rejectionReason && (quoteStatus === 'draft' || quoteStatus === 'sent' || quoteStatus === 'confirmed'))) && (() => {
            /* Two visual states:
                 - Rejected: destructive tone (active problem)
                 - Post-reactivation (draft/sent/confirmed with the
                   reason still on the record): warning tone — the
                   quote is back in flight, banner just nudges the
                   rep to revise before re-sending. */
            const isRejected = quoteStatus === 'rejected';
            const bannerTone: 'destructive' | 'warning' = isRejected ? 'destructive' : 'warning';
            const bannerIcon = isRejected ? ThumbsDown : RefreshCw;
            const pillTintBg = isRejected ? 'rgba(220, 38, 38, 0.10)' : 'rgba(245, 158, 11, 0.14)';
            const pillTintBgHover = isRejected ? 'rgba(220, 38, 38, 0.16)' : 'rgba(245, 158, 11, 0.22)';
            const pillTextColor = isRejected ? 'var(--destructive)' : '#B45309';
            /* MM/DD/YYYY HH:mm timestamp — same format the listing's
               "Rejected On" column uses, so the two surfaces read
               consistently. Inlined here to keep the banner render
               self-contained. */
            let stamp = '';
            if (quote?.rejectedAt) {
              try {
                const d = new Date(quote.rejectedAt);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const yyyy = d.getFullYear();
                const hh = String(d.getHours()).padStart(2, '0');
                const mi = String(d.getMinutes()).padStart(2, '0');
                stamp = ` · ${mm}/${dd}/${yyyy} at ${hh}:${mi}`;
              } catch { /* fall through with empty stamp */ }
            }
            const rejectedBy = (quote as any)?.rejectedBy as string | undefined;
            /* Attribution (who rejected) moves into the pill's native
               tooltip so the primary banner line stays clean and only
               the reason + timestamp show inline. */
            const pillTitle = rejectedBy
              ? `Recorded by ${rejectedBy}${stamp ? `. ${stamp.replace(/^ · /, '')}` : ''}`
              : 'Reason recorded on this quote';
            /* Two subtitle shapes:
                 - Reason recorded: REASON pill + reason text +
                   optional italic comment + timestamp.
                 - No reason recorded (approver rejected without
                   picking a reason): a single muted sentence noting
                   the state + timestamp. Skips the pill so the
                   banner doesn't advertise an empty label. */
            const reasonPill = rejectionReason ? (
              <>
                <span
                  className="reason-chip"
                  title={pillTitle}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '1px 6px', borderRadius: 4,
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1.3,
                    textTransform: 'uppercase',
                    backgroundColor: pillTintBg,
                    color: pillTextColor,
                    flexShrink: 0,
                    cursor: 'default',
                    transition: 'background-color 120ms',
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
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rejectionReason}
                  {rejectionReasonText && (
                    <span style={{ fontStyle: 'italic', opacity: 0.75, marginLeft: 6 }}>
                      ({rejectionReasonText})
                    </span>
                  )}
                  {stamp}
                </span>
              </>
            ) : (
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                No reason recorded{stamp}
              </span>
            );
            return (
            <StatusNoticeBanner
              tone={bannerTone}
              Icon={bannerIcon}
              title={isRejected ? 'Quote Rejected by Customer' : 'Previously rejected. Revise before resending.'}
              subtitle={reasonPill}
              isNarrow={isNarrow}
              onDismiss={() => setRejectionBannerDismissed(true)}
              action={quoteStatus === 'rejected'
                ? {
                    label: isNarrow ? 'Reactivate' : 'Reactivate Quote',
                    icon: RotateCcw,
                    /* Opens the two-option choice modal (restore in
                       place / new draft version). The new-draft path
                       chains into `NewDraftDatesModal` so the rep can
                       set fresh Effective From + Valid Till before
                       the version bump lands. */
                    onClick: () => setShowReactivateChoice(true),
                  }
                : undefined}
            />
            );
          })()}

          {/* Version Context Strip — between header card and tabs.
              Quote-unique surface (Partner has no equivalent). Clean Partner
              card style: rounded-xl, light PM-V shadow, no heavy accent bar.
              Status colour is carried by the inline status icon next to the
              text (left side of the row), keeping the card itself uniform.

              The strip has two states in Draft when outdated configurations
              exist. The outdated variant surfaces the sync CTA inline
              (replacing the amber pill that used to sit in the header). Both
              variants render a subtle X close on the right so the user can
              reclaim the vertical space at any time. */}
          {/* Version-context strip — always eligible whenever its
              own state condition matches; deck stacking handles
              coexistence with the rejection banner above. */}
          {!isViewingOldVersion && !versionBannerHidden && (outdatedBannerVisible || quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || (quoteStatus === 'draft' && quoteVersion > 1)) && (
            <div
              className="rounded-xl"
              style={{
                display: 'flex',
                alignItems: 'stretch',
                fontFamily: 'Inter, system-ui, sans-serif',
                backgroundColor: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px 0 rgba(0,0,0,0.06)',
                overflow: 'hidden',
                minWidth: 0,
              }}
            >

              {/* Content */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flex: 1,
                padding: '10px 12px',
                gap: '12px',
                flexWrap: 'wrap' as const,
                minWidth: 0,
              }}>
                {/* Left: version narrative */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  {outdatedBannerVisible && quoteStatus === 'draft' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div
                        className="flex items-center justify-center shrink-0"
                        style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }}
                      >
                        <RefreshCw style={{ width: 16, height: 16, color: '#B45309' }} strokeWidth={2} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>
                          {outdatedUpdates.length} outdated {outdatedUpdates.length === 1 ? 'configuration' : 'configurations'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.45 }}>
                          {customerName ? `Updated configurations are available for ${customerName}.` : 'Updated configurations are available for this customer.'} Review before continuing this draft.
                        </span>
                      </div>
                    </div>
                  )}
                  {!(outdatedBannerVisible && quoteStatus === 'draft') && quoteStatus === 'sent' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div className="rounded-md bg-primary/10 flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 8 }}>
                        <Clock style={{ width: 16, height: 16, color: 'var(--primary)' }} strokeWidth={2} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>
                          Version {quoteVersion} sent — awaiting customer confirmation
                        </span>
                        {quoteVersion > 1 && (
                          <span style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.45 }}>
                            Current active version: V{quoteVersion - 1}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {!(outdatedBannerVisible && quoteStatus === 'draft') && quoteStatus === 'confirmed' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div className="rounded-md bg-primary/10 flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 8 }}>
                        <CheckCircle2 style={{ width: 16, height: 16, color: 'var(--primary)' }} strokeWidth={2} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>
                          Version {quoteVersion} confirmed
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.45 }}>
                          Any material change creates a new draft version (V{quoteVersion + 1}).
                        </span>
                      </div>
                    </div>
                  )}
                  {!(outdatedBannerVisible && quoteStatus === 'draft') && quoteStatus === 'draft' && quoteVersion > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div className="rounded-md bg-primary/10 flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 8 }}>
                        <Pencil style={{ width: 16, height: 16, color: 'var(--primary)' }} strokeWidth={2} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>
                            Editing Version {quoteVersion} draft
                          </span>
                          {materialChangesInDraft > 0 && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, lineHeight: 1,
                              color: 'var(--primary)', backgroundColor: 'var(--accent)',
                              padding: '3px 7px', borderRadius: 4,
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              border: '1px solid var(--accent)',
                            }}>
                              <GitBranch style={{ width: 9, height: 9 }} />
                              {materialChangesInDraft} material change{materialChangesInDraft > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.45 }}>
                          Send when ready to finalize V{quoteVersion}.
                        </span>
                      </div>
                    </div>
                  )}
                  {!(outdatedBannerVisible && quoteStatus === 'draft') && quoteStatus === 'converted' && salesOrderNumber && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div className="rounded-md bg-primary/10 flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 8 }}>
                        <Package style={{ width: 16, height: 16, color: 'var(--primary)' }} strokeWidth={2} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>
                            Converted to Sales Order
                          </span>
                          <button
                            onClick={() => {
                              toast.info('Sales Order module coming soon', {
                                description: `Would navigate to ${salesOrderNumber}`,
                                position: 'top-right',
                              });
                            }}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 12, fontWeight: 600, color: 'var(--success)',
                              backgroundColor: 'rgba(5, 150, 105, 0.15)',
                              padding: '2px 8px', borderRadius: 4, lineHeight: 1,
                              border: '1px solid rgba(5, 150, 105, 0.35)',
                              cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                              transition: 'background-color 150ms',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 0.25)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 0.15)'; }}
                            title={`Open ${salesOrderNumber}`}
                          >
                            {salesOrderNumber}
                            <ExternalLink style={{ width: 10, height: 10 }} />
                          </button>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.45 }}>
                          Read-only — duplicate as a new quote or cancel. View the linked SO for further processing.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: CTA cluster.
                    - Outdated variant: amber "Review and sync" opens the modal.
                    - Confirmed status: "Edit as VN+1" starts a new draft.
                    - Every state also carries a subtle X close so the user
                      can hide the whole bar and reclaim vertical space. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {outdatedBannerVisible && quoteStatus === 'draft' && (
                    <button
                      onClick={() => setShowOutdatedConfigsModal(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        height: '32px', padding: '0 14px', borderRadius: '6px',
                        border: 'none', backgroundColor: 'var(--primary)',
                        color: '#FFFFFF', fontSize: '13px', fontWeight: 500,
                        cursor: 'pointer', lineHeight: '1', transition: 'background-color 150ms',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
                    >
                      <RefreshCw style={{ width: '12px', height: '12px' }} />
                      Review and sync
                    </button>
                  )}
                  {!(outdatedBannerVisible && quoteStatus === 'draft') && quoteStatus === 'confirmed' && (
                    <button
                      onClick={() => {
                        const newVersion = quoteVersion + 1;
                        setQuoteVersion(newVersion);
                        setQuoteStatus('draft');
                        setMaterialChangesInDraft(0);
                        toast.success(`Editing as V${newVersion} Draft`, {
                          description: 'Make your changes. Material changes start a new version automatically.',
                          position: 'top-right',
                        });
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        height: '32px', padding: '0 14px', borderRadius: '6px',
                        border: 'none', backgroundColor: 'var(--primary)',
                        color: '#FFFFFF', fontSize: '13px', fontWeight: 500,
                        cursor: 'pointer', lineHeight: '1', transition: 'background-color 150ms',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
                    >
                      <Pencil style={{ width: '12px', height: '12px' }} />
                      Edit as V{quoteVersion + 1}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      /* Two-stage close. Outdated variant collapses back
                         to the plain version message on first X; a second
                         X on the plain message hides the whole bar. Both
                         states persist per-session (registry + local
                         state) so the user does not have to dismiss
                         again on every re-render. */
                      if (outdatedBannerVisible && quoteStatus === 'draft') {
                        dismissOutdatedBanner(propQuoteId ?? quote?.id ?? '');
                        setOutdatedBannerVisible(false);
                      } else {
                        setVersionBannerHidden(true);
                      }
                    }}
                    aria-label={outdatedBannerVisible && quoteStatus === 'draft' ? 'Hide outdated configurations' : 'Hide version bar'}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 26, height: 26, borderRadius: 6,
                      border: '1px solid transparent',
                      backgroundColor: 'transparent',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      transition: 'color 120ms',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; }}
                  >
                    <X style={{ width: 14, height: 14 }} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          )}
          </NoticeBannerStack>

          </div>
          {/* ─── /Notices ─── */}

          {/* Body | Sidebar row — tabs now live inside the sticky
              header card above, so the body wrapper starts directly
              below the page notices. Uses `items-stretch` so the body
              column grows to the sidebar's height when the sidebar is
              the taller of the two — the Attachments tab flexes to
              fill that height so it never sits shorter than the
              sidebar and no inner scrollbar appears. */}
          {/* PO's breakpoint: beside the body at lg and up, stacked under
              it below (PO hides nothing, so neither do we). */}
          <div className="flex flex-col lg:flex-row lg:items-stretch gap-5">
            <div className="flex-1 min-w-0 flex flex-col lg:pb-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  {activeTab === 'items' && (
                    <ItemsTabTableClean
                      quoteStatus={quoteStatus}
                      quoteId={propQuoteId}
                      /* Store key for line-item attachments. Must be
                         `quoteNumber`, matching the Attachments tab's
                         reader: `propQuoteId` and `quoteNumber` are
                         different values, and keying writes and reads
                         differently is what made the rejection-doc
                         registry look empty once before. */
                      attachmentQuoteKey={quoteNumber}
                      readOnly={isFullyReadOnly}
                      onMaterialChange={handleMaterialChange}
                      onAskUserChange={handleAskUserChange}
                      customerName={customerName}
                      pricingAPI={pricingAPI}
                      adjustmentsAPI={adjustmentsAPI}
                      quoteDefaultFreight={quoteDefaultFreight}
                      lineFreightCosts={lineFreightCosts}
                      onSetLineFreightCost={setLineFreightCost}
                      onSeedLineFreightCosts={seedLineFreightCosts}
                      onRequestPriceVersionConfirm={handleRequestPriceVersionConfirm}
                      onLinesChange={setLiveLines}
                    />
                  )}
                  {activeTab === 'overview' && (
                    <OverviewTab quoteNumber={quoteNumber} customerName={customerName} contactName={contactName} readOnly={isFullyReadOnly} tags={quoteTags} priority={quotePriority} winProbability={quoteWinProbability} salesRep={quoteSalesRep} onNonMaterialChange={handleNonMaterialChange} isNewlyCreated={isNewlyCreatedQuote} />
                  )}
                  {activeTab === 'invoicing' && (
                    <ComingSoonTab title="Invoicing" description="Invoice generation, tracking, payment status, and billing history will be available here." />
                  )}
                  {activeTab === 'linked_transactions' && (
                    <div
                      className="flex-1 flex flex-col min-h-0"
                      style={sidebarHeight ? { maxHeight: sidebarHeight } : undefined}
                    >
                      <LinkedTransactionsTab quoteNumber={quoteNumber} customerName={customerName} readOnly={isFullyReadOnly} onAskUserChange={handleAskUserChange} isNewlyCreated={isNewlyCreatedQuote} quoteStatus={quoteStatus} />
                    </div>
                  )}
                  {activeTab === 'transactions' && (
                    <TransactionsTab
                      quoteNumber={quoteNumber}
                      customerName={customerName}
                      readOnly={isFullyReadOnly}
                      quoteStatus={quoteStatus}
                      /* Mirror the live quote totals into the linked-SO
                         row so it reads as the actual converted order
                         instead of a stale hard-coded number. */
                      quoteTotal={Math.max(0, Math.round(projectedTotal))}
                      quoteLineItemCount={liveLines.length}
                      isNewlyCreated={isNewlyCreatedQuote}
                    />
                  )}
                  {activeTab === 'communications' && (
                    <ComingSoonTab title="Communications" description="Threaded messages, email integration, and customer correspondence will be available here." />
                  )}
                  {activeTab === 'version_history' && (
                    <VersionHistoryTab quoteNumber={quoteNumber} customerName={customerName} currentVersion={quoteVersion} onEditAsDraft={handleEditAsDraft} />
                  )}
                  {activeTab === 'activity' && (
                    <ComingSoonTab title="Activity Log" description="A full audit trail of changes, status transitions, and user actions will appear here." />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Removed the full-tab `pointer-events: all` click-blocker
                  that used to overlay every read-only tab. Per-component
                  edit-affordance gating (`readOnly={isFullyReadOnly}` on
                  ItemsTab / RightSidebar / TabContent) already blocks
                  mutations; the overlay was also blocking VIEW
                  interactions (opening the configurator, pricing-rules
                  manage modal, one-time adjustments, etc.) which the user
                  needs in terminal states. */}
            </div>

            {/* Right Column: Sidebar — flows with the page. Both the body
                column and the sidebar scroll together via the page's main
                scrollbar; once the body's content is exhausted the page
                keeps scrolling against the taller column (typically the
                sidebar) so the user always reaches its bottom without a
                second scrollbar appearing. No `sticky`, no `max-height`,
                no `overflow-y` — the row's natural height = max(body,
                sidebar). */}
            <div
              ref={sidebarRef}
              className="shrink-0 w-full lg:w-[300px] lg:self-start"
              style={{ paddingBottom: 48 }}
            >
              <RightSidebar
                activeTab={activeTab}
                onNavigateToTab={(tab) => setActiveTab(tab as any)}
                quoteStatus={quoteStatus}
                expiryDate={quoteExpiryDate}
                createdDate={new Date(createdDate + 'T00:00:00')}
                customerName={customerName}
                contactName={contactName}
                quoteId={propQuoteId}
                readOnly={isFullyReadOnly}
                salesRep={typeof quoteSalesRep === 'string' ? quoteSalesRep : quoteSalesRep?.name}
                salesRepId={typeof quoteSalesRep === 'string' ? undefined : quoteSalesRep?.id}
                /* Real PoC + sales rep roster from the quote record so the
                   sidebar matches the listing and kanban for this quote. */
                quotePrimaryPoC={quote?.primaryPoC}
                quoteAdditionalPoCs={quote?.additionalPoCs}
                quoteAdditionalSalesReps={quote?.additionalSalesReps}
                quoteRecord={quote}
                /* Live grand-total baseline = sum of the items table's
                   current lines (after UoM rescales / qty edits).
                   Replaces the prior static `summarizeQuote(quote).grandTotal`
                   read so the sidebar reflects edits made in the line-items
                   table, configurator, or Add Line Items picker without a
                   reload. */
                quoteGrandTotal={liveSubtotal}
                subtotal={liveSubtotal}
                onMaterialChange={handleMaterialChange}
                onNonMaterialChange={handleNonMaterialChange}
                onAskUserChange={handleAskUserChange}
                pricingAPI={pricingAPI}
                adjustmentsAPI={adjustmentsAPI}
                quoteLines={liveLines}
                quoteDefaultFreight={quoteDefaultFreight}
                onSetQuoteDefaultFreight={setQuoteDefaultFreight}
                lineFreightCosts={lineFreightCosts}
                onSetLineFreightCost={setLineFreightCost}
                onClearAllLineFreightCosts={clearAllLineFreightCosts}
              />
            </div>
          </div>


          </div>{/* close body max-w wrapper */}
        </div>{/* close w-full wrapper */}

      {/* Modals */}
      {showDuplicateModal && (
        <DuplicateQuoteModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          quoteNumber={quoteNumber}
          currentCustomer={customerName}
          /* The latest version reflects the quote's current operational
             state. When the quote has been converted to a Sales Order
             (Unconfirmed SO / Confirmed SO) or has reached a terminal
             state (Cancelled / Archived / Expired), mark the latest
             version as non-duplicable. Older versions stay open since
             they captured a snapshot before the lock. */
          availableVersions={(quote?.versions || []).map(v => {
            const nonDuplicableStatuses = ['Unconfirmed SO', 'Confirmed SO', 'Cancelled', 'Archived', 'Expired'];
            const latestNum = quote?.version ?? quote?.versions?.[quote.versions.length - 1]?.version;
            const isLatest = v.version === latestNum;
            return isLatest && quote && nonDuplicableStatuses.includes(quote.status) ? { ...v, canDuplicate: false } : v;
          })}
          currentVersion={quote?.version}
          onConfirm={({ customerId, customerName: custName, versionMode, selectedVersion }) => {
            setShowDuplicateModal(false);
            if (!quote) return;
            /* Build the duplicate immediately so QuoteDetails has a real
               id to navigate to once the overlay finishes. addCreatedQuote
               persists it in the module store so the listing also sees
               it on the next render. */
            const existingNumbers = mockQuotes.map(q => q.quoteNumber);
            const result = duplicateQuote(quote, {
              newCustomerId: customerId,
              newCustomerName: custName,
              versionMode,
              selectedVersion,
              existingQuoteNumbers: existingNumbers,
            });
            const versionMeta = versionMode === 'all'
              ? `all versions copied`
              : `from V${selectedVersion}`;
            setActionOverlay({
              config: {
                processing: 'Duplicating Quote',
                done: `${result.quote.quoteNumber} created (${versionMeta})`,
                icon: Copy,
                accentColor: 'var(--primary)',
                accentBg: 'var(--accent)',
                ringColor: 'rgba(10, 119, 255, 0.4)',
              },
              onComplete: () => {
                setActionOverlay(null);
                toast.success(`Quote duplicated → ${result.quote.quoteNumber}`, {
                  description: `New draft created for ${custName}.`,
                });
                navigate(`/quotes/${result.quote.id}`);
              },
            });
          }}
        />
      )}
      {(() => {
        /* Shared PDF-detail payload — used by every preview surface
           on this page so the Send / Print / Download previews all
           render the same data. Pulls billing + shipping addresses
           off `getCustomerDefaults` (the same seed the sidebar uses)
           so the PDF's Ship-To / Bill-To panels aren't blank. */
        const defaults = getCustomerDefaults(customerName);
        const pdfDetail = {
          contactName,
          contactEmail: quote?.primaryPoC?.email,
          salesRepName: typeof quoteSalesRep === 'string' ? quoteSalesRep : quoteSalesRep?.name,
          /* Record fields win when the quote carries them ('' = not
             set, rendered as the field's empty label); older records
             fall back to the customer defaults. */
          ...pdfCommercialFromRecord(quote, defaults),
          createdDateDisplay: quote?.createdDate ? quote.createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined,
          expiryDateDisplay: quote?.expiryDate ? quote.expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined,
        };
        return (
          <>
            {showPDFVisibilityModal && (
              <PDFPreviewModal
                isOpen={showPDFVisibilityModal}
                onClose={() => setShowPDFVisibilityModal(false)}
                quote={quote}
                detail={pdfDetail}
                mode="download"
              />
            )}
            {showPrintModal && (
              <PDFPreviewModal
                isOpen={showPrintModal}
                onClose={() => setShowPrintModal(false)}
                quote={quote}
                detail={pdfDetail}
                mode="print"
                isNewlyCreated={isNewlyCreatedQuote}
              />
            )}
          </>
        );
      })()}
      {showConvertToSOModal && (
        <ConvertToSOModal
          isOpen={showConvertToSOModal}
          onClose={() => setShowConvertToSOModal(false)}
          quoteNumber={quoteNumber}
          customerName={customerName}
          onConfirm={(data) => {
            setShowConvertToSOModal(false);
            // Generate a SO number
            const soNum = `SO-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
            setSalesOrderNumber(soNum);
            // Trigger transition overlay for convert-to-SO flow
            setTransitionOverlay({
              fromStatus: quoteStatus,
              toStatus: 'converted',
              pendingStatus: 'converted',
            });
          }}
        />
      )}
      <StatusTransitionOverlay
        isActive={transitionOverlay !== null}
        fromStatus={transitionOverlay?.fromStatus ?? 'draft'}
        toStatus={transitionOverlay?.toStatus ?? 'sent'}
        onComplete={handleTransitionComplete}
      />
      <StatusTransitionOverlay
        isActive={actionOverlay !== null}
        fromStatus={'draft'}
        toStatus={'draft'}
        customAction={actionOverlay?.config ?? null}
        onComplete={() => actionOverlay?.onComplete()}
      />

      {/* Archive Quote — shared Partner-style ConfirmationModal (red variant).
          The Reason textarea is slotted into the modal's body via the new
          `children` prop on ConfirmationModal; same surface as the bulk
          archive flow so the two read identically. */}
      <ConfirmationModal
        isOpen={showArchiveConfirm}
        title="Archive Quote?"
        message={
          quoteStatus === 'sent'
            ? `This will move ${quoteNumber} to the archive. Archived quotes are hidden from active views but can be restored later. This quote has been sent to the customer — archiving it will not notify them.`
            : `This will move ${quoteNumber} to the archive. Archived quotes are hidden from active views but can be restored later.`
        }
        confirmText="Archive Quote"
        cancelText="Cancel"
        variant="red"
        icon={<Archive />}
        onCancel={() => { setShowArchiveConfirm(false); setArchiveReasonInput(''); }}
        onConfirm={() => {
          const reason = archiveReasonInput.trim() || null;
          setArchiveReason(reason);
          setArchiveReasonInput('');
          setShowArchiveConfirm(false);
          // Capture the pre-archive status so reactivating restores the
          // quote to the same state and version instead of forcing a
          // fresh draft on the way back.
          setStatusBeforeArchive(quoteStatus);
          setActionOverlay({
            config: {
              processing: 'Archiving Quote',
              done: 'Quote Archived',
              icon: Archive,
              accentColor: 'var(--destructive)',
              accentBg: 'rgba(220, 38, 38, 0.2)',
              ringColor: '#FCA5A5',
              isNegative: true,
            },
            onComplete: () => {
              setQuoteStatus('archived' as QuoteLifecycleStatus);
              setActionOverlay(null);
            },
          });
        }}
      >
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--foreground-soft)', marginBottom: 6 }}>
          Reason <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={archiveReasonInput}
          onChange={(e) => setArchiveReasonInput(e.target.value)}
          placeholder="Why is this quote being archived? e.g., No longer relevant, superseded by another quote..."
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', fontSize: 13, color: 'var(--foreground)',
            border: '1px solid var(--border)', borderRadius: 8, outline: 'none',
            backgroundColor: 'var(--background)', resize: 'vertical', minHeight: 68,
            boxSizing: 'border-box', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: 1.5,
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 4 }}>
          This reason will be displayed on the archived quote and logged in activity.
        </div>
      </ConfirmationModal>

      {/* Header revert flow — routed through the same RevertConfirmModal
          + StateTransitionOverlay chrome the Versions tab, Version
          History modal, and Version dropdown use, so all four entry
          points behave identically (including the optional "Reason for
          revert" textarea). */}
      {headerRevertConfirm && (
        <HeaderRevertConfirmModal
          version={headerRevertConfirm.version}
          onClose={() => setHeaderRevertConfirm(null)}
          onConfirm={() => {
            const target = headerRevertConfirm.version;
            setHeaderRevertConfirm(null);
            setHeaderRevertOverlay({ toVersion: target, fromVersion: quoteVersion });
          }}
        />
      )}
      <StateTransitionOverlay
        isActive={!!headerRevertOverlay}
        fromLabel={`V${headerRevertOverlay?.fromVersion ?? 0} · Current Version`}
        toLabel={`V${headerRevertOverlay?.toVersion ?? 0} · Current Version`}
        tone="version"
        Icon={GitBranch}
        heading={`Reverting to V${headerRevertOverlay?.toVersion ?? 0}`}
        meta={`V${headerRevertOverlay?.fromVersion ?? 0} → V${headerRevertOverlay?.toVersion ?? 0}`}
        duration={2000}
        onComplete={() => {
          if (!headerRevertOverlay) return;
          const target = headerRevertOverlay.toVersion;
          setHeaderRevertOverlay(null);
          handleEditAsDraft(target);
        }}
      />

      {/* Sync overlay — fires on the Draft path when the user applies
          updates from the Outdated Configurations modal. Shares the
          same StateTransitionOverlay chrome as version reverts and
          status transitions for consistency. Success toast fires on
          complete so the outcome is visible after the animation. */}
      <StateTransitionOverlay
        isActive={!!outdatedSyncOverlay}
        fromLabel="Outdated"
        toLabel="Up to date"
        tone="success"
        heading={outdatedSyncOverlay
          ? outdatedSyncOverlay.count === 1
            ? 'Syncing configuration'
            : `Syncing ${outdatedSyncOverlay.count} configurations`
          : ''}
        meta={outdatedSyncOverlay?.label}
        duration={1600}
        onComplete={() => {
          if (outdatedSyncOverlay) {
            toast.success(outdatedSyncOverlay.label, { position: 'top-right' });
          }
          setOutdatedSyncOverlay(null);
        }}
      />

      {/* Draft Conflict Modal */}
      <DraftConflictModal
        isOpen={draftConflict !== null}
        onClose={() => setDraftConflict(null)}
        existingDraftVersion={quoteVersion}
        revertFromVersion={draftConflict?.fromVersion ?? 0}
        onOverwrite={() => {
          if (draftConflict) {
            doOverwriteDraft(draftConflict.fromVersion);
            setDraftConflict(null);
          }
        }}
        onCreateNew={() => {
          if (draftConflict) {
            doRevertToVersion(draftConflict.fromVersion);
            setDraftConflict(null);
          }
        }}
      />

      {/* Cancel Converted Quote Modal */}
      <CancelConvertedQuoteModal
        isOpen={showCancelConvertedModal}
        onClose={() => setShowCancelConvertedModal(false)}
        quoteNumber={quoteNumber}
        salesOrderNumber={salesOrderNumber || 'SO-XXXX'}
        actionType="cancel"
        onNavigateToSO={() => {
          toast.info('Sales Order module coming soon', {
            description: `Would navigate to ${salesOrderNumber}`,
            position: 'top-right',
          });
        }}
      />

      {/* Archive Converted Quote Modal */}
      <CancelConvertedQuoteModal
        isOpen={showArchiveConvertedModal}
        onClose={() => setShowArchiveConvertedModal(false)}
        quoteNumber={quoteNumber}
        salesOrderNumber={salesOrderNumber || 'SO-XXXX'}
        actionType="archive"
        onNavigateToSO={() => {
          toast.info('Sales Order module coming soon', {
            description: `Would navigate to ${salesOrderNumber}`,
            position: 'top-right',
          });
        }}
      />

      {/* Revive Quote Modal */}
      {showReviveModal && (
        <ReviveQuoteModal
          quoteNumber={quoteNumber}
          customerName={customerName}
          originalExpiryDate={quoteExpiryDate}
          onConfirm={(newExpiryDate, newRespondBy, resendToCustomer) => {
            setShowReviveModal(false);
            // Transition the quote to "sent" status with updated dates
            setQuoteStatus('sent');
            toast.success('Quote Reactivated', {
              description: resendToCustomer
                ? `Updated dates and resent to ${customerName}. New expiry: ${newExpiryDate}`
                : `Updated dates. New expiry: ${newExpiryDate}`,
              position: 'top-right',
            });
          }}
          onClose={() => setShowReviveModal(false)}
        />
      )}

      {/* Revive Cancelled Quote Modal */}
      {showReviveCancelledModal && (
        <ReviveCancelledModal
          quoteNumber={quoteNumber}
          customerName={customerName}
          currentVersion={quoteVersion}
          statusBeforeCancellation={statusBeforeCancellation as any}
          cancellationReason={cancellationReason}
          onConfirm={(newExpiryDate) => {
            setShowReviveCancelledModal(false);
            // Restore the quote to its pre-cancellation state on the
            // same version. A cancelled quote is a paused snapshot, not
            // a new revision — reactivation just resumes it.
            const restored: QuoteLifecycleStatus = (statusBeforeCancellation as QuoteLifecycleStatus) || 'draft';
            setQuoteStatus(restored);
            if (restored === 'draft') setMaterialChangesInDraft(0);
            setCancellationReason(null);
            setStatusBeforeCancellation(null);
            const label = restored.charAt(0).toUpperCase() + restored.slice(1);
            toast.success(`V${quoteVersion} restored to ${label}`, {
              description: `Quote resumed on the same version. Expiry set to ${newExpiryDate}.`,
              position: 'top-right',
            });
          }}
          onClose={() => setShowReviveCancelledModal(false)}
        />
      )}

      {/* Version Change Prompt Modal (for instructions / attachments) */}
      {versionPrompt && (
        <VersionChangePromptModal
          isOpen={true}
          fieldLabel={versionPrompt.fieldLabel}
          changeDescription={versionPrompt.changeDescription}
          currentVersion={quoteVersion}
          onCreateNewVersion={() => versionPrompt.onComplete(true)}
          onCancel={() => versionPrompt.onComplete(false)}
        />
      )}

      {/* Auto-Version Confirmation Modal — gates before overlay animation */}
      <AutoVersionConfirmModal
        isOpen={autoVersionConfirm.show}
        fieldLabel={autoVersionConfirm.fieldLabel}
        oldValue={autoVersionConfirm.oldValue}
        newValue={autoVersionConfirm.newValue}
        currentVersion={quoteVersion}
        fromStatus={autoVersionConfirm.fromStatus}
        onConfirm={handleAutoVersionConfirmed}
        onDiscard={handleAutoVersionDiscarded}
      />

      {/* Auto-Version Creation Overlay */}
      <AutoVersionOverlay
        show={autoVersionOverlay.show}
        newVersion={autoVersionOverlay.newVersion}
        fromStatus={autoVersionOverlay.fromStatus}
        onComplete={() => {
          setAutoVersionOverlay(prev => ({ ...prev, show: false }));
          /* Fire the Partner-sync success toast at the very end of
             the material-change flow, after the version overlay has
             finished animating. `null` means either no sync was in
             flight, or the user cancelled it via the confirm modal
             and revert() already cleared this. Small delay lets the
             overlay's own dismissal animation settle first so the
             toast slides in cleanly. */
          if (pendingSyncSuccessToast) {
            const msg = pendingSyncSuccessToast;
            setPendingSyncSuccessToast(null);
            setTimeout(() => {
              toast.success(msg, { position: 'top-right' });
            }, 250);
          }
        }}
      />
      {/* Inactive-items warning. Comes before the send modal, the way PO
          puts it before Send to Vendor: the user learns about inactive
          items before composing, not after. */}
      <InactiveItemsWarningModal
        open={!!inactiveWarning}
        mode={inactiveWarning?.mode ?? 'send'}
        lines={inactiveWarningLines}
        noun="quote"
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
        quoteNumber={quoteNumber}
        customerName={customerName}
        quote={quote}
        detail={(() => {
          /* Same defaults-driven payload as the download/print modals
             above so the Send preview matches the Download preview. */
          const defaults = getCustomerDefaults(customerName);
          return {
            contactName,
            contactEmail: quote?.primaryPoC?.email,
            salesRepName: typeof quoteSalesRep === 'string' ? quoteSalesRep : quoteSalesRep?.name,
            /* Record fields win when the quote carries them ('' = not
               set, rendered as the field's empty label); older records
               fall back to the customer defaults. */
            ...pdfCommercialFromRecord(quote, defaults),
            createdDateDisplay: quote?.createdDate ? quote.createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined,
            expiryDateDisplay: quote?.expiryDate ? quote.expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : undefined,
          };
        })()}
        isResend={isSendResend}
        onClose={() => setShowSendToCustomer(false)}
        onSend={() => {
          /* Block first-send when discounts pushed the projected total
             below $0 — internal state would diverge from a number the
             customer can't actually be charged. Resend is allowed (the
             quote already exists at that version). */
          if (!isSendResend && blockTransitionIfNegative('send to customer')) return;
          setShowSendToCustomer(false);
          if (!isSendResend) {
            // First send: transition to sent status with overlay animation
            setTransitionOverlay({
              fromStatus: quoteStatus,
              toStatus: 'sent',
              pendingStatus: 'sent',
            });
          } else {
            // Resend: just show toast
            toast.success(`${quoteNumber} resent to customer`, {
              position: 'top-right',
            });
          }
        }}
      />

      <OutdatedConfigsModal
        open={showOutdatedConfigsModal}
        onOpenChange={setShowOutdatedConfigsModal}
        updates={outdatedUpdates}
        customerName={customerName}
        documentType="quote"
        onApply={(ids) => {
          if (ids.length === 0) return;
          const applied = outdatedUpdates.filter((u) => ids.includes(u.id));
          const docId = propQuoteId ?? quote?.id ?? '';
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
          markOutdatedApplied(docId, ids);
          setOutdatedBannerVisible(false);
          setOutdatedSyncOverlay({ count: applied.length, label: successToast });
        }}
        onIgnore={(ids) => {
          /* Ignore permanently marks these ids as dismissed for this
             record — they will not resurface even if the modal is
             reopened manually. Also flips banner-dismissed so the
             version-card banner does not come back. */
          const docId = propQuoteId ?? quote?.id ?? '';
          markOutdatedIgnored(docId, ids);
          setOutdatedUpdates((prev) => prev.filter((u) => !ids.includes(u.id)));
          setOutdatedBannerVisible(false);
        }}
      />

      {/* Reactivate → single dates modal. Reactivation always spins
          up a new draft (V+1), so the modal only asks for the two
          dates that need to change on the reactivated version:
          Effective From and Expiration Date. Same modal chrome the
          revive-from-cancellation flow uses. */}
      <ReactivateChoiceModal
        isOpen={showReactivateChoice}
        recordLabel={quoteNumber}
        newVersionNumber={quoteVersion + 1}
        defaultEffectiveFrom={new Date()}
        defaultValidTill={(() => {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          return d;
        })()}
        onCancel={() => setShowReactivateChoice(false)}
        onConfirm={(effectiveFrom, expirationDate) => {
          setShowReactivateChoice(false);
          const newVersion = quoteVersion + 1;
          const fromStatus = getStatusLabel(quoteStatus);
          /* Play the standard auto-version overlay so reactivation
             matches every other version-bump transition in the
             module (same animation, same timing). */
          setAutoVersionOverlay({ show: true, newVersion, fromStatus });
          setQuoteVersion(newVersion);
          setQuoteStatus('draft');
          setRejectionReason(null);
          setRejectionReasonText(null);
          setStatusBeforeRejection(null);
          setRejectionBannerDismissed(false);
          if (propQuoteId) {
            setQuoteStatusOverride(propQuoteId, { status: 'Draft' });
          }
          toast.success(`Started V${newVersion} draft`, {
            description: `Effective ${effectiveFrom}. Expires ${expirationDate}. Revise pricing or terms, then send.`,
            position: 'top-right',
          });
        }}
      />
    </div>
  );
}

/* ── Header Revert Confirm Modal ─────────────────────────────────
   Mirrors the Versions tab + Version History modal + Version dropdown
   RevertConfirmModal verbatim: ConfirmDiscardModal banner + glow icon
   + h-11 stacked buttons, plus an optional "Reason for revert"
   textarea. Pulled out as its own component so the parent stays
   tidy and so the reason state's lifecycle is scoped to one open
   instance. */
function HeaderRevertConfirmModal({ version, onClose, onConfirm }: {
  version: number; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <ConfirmDiscardModal
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      badge={`Revert to V${version}`}
      title={`Revert to V${version}?`}
      description={`V${version} will become the latest version of this quote. Its existing status is preserved. The next material change starts a new version.`}
      confirmLabel={`Revert to V${version}`}
      cancelLabel="Cancel"
      onConfirm={() => onConfirm(reason.trim())}
    >
      <div>
        <label
          className="block"
          style={{
            fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)',
            textTransform: 'none', marginBottom: '6px', lineHeight: '1',
          }}
        >
          Reason for revert <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Customer wants to go back to the original configuration..."
          rows={3}
          className="w-full"
          style={{
            fontSize: '13px', fontWeight: 400, color: 'var(--foreground)',
            border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px',
            outline: 'none', resize: 'none', fontFamily: 'Inter, system-ui, sans-serif',
            lineHeight: '1.5', boxSizing: 'border-box', transition: 'border-color 150ms',
            backgroundColor: '#FFFFFF',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>
    </ConfirmDiscardModal>
  );
}