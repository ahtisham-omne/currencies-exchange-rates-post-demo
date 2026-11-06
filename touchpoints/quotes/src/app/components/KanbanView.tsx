// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Search, ArrowUpDown, TrendingUp, TrendingDown, GripVertical, Clock, CheckCircle2, AlertTriangle, X, Check, Ban, Archive, FileText, Send, Package, ChevronRight, ChevronDown, Users, Building2, Flag, Layers, Eye, EyeOff, Calendar, ArrowRight, RotateCcw } from 'lucide-react';
import { Quote, QuoteStatus } from '@/app/types/quote';
import { formatCurrency } from '@/app/utils/quoteUtils';
import { HighlightText } from '@/app/components/HighlightText';
import { VersionBadge } from '@/app/components/VersionBadge';
import { VersionHistoryModal } from '@/app/components/VersionHistoryModal';
import { ConvertToSOModal } from '@/app/components/quote-details/ConvertToSOModal';
import { SendToCustomerModal } from '@/app/components/quote-details/SendToCustomerModal';
import { CancelQuoteModal } from '@/app/components/quote-details/CancelQuoteModal';
import { ReviveCancelledModal } from '@/app/components/quote-details/ReviveCancelledModal';
import { ReviveQuoteModal } from '@/app/components/quote-details/ReviveQuoteModal';
import { CancelConvertedQuoteModal } from '@/app/components/quote-details/CancelConvertedQuoteModal';
import { ConfirmationModal } from '@/app/components/ConfirmationModal';
import { toast } from 'sonner';
import { InactiveItemsWarningModal } from '@/app/components/shared/InactiveItemsWarningModal';
import { isItemInactive } from '@/app/components/shared/inactiveItems';
import { MOCK_LINE_ITEMS } from '@/app/components/quote-details/ItemsTabTableClean';
import { getCreatedQuoteLineItems } from '@/app/data/quoteStore';
import { getLineItemImage } from '@/app/data/lineItemImage';
import { FIELD_RULES } from '@/app/components/shared/fieldRequirements';

/* The lines a quote's detail page would show: its own created lines when
   it has any, otherwise the shared demo set. Same rule ItemsTabTableClean
   uses for `initialItems`, so the Kanban guard and the detail page always
   agree on whether a quote carries an inactive item. */
function warningLinesFor(quoteId: string) {
  const created = getCreatedQuoteLineItems(quoteId);
  if (created && created.length > 0) {
    return created.map((ci, idx) => ({
      id: ci.id || String(idx + 1),
      code: ci.productId,
      name: ci.name,
      image: (ci as any).image || getLineItemImage(ci.productId),
    }));
  }
  return MOCK_LINE_ITEMS.map((l) => ({
    id: String(l.id),
    code: l.productId,
    name: l.productName,
    image: l.image || getLineItemImage(l.productId),
  }));
}
import {
  StateTransitionOverlay,
  type StateTransitionTone,
} from '@/app/components/shared/StateTransitionOverlay';

type ViewDensity = 'comfortable' | 'compact' | 'board';

interface KanbanViewProps {
  quotes: Quote[];
  onStatusChange: (quoteId: string, newStatus: QuoteStatus) => void;
  onQuoteClick: (quoteId: string) => void;
  groupBy?: 'none' | 'salesRep' | 'customer' | 'priority';
  searchTerm: string;
  visibleColumns?: QuoteStatus[];
  onVisibleColumnsChange?: (columns: QuoteStatus[]) => void;
  onGroupByChange?: (groupBy: 'none' | 'salesRep' | 'customer' | 'priority') => void;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
  onColumnConfig?: () => void;
  onViewDensityChange?: (density: ViewDensity) => void;
}

/* ═══ Avatar palette (matches SO module) ═══ */
const CARD_AVATAR_TINTS = [
  { bg: "#EDF4FF", fg: "hsl(var(--primary))" },
  { bg: "#F0FDF4", fg: "#16A34A" },
  { bg: "#FFF7ED", fg: "#EA580C" },
  { bg: "#F5F3FF", fg: "#7C3AED" },
  { bg: "#ECFEFF", fg: "#0891B2" },
  { bg: "#FFF1F2", fg: "#E11D48" },
  { bg: "#FEF9C3", fg: "#A16207" },
  { bg: "#F0FDFA", fg: "#0D9488" },
];
function getCardAvatarTint(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return CARD_AVATAR_TINTS[Math.abs(hash) % CARD_AVATAR_TINTS.length];
}

/* ═══ Priority styling — Low / Standard / High ═══ */
const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  High:     { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  Standard: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  Low:      { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
  // Legacy keys kept so older mock data still resolves to a colour.
  Urgent:   { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  Medium:   { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
};

const PRIORITY_LABEL: Record<string, string> = {
  Urgent: 'High',
  Medium: 'Standard',
};

const KANBAN_COLUMNS: {
  status: QuoteStatus;
  label: string;
  dotColor: string;
  tint: string;
  tintBorder: string;
}[] = [
  { status: 'Draft',            label: 'Draft',                  dotColor: '#6B7280', tint: '#F9FAFB', tintBorder: '#E5E7EB' },
  { status: 'Sent to Customer', label: 'Sent to Customer',       dotColor: '#1E40AF', tint: '#F8FAFF', tintBorder: '#E8EEFB' },
  { status: 'Unconfirmed SO',   label: 'Confirmed by Customer',  dotColor: '#7C3AED', tint: '#F5F3FF', tintBorder: '#DDD6FE' },
  { status: 'Confirmed SO',     label: 'Converted to SO',        dotColor: '#16A34A', tint: '#F0FDF4', tintBorder: '#BBF7D0' },
  { status: 'Expired',          label: 'Expired',                dotColor: '#DC2626', tint: '#FEF2F2', tintBorder: '#FECACA' },
  { status: 'Rejected',         label: 'Rejected',               dotColor: '#DC2626', tint: '#FEF2F2', tintBorder: '#FECACA' },
  { status: 'Cancelled',        label: 'Cancelled',              dotColor: '#DC2626', tint: '#FEF2F2', tintBorder: '#FECACA' },
  { status: 'Archived',         label: 'Archived',               dotColor: '#DC2626', tint: '#FEF2F2', tintBorder: '#FECACA' },
];

const ALL_STATUSES = KANBAN_COLUMNS.map(c => c.status);

/* ── Allowed kanban drag transitions ─────────────────────────────────────
 * Canonical lifecycle matrix (column label → column label):
 *
 *   Draft               → Sent to Customer (send modal)
 *                       → Confirmed by Customer (direct)
 *                       → Converted to SO (convert modal)
 *                       → Cancelled (cancel modal)
 *   Sent to Customer    → Confirmed by Customer (direct)
 *                       → Converted to SO (convert modal)
 *                       → Cancelled (cancel modal)
 *   Confirmed Customer  → Converted to SO (convert modal)
 *                       → Cancelled (cancel modal)
 *   Converted to SO     → Cancelled (cancel modal — only if no active SO)
 *   Expired             → Draft (new-expiry modal)
 *   Cancelled           → Draft (revive confirmation)
 *
 * Anything not listed is blocked at drop-time with a toast.
 *
 * Internal status keys map to display labels via KANBAN_COLUMNS:
 *   'Unconfirmed SO'  = "Confirmed by Customer"
 *   'Confirmed SO'    = "Converted to SO"
 */
const ALLOWED_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  'Draft':            ['Sent to Customer', 'Unconfirmed SO', 'Confirmed SO', 'Cancelled'],
  'Sent to Customer': ['Unconfirmed SO', 'Confirmed SO', 'Rejected', 'Cancelled'],
  'Unconfirmed SO':   ['Confirmed SO', 'Cancelled'],
  'Confirmed SO':     ['Cancelled'],
  'Expired':          ['Draft'],
  'Rejected':         ['Draft'],
  'Cancelled':        ['Draft'],
  'Archived':         [],
};

function statusLabel(s: QuoteStatus): string {
  return KANBAN_COLUMNS.find(c => c.status === s)?.label ?? s;
}

/* ── Kanban transition info ──
   Resolved into the unified StateTransitionOverlay below so the
   kanban drag-drop animation matches the detail-page transition.
   Tone + icon + label are derived from the destination QuoteStatus
   via KANBAN_TRANSITION_VISUALS so the kanban stays the source of
   truth for column display labels. */
interface TransitionInfo {
  quoteNumber: string;
  fromStatus: QuoteStatus;
  toStatus: QuoteStatus;
}

interface KanbanVisual {
  Icon: React.ElementType;
  tone: StateTransitionTone;
  heading: string;
}

const KANBAN_TRANSITION_VISUALS: Record<QuoteStatus, KanbanVisual> = {
  'Draft':            { Icon: FileText,     tone: 'neutral',     heading: 'Reverted to Draft' },
  'Sent to Customer': { Icon: Send,          tone: 'info',        heading: 'Sending to Customer' },
  'Unconfirmed SO':   { Icon: CheckCircle2,  tone: 'success',     heading: 'Quote Confirmed' },
  'Confirmed SO':     { Icon: Package,       tone: 'success',     heading: 'Converting to Sales Order' },
  'Cancelled':        { Icon: Ban,           tone: 'destructive', heading: 'Cancelling Quote' },
  'Archived':         { Icon: Archive,       tone: 'neutral',     heading: 'Archiving Quote' },
  'Expired':          { Icon: Ban,           tone: 'destructive', heading: 'Quote Expired' },
};

/* ═══════════════════════════════════════════════════════════════════════
 *  Main KanbanView
 * ════════════════════════════════════════════════════════════════════════ */

export function KanbanView({
  quotes, onStatusChange, onQuoteClick, groupBy = 'none', searchTerm,
  visibleColumns, onVisibleColumnsChange, onGroupByChange, isFullscreen,
  onFullscreenToggle, onColumnConfig, onViewDensityChange,
}: KanbanViewProps) {
  const activeColumns = visibleColumns || ALL_STATUSES;
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);
  const [showTimeDurationDropdown, setShowTimeDurationDropdown] = useState(false);
  const [timeDuration, setTimeDuration] = useState<string>('last_30_days');
  const groupByRef = useRef<HTMLDivElement>(null);
  const timeDurationRef = useRef<HTMLDivElement>(null);

  // ── Drag-drop flow modals ──
  // Convert flow uses the existing ConvertToSOModal; everything else routes
  // through the standardized red/blue/yellow ConfirmationModal so the kanban
  // matches the detail-page archive/cancel flows.
  const [convertModal, setConvertModal]   = useState<{ quoteId: string; quoteNumber: string; from: QuoteStatus } | null>(null);
  const [sendModal, setSendModal]         = useState<{ quoteId: string; quoteNumber: string } | null>(null);
  /* Inactive-items guard for the Draft -> Sent drag, same as the detail
     page's Send to Customer. Holds the quote until the user confirms. */
  const [inactiveGuard, setInactiveGuard] = useState<{ quoteId: string; quoteNumber: string } | null>(null);
  const [cancelModal, setCancelModal]     = useState<{ quoteId: string; quoteNumber: string; from: QuoteStatus } | null>(null);
  const [reviveModal, setReviveModal]     = useState<{ quoteId: string; quoteNumber: string } | null>(null);
  const [expiredReviveModal, setExpiredReviveModal] = useState<{ quoteId: string; quoteNumber: string } | null>(null);

  // ── Status transition overlay ──
  const [transitionInfo, setTransitionInfo] = useState<TransitionInfo | null>(null);

  /* Run a status change with the existing transition-overlay animation. */
  const applyTransition = useCallback((quoteId: string, from: QuoteStatus, to: QuoteStatus) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return;
    setTransitionInfo({ quoteNumber: quote.quoteNumber, fromStatus: from, toStatus: to });
    onStatusChange(quoteId, to);
  }, [quotes, onStatusChange]);

  const getColumnMeta = useCallback((status: QuoteStatus) => {
    const col = KANBAN_COLUMNS.find(c => c.status === status);
    return col ? { label: col.label, color: col.dotColor } : { label: status, color: '#6B7280' };
  }, []);

  const handleDrop = useCallback((quoteId: string, fromStatus: QuoteStatus, toStatus: QuoteStatus) => {
    if (fromStatus === toStatus) return;
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return;

    // ── Gate: enforce the canonical lifecycle matrix ──
    if (!ALLOWED_TRANSITIONS[fromStatus]?.includes(toStatus)) {
      /* Special case: dragging anything into Expired. Expiry is a
         derived status that flips automatically when the quote's
         expiration date passes, so the lifecycle blocks manual
         transitions into it. Surface the rule explicitly instead of
         the generic "transition not allowed" copy. */
      if (toStatus === 'Expired') {
        toast.warning("Quotes can't be manually marked as expired", {
          description: 'A quote expires automatically once its expiration date passes.',
          position: 'top-right',
        });
        return;
      }
      toast.warning(`Can't move ${statusLabel(fromStatus)} → ${statusLabel(toStatus)}`, {
        description: 'This transition isn\'t allowed in the quote lifecycle.',
        position: 'top-right',
      });
      return;
    }

    // ── Route by destination ──
    switch (toStatus) {
      // Send modal — Draft → Sent to Customer
      case 'Sent to Customer': {
        const target = { quoteId, quoteNumber: quote.quoteNumber };
        const lines = warningLinesFor(quoteId);
        if (fromStatus === 'Draft' && lines.some((l) => isItemInactive(l.code))) setInactiveGuard(target);
        else setSendModal(target);
        return;
      }

      // Convert modal — anything → Converted to SO
      case 'Confirmed SO':
        setConvertModal({ quoteId, quoteNumber: quote.quoteNumber, from: fromStatus });
        return;

      // Cancel modal — anything → Cancelled (Confirmed SO routes through
      // the blocking CancelConvertedQuoteModal instead).
      case 'Cancelled':
        setCancelModal({ quoteId, quoteNumber: quote.quoteNumber, from: fromStatus });
        return;

      // Draft target — Expired → Draft (new-expiry) vs Cancelled → Draft (revive)
      case 'Draft':
        if (fromStatus === 'Expired') {
          setExpiredReviveModal({ quoteId, quoteNumber: quote.quoteNumber });
        } else if (fromStatus === 'Cancelled') {
          setReviveModal({ quoteId, quoteNumber: quote.quoteNumber });
        } else {
          applyTransition(quoteId, fromStatus, toStatus);
        }
        return;

      // Direct transitions — Confirmed by Customer (no modal)
      default:
        applyTransition(quoteId, fromStatus, toStatus);
    }
  }, [quotes, applyTransition]);

  useEffect(() => {
    if (!showGroupByDropdown) return;
    const handler = (e: MouseEvent) => {
      if (groupByRef.current && !groupByRef.current.contains(e.target as Node)) setShowGroupByDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showGroupByDropdown]);

  useEffect(() => {
    if (!showTimeDurationDropdown) return;
    const handler = (e: MouseEvent) => {
      if (timeDurationRef.current && !timeDurationRef.current.contains(e.target as Node)) setShowTimeDurationDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTimeDurationDropdown]);

  const timeDurationOptions: { value: string; label: string }[] = [
    { value: 'last_7_days', label: 'Last 7 days' },
    { value: 'last_30_days', label: 'Last 30 days' },
    { value: 'last_6_months', label: 'Last 6 months' },
    { value: 'last_12_months', label: 'Last 12 months' },
    { value: 'all', label: 'All' },
  ];
  const currentTimeDuration = timeDurationOptions.find(o => o.value === timeDuration) || timeDurationOptions[1];

  const groupByOptions: { value: 'none' | 'salesRep' | 'customer' | 'priority'; label: string; description: string; icon: typeof Layers }[] = [
    { value: 'none', label: 'None', description: 'No grouping', icon: Layers },
    { value: 'salesRep', label: 'Sales Rep', description: 'Group by representative', icon: Users },
    { value: 'customer', label: 'Customer', description: 'Group by customer', icon: Building2 },
    { value: 'priority', label: 'Priority', description: 'Group by urgency', icon: Flag },
  ];

  const currentGroupBy = groupByOptions.find(o => o.value === groupBy) || groupByOptions[0];
  const CurrentGroupByIcon = currentGroupBy.icon;

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: '#F7F8F9', overflow: 'hidden' }}>
        {/* Pipeline Stats Bar — removed, replaced by insight cards in listing page */}
        {false && <div className="flex-shrink-0 bg-white border-b border-[#E5E7EB]" style={{ padding: '12px 20px' }}>
          <div className="flex items-center" style={{ gap: '20px' }}>
            {/* Total Pipeline */}
            <div>
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: '1' }}>Pipeline</div>
              <div style={{ fontSize: '15px', color: '#1F2937', fontWeight: 700, lineHeight: '1.4' }}>{formatCurrency(totalValue)}</div>
            </div>

            <div style={{ width: '1px', height: '28px', backgroundColor: '#E5E7EB' }} />

            {/* Won Value */}
            <div>
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: '1' }}>Won</div>
              <div style={{ fontSize: '15px', color: '#059669', fontWeight: 700, lineHeight: '1.4' }}>{formatCurrency(confirmedValue)}</div>
            </div>

            <div style={{ width: '1px', height: '28px', backgroundColor: '#E5E7EB' }} />

            {/* Win Rate */}
            <div>
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: '1' }}>Win Rate</div>
              <div style={{ fontSize: '15px', color: '#1F2937', fontWeight: 700, lineHeight: '1.4' }}>{winRate.toFixed(1)}%</div>
            </div>

            <div style={{ width: '1px', height: '28px', backgroundColor: '#E5E7EB' }} />

            {/* Avg Deal */}
            <div>
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: '1' }}>Avg Deal</div>
              <div style={{ fontSize: '15px', color: '#1F2937', fontWeight: 700, lineHeight: '1.4' }}>{formatCurrency(avgDeal)}</div>
            </div>

            <div style={{ width: '1px', height: '28px', backgroundColor: '#E5E7EB' }} />

            {/* Quotes Count */}
            <div>
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px', lineHeight: '1' }}>Quotes</div>
              <div style={{ fontSize: '15px', color: '#1F2937', fontWeight: 700, lineHeight: '1.4' }}>{quotes.length.toLocaleString()}</div>
            </div>

            {/* Spacer to push controls to the right */}
            <div style={{ flex: 1 }} />

            {/* Board Controls — Group By + Time Duration */}
            <div className="flex items-center" style={{ gap: '6px', flexShrink: 0 }}>
              {/* Group By Dropdown */}
              {onGroupByChange && (
                <div ref={groupByRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowGroupByDropdown(!showGroupByDropdown)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      height: '32px', padding: '0 10px 0 12px',
                      border: '1px solid #E5E7EB', borderRadius: '6px',
                      cursor: 'pointer', backgroundColor: '#FFFFFF',
                      transition: 'all 120ms', fontFamily: 'Inter, system-ui, sans-serif',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                  >
                    <CurrentGroupByIcon style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                      {groupBy === 'none' ? 'Group By' : currentGroupBy.label}
                    </span>
                    <ChevronDown style={{ width: '14px', height: '14px', color: '#9CA3AF', transition: 'transform 150ms', transform: showGroupByDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </button>

                  {showGroupByDropdown && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                      width: '220px', backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB', borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                      zIndex: 50, overflow: 'hidden', padding: '4px 0',
                    }}>
                      {groupByOptions.map(option => {
                        const isSelected = groupBy === option.value;
                        const OptionIcon = option.icon;
                        return (
                          <button
                            key={option.value}
                            onClick={() => { onGroupByChange(option.value); setShowGroupByDropdown(false); }}
                            style={{
                              display: 'flex', alignItems: 'center', width: '100%',
                              padding: '8px 12px', gap: '10px', cursor: 'pointer',
                              border: 'none', backgroundColor: 'transparent',
                              transition: 'background-color 100ms',
                              fontFamily: 'Inter, system-ui, sans-serif',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '6px',
                              backgroundColor: isSelected ? '#EFF6FF' : '#F9FAFB',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              <OptionIcon style={{ width: '15px', height: '15px', color: isSelected ? '#1B6EF3' : '#6B7280' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                              <div style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1.3' }}>{option.label}</div>
                              <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1.3' }}>{option.description}</div>
                            </div>
                            {isSelected && <Check style={{ width: '14px', height: '14px', color: '#1B6EF3', flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Time Duration Dropdown */}
              <div ref={timeDurationRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowTimeDurationDropdown(!showTimeDurationDropdown)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    height: '32px', padding: '0 10px 0 12px',
                    border: '1px solid #E5E7EB', borderRadius: '6px',
                    cursor: 'pointer', backgroundColor: '#FFFFFF',
                    transition: 'all 120ms', fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  <Calendar style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
                    {currentTimeDuration.label}
                  </span>
                  <ChevronDown style={{ width: '14px', height: '14px', color: '#9CA3AF', transition: 'transform 150ms', transform: showTimeDurationDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>

                {showTimeDurationDropdown && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                    width: '180px', backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB', borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                    zIndex: 50, overflow: 'hidden', padding: '4px 0',
                  }}>
                    {timeDurationOptions.map(option => {
                      const isSelected = timeDuration === option.value;
                      return (
                        <button
                          key={option.value}
                          onClick={() => { setTimeDuration(option.value); setShowTimeDurationDropdown(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', width: '100%',
                            padding: '8px 12px', gap: '8px', cursor: 'pointer',
                            border: 'none', backgroundColor: 'transparent',
                            transition: 'background-color 100ms',
                            fontFamily: 'Inter, system-ui, sans-serif',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: isSelected ? '#1B6EF3' : '#1F2937', textAlign: 'left' }}>
                            {option.label}
                          </span>
                          {isSelected && <Check style={{ width: '14px', height: '14px', color: '#1B6EF3', flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>}

        {/* Kanban board surface — viewport-locked architecture.
         *
         * Outer container is pinned to the board's available height with
         * `overflow-x: auto / overflow-y: hidden`, so the only horizontal
         * scrollbar in the app lives here. The vertical axis is owned
         * independently by each column's body, which keeps long pipelines
         * scrollable without dragging the column headers off-screen and
         * without nesting two scroll surfaces along the same axis.
         *
         * `items-stretch` forces each column to fill the board height so
         * the column footers (page button / empty state) anchor cleanly
         * to the bottom even when a column is empty.
         */}
        <div
          className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#D1D5DB #F3F4F6' }}
        >
          <div
            className="flex items-stretch h-full"
            style={{ padding: '20px', gap: '14px' }}
          >
            {KANBAN_COLUMNS.filter(col => activeColumns.includes(col.status)).map((column) => {
              const columnQuotes = quotes.filter(q => q.status === column.status);
              return (
                <KanbanColumn
                  key={column.status}
                  status={column.status}
                  label={column.label}
                  dotColor={column.dotColor}
                  tint={column.tint}
                  tintBorder={column.tintBorder}
                  quotes={columnQuotes}
                  allQuotes={quotes}
                  groupBy={groupBy}
                  onDrop={handleDrop}
                  onQuoteClick={onQuoteClick}
                  searchTerm={searchTerm}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Status transition overlay animation — unified across modules */}
      {transitionInfo && (() => {
        const visual = KANBAN_TRANSITION_VISUALS[transitionInfo.toStatus];
        const fromLabel = getColumnMeta(transitionInfo.fromStatus).label;
        const toLabel = getColumnMeta(transitionInfo.toStatus).label;
        return (
          <StateTransitionOverlay
            isActive={true}
            fromLabel={fromLabel}
            toLabel={toLabel}
            tone={visual?.tone ?? 'neutral'}
            Icon={visual?.Icon}
            heading={visual?.heading}
            meta={transitionInfo.quoteNumber}
            onComplete={() => setTransitionInfo(null)}
          />
        );
      })()}

      {/* Convert to SO Modal — reuses the full modal from details page */}
      {convertModal && (() => {
        const q = quotes.find(qq => qq.id === convertModal.quoteId);
        return (
          <ConvertToSOModal
            isOpen
            quoteNumber={convertModal.quoteNumber}
            customerName={q?.customer.name ?? ''}
            onClose={() => setConvertModal(null)}
            onConfirm={(_data) => {
              applyTransition(convertModal.quoteId, convertModal.from, 'Confirmed SO');
              setConvertModal(null);
            }}
          />
        );
      })()}

      <InactiveItemsWarningModal
        open={!!inactiveGuard}
        mode="send"
        lines={inactiveGuard ? warningLinesFor(inactiveGuard.quoteId) : []}
        noun="quote"
        onClose={() => setInactiveGuard(null)}
        onConfirm={() => {
          const target = inactiveGuard;
          setInactiveGuard(null);
          if (target) setSendModal(target);
        }}
      />

      {/* Send to Customer — reuses the full SendToCustomerModal from the
          details page so the kanban drop carries the same recipient picker,
          attachments, and "Mark as Sent" flow. */}
      {sendModal && (() => {
        const q = quotes.find(qq => qq.id === sendModal.quoteId);
        return (
          <SendToCustomerModal
            isOpen
            quoteNumber={sendModal.quoteNumber}
            customerName={q?.customer?.name ?? ''}
            mode="send"
            onClose={() => setSendModal(null)}
            onSend={() => {
              applyTransition(sendModal.quoteId, 'Draft', 'Sent to Customer');
              setSendModal(null);
            }}
          />
        );
      })()}

      {/* Cancel — Converted → Cancelled uses the blocking CancelConvertedQuoteModal
          (matrix: "only if no active SO"). Every other origin uses the
          standard CancelQuoteModal with reason textarea. */}
      {cancelModal && cancelModal.from === 'Confirmed SO' && (() => {
        const q = quotes.find(qq => qq.id === cancelModal.quoteId);
        const soNum = (q as any)?.salesOrderNumber ?? (q as any)?.linkedSO?.number ?? '';
        return (
          <CancelConvertedQuoteModal
            isOpen
            quoteNumber={cancelModal.quoteNumber}
            salesOrderNumber={soNum}
            actionType="cancel"
            onClose={() => setCancelModal(null)}
            onNavigateToSO={() => { setCancelModal(null); }}
          />
        );
      })()}
      {cancelModal && cancelModal.from !== 'Confirmed SO' && (
        <CancelQuoteModal
          isOpen
          quoteNumber={cancelModal.quoteNumber}
          onCancel={() => setCancelModal(null)}
          onConfirm={(_reason) => {
            applyTransition(cancelModal.quoteId, cancelModal.from, 'Cancelled');
            toast.success(`Quote ${cancelModal.quoteNumber} cancelled`, { position: 'top-right' });
            setCancelModal(null);
          }}
        />
      )}

      {/* Cancelled → Draft — full ReviveCancelledModal from details page
          (shows original cancellation reason, bumps version, asks for new
          expiry date). */}
      {reviveModal && (() => {
        const q = quotes.find(qq => qq.id === reviveModal.quoteId);
        return (
          <ReviveCancelledModal
            quoteNumber={reviveModal.quoteNumber}
            customerName={q?.customer?.name ?? ''}
            currentVersion={(q as any)?.version ?? 1}
            statusBeforeCancellation={(q as any)?.statusBeforeCancellation ?? 'Draft'}
            cancellationReason={(q as any)?.cancellationReason ?? null}
            onClose={() => setReviveModal(null)}
            onConfirm={(_newExpiryDate) => {
              applyTransition(reviveModal.quoteId, 'Cancelled', 'Draft');
              setReviveModal(null);
            }}
          />
        );
      })()}

      {/* Expired → Draft — full ReviveQuoteModal from details page (new
          expiry date picker, optional respond-by date, resend checkbox). */}
      {expiredReviveModal && (() => {
        const q = quotes.find(qq => qq.id === expiredReviveModal.quoteId);
        return (
          <ReviveQuoteModal
            quoteNumber={expiredReviveModal.quoteNumber}
            customerName={q?.customer?.name ?? ''}
            originalExpiryDate={(q as any)?.expiryDate ?? ''}
            onClose={() => setExpiredReviveModal(null)}
            onConfirm={(_newExpiryDate, _respondByDate, _resendToCustomer) => {
              applyTransition(expiredReviveModal.quoteId, 'Expired', 'Draft');
              setExpiredReviveModal(null);
            }}
          />
        );
      })()}
    </DndProvider>
  );
}

/* ─── Board Column Config Sidebar ─── */

interface BoardColumnConfigSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  visibleColumns: QuoteStatus[];
  onSave: (columns: QuoteStatus[]) => void;
}

export function BoardColumnConfigSidebar({ isOpen, onClose, visibleColumns, onSave }: BoardColumnConfigSidebarProps) {
  const [selected, setSelected] = useState<QuoteStatus[]>(visibleColumns);
  useEffect(() => { setSelected(visibleColumns); }, [visibleColumns]);
  if (!isOpen) return null;
  const toggle = (s: QuoteStatus) => setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const visibleCount = selected.length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className="fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col"
        style={{ width: '384px', borderLeft: '1px solid #E5E7EB' }}
      >
        {/* Header */}
        <div className="flex-shrink-0" style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937' }}>
              Configure Board Columns
            </h3>
            <button
              onClick={onClose}
              className="flex items-center justify-center"
              style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', transition: 'background-color 120ms' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X style={{ width: '18px', height: '18px', color: '#6B7280' }} />
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.5' }}>
            {visibleCount} of {KANBAN_COLUMNS.length} columns visible · Toggle to show or hide columns on the board
          </p>
        </div>

        {/* Column List */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '16px 24px', scrollbarWidth: 'thin' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {KANBAN_COLUMNS.map(col => {
              const isActive = selected.includes(col.status);
              return (
                <button
                  key={col.status}
                  onClick={() => toggle(col.status)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    width: '100%', padding: '10px 12px',
                    borderRadius: '8px', cursor: 'pointer',
                    border: isActive ? '1px solid transparent' : '1px dashed #E5E7EB',
                    backgroundColor: isActive ? '#F7F8F9' : '#FFFFFF',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = isActive ? '#EFF6FF' : '#F9FAFB'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? '#F7F8F9' : '#FFFFFF'; }}
                >
                  {/* Checkbox */}
                  <div
                    style={{
                      width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: isActive ? 'none' : '2px solid #D1D5DB',
                      backgroundColor: isActive ? col.dotColor : 'transparent',
                      transition: 'all 150ms',
                    }}
                  >
                    {isActive && <Check style={{ width: '12px', height: '12px', color: '#FFFFFF' }} />}
                  </div>

                  {/* Dot */}
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.dotColor, flexShrink: 0 }} />

                  {/* Label */}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: isActive ? '#1F2937' : '#6B7280', flex: 1, textAlign: 'left' }}>
                    {col.label}
                  </span>

                  {/* Eye icon */}
                  {isActive ? (
                    <Eye style={{ width: '14px', height: '14px', color: '#9CA3AF', flexShrink: 0 }} />
                  ) : (
                    <EyeOff style={{ width: '14px', height: '14px', color: '#D1D5DB', flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0" style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB' }}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelected(ALL_STATUSES)}
              style={{ fontSize: '12px', color: '#1B6EF3', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Select All
            </button>
            <div className="flex items-center" style={{ gap: '8px' }}>
              <button
                onClick={onClose}
                style={{
                  height: '32px', padding: '0 16px',
                  fontSize: '13px', fontWeight: 500, color: '#6B7280',
                  border: '1px solid #E5E7EB', borderRadius: '6px',
                  backgroundColor: '#FFFFFF', cursor: 'pointer',
                  transition: 'all 120ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                Cancel
              </button>
              <button
                onClick={() => { onSave(selected); onClose(); }}
                style={{
                  height: '32px', padding: '0 16px',
                  fontSize: '13px', fontWeight: 500, color: '#FFFFFF',
                  border: 'none', borderRadius: '6px',
                  backgroundColor: '#1B6EF3', cursor: 'pointer',
                  transition: 'all 120ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0D5ED7')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#1B6EF3')}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** @deprecated Use BoardColumnConfigSidebar instead */
export const BoardColumnConfigModal = BoardColumnConfigSidebar;

/* ═══════════════════════════════════════════════════════════════════════
 *  Column
 * ═══════════════════════════════════════════════════════════════════════ */

interface KanbanColumnProps {
  status: QuoteStatus;
  label: string;
  dotColor: string;
  tint: string;
  tintBorder: string;
  quotes: Quote[];
  allQuotes: Quote[];
  groupBy: 'none' | 'salesRep' | 'customer' | 'priority';
  onDrop: (quoteId: string, fromStatus: QuoteStatus, toStatus: QuoteStatus) => void;
  onQuoteClick: (quoteId: string) => void;
  searchTerm: string;
}

function KanbanColumn({ status, label, dotColor, tint, tintBorder, quotes, allQuotes, groupBy, onDrop, onQuoteClick, searchTerm }: KanbanColumnProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [showSort, setShowSort] = useState(false);
  const [sortBy, setSortBy] = useState<'lastUpdated' | 'value' | 'created' | 'expiry'>('lastUpdated');
  /* Direction is independent of the criterion — picking Asc/Desc never
     clears the criterion and vice versa. Descending is the default per
     the design spec. */
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Pagination is applied to EVERY column (not just Expired/Cancelled). Each
  // column starts with the first 40 cards visible; clicking "Show N more"
  // reveals 40 more, until everything is in view. Keeps long pipelines
  // scrollable rather than dumping hundreds of cards into a single column.
  const PAGE_SIZE = 40;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(groupName) ? next.delete(groupName) : next.add(groupName);
      return next;
    });
  };

  // ── Drag rules: allow backward dragging freely, terminal states → draft only ──
  const TERMINAL_STATUSES: QuoteStatus[] = ['Cancelled', 'Archived', 'Expired'];
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'QUOTE_CARD',
    drop: (item: { quoteId: string; currentStatus: QuoteStatus }) => {
      if (item.currentStatus !== status) onDrop(item.quoteId, item.currentStatus, status);
    },
    canDrop: (item: { currentStatus: QuoteStatus }) => {
      if (item.currentStatus === status) return false;
      // From terminal status → only Draft allowed
      if (TERMINAL_STATUSES.includes(item.currentStatus)) {
        return status === 'Draft';
      }
      // Otherwise, allow any movement (forward or backward)
      return true;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  const totalValue = quotes.reduce((sum, q) => sum + q.totalValue, 0);

  const activeSearchTerm = localSearchTerm || searchTerm;
  let processedQuotes = quotes;
  if (activeSearchTerm) {
    processedQuotes = quotes.filter(q =>
      q.quoteNumber.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
      (q.customer?.name ?? '').toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
      (q.primaryPoC?.name ?? '').toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
      (q.salesRep?.name ?? '').toLowerCase().includes(activeSearchTerm.toLowerCase())
    );
  }

  /* Sort comparator — compute the "natural descending" delta for the
     chosen criterion, then flip its sign when ascending. Keeping the
     direction multiplier external means criterion and direction stay
     independent (per spec). */
  processedQuotes = [...processedQuotes].sort((a, b) => {
    const dirMul = sortDir === 'asc' ? -1 : 1;
    let delta = 0;
    switch (sortBy) {
      case 'value':
        delta = b.totalValue - a.totalValue;
        break;
      case 'created':
        delta = new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
        break;
      case 'expiry':
        delta = new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime();
        break;
      default:
        delta = new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    }
    return delta * dirMul;
  });

  const groupedQuotes = (() => {
    if (groupBy === 'none') return { All: processedQuotes };
    const acc = processedQuotes.reduce((m, quote) => {
      const key = groupBy === 'salesRep'
        ? (quote.salesRep?.name || FIELD_RULES.salesRep.emptyLabel)
        : groupBy === 'customer'
          ? (quote.customer?.name ?? '')
          : quote.priority;
      if (!m[key]) m[key] = [];
      m[key].push(quote);
      return m;
    }, {} as Record<string, Quote[]>);

    /* Priority groupings have a canonical lifecycle order
       (Low → Standard → High, ascending). Object insertion order is
       preserved in modern JS, so we rebuild the bucket in that order
       and let `sortDir` flip it when descending. Legacy values
       ("Urgent"/"Medium") are mapped through `PRIORITY_LABEL` so they
       still slot into the right bucket. */
    if (groupBy === 'priority') {
      const order = ['Low', 'Standard', 'High'];
      const ordered: Record<string, Quote[]> = {};
      const keys = (sortDir === 'desc' ? [...order].reverse() : order)
        .filter(k => acc[k]);
      keys.forEach(k => { ordered[k] = acc[k]; });
      // Carry over any non-canonical buckets at the end so we never
      // drop data if the data shape changes.
      Object.keys(acc).forEach(k => { if (!ordered[k]) ordered[k] = acc[k]; });
      return ordered;
    }
    return acc;
  })();

  return (
    <div
      ref={drop}
      className="flex-shrink-0 flex flex-col h-full"
      style={{ width: '308px', minWidth: '308px' }}
    >
      {/* Column Header — pinned to the top of the column. Lives OUTSIDE
          the scrollable body, so it never moves when the user scrolls
          through cards. The board's outer wrapper owns horizontal scroll;
          the body below owns vertical scroll. */}
      <div
        className="shrink-0"
        style={{
          backgroundColor: '#FFFFFF',
          borderTop: `1px solid ${isOver && canDrop ? dotColor : '#E5E7EB'}`,
          borderLeft: `1px solid ${isOver && canDrop ? dotColor : '#E5E7EB'}`,
          borderRight: `1px solid ${isOver && canDrop ? dotColor : '#E5E7EB'}`,
          borderRadius: '10px 10px 0 0',
          padding: '12px 14px',
          transition: 'border-color 200ms ease',
        }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
          <div className="flex items-center" style={{ gap: '8px' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937' }}>{label}</span>
            <span style={{
              fontSize: '11px', fontWeight: 600, color: '#6B7280',
              backgroundColor: '#F3F4F6', borderRadius: '8px', padding: '1px 8px', lineHeight: '1.6',
            }}>
              {quotes.length}
            </span>
          </div>
          <div className="flex items-center" style={{ gap: '2px' }}>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="w-7 h-7 flex items-center justify-center transition-colors"
              style={{ borderRadius: '4px', backgroundColor: showSearch ? '#F3F4F6' : 'transparent' }}
              onMouseEnter={e => !showSearch && (e.currentTarget.style.backgroundColor = '#F3F4F6')}
              onMouseLeave={e => !showSearch && (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Search style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowSort(!showSort)}
                className="w-7 h-7 flex items-center justify-center transition-colors"
                style={{ borderRadius: '4px', backgroundColor: showSort ? '#F3F4F6' : 'transparent' }}
                onMouseEnter={e => !showSort && (e.currentTarget.style.backgroundColor = '#F3F4F6')}
                onMouseLeave={e => !showSort && (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ArrowUpDown style={{ width: '14px', height: '14px', color: (sortBy !== 'lastUpdated' || sortDir !== 'desc') ? '#0A77FF' : '#9CA3AF' }} />
              </button>
              {showSort && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[#E5E7EB] shadow-lg z-20 py-1" style={{ borderRadius: '8px' }}>
                    <div className="px-3 py-2 text-[11px] text-[#6B7280] uppercase tracking-wide" style={{ fontWeight: 500 }}>Sort By</div>
                    {[
                      { value: 'lastUpdated', label: 'Last Updated' },
                      { value: 'value', label: 'Quote Value' },
                      { value: 'created', label: 'Creation Date' },
                      { value: 'expiry', label: 'Expiration Date' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        /* Criterion click only updates the criterion — the
                           direction selection (below the divider) is kept
                           intact. Dropdown stays open so the user can
                           pick both in one pass. */
                        onClick={() => setSortBy(opt.value as any)}
                        className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#F9FAFB] transition-colors flex items-center justify-between"
                        style={{ color: sortBy === opt.value ? '#1B6EF3' : '#374151' }}
                      >
                        {opt.label}
                        {sortBy === opt.value && <span style={{ color: '#1B6EF3' }}>✓</span>}
                      </button>
                    ))}
                    {/* Divider between criterion options and direction options */}
                    <div className="my-1 h-px bg-[#E5E7EB]" />
                    {([
                      { value: 'desc', label: 'Descending' },
                      { value: 'asc',  label: 'Ascending' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setSortDir(opt.value)}
                        className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#F9FAFB] transition-colors flex items-center justify-between"
                        style={{ color: sortDir === opt.value ? '#1B6EF3' : '#374151' }}
                      >
                        {opt.label}
                        {sortDir === opt.value && <span style={{ color: '#1B6EF3' }}>✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              className="w-7 h-7 flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing"
              style={{ borderRadius: '4px' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <GripVertical style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
            </button>
          </div>
        </div>

        {showSearch && (
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text" value={localSearchTerm} onChange={e => setLocalSearchTerm(e.target.value)}
              placeholder="Search quotes..."
              className="w-full h-8 px-3 text-[13px] border border-[#E5E7EB] focus:outline-none focus:border-[#1B6EF3] bg-white transition-colors"
              style={{ borderRadius: '6px' }}
              autoFocus
            />
          </div>
        )}

        <div className="flex items-center justify-between" style={{ padding: '8px 12px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
          <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>Total Value</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#1F2937' }}>{formatCurrency(totalValue)}</span>
        </div>
      </div>

      {/* Column Body — owns vertical scroll independently. `flex-1
          min-h-0` lets it fill whatever vertical space the column has
          (the board height minus the fixed header). Scrolls cleanly on
          its own without dragging the header off-screen.
          `overscrollBehaviorY: contain` stops VERTICAL over-scroll from
          bubbling to the board, but leaves the horizontal axis alone
          so a trackpad swipe over a column still pans the board. The
          previous shorthand `overscrollBehavior: contain` also
          contained the X axis, which is why horizontal scroll/kinetic
          swipes dead-ended when the cursor was inside a column. */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{
          position: 'relative',
          zIndex: 0,
          backgroundColor: isOver && canDrop ? `${dotColor}08` : tint,
          borderLeft: `1px solid ${isOver && canDrop ? dotColor : tintBorder}`,
          borderRight: `1px solid ${isOver && canDrop ? dotColor : tintBorder}`,
          borderBottom: `1px solid ${isOver && canDrop ? dotColor : tintBorder}`,
          borderRadius: '0 0 10px 10px',
          padding: '8px',
          transition: 'background-color 250ms ease, border-color 200ms ease',
          scrollbarWidth: 'thin',
          scrollbarColor: '#D1D5DB transparent',
          overscrollBehaviorY: 'contain',
          overscrollBehaviorX: 'auto',
        }}
        onWheel={(e) => {
          /* Belt-and-suspenders: if the wheel event carries a
             horizontal delta (trackpad swipe, shift-wheel), forward
             that scroll to the board's nearest `overflow-x: auto`
             ancestor. `overscrollBehavior` alone handles most
             cases, but some browsers still intercept horizontal
             wheel deltas on a vertically-scrollable child. */
          if (!e.deltaX || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
          let node: HTMLElement | null = e.currentTarget.parentElement;
          while (node) {
            const cs = window.getComputedStyle(node);
            if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && node.scrollWidth > node.clientWidth) {
              node.scrollLeft += e.deltaX;
              break;
            }
            node = node.parentElement;
          }
        }}
      >
        {Object.entries(groupedQuotes).map(([groupName, groupQuotes]) => {
          const isCollapsed = collapsedGroups.has(groupName);
          return (
            <div key={groupName} style={{ marginBottom: groupBy !== 'none' ? '8px' : '0' }}>
              {groupBy !== 'none' && (
                <button
                  onClick={() => toggleGroupCollapse(groupName)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '7px 10px',
                    marginBottom: isCollapsed ? '0' : '6px',
                    cursor: 'pointer', background: '#FFFFFF',
                    border: '1px solid #E5E7EB', borderRadius: '6px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {groupName}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: 600, color: '#6B7280',
                      backgroundColor: '#F3F4F6', borderRadius: '8px', padding: '1px 6px',
                      lineHeight: '1.5', flexShrink: 0,
                    }}>
                      {groupQuotes.length}
                    </span>
                  </div>
                  <ChevronRight style={{
                    width: '12px', height: '12px', color: '#9CA3AF', flexShrink: 0,
                    transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                    transition: 'transform 150ms ease',
                  }} />
                </button>
              )}
              {!isCollapsed && (() => {
                // Load-more pagination — applies to every column. We hold one
                // `visibleCount` per column (state above); when group-by is on,
                // the same cap applies across the column's groups summed
                // (otherwise long columns with many groups would render
                // everything via the slice-per-group shortcut). Here we use a
                // per-group view of the same global cap by slicing per group
                // off the total visible budget.
                const totalCards = processedQuotes.length;
                const cap = Math.min(visibleCount, totalCards);
                const remaining = Math.max(0, totalCards - cap);
                // Per-group slice from the global cap, in render order.
                // Compute index of first quote in this group, then take up to
                // (cap - cardsBeforeGroup) from it.
                const groupOffset = (() => {
                  let acc = 0;
                  for (const [g, qs] of Object.entries(groupedQuotes)) {
                    if (g === groupName) return acc;
                    acc += qs.length;
                  }
                  return acc;
                })();
                const groupBudget = Math.max(0, cap - groupOffset);
                const displayQuotes = groupQuotes.slice(0, groupBudget);
                const isLastGroup = (() => {
                  const keys = Object.keys(groupedQuotes);
                  return keys[keys.length - 1] === groupName;
                })();
                const nextChunk = Math.min(40, remaining);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {displayQuotes.map(quote => (
                      <QuoteCard
                        key={quote.id}
                        quote={quote}
                        onQuoteClick={onQuoteClick}
                        searchTerm={activeSearchTerm}
                        columnStatus={status}
                        accentColor={dotColor}
                      />
                    ))}
                    {/* Render the "Show N more" button once per column,
                        anchored to the last visible group so it sits at the
                        bottom of the column. */}
                    {isLastGroup && remaining > 0 && (
                      <button
                        onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          width: '100%', padding: '10px 12px',
                          background: 'rgba(255,255,255,0.85)',
                          border: '1px dashed #D1D5DB', borderRadius: '8px',
                          cursor: 'pointer', transition: 'all 150ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#9CA3AF'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.85)'; }}
                      >
                        <ChevronDown style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>
                          Show {nextChunk} more {nextChunk === 1 ? 'quote' : 'quotes'}
                        </span>
                      </button>
                    )}
                    {isLastGroup && visibleCount > PAGE_SIZE && (
                      <button
                        onClick={() => setVisibleCount(PAGE_SIZE)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '100%', padding: '6px 12px',
                          background: 'transparent', border: 'none', borderRadius: '8px',
                          cursor: 'pointer', transition: 'all 150ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.7)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF' }}>Show less</span>
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
        {processedQuotes.length === 0 && (
          <div className="flex items-center justify-center py-12 text-[13px] text-[#9CA3AF]">
            {activeSearchTerm ? 'No matching quotes' : 'No quotes in this stage'}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 *  Card
 * ═══════════════════════════════════════════════════════════════════════ */

interface QuoteCardProps {
  quote: Quote;
  onQuoteClick: (quoteId: string) => void;
  searchTerm: string;
  columnStatus: QuoteStatus;
  accentColor: string;
}

function QuoteCard({ quote, onQuoteClick, searchTerm, columnStatus, accentColor }: QuoteCardProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'QUOTE_CARD',
    item: { quoteId: quote.id, currentStatus: quote.status },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }));

  const [isHovered, setIsHovered] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionBadgeHovered, setVersionBadgeHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced hover to prevent jitter with scrolling
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(true), 60);
  };
  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(false);
  };

  useEffect(() => {
    return () => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); };
  }, []);

  const winProb = quote.winProbability || 0;

  /* ── Card status footer copy ─────────────────────────────────────────
   * Per the lifecycle spec, the line at the bottom of each card reads:
   *
   *   Draft               "Created X days/months ago"
   *   Sent to Customer    "Sent X days/months ago", or
   *                       "Expires in X days" when fewer than 7 days remain
   *   Confirmed by Cust.  "Confirmed X days/months ago"
   *   Converted to SO     "Converted X days/months ago"
   *   Expired             "Expired X days/months ago"
   *   Cancelled           "Cancelled X days/months ago"
   *   Archived            "Archived X days/months ago" (parity, not in spec)
   *
   * Threshold: 1 to 30 days uses days. 31 to 60 days reads "1 month
   * ago", 61 to 90 reads "2 months ago", and so on. Past 365 days the
   * unit flips to years for readability.
   *
   * Day math is whole-day-floored from `now`. Same-day timestamps clamp
   * to 0 so future-dated mocks read "Created 0 days ago" instead of a
   * negative number. */
  const getStatusFooter = () => {
    const now = new Date();
    const daysSince = (d: Date | string | undefined) => {
      if (!d) return 0;
      return Math.max(0, Math.floor((now.getTime() - new Date(d).getTime()) / 86400000));
    };
    /* Spec wording: "If days > 30, changes to months. If between 31 to
       60 days, then it's 1 month ago and so on." So day 30 still reads
       as days, day 31 to 60 reads as 1 month, day 61 to 90 as 2 months,
       etc. `Math.ceil((days - 30) / 30)` lands the bucket boundaries
       exactly where the spec puts them. */
    const fmt = (d: Date | string | undefined) => {
      const days = daysSince(d);
      if (days <= 30) return `${days} ${days === 1 ? 'day' : 'days'}`;
      if (days <= 365) {
        const m = Math.ceil((days - 30) / 30);
        return `${m} ${m === 1 ? 'month' : 'months'}`;
      }
      const y = Math.floor(days / 365);
      return `${y} ${y === 1 ? 'year' : 'years'}`;
    };
    const daysUntilExpiry = () => {
      if (!quote.expiryDate) return Infinity;
      return Math.floor((new Date(quote.expiryDate).getTime() - now.getTime()) / 86400000);
    };

    // Terminal/non-pending states first — these never show the expiry override.
    if (columnStatus === 'Unconfirmed SO') {
      return { icon: <CheckCircle2 style={{ width: '11px', height: '11px' }} />, text: `Confirmed ${fmt(quote.confirmationDate ?? quote.lastUpdated)} ago`, color: '#7C3AED' };
    }
    if (columnStatus === 'Confirmed SO') {
      return { icon: <CheckCircle2 style={{ width: '11px', height: '11px' }} />, text: `Converted ${fmt(quote.lastUpdated)} ago`, color: '#16A34A' };
    }
    if (columnStatus === 'Expired') {
      return { icon: <AlertTriangle style={{ width: '11px', height: '11px' }} />, text: `Expired ${fmt(quote.expiryDate)} ago`, color: '#DC2626' };
    }
    if (columnStatus === 'Cancelled') {
      return { icon: <Ban style={{ width: '11px', height: '11px' }} />, text: `Cancelled ${fmt(quote.lastUpdated)} ago`, color: '#DC2626' };
    }
    if (columnStatus === 'Archived') {
      return { icon: <Archive style={{ width: '11px', height: '11px' }} />, text: `Archived ${fmt(quote.lastUpdated)} ago`, color: '#6B7280' };
    }

    // Draft: relative "Created X days/months ago" per spec. The expiry
    // window only becomes customer-facing once the quote is sent, so
    // Draft never falls into the expiry override below.
    if (columnStatus === 'Draft') {
      return { icon: <FileText style={{ width: '11px', height: '11px' }} />, text: `Created ${fmt(quote.createdDate)} ago`, color: '#6B7280' };
    }

    // Sent to Customer — fewer-than-7-days-to-expiry override per spec
    // takes precedence over the base "Sent X days ago" copy.
    const left = daysUntilExpiry();
    if (left < 0) {
      // Already past expiry while still in a pending column — surface it.
      return { icon: <AlertTriangle style={{ width: '11px', height: '11px' }} />, text: `Expired ${Math.abs(left)} ${Math.abs(left) === 1 ? 'day' : 'days'} ago`, color: '#DC2626' };
    }
    if (left < 7) {
      return { icon: <Clock style={{ width: '11px', height: '11px' }} />, text: `Expires in ${left} ${left === 1 ? 'day' : 'days'}`, color: '#DC2626' };
    }

    if (columnStatus === 'Sent to Customer') {
      return { icon: <Send style={{ width: '11px', height: '11px' }} />, text: `Sent ${fmt(quote.lastUpdated)} ago`, color: '#1E40AF' };
    }
    // Fallback (shouldn't be hit — Draft handled above, Sent above, terminals earlier).
    return { icon: <FileText style={{ width: '11px', height: '11px' }} />, text: `Created ${fmt(quote.createdDate)} ago`, color: '#6B7280' };
  };

  const footer = getStatusFooter();

  // (date removed from card — quote number shown instead)

  return (
    <div
      ref={drag}
      className={`cursor-pointer ${isDragging ? 'opacity-30 scale-95' : ''}`}
      style={{
        position: 'relative',
        backgroundColor: isHovered ? '#FAFBFC' : '#FFFFFF',
        borderRadius: '10px',
        border: `1px solid ${isHovered ? '#CBD5E1' : '#E2E8F0'}`,
        boxShadow: isHovered ? '0 6px 16px -4px rgba(15,23,42,0.10), 0 2px 4px rgba(15,23,42,0.04)' : '0 1px 2px rgba(15,23,42,0.04)',
        transform: isHovered && !isDragging ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all 200ms ease',
        overflow: 'hidden',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      /* Tap anywhere on the card opens the quote detail page. Interactive
         children (Version badge, action menus, etc.) stop propagation in
         their own onClick handlers; the target-guard below early-returns
         if the click actually landed on a button/input so the user can
         still operate inline controls without bubbling to navigate. */
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest('button, input, select, a, [role="button"], [data-no-card-click]')) return;
        if (isDragging) return;
        onQuoteClick(quote.id);
      }}
    >
      {/* Thin top accent */}
      <div style={{ height: '2px', backgroundColor: accentColor, opacity: isHovered ? 1 : 0.4, transition: 'opacity 200ms ease' }} />

      <div style={{ padding: '14px' }}>
        {/* Row 1: Quote number on left, Version on right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <button
            onClick={() => onQuoteClick(quote.id)}
            style={{
              fontSize: '11px', fontWeight: 500, color: '#9CA3AF', lineHeight: '1',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              letterSpacing: '0.2px',
            }}
          >
            <HighlightText text={quote.quoteNumber} searchTerm={searchTerm} />
          </button>
          <div
            onMouseEnter={() => setVersionBadgeHovered(true)}
            onMouseLeave={() => setVersionBadgeHovered(false)}
          >
            <VersionBadge
              onClick={(e) => { e.stopPropagation(); setShowVersionHistory(true); }}
              version={quote.version}
              compact
              showExpandIcon={versionBadgeHovered}
            />
          </div>
        </div>

        {/* Row 2: Customer avatar + name + Description */}
        <div
          onClick={() => onQuoteClick(quote.id)}
          style={{ cursor: 'pointer', marginBottom: '12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            {(() => {
              const t = getCardAvatarTint(quote.customer?.name ?? '');
              const initials = (quote.customer?.name ?? '').split(/[\s&]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
              return (
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', backgroundColor: t.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '8px', fontWeight: 700, color: t.fg, flexShrink: 0,
                }}>
                  {initials}
                </div>
              );
            })()}
            <div style={{
              fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1.4',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
            }}>
              <HighlightText text={quote.customer.name} searchTerm={searchTerm} />
            </div>
          </div>
          <div style={{
            fontSize: '11.5px', color: '#9CA3AF', lineHeight: '1.4',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            paddingLeft: '28px',
          }}>
            {quote.description ? (
              <HighlightText text={quote.description} searchTerm={searchTerm} />
            ) : (
              <>
                <HighlightText text={quote.primaryPoC?.name || FIELD_RULES.poc.emptyLabel} searchTerm={searchTerm} />
                {` · ${String(quote.createdDate.getMonth() + 1).padStart(2, '0')}/${String(quote.createdDate.getDate()).padStart(2, '0')}`}
              </>
            )}
          </div>
        </div>

        {/* Row 3: Value + Priority Badge */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1F2937', lineHeight: '1.2' }}>
              {formatCurrency(quote.totalValue)}
            </div>
            <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 400, marginTop: '2px', lineHeight: '1' }}>Quote Value</div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            {(() => {
              const ps = PRIORITY_STYLES[quote.priority] || PRIORITY_STYLES.Standard;
              const displayLabel = PRIORITY_LABEL[quote.priority] ?? quote.priority;
              return (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  fontSize: '10px', fontWeight: 600, lineHeight: '1',
                  padding: '3px 8px', borderRadius: '4px',
                  backgroundColor: ps.bg, color: ps.text, border: `1px solid ${ps.border}`,
                }}>
                  {displayLabel}
                </span>
              );
            })()}
            <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 400, marginTop: '3px', lineHeight: '1' }}>Priority</div>
          </div>
        </div>

        {/* Row 4: Win Prob + Expiry (compact info row) */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid #F1F5F9', paddingTop: '10px', marginBottom: '10px',
        }}>
          {/* Win probability — matches the Deal Information tab thresholds
              (70%+ green, 40-69% amber, <40% red). The icon swaps to
              TrendingDown for anything under 50% to telegraph that the
              deal is slipping. */}
          {(() => {
            const winColor =
              winProb >= 70 ? 'var(--success)' :
              winProb >= 40 ? 'var(--warning)' :
              'var(--destructive)';
            const WinIcon = winProb < 50 ? TrendingDown : TrendingUp;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <WinIcon style={{ width: '11px', height: '11px', color: winColor }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>{winProb}%</span>
                <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 400 }}>Win Prob</span>
              </div>
            );
          })()}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar style={{ width: '11px', height: '11px', color: '#6B7280' }} />
            <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>
              {quote.expiryDate ? `${String(new Date(quote.expiryDate).getMonth() + 1).padStart(2, '0')}/${String(new Date(quote.expiryDate).getDate()).padStart(2, '0')}/${new Date(quote.expiryDate).getFullYear()}` : '–'}
            </span>
          </div>
        </div>

        {/* Row 4: Footer — status context line */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid #F1F5F9', paddingTop: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: footer.color }}>
            {footer.icon}
            <span style={{ fontSize: '11px', fontWeight: 500 }}>{footer.text}</span>
          </div>

          {/* Subtle expand hint */}
          <ChevronDown
            style={{
              width: '12px', height: '12px',
              color: isHovered ? '#9CA3AF' : '#D1D5DB',
              transition: 'color 200ms, transform 200ms',
              transform: isHovered ? 'translateY(0)' : 'translateY(0)',
              flexShrink: 0,
            }}
            title="Hover to see more details"
          />
        </div>

        {/* Row 5: People — compact single row, revealed on hover */}
        {isHovered && (() => {
          const recipients: { initials: string; bg: string; color: string; name: string }[] = [];
          if (quote.primaryPoC?.name) {
            recipients.push({
              initials: quote.primaryPoC.name.split(' ').map(n => n[0]).join('').slice(0, 2),
              name: quote.primaryPoC.name, bg: '#1E40AF', color: '#FFFFFF',
            });
          }
          if (quote.additionalPoCs) {
            quote.additionalPoCs.filter(poc => poc?.name).forEach(poc => {
              recipients.push({
                initials: poc.name.split(' ').map(n => n[0]).join('').slice(0, 2),
                name: poc.name, bg: '#059669', color: '#FFFFFF',
              });
            });
          }
          if (quote.additionalSalesReps) {
            quote.additionalSalesReps.filter(rep => rep?.name).forEach(rep => {
              recipients.push({
                initials: rep.name.split(' ').map(n => n[0]).join('').slice(0, 2),
                name: rep.name, bg: '#D97706', color: '#FFFFFF',
              });
            });
          }
          const maxCircles = 3;
          const visibleR = recipients.slice(0, maxCircles);
          const overflowCount = recipients.length - maxCircles;

          return (
            <div style={{
              borderTop: '1px solid #F1F5F9', paddingTop: '10px',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            }}>
              {/* Sales Rep — label + avatar + name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>Sales Representative</span>
                {!quote.salesRep?.name ? (
                  <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 400 }}>{FIELD_RULES.salesRep.emptyLabel}</span>
                ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#D1FAE5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', fontWeight: 700, color: '#065F46', flexShrink: 0,
                  }}>
                    {quote.salesRep.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <span style={{
                    fontSize: '11px', color: '#374151', fontWeight: 500,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    <HighlightText text={quote.salesRep.name} searchTerm={searchTerm} />
                  </span>
                </div>
                )}
              </div>

              {/* Recipients — label + stacked circles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>Point of contacts</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {visibleR.length === 0 && (
                    <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 400 }}>{FIELD_RULES.poc.emptyLabel}</span>
                  )}
                  {visibleR.map((r, i) => (
                    <div
                      key={i}
                      title={r.name}
                      style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        backgroundColor: r.bg, color: r.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '8px', fontWeight: 700,
                        border: '2px solid #FFFFFF',
                        marginLeft: i === 0 ? 0 : '-6px',
                        position: 'relative', zIndex: maxCircles - i,
                        flexShrink: 0,
                      }}
                    >
                      {r.initials}
                    </div>
                  ))}
                  {overflowCount > 0 && (
                    <div
                      title={`${overflowCount} more recipients`}
                      style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        backgroundColor: '#F59E0B', color: '#FFFFFF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '9px', fontWeight: 700,
                        border: '2px solid #FFFFFF',
                        marginLeft: '-6px',
                        position: 'relative', zIndex: 0,
                        flexShrink: 0,
                      }}
                    >
                      +{overflowCount}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Version History Modal — portaled to body to escape overflow containers */}
        {showVersionHistory && ReactDOM.createPortal(
          <VersionHistoryModal
            quoteId={quote.id}
            currentVersion={quote.version}
            onClose={() => setShowVersionHistory(false)}
          />,
          document.body
        )}
      </div>
    </div>
  );
}