// @ts-nocheck
import { useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Package, ArrowUpRight, Zap, Pencil, Paperclip, MessageSquare, GitBranch, Copy, Archive, X, Download, FileText, Printer, CheckCircle2, Clock, AlertTriangle, Link2, Ban, MoreHorizontal, Receipt, Settings2 } from 'lucide-react';
import { QuoteCurrencyConfigModal, type QuoteCurrencyConfig } from '../components/currency/QuoteCurrencyConfigModal';
import { QuoteMoney } from '../components/currency/QuoteMoney';
import { InfoTooltip } from '../components/ui/info-tooltip';
import { BASE_CURRENCY, getLibraryCurrency } from '../data/currencyLibrary';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { QuoteLifecycleStatus, ModernStatusStepper, getStepperBackground } from '../components/quote-details/ModernStatusStepper';
import { StatusActionButton } from '../components/quote-details/StatusActionButton';
import { SendToCustomerModal } from '../components/quote-details/SendToCustomerModal';
import { StatusTransitionOverlay, CustomActionConfig } from '../components/quote-details/StatusTransitionOverlay';
import { VersionDropdown } from '../components/quote-details/VersionDropdown';
import { PriorityDropdown } from '../components/quote-details/PriorityDropdown';
import { ItemsTabTableClean } from '../components/quote-details/ItemsTabTableClean';
import { ComingSoonTab } from '../components/quote-details/ComingSoonTab';
import { OverviewTab } from '../components/quote-details/OverviewTab';
import { RightSidebar } from '../components/quote-details/RightSidebar';
import { LinkedTransactionsTab } from '../components/quote-details/LinkedTransactionsTab';
import { TransactionsTab } from '../components/quote-details/TransactionsTab';
import { VersionHistoryTab } from '../components/quote-details/VersionHistoryTab';
import { DuplicateQuoteModal } from '../components/quote-details/DuplicateQuoteModal';
import { PDFPreviewModal } from '../components/quote-details/PDFPreviewModal';
import { ConvertToSOModal } from '../components/quote-details/ConvertToSOModal';
import { DraftConflictModal } from '../components/quote-details/DraftConflictModal';
import { CancelConvertedQuoteModal } from '../components/quote-details/CancelConvertedQuoteModal';
import { ReviveQuoteModal } from '../components/quote-details/ReviveQuoteModal';
import { ReviveCancelledModal } from '../components/quote-details/ReviveCancelledModal';
import { VersionChangePromptModal } from '../components/quote-details/VersionChangePromptModal';
import { showNonMaterialChangeToast, showMaterialChangeAccumulatedToast } from '../components/quote-details/versionToasts';
import { AutoVersionOverlay } from '../components/quote-details/AutoVersionOverlay';
import { AutoVersionConfirmModal } from '../components/quote-details/AutoVersionConfirmModal';
import { isEditableStatus, requiresNewDraftFirst } from '../utils/versioningEngine';
import { mockQuotes } from '../data/mockQuotes';
import { getCreatedQuote, getCreatedQuoteLineItems } from '../data/quoteStore';
import { getQuoteDescription, setQuoteDescription } from '../data/quoteStore';
import { QuoteStatus } from '../types/quote';

// Map from listing QuoteStatus → lifecycle status used in detail page
function mapToLifecycleStatus(status: QuoteStatus): QuoteLifecycleStatus {
  switch (status) {
    case 'Draft': return 'draft';
    case 'Sent to Customer': return 'sent';
    case 'Unconfirmed SO': return 'confirmed';
    case 'Confirmed SO': return 'converted';
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

export function QuoteDetails({ quoteId: propQuoteId, onBack }: QuoteDetailsProps) {
  const navigate = useNavigate();

  // Look up quote from mock data or created quotes store
  const quote = propQuoteId
    ? (mockQuotes.find(q => q.id === propQuoteId) || getCreatedQuote(propQuoteId))
    : undefined;
  
  const quoteNumber = quote?.quoteNumber || 'Q-000-000-000';
  const customerName = quote?.customer?.name || 'Unknown Customer';
  const contactName = quote?.primaryPoC?.name || 'Unknown Contact';
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
  const [quoteStatus, setQuoteStatus] = useState<QuoteLifecycleStatus>(
    quote ? mapToLifecycleStatus(quote.status) : 'sent'
  );
  // Version is stateful — starts from quote data or 3 (matching dropdown's initial data)
  const [quoteVersion, setQuoteVersion] = useState(quote?.version || 3);

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
  const [showCurrencyConfig, setShowCurrencyConfig] = useState(false);
  // When the configurator is opened from the Duplicate flow, the user is
  // configuring the *new* (Draft) quote being created — not the original.
  // Override the sent/confirmed lock so they can pick a different pair.
  const [currencyConfigForceUnlocked, setCurrencyConfigForceUnlocked] = useState(false);
  // Quote-level FX configuration. The customer's primary currency persists
  // separately from the quote's per-instance currency so the configurator can
  // offer a proper Reset-to-default and surface "Custom for this quote" hints.
  const customerDefaultCurrency = (quote?.customerCurrency || BASE_CURRENCY).toUpperCase();
  const [currencyConfig, setCurrencyConfig] = useState<QuoteCurrencyConfig>({
    currency: customerDefaultCurrency,
    settlementCurrency: BASE_CURRENCY,
  });
  // Page-level Base ↔ Customer view toggle. `base` shows PKR with customer
  // hover everywhere; `customer` flips every cell to the customer currency
  // with PKR hover. Toggle is suppressed when the customer settles in PKR.
  const [quoteViewMode, setQuoteViewMode] = useState<'base' | 'customer'>('base');
  const customerCurrencyIsBase = currencyConfig.currency.toUpperCase() === BASE_CURRENCY;
  
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

  // Track the status before cancellation — used to decide whether to bump version on revive
  const [statusBeforeCancellation, setStatusBeforeCancellation] = useState<QuoteLifecycleStatus | null>(null);

  // Cancellation reason state — populated from mock data or set when user cancels
  const [cancellationReason, setCancellationReason] = useState<string | null>(
    quote?.cancellationReason || null
  );

  // Archive reason state
  const [archiveReason, setArchiveReason] = useState<string | null>(null);
  const [archiveReasonInput, setArchiveReasonInput] = useState('');

  // Priority state — lifted to header level
  const mapPriority = (p?: 'Urgent' | 'Medium' | 'Low'): 'low' | 'standard' | 'high' => {
    if (p === 'Urgent') return 'high';
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
  const [tabsCanScrollLeft, setTabsCanScrollLeft] = useState(false);
  const [tabsCanScrollRight, setTabsCanScrollRight] = useState(false);

  // Detect narrow viewport
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 860);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Scroll compression for header
  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    const handler = () => setIsScrolled(el.scrollTop > 10);
    el.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => el.removeEventListener('scroll', handler);
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
      case 'cancelled': return 'Cancelled';
      case 'archived': return 'Archived';
      case 'expired': return 'Expired';
      default: return status;
    }
  };

  const getStatusPillStyle = (status: QuoteLifecycleStatus): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: 600, padding: '3px 8px',
      borderRadius: '4px', lineHeight: '1', whiteSpace: 'nowrap',
      flexShrink: 0,
    };
    switch (status) {
      case 'draft': return { ...base, backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' };
      case 'sent': return { ...base, backgroundColor: '#DBEAFE', color: '#1E40AF', border: '1px solid #BFDBFE' };
      case 'confirmed': return { ...base, backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0' };
      case 'converted': return { ...base, backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.3)' };
      case 'cancelled': return { ...base, backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' };
      case 'archived': return { ...base, backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' };
      case 'expired': return { ...base, backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' };
      default: return base;
    }
  };

  // ═══ Versioning Engine State ═══════════════════════════════════════════════
  // Tracks number of material changes accumulated in the current draft version.
  // Resets when status transitions away from draft.
  const [materialChangesInDraft, setMaterialChangesInDraft] = useState(0);

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
  }>({ show: false, fieldKey: '', fieldLabel: '', fromStatus: '' });

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
  const handleMaterialChange = useCallback((fieldKey: string, fieldLabel: string, oldValue?: string, newValue?: string) => {
    if (!isEditableStatus(quoteStatus)) return;

    if (requiresNewDraftFirst(quoteStatus)) {
      // Show confirmation modal before creating new version
      const prevStatus = quoteStatus === 'sent' ? 'Sent' : 'Confirmed';
      setAutoVersionConfirm({
        show: true,
        fieldKey,
        fieldLabel,
        oldValue,
        newValue,
        fromStatus: prevStatus,
      });
    } else {
      // Already in draft — accumulate
      setMaterialChangesInDraft(prev => {
        const next = prev + 1;
        showMaterialChangeAccumulatedToast(fieldLabel, quoteVersion, next);
        return next;
      });
    }
  }, [quoteStatus, quoteVersion]);

  /** Called when user confirms auto-version creation from the confirmation modal */
  const handleAutoVersionConfirmed = useCallback(() => {
    const newVer = quoteVersion + 1;
    const prevStatus = autoVersionConfirm.fromStatus;
    setAutoVersionConfirm(prev => ({ ...prev, show: false }));

    setQuoteVersion(newVer);
    setQuoteStatus('draft');
    setMaterialChangesInDraft(1);

    // Notify version dropdown
    if ((window as any).__versionDropdownAddRevert) {
      (window as any).__versionDropdownAddRevert(quoteVersion, `Auto-draft: ${autoVersionConfirm.fieldLabel}`);
    }

    setAutoVersionOverlay({ show: true, newVersion: newVer, fromStatus: prevStatus });
  }, [quoteVersion, autoVersionConfirm]);

  /** Called when user discards the material change from the confirmation modal */
  const handleAutoVersionDiscarded = useCallback(() => {
    setAutoVersionConfirm(prev => ({ ...prev, show: false }));
    toast('Change discarded', {
      description: `No new version created. The ${autoVersionConfirm.fieldLabel.toLowerCase()} change was not applied.`,
      position: 'top-right',
    });
  }, [autoVersionConfirm]);

  /**
   * Handle a NON-MATERIAL change.
   * Always just logs — no version bump regardless of status.
   */
  const handleNonMaterialChange = useCallback((_fieldKey: string, fieldLabel: string, _oldValue?: string, _newValue?: string) => {
    showNonMaterialChangeToast(fieldLabel);
  }, []);

  /**
   * Handle an ASK-USER change (instructions / attachments).
   * Shows prompt modal. User decides whether to create version or just record.
   */
  const handleAskUserChange = useCallback((fieldKey: string, fieldLabel: string, changeDescription: string) => {
    setVersionPrompt({
      fieldKey,
      fieldLabel,
      changeDescription,
      onComplete: (createVersion: boolean) => {
        setVersionPrompt(null);
        if (createVersion) {
          handleMaterialChange(fieldKey, fieldLabel);
        } else {
          showNonMaterialChangeToast(`${fieldLabel} (record only)`);
        }
      },
    });
  }, [handleMaterialChange]);

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

  // Core logic to create a new draft from a version (no conflict check)
  const doCreateNewDraft = (fromVersion: number) => {
    const newVer = quoteVersion + 1;
    setQuoteVersion(newVer);
    setQuoteStatus('draft');
    setMaterialChangesInDraft(0);
    if ((window as any).__versionDropdownAddRevert) {
      (window as any).__versionDropdownAddRevert(fromVersion, `Editing from V${fromVersion}`);
    }
    toast.success(`Created V${newVer} Draft from Version ${fromVersion}`, {
      description: 'Make changes and send when ready.',
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

  // Edit a previous version as a new draft (from dropdown or version view)
  // Checks for existing draft conflict first
  const handleEditAsDraft = (fromVersion: number) => {
    // If current status is already 'draft', show conflict modal
    if (quoteStatus === 'draft') {
      setDraftConflict({ fromVersion });
      return;
    }
    doCreateNewDraft(fromVersion);
  };

  // Intercept status changes to show transition overlay + Convert to SO modal
  const handleStatusChange = (newStatus: QuoteLifecycleStatus, reason?: string) => {
    if (newStatus === 'converted') {
      setShowConvertToSOModal(true);
    } else {
      // Store cancellation reason if transitioning to cancelled
      if (newStatus === 'cancelled' && reason) {
        setCancellationReason(reason);
      }
      // Track the pre-cancellation status so revive knows whether to bump version
      if (newStatus === 'cancelled') {
        setStatusBeforeCancellation(quoteStatus);
      }
      // Clear cancellation reason if leaving cancelled status
      if (newStatus !== 'cancelled') {
        setCancellationReason(null);
      }
      // Clear archive reason if leaving archived status
      if (quoteStatus === 'archived' && newStatus !== 'archived') {
        setArchiveReason(null);
      }
      // Trigger transition overlay, then apply the status change on completion
      setTransitionOverlay({
        fromStatus: quoteStatus,
        toStatus: newStatus,
        pendingStatus: newStatus,
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
    }
  }, [transitionOverlay]);

  const getStatusBadgeColor = (status: QuoteLifecycleStatus) => {
    switch(status) {
      case 'draft': return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'sent': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'confirmed': return 'bg-teal-50 text-teal-700 border-teal-100';
      case 'converted': return 'bg-green-50 text-green-700 border-green-100';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-100';
      case 'archived': return 'bg-red-50 text-red-700 border-red-100';
      case 'expired': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  // Status-aware colors for the header icon badge + quote number
  const getHeaderStatusColors = (status: QuoteLifecycleStatus) => {
    switch (status) {
      case 'draft':     return { iconBg: '#F3F4F6', iconBorder: '#E5E7EB', iconColor: '#6B7280', textColor: '#374151' };
      case 'sent':      return { iconBg: '#EFF6FF', iconBorder: '#BFDBFE', iconColor: '#2563EB', textColor: '#1E40AF' };
      case 'confirmed': return { iconBg: '#F0FDFA', iconBorder: '#99F6E4', iconColor: '#0D9488', textColor: '#0F766E' };
      case 'converted': return { iconBg: 'rgba(255,255,255,0.2)', iconBorder: 'rgba(255,255,255,0.35)', iconColor: '#FFFFFF', textColor: '#FFFFFF' };
      case 'cancelled': return { iconBg: '#FEE2E2', iconBorder: '#FECACA', iconColor: '#DC2626', textColor: '#991B1B' };
      case 'archived':  return { iconBg: '#FEE2E2', iconBorder: '#FECACA', iconColor: '#B91C1C', textColor: '#991B1B' };
      case 'expired':   return { iconBg: '#FEE2E2', iconBorder: '#FECACA', iconColor: '#DC2626', textColor: '#991B1B' };
      default:          return { iconBg: '#EFF6FF', iconBorder: '#DBEAFE', iconColor: '#3B82F6', textColor: '#1F2937' };
    }
  };

  const headerColors = getHeaderStatusColors(quoteStatus);
  const isConverted = quoteStatus === 'converted';
  // Fully read-only when viewing an old version OR when status is a terminal state
  const isFullyReadOnly = isViewingOldVersion || quoteStatus === 'converted' || quoteStatus === 'cancelled' || quoteStatus === 'archived' || quoteStatus === 'expired';

  return (
    <div className="flex-1 bg-background font-sans h-full overflow-hidden flex flex-col">
      <div ref={contentScrollRef} className="flex-1 overflow-y-auto">
        <div style={{ maxWidth: 'var(--container-detail)' }} className="mx-auto px-3 py-4 sm:px-4 md:px-6 md:py-6">
          


          {/* 2. Header Card — SO V5-style: gradient, scroll-compressing */}
          {(() => {
            const QUOTE_STEP_COLORS: Record<string, string> = {
              draft: '#4B5563', sent: '#2563EB', confirmed: '#7C3AED', converted: '#047857',
            };
            const TERMINAL_COLORS: Record<string, string> = {
              cancelled: '#DC2626', archived: '#DC2626', expired: '#D97706', converted: '#047857',
            };
            const isTerminal = ['cancelled', 'archived', 'expired', 'converted'].includes(quoteStatus);
            const isClosed = isTerminal;
            const terminalFill = TERMINAL_COLORS[quoteStatus] || '#4B5563';
            const stepIdxMap: Record<string, number> = { draft: 0, sent: 1, confirmed: 2, converted: 3 };
            const currentIdx = stepIdxMap[quoteStatus] ?? -1;

            const cardGradient = (() => {
              if (isTerminal) {
                return `radial-gradient(ellipse 110% 200% at 80% 100%, color-mix(in srgb, ${terminalFill} 10%, transparent) 0%, color-mix(in srgb, ${terminalFill} 5%, transparent) 30%, transparent 70%), linear-gradient(180deg, color-mix(in srgb, ${terminalFill} 1%, transparent) 0%, color-mix(in srgb, ${terminalFill} 3%, transparent) 100%)`;
              }
              if (currentIdx <= 0) return '';
              const fill = QUOTE_STEP_COLORS[quoteStatus] || '#4B5563';
              const cx = Math.round((currentIdx / 3) * 100);
              return `radial-gradient(ellipse 110% 200% at ${cx}% 100%, color-mix(in srgb, ${fill} 10%, transparent) 0%, color-mix(in srgb, ${fill} 8%, transparent) 25%, color-mix(in srgb, ${fill} 3%, transparent) 50%, transparent 95%), linear-gradient(180deg, color-mix(in srgb, ${fill} 1%, transparent) 0%, color-mix(in srgb, ${fill} 3%, transparent) 100%)`;
            })();

            const hdrBtnSize = isScrolled ? 'w-7 h-7' : 'w-8 h-8';

            return (
              <div className="shrink-0 relative" style={{ padding: `${isScrolled ? '4px' : '0'} 0 ${isScrolled ? '0' : '6px'}`, transition: 'padding 200ms ease', zIndex: 20, marginBottom: 16 }}>
                <div
                  className="relative overflow-hidden transition-all duration-200"
                  style={{
                    borderRadius: 12,
                    boxShadow: 'var(--elevation-sm)',
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    background: cardGradient ? `${cardGradient}, var(--card)` : 'var(--card)',
                    transition: 'background 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {/* ── Row 1: Back + sep + icon + Quote# + Version + Priority | Actions + sep + CTA ── */}
                  <div
                    className="flex items-center justify-between transition-all duration-200"
                    style={{ padding: isScrolled ? '6px 16px' : '16px 20px 12px', gap: 12 }}
                  >
                    {/* Left */}
                    <div className={`flex items-center min-w-0 ${isScrolled ? 'gap-2' : 'gap-2.5'}`}>
                      {/* Back button — outlined, SO-style */}
                      <button
                        onClick={() => onBack ? onBack() : navigate('/')}
                        className="shrink-0 flex items-center justify-center rounded-lg transition-colors"
                        title="Back to Quotes"
                        style={{
                          width: isScrolled ? 28 : 32,
                          height: isScrolled ? 28 : 32,
                          backgroundColor: '#FFFFFF',
                          border: `1px solid ${isClosed ? 'color-mix(in srgb, var(--muted-foreground) 18%, transparent)' : 'var(--border)'}`,
                          cursor: 'pointer',
                          color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 55%, transparent)' : 'var(--muted-foreground)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--secondary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = isClosed ? 'color-mix(in srgb, var(--muted-foreground) 55%, transparent)' : 'var(--muted-foreground)'; }}
                      >
                        <ChevronLeft style={{ width: isScrolled ? 16 : 18, height: isScrolled ? 16 : 18 }} />
                      </button>

                      {/* Separator */}
                      <div className="shrink-0" style={{ width: 1, height: isScrolled ? 18 : 22, backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 18%, transparent)' : 'var(--border)' }} />

                      {/* Document icon — gray SO-style */}
                      {!isNarrow && (
                        <div className="shrink-0 flex items-center justify-center" style={{
                          width: isScrolled ? 24 : 32,
                          height: isScrolled ? 24 : 32,
                          borderRadius: isScrolled ? 6 : 8,
                          backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 12%, transparent)' : 'color-mix(in srgb, var(--muted-foreground) 8%, transparent)',
                          border: `1px solid ${isClosed ? 'color-mix(in srgb, var(--muted-foreground) 20%, transparent)' : 'color-mix(in srgb, var(--muted-foreground) 15%, transparent)'}`,
                          transition: 'all 300ms ease',
                        }}>
                          <FileText style={{ width: isScrolled ? 12 : 16, height: isScrolled ? 12 : 16, color: 'var(--muted-foreground)', transition: 'color 300ms ease' }} />
                        </div>
                      )}

                      {/* Quote number */}
                      <span className="text-foreground" style={{
                        fontSize: isScrolled ? 14 : 18,
                        fontWeight: 700,
                        lineHeight: isScrolled ? '16px' : '22px',
                        letterSpacing: '-0.01em',
                        color: isClosed ? 'var(--muted-foreground)' : undefined,
                      }}>
                        {quoteNumber}
                      </span>

                      {/* Version Dropdown */}
                      <VersionDropdown
                        currentVersion={quoteVersion}
                        currentStatus={quoteStatus}
                        viewingVersion={viewingVersion}
                        onViewVersion={setViewingVersion}
                        onEditAsDraft={quoteStatus !== 'converted' ? handleEditAsDraft : undefined}
                        materialChangesCount={materialChangesInDraft}
                      />

                      {/* Priority Dropdown — hidden at narrow widths */}
                      {!isNarrow && (
                        <PriorityDropdown
                          priority={headerPriority}
                          onPriorityChange={setHeaderPriority}
                          readOnly={isFullyReadOnly}
                          darkBg={isConverted}
                        />
                      )}

                      {/* Compact status pill — narrow only */}
                      {isNarrow && (
                        <span style={getStatusPillStyle(quoteStatus)}>
                          {getStatusLabel(quoteStatus)}
                        </span>
                      )}
                    </div>

                    {/* Right: Action buttons + separator + CTA */}
                    <div className="flex items-center shrink-0 gap-1.5">
                      {/* Icon action buttons — SO-style with CSS vars */}
                      {!isNarrow && (
                        <>
                          {([
                            { icon: Printer, onClick: () => setShowPrintModal(true), destructive: false, label: 'Print' },
                            { icon: Download, onClick: () => setShowPDFVisibilityModal(true), destructive: false, label: 'Download' },
                            { icon: Copy, onClick: () => setShowDuplicateModal(true), destructive: false, label: 'Duplicate Quote' },
                            { icon: Archive, onClick: () => { if (isConverted) setShowArchiveConvertedModal(true); else setShowArchiveConfirm(true); }, destructive: true, label: 'Archive' },
                          ] as Array<{ icon: typeof Printer; onClick: () => void; destructive: boolean; label: string }>).map((btn, idx) => (
                            <button
                              key={idx}
                              onClick={btn.onClick}
                              title={btn.label}
                              className={`rounded-lg flex items-center justify-center shrink-0 transition-all duration-150 ${hdrBtnSize}`}
                              style={{
                                border: btn.destructive
                                  ? `1px solid ${isClosed ? 'color-mix(in srgb, var(--muted-foreground) 14%, transparent)' : 'color-mix(in srgb, var(--destructive) 40%, transparent)'}`
                                  : `1px solid ${isClosed ? 'color-mix(in srgb, var(--muted-foreground) 18%, transparent)' : 'var(--border)'}`,
                                backgroundColor: '#FFFFFF',
                                color: btn.destructive
                                  ? (isClosed ? 'color-mix(in srgb, var(--muted-foreground) 40%, transparent)' : 'var(--destructive)')
                                  : (isClosed ? 'color-mix(in srgb, var(--muted-foreground) 55%, transparent)' : 'var(--muted-foreground)'),
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => {
                                if (btn.destructive && !isClosed) {
                                  e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--destructive) 5%, var(--card))';
                                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--destructive) 60%, transparent)';
                                } else {
                                  e.currentTarget.style.backgroundColor = 'var(--secondary)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#FFFFFF';
                                if (btn.destructive && !isClosed) {
                                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--destructive) 40%, transparent)';
                                }
                              }}
                            >
                              <btn.icon style={{ width: 15, height: 15 }} />
                            </button>
                          ))}
                        </>
                      )}

                      {/* Narrow: More actions dropdown */}
                      {isNarrow && (
                        <div ref={moreActionsRef} style={{ position: 'relative' }}>
                          <button
                            onClick={() => setShowMoreActions(!showMoreActions)}
                            title="More actions"
                            className="flex items-center justify-center rounded-lg transition-colors"
                            style={{
                              width: 32, height: 32,
                              border: '1px solid var(--border)',
                              backgroundColor: showMoreActions ? 'var(--secondary)' : 'var(--card)',
                              color: 'var(--muted-foreground)',
                            }}
                          >
                            <MoreHorizontal style={{ width: 16, height: 16 }} />
                          </button>
                          {showMoreActions && (
                            <div
                              style={{
                                position: 'absolute', right: 0, top: 36, zIndex: 50,
                                backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                                borderRadius: 8, padding: '4px 0', minWidth: 180,
                                boxShadow: 'var(--elevation-2)',
                              }}
                            >
                              {[
                                { label: 'Print', icon: Printer, action: () => { setShowPrintModal(true); setShowMoreActions(false); } },
                                { label: 'Download PDF', icon: Download, action: () => { setShowPDFVisibilityModal(true); setShowMoreActions(false); } },
                                { label: 'Duplicate Quote', icon: Copy, action: () => { setShowDuplicateModal(true); setShowMoreActions(false); } },
                              ].map((item) => (
                                <button
                                  key={item.label}
                                  onClick={item.action}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary transition-colors text-foreground"
                                  style={{ fontSize: 13, fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                                >
                                  <item.icon style={{ width: 14, height: 14, color: 'var(--muted-foreground)' }} />
                                  {item.label}
                                </button>
                              ))}
                              <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 0' }} />
                              <button
                                onClick={() => {
                                  if (isConverted) setShowArchiveConvertedModal(true);
                                  else setShowArchiveConfirm(true);
                                  setShowMoreActions(false);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-destructive/5 transition-colors"
                                style={{ fontSize: 13, fontWeight: 500, color: 'var(--destructive)', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
                              >
                                <Archive style={{ width: 14, height: 14 }} />
                                Archive Quote
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Separator before CTA */}
                      <div className="shrink-0" style={{ width: 1, height: isScrolled ? 18 : 22, backgroundColor: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 18%, transparent)' : 'var(--border)', margin: '0 2px' }} />

                      {/* CTA */}
                      {!isViewingOldVersion && (
                        <StatusActionButton
                          currentStatus={quoteStatus}
                          onStatusChange={handleStatusChange}
                          onCancelConverted={quoteStatus === 'converted' ? () => setShowCancelConvertedModal(true) : undefined}
                          onReviveExpired={quoteStatus === 'expired' ? () => setShowReviveModal(true) : undefined}
                          onDuplicate={quoteStatus === 'cancelled' ? () => setShowDuplicateModal(true) : undefined}
                          onReviveCancelled={quoteStatus === 'cancelled' ? () => setShowReviveCancelledModal(true) : undefined}
                          onSendToCustomer={() => { setIsSendResend(false); setShowSendToCustomer(true); }}
                          onResendToCustomer={() => { setIsSendResend(true); setShowSendToCustomer(true); }}
                          salesOrderNumber={salesOrderNumber}
                        />
                      )}

                      {isViewingOldVersion && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {quoteStatus !== 'converted' && viewingVersion !== null && (
                            <button
                              onClick={() => handleEditAsDraft(viewingVersion)}
                              className="flex items-center gap-1.5 text-white transition-colors rounded-lg"
                              style={{ height: isScrolled ? 28 : 32, padding: '0 14px', fontSize: 13, fontWeight: 600, backgroundColor: 'var(--primary)', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                            >
                              <Pencil style={{ width: 12, height: 12 }} />
                              {isNarrow ? 'Edit' : 'Edit as New Draft'}
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

                  {/* ── Row 2: Metadata bar — description (hidden when scrolled) ── */}
                  {!isScrolled && (
                    <div
                      className="flex items-center justify-between"
                      style={{
                        margin: '4px 20px 0',
                        padding: '4px 10px',
                        borderRadius: 8,
                        backgroundColor: isClosed
                          ? 'color-mix(in srgb, var(--muted-foreground) 4%, transparent)'
                          : 'color-mix(in srgb, var(--foreground) 3%, transparent)',
                      }}
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        {isEditingDescription ? (
                          <div className="flex items-center flex-1 min-w-0" style={{ height: 24, borderRadius: 4, backgroundColor: '#FFFFFF', border: '1px solid var(--primary)', padding: '0 8px', boxShadow: '0 0 0 2px rgba(10,119,255,0.1)' }}>
                            <input
                              type="text"
                              value={description}
                              onChange={(e) => { setDescription(e.target.value); setQuoteDescription(descriptionKey, e.target.value); }}
                              onBlur={() => setIsEditingDescription(false)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setIsEditingDescription(false); }}
                              placeholder="Add a description..."
                              autoFocus
                              className="bg-transparent text-foreground focus:outline-none w-full"
                              style={{ fontSize: 11.5, lineHeight: '22px', padding: 0, border: 'none' }}
                            />
                            <Pencil style={{ width: 10, height: 10, color: 'var(--muted-foreground)', flexShrink: 0, marginLeft: 6 }} />
                          </div>
                        ) : description ? (
                          <button
                            onClick={() => !isFullyReadOnly && setIsEditingDescription(true)}
                            className="group/desc inline-flex items-center min-w-0"
                            style={{ height: 24, border: 'none', background: 'none', padding: '0 6px', borderRadius: 4, cursor: isFullyReadOnly ? 'default' : 'pointer', transition: 'all 150ms', gap: 4, maxWidth: '100%' }}
                            onMouseEnter={(e) => { if (!isFullyReadOnly) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <span style={{ fontSize: 11.5, color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '22px' }}>{description}</span>
                            {!isFullyReadOnly && <Pencil className="shrink-0 text-foreground/25 group-hover/desc:text-primary transition-all" style={{ width: 10, height: 10 }} />}
                          </button>
                        ) : (
                          <button
                            onClick={() => !isFullyReadOnly && setIsEditingDescription(true)}
                            className="group/desc flex items-center min-w-0"
                            style={{ height: 24, border: '1px dashed color-mix(in srgb, var(--muted-foreground) 30%, transparent)', background: 'none', padding: '0 8px', borderRadius: 4, cursor: isFullyReadOnly ? 'default' : 'pointer', transition: 'all 150ms', gap: 5 }}
                            onMouseEnter={(e) => { if (!isFullyReadOnly) { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--muted-foreground) 50%, transparent)'; } }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--muted-foreground) 30%, transparent)'; }}
                          >
                            <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', lineHeight: '22px' }}>Add description...</span>
                            {!isFullyReadOnly && <Pencil style={{ width: 10, height: 10, color: 'var(--muted-foreground)', flexShrink: 0 }} />}
                          </button>
                        )}
                      </div>
                      {/* Right: Items count + Total + Currency toggle/configurator (PO-style) */}
                      <div className="flex items-center gap-2 shrink-0">
                        {(() => {
                          const createdItems = propQuoteId ? getCreatedQuoteLineItems(propQuoteId) : undefined;
                          const itemCount = createdItems?.length ?? quote?.items?.length ?? 5;
                          const computedTotal = createdItems
                            ? createdItems.reduce((s, i) => s + (i.total ?? i.unitPrice * i.quantity), 0)
                            : (quote?.total || quote?.subtotal || quote?.totalValue || 87000);
                          return (
                            <>
                              <span style={{ fontSize: 13, color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 50%, transparent)' : 'var(--muted-foreground)', lineHeight: 1.3 }}>
                                {itemCount} {itemCount === 1 ? 'item' : 'items'}
                              </span>
                              <div style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--muted-foreground) 25%, transparent)', flexShrink: 0 }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: isClosed ? 'color-mix(in srgb, var(--muted-foreground) 75%, transparent)' : 'var(--foreground)', lineHeight: 1.3 }}>
                                <QuoteMoney
                                  valuePKR={computedTotal}
                                  customerCurrency={currencyConfig.currency}
                                  view={quoteViewMode}
                                />
                              </span>
                            </>
                          );
                        })()}

                        {/* Base ↔ Customer view toggle + Currency configurator —
                            mirrors POCurrencyHeaderControls 1:1. Always visible
                            so users can see the page-level FX view at a glance,
                            even when the customer settles in the base currency. */}
                        <div className="flex items-center gap-1.5 shrink-0" style={{ marginLeft: 4 }}>
                          <div className="inline-flex items-center gap-0.5 h-8 rounded-lg border border-border p-0.5 bg-white shadow-sm shrink-0">
                            <button
                              type="button"
                              onClick={() => setQuoteViewMode('base')}
                              aria-pressed={quoteViewMode === 'base'}
                              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] whitespace-nowrap cursor-pointer transition-colors ${
                                quoteViewMode === 'base'
                                  ? 'bg-[#EDF4FF] text-primary'
                                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                              }`}
                              style={{ fontWeight: quoteViewMode === 'base' ? 600 : 500 }}
                            >
                              Base Currency
                              <InfoTooltip side="bottom" iconClassName="w-3 h-3">
                                Show amounts in the company's base currency ({BASE_CURRENCY}). Values stay comparable across all quotes regardless of the customer's transaction currency.
                              </InfoTooltip>
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuoteViewMode('customer')}
                              aria-pressed={quoteViewMode === 'customer'}
                              disabled={customerCurrencyIsBase}
                              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] whitespace-nowrap transition-colors ${
                                customerCurrencyIsBase
                                  ? 'text-muted-foreground/40 cursor-not-allowed'
                                  : quoteViewMode === 'customer'
                                    ? 'bg-[#EDF4FF] text-primary cursor-pointer'
                                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground cursor-pointer'
                              }`}
                              style={{ fontWeight: quoteViewMode === 'customer' && !customerCurrencyIsBase ? 600 : 500 }}
                            >
                              Customer Currency
                              <InfoTooltip side="bottom" iconClassName="w-3 h-3">
                                {customerCurrencyIsBase
                                  ? `Customer settles in ${BASE_CURRENCY} — same as the base currency, so this view is identical to "Base Currency". Set a different currency in the configurator to enable the toggle.`
                                  : `Show amounts in this customer's own default transaction currency (${currencyConfig.currency}). The base-currency equivalent remains available on hover for reporting.`}
                              </InfoTooltip>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowCurrencyConfig(true)}
                            title="Currency settings for this quote"
                            aria-label="Open currency configuration"
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-white text-muted-foreground hover:bg-slate-50 hover:text-foreground transition-colors cursor-pointer shrink-0 text-[11px]"
                            style={{ fontWeight: 500 }}
                          >
                            <Settings2 className="w-3.5 h-3.5" />
                            <span className="whitespace-nowrap">Currency</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Row 3: Lifecycle stepper — inherits card gradient ── */}
                  {!isScrolled && !isNarrow && (
                    <div className="relative" style={{ padding: '10px 20px 12px', overflow: 'hidden', borderRadius: '0 0 12px 12px' }}>
                      <ModernStatusStepper currentStatus={quoteStatus} />
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Cancellation Reason Banner — shown when quote is cancelled */}
          {quoteStatus === 'cancelled' && cancellationReason && (
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderRadius: '8px',
                marginBottom: '16px',
                fontFamily: 'Inter, system-ui, sans-serif',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
              }}
            >
              <div style={{
                width: '3px',
                flexShrink: 0,
                backgroundColor: '#DC2626',
              }} />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flex: 1,
                padding: isNarrow ? '10px 10px' : '10px 16px',
                gap: isNarrow ? '8px' : '16px',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Ban style={{ width: '13px', height: '13px', color: '#DC2626', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>
                      Quote Cancelled
                    </span>
                  </div>
                  <span style={{
                    fontSize: '12px',
                    color: '#6B7280',
                    paddingLeft: '19px',
                    lineHeight: '1.5',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: isNarrow ? '100%' : '600px',
                  }}>
                    {cancellationReason}
                  </span>
                </div>
                <button
                  onClick={() => setShowDuplicateModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    height: '32px', padding: isNarrow ? '0 8px' : '0 14px', borderRadius: '6px',
                    border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
                    color: '#374151', fontSize: '13px', fontWeight: 500,
                    cursor: 'pointer', lineHeight: '1', transition: 'all 150ms',
                    flexShrink: 0, whiteSpace: 'nowrap',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                >
                  <Copy style={{ width: '12px', height: '12px' }} />
                  {isNarrow ? 'Duplicate' : 'Duplicate Quote'}
                </button>
              </div>
            </div>
          )}

          {/* Archive Reason Banner — shown when quote is archived */}
          {quoteStatus === 'archived' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderRadius: '8px',
                marginBottom: '16px',
                fontFamily: 'Inter, system-ui, sans-serif',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
              }}
            >
              <div style={{
                width: '3px',
                flexShrink: 0,
                backgroundColor: '#991B1B',
              }} />
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flex: 1,
                padding: isNarrow ? '10px 10px' : '10px 16px',
                gap: isNarrow ? '8px' : '16px',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Archive style={{ width: '13px', height: '13px', color: '#991B1B', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>
                      Quote Archived
                    </span>
                  </div>
                  {archiveReason && (
                    <span style={{
                      fontSize: '12px',
                      color: '#6B7280',
                      paddingLeft: '19px',
                      lineHeight: '1.5',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: isNarrow ? '100%' : '600px',
                    }}>
                      {archiveReason}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowDuplicateModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    height: '32px', padding: isNarrow ? '0 8px' : '0 14px', borderRadius: '6px',
                    border: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
                    color: '#374151', fontSize: '13px', fontWeight: 500,
                    cursor: 'pointer', lineHeight: '1', transition: 'all 150ms',
                    flexShrink: 0, whiteSpace: 'nowrap',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                >
                  <Copy style={{ width: '12px', height: '12px' }} />
                  {isNarrow ? 'Duplicate' : 'Duplicate Quote'}
                </button>
              </div>
            </div>
          )}

          {/* Version Context Strip — between header card and tabs */}
          {!isViewingOldVersion && (quoteStatus === 'sent' || quoteStatus === 'confirmed' || quoteStatus === 'converted' || (quoteStatus === 'draft' && quoteVersion > 1)) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                borderRadius: '8px',
                marginBottom: '16px',
                fontFamily: 'Inter, system-ui, sans-serif',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              {/* Left accent bar */}
              <div style={{
                width: '3px',
                flexShrink: 0,
                backgroundColor: quoteStatus === 'converted' ? '#047857' : quoteStatus === 'sent' ? '#F59E0B' : quoteStatus === 'confirmed' ? '#8B5CF6' : '#3B82F6',
              }} />

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
                  {quoteStatus === 'sent' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock style={{ width: '13px', height: '13px', color: '#D97706', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>
                          Version {quoteVersion} sent — awaiting customer confirmation
                        </span>
                      </div>
                      {quoteVersion > 1 && (
                        <span style={{ fontSize: '12px', color: '#6B7280', paddingLeft: '19px' }}>
                          Current active version: V{quoteVersion - 1}
                        </span>
                      )}
                    </>
                  )}
                  {quoteStatus === 'confirmed' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 style={{ width: '13px', height: '13px', color: '#8B5CF6', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>
                          Version {quoteVersion} confirmed — current active version
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#6B7280', paddingLeft: '19px' }}>
                        Edit to create V{quoteVersion + 1} draft, or make a change — material edits auto-version
                      </span>
                    </>
                  )}
                  {quoteStatus === 'draft' && quoteVersion > 1 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Pencil style={{ width: '12px', height: '12px', color: '#2563EB', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>
                          Editing Version {quoteVersion} draft
                        </span>
                        {materialChangesInDraft > 0 && (
                          <span style={{
                            fontSize: '10px', fontWeight: 600, lineHeight: '1',
                            color: '#1E40AF', backgroundColor: '#DBEAFE',
                            padding: '3px 7px', borderRadius: '4px',
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            border: '1px solid #BFDBFE',
                          }}>
                            <GitBranch style={{ width: '9px', height: '9px' }} />
                            {materialChangesInDraft} material change{materialChangesInDraft > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: '#6B7280', paddingLeft: '18px' }}>
                        {materialChangesInDraft > 0
                          ? `${materialChangesInDraft} revision-triggering change${materialChangesInDraft > 1 ? 's' : ''} queued — send to finalize V${quoteVersion}`
                          : `Send when ready to finalize as V${quoteVersion}`
                        }
                      </span>
                    </>
                  )}
                  {quoteStatus === 'converted' && salesOrderNumber && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Package style={{ width: '13px', height: '13px', color: '#059669', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>
                          Converted to Sales Order
                        </span>
                        <span style={{
                          fontSize: '12px', fontWeight: 600, color: '#047857', backgroundColor: '#D1FAE5',
                          padding: '2px 8px', borderRadius: '4px', lineHeight: '1',
                        }}>
                          {salesOrderNumber}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#6B7280', paddingLeft: '19px' }}>
                        Read-only — duplicate as a new quote or cancel. View the linked SO for further processing.
                      </span>
                    </>
                  )}
                </div>

                {/* Right: CTA — only when sent or confirmed */}
                {(quoteStatus === 'sent' || quoteStatus === 'confirmed') && (
                  <button
                    onClick={() => {
                      const newVersion = quoteVersion + 1;
                      setQuoteVersion(newVersion);
                      setQuoteStatus('draft');
                      setMaterialChangesInDraft(0);
                      toast.success(`Editing as V${newVersion} Draft`, {
                        description: 'Make your changes — material changes will auto-version.',
                        position: 'top-right',
                      });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      height: '32px', padding: '0 14px', borderRadius: '6px',
                      border: 'none', backgroundColor: '#1B6EF3',
                      color: '#FFFFFF', fontSize: '13px', fontWeight: 500,
                      cursor: 'pointer', lineHeight: '1', transition: 'background-color 150ms',
                      flexShrink: 0, whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B6EF3'; }}
                  >
                    <Pencil style={{ width: '12px', height: '12px' }} />
                    Edit as V{quoteVersion + 1}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 3. Tabs — SO V5 plain underline style */}
          <div className="relative" style={{ marginTop: 16 }}>
            <div
              ref={tabsContainerRef}
              onMouseDown={handleTabsMouseDown}
              onMouseMove={handleTabsMouseMove}
              onMouseUp={handleTabsMouseUp}
              onMouseLeave={handleTabsMouseUp}
              className="flex items-center overflow-x-auto border-b border-border"
              style={{ gap: 0, paddingLeft: 0, scrollbarWidth: 'none' as any, cursor: 'grab' }}
            >
              {[
                { key: 'items', label: 'Line Items', count: 5 },
                { key: 'overview', label: 'Deal Information' },
                { key: 'invoicing', label: 'Invoicing' },
                { key: 'linked_transactions', label: 'Attachments', count: 12 },
                { key: 'transactions', label: 'Linked Transactions', count: 9 },
                { key: 'communications', label: 'Communications' },
                { key: 'activity', label: 'Activity' },
                { key: 'version_history', label: 'Versions', count: 4 },
              ].map((tab) => {
                const isActiveTab = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      if (tabsDragMoved.current) return;
                      setActiveTab(tab.key as any);
                    }}
                    className="flex items-center whitespace-nowrap shrink-0 transition-colors duration-150 relative"
                    style={{
                      gap: 5,
                      padding: '8px 16px 10px',
                      color: isActiveTab ? 'var(--primary)' : 'var(--muted-foreground)',
                      fontSize: 'var(--text-caption, 13px)',
                      fontWeight: isActiveTab ? 600 : 500,
                      lineHeight: 1,
                      cursor: 'pointer',
                      background: 'transparent',
                      border: 'none',
                    }}
                    onMouseEnter={(e) => { if (!isActiveTab) e.currentTarget.style.color = 'var(--foreground)'; }}
                    onMouseLeave={(e) => { if (!isActiveTab) e.currentTarget.style.color = 'var(--muted-foreground)'; }}
                  >
                    {tab.label}
                    {'count' in tab && tab.count !== undefined && tab.count > 0 && (
                      <span
                        style={{
                          fontSize: 10, fontWeight: 600, lineHeight: 1,
                          color: isActiveTab ? 'var(--primary)' : 'var(--muted-foreground)',
                          backgroundColor: isActiveTab ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'color-mix(in srgb, var(--muted-foreground) 10%, transparent)',
                          padding: '3px 6px', borderRadius: 5, minWidth: 18, textAlign: 'center' as const,
                        }}
                      >
                        {tab.count}
                      </span>
                    )}
                    {isActiveTab && (
                      <span className="absolute bottom-0 left-4 right-4" style={{ height: 2, backgroundColor: 'var(--primary)', borderRadius: '1px 1px 0 0' }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Content + Right Sidebar — SO V5 flex row layout */}
          <div className="flex" style={{ alignItems: 'flex-start', gap: 'var(--space-card-padding, 24px)' }}>
            <div className="flex-1 min-w-0" style={{ paddingTop: 24, paddingBottom: 48 }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  {activeTab === 'items' && <ItemsTabTableClean quoteStatus={quoteStatus} quoteId={propQuoteId} readOnly={isFullyReadOnly} customerCurrency={currencyConfig.currency} viewMode={quoteViewMode} onMaterialChange={handleMaterialChange} />}
                  {activeTab === 'overview' && <OverviewTab quoteNumber={quoteNumber} customerName={customerName} contactName={contactName} readOnly={isFullyReadOnly} tags={quoteTags} priority={quotePriority} winProbability={quoteWinProbability} salesRep={quoteSalesRep} onNonMaterialChange={handleNonMaterialChange} />}
                  {activeTab === 'invoicing' && <ComingSoonTab title="Invoicing" description="Invoice generation, tracking, payment status, and billing history will be available here." />}
                  {activeTab === 'linked_transactions' && <LinkedTransactionsTab quoteNumber={quoteNumber} customerName={customerName} readOnly={isFullyReadOnly} onAskUserChange={handleAskUserChange} />}
                  {activeTab === 'transactions' && <TransactionsTab quoteNumber={quoteNumber} customerName={customerName} readOnly={isFullyReadOnly} customerCurrency={currencyConfig.currency} quoteLockedRate={278} quoteRateType="market" viewMode={quoteViewMode} />}
                  {activeTab === 'communications' && <ComingSoonTab title="Communications" description="Threaded messages, email integration, and customer correspondence will be available here." />}
                  {activeTab === 'version_history' && <VersionHistoryTab quoteNumber={quoteNumber} customerName={customerName} customerCurrency={currencyConfig.currency} viewMode={quoteViewMode} />}
                  {activeTab === 'activity' && <ComingSoonTab title="Activity Log" description="A full audit trail of changes, status transitions, and user actions will appear here." />}
                </motion.div>
              </AnimatePresence>

              {isFullyReadOnly && activeTab !== 'version_history' && activeTab !== 'activity' && activeTab !== 'overview' && (
                <div className="absolute inset-0 z-10 cursor-not-allowed bg-white/5" />
              )}
            </div>

            {/* Right Column: Sidebar — sticky like SO */}
            <div className="shrink-0 sticky top-0 hidden lg:block" style={{ width: 300, paddingTop: 24, paddingBottom: 48 }}>
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
                salesRep={quoteSalesRep}
                customerCurrency={currencyConfig.currency}
                settlementCurrency={currencyConfig.settlementCurrency}
                viewMode={quoteViewMode}
                onOpenCurrencyConfig={() => setShowCurrencyConfig(true)}
                onMaterialChange={handleMaterialChange}
                onNonMaterialChange={handleNonMaterialChange}
                onAskUserChange={handleAskUserChange}
              />
            </div>
          </div>


        </div>
      </div>

      {/* Modals */}
      {showDuplicateModal && (
        <DuplicateQuoteModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          quoteNumber={quoteNumber}
          currentCustomer={customerName}
          quoteCurrency={currencyConfig.currency}
          quoteLockedRate={278}
          onChangeCurrencyPair={() => {
            setShowDuplicateModal(false);
            setCurrencyConfigForceUnlocked(true);
            setShowCurrencyConfig(true);
          }}
          onConfirm={(customerId, custName, _rateOption) => {
            setShowDuplicateModal(false);
            setActionOverlay({
              config: {
                processing: 'Duplicating Quote',
                done: `Quote Duplicated for ${custName}`,
                icon: Copy,
                accentColor: '#1E40AF',
                accentBg: '#DBEAFE',
                ringColor: '#93C5FD',
              },
              onComplete: () => {
                setActionOverlay(null);
              },
            });
          }}
        />
      )}
      {showPDFVisibilityModal && (
        <PDFPreviewModal
          isOpen={showPDFVisibilityModal}
          onClose={() => setShowPDFVisibilityModal(false)}
          quote={{
            quoteNumber,
            customerName,
            version: quoteVersion,
            items: quote?.items || [],
            subtotal: quote?.subtotal || 0,
            tax: quote?.tax || 0,
            total: quote?.total || 0,
            status: quoteStatus
          }}
          mode="download"
          customerCurrency={currencyConfig.currency}
          quoteLockedRate={278}
          rateType="market"
          lockedAt={initialCreatedDate}
        />
      )}
      {showPrintModal && (
        <PDFPreviewModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          quote={{
            quoteNumber,
            customerName,
            version: quoteVersion,
            items: quote?.items || [],
            subtotal: quote?.subtotal || 0,
            tax: quote?.tax || 0,
            total: quote?.total || 0,
            status: quoteStatus
          }}
          mode="print"
          customerCurrency={currencyConfig.currency}
          quoteLockedRate={278}
          rateType="market"
          lockedAt={initialCreatedDate}
        />
      )}
      <QuoteCurrencyConfigModal
        open={showCurrencyConfig}
        onOpenChange={(v) => {
          setShowCurrencyConfig(v);
          if (!v) setCurrencyConfigForceUnlocked(false);
        }}
        customerDefaultCurrency={customerDefaultCurrency}
        config={currencyConfig}
        // Once a quote leaves Draft → it's "sent": rate locks per business rules.
        // Exception: when opened from the Duplicate flow, the configurator is
        // editing the *new* Draft being created, so unlock it.
        locked={!currencyConfigForceUnlocked && quoteStatus !== 'draft'}
        lockedAt={initialCreatedDate}
        quoteTotalPKR={quote?.total || quote?.subtotal || quote?.totalValue || 87000}
        onSave={(next) => setCurrencyConfig(next)}
      />
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

      {/* Archive Confirmation Modal — portaled to document.body */}
      {showArchiveConfirm && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.4)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
          onClick={() => { setShowArchiveConfirm(false); setArchiveReasonInput(''); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '420px',
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px 0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Archive style={{ width: '18px', height: '18px', color: '#DC2626' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1F2937', margin: 0, lineHeight: '1.3' }}>
                    Archive Quote
                  </h3>
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>{quoteNumber}</span>
                </div>
              </div>
              <button
                onClick={() => { setShowArchiveConfirm(false); setArchiveReasonInput(''); }}
                style={{
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '6px', border: 'none', backgroundColor: 'transparent',
                  cursor: 'pointer', color: '#9CA3AF', transition: 'all 120ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F3F4F6'; e.currentTarget.style.color = '#374151'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            {/* Warning callout */}
            <div style={{ padding: '16px 24px' }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '12px 14px', borderRadius: '8px',
                backgroundColor: '#FFFBEB',
                borderWidth: '1px', borderStyle: 'solid', borderColor: '#FDE68A',
              }}>
                <AlertTriangle style={{ width: '16px', height: '16px', color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
                <div style={{ fontSize: '13px', color: '#92400E', lineHeight: '1.5' }}>
                  This will move the quote to the archive. Archived quotes are hidden from active views but can be restored later.
                  {quoteStatus === 'sent' && (
                    <span style={{ display: 'block', marginTop: '6px', fontWeight: 500 }}>
                      This quote has been sent to the customer — archiving it will not notify them.
                    </span>
                  )}
                </div>
              </div>

              {/* Archive Reason (optional) */}
              <div style={{ marginTop: '16px' }}>
                <label style={{
                  fontSize: '11px', fontWeight: 600, color: '#374151',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  display: 'block', marginBottom: '6px', lineHeight: '1',
                }}>
                  Reason <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={archiveReasonInput}
                  onChange={(e) => setArchiveReasonInput(e.target.value)}
                  placeholder="Why is this quote being archived? e.g., No longer relevant, superseded by another quote..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: '13px', color: '#1F2937',
                    borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                    borderRadius: '6px', outline: 'none', backgroundColor: '#FFFFFF',
                    fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.5',
                    resize: 'vertical', minHeight: '68px', boxSizing: 'border-box',
                    transition: 'border-color 150ms',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.1)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
                />
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', lineHeight: '1' }}>
                  This reason will be displayed on the archived quote and logged in activity.
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{
              padding: '0 24px 20px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
            }}>
              <button
                onClick={() => { setShowArchiveConfirm(false); setArchiveReasonInput(''); }}
                style={{
                  height: '32px', padding: '0 14px', borderRadius: '6px',
                  borderWidth: '1px', borderStyle: 'solid', borderColor: '#E5E7EB',
                  backgroundColor: '#FFFFFF', color: '#374151',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'all 120ms', lineHeight: '1',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const reason = archiveReasonInput.trim() || null;
                  setArchiveReason(reason);
                  setArchiveReasonInput('');
                  setShowArchiveConfirm(false);
                  setActionOverlay({
                    config: {
                      processing: 'Archiving Quote',
                      done: 'Quote Archived',
                      icon: Archive,
                      accentColor: '#991B1B',
                      accentBg: '#FEE2E2',
                      ringColor: '#FCA5A5',
                      isNegative: true,
                    },
                    onComplete: () => {
                      setQuoteStatus('archived' as QuoteLifecycleStatus);
                      setActionOverlay(null);
                    },
                  });
                }}
                style={{
                  height: '32px', padding: '0 16px', borderRadius: '6px',
                  borderWidth: '1px', borderStyle: 'solid', borderColor: '#DC2626',
                  backgroundColor: '#FFFFFF', color: '#DC2626',
                  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'all 120ms', lineHeight: '1',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                <Archive style={{ width: '14px', height: '14px' }} />
                Archive Quote
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
            doCreateNewDraft(draftConflict.fromVersion);
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
            const willBumpVersion = statusBeforeCancellation !== 'draft';
            if (willBumpVersion) {
              // Create new version as draft (e.g., v3 Sent → v4 Draft)
              const newVer = quoteVersion + 1;
              setQuoteVersion(newVer);
              setQuoteStatus('draft');
              setMaterialChangesInDraft(0);
              setCancellationReason(null);
              // Notify version dropdown
              if ((window as any).__versionDropdownAddRevert) {
                (window as any).__versionDropdownAddRevert(quoteVersion, 'Reactivated from cancellation');
              }
              toast.success(`Quote Reactivated as V${newVer} Draft`, {
                description: `New draft created from cancelled V${quoteVersion}. Expiry set to ${newExpiryDate}.`,
                position: 'top-right',
              });
            } else {
              // Reopen same version as draft (e.g., v3 Draft-cancelled → v3 Draft)
              setQuoteStatus('draft');
              setMaterialChangesInDraft(0);
              setCancellationReason(null);
              toast.success(`V${quoteVersion} Draft Reopened`, {
                description: `Draft reopened. Expiry set to ${newExpiryDate}.`,
                position: 'top-right',
              });
            }
            setStatusBeforeCancellation(null);
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
          onKeepCurrentVersion={() => versionPrompt.onComplete(false)}
          onCancel={() => setVersionPrompt(null)}
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
        onComplete={() => setAutoVersionOverlay(prev => ({ ...prev, show: false }))}
      />
      {/* Send to Customer Modal */}
      <SendToCustomerModal
        isOpen={showSendToCustomer}
        quoteNumber={quoteNumber}
        customerName={customerName}
        isResend={isSendResend}
        customerCurrency={currencyConfig.currency}
        quoteLiveRate={278}
        rateType="market"
        onClose={() => setShowSendToCustomer(false)}
        onSend={() => {
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
    </div>
  );
}