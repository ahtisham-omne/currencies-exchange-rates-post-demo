// @ts-nocheck
import { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Search, ArrowUpDown, TrendingUp, GripVertical, Clock, CheckCircle2, AlertTriangle, X, Check, Ban, Archive, ChevronRight, ChevronDown, Users, Building2, Flag, Layers, Eye, EyeOff, Calendar, ArrowRight } from 'lucide-react';
import { Quote, QuoteStatus } from '@/app/types/quote';
import { formatCurrency } from '@/app/utils/quoteUtils';
import { HighlightText } from '@/app/components/HighlightText';
import { VersionBadge } from '@/app/components/VersionBadge';
import { VersionHistoryModal } from '@/app/components/VersionHistoryModal';
import { ConvertToSOModal } from '@/app/components/quote-details/ConvertToSOModal';

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
  { bg: "#EDF4FF", fg: "#0A77FF" },
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

/* ═══ Priority styling ═══ */
const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Urgent: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  Medium: { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" },
  Low:    { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
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
  { status: 'Cancelled',        label: 'Cancelled',              dotColor: '#DC2626', tint: '#FEF2F2', tintBorder: '#FECACA' },
  { status: 'Archived',         label: 'Archived',               dotColor: '#DC2626', tint: '#FEF2F2', tintBorder: '#FECACA' },
];

const ALL_STATUSES = KANBAN_COLUMNS.map(c => c.status);

// ── Status Transition Overlay ──
interface TransitionInfo {
  quoteNumber: string;
  fromLabel: string;
  toLabel: string;
  fromColor: string;
  toColor: string;
}

function StatusTransitionOverlay({ info, onDone }: { info: TransitionInfo; onDone: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('show'), 30);
    const t2 = setTimeout(() => setPhase('exit'), 2200);
    const t3 = setTimeout(onDone, 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  const opacity = phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1;
  const translateY = phase === 'enter' ? '12px' : phase === 'exit' ? '-8px' : '0px';

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', top: '20px', left: '50%', transform: `translateX(-50%) translateY(${translateY})`,
      zIndex: 9999, opacity, transition: 'opacity 300ms ease, transform 300ms ease',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 20px', backgroundColor: '#FFFFFF',
        borderRadius: '10px', border: '1px solid #E5E7EB',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        fontFamily: 'Inter, system-ui, sans-serif', whiteSpace: 'nowrap',
      }}>
        {/* From badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: info.fromColor, flexShrink: 0 }} />
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>{info.fromLabel}</span>
        </div>
        {/* Arrow animation */}
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: '32px', height: '20px' }}>
          <div style={{
            position: 'absolute', left: 0, top: '50%', width: '100%', height: '1px',
            backgroundColor: '#D1D5DB',
          }} />
          <ArrowRight style={{
            width: '14px', height: '14px', color: info.toColor, flexShrink: 0,
            position: 'absolute', right: '-2px', top: '50%', transform: 'translateY(-50%)',
            animation: phase === 'show' ? 'kanbanArrowPulse 800ms ease-in-out infinite alternate' : 'none',
          }} />
        </div>
        {/* To badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: info.toColor, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: info.toColor }}>{info.toLabel}</span>
        </div>
        {/* Quote number */}
        <div style={{ width: '1px', height: '16px', backgroundColor: '#E5E7EB', margin: '0 2px' }} />
        <span style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF', letterSpacing: '0.2px' }}>{info.quoteNumber}</span>
      </div>
      <style>{`@keyframes kanbanArrowPulse { from { transform: translateY(-50%) translateX(-2px); } to { transform: translateY(-50%) translateX(2px); } }`}</style>
    </div>,
    document.body
  );
}

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

  // ── Convert to SO modal state ──
  const [convertModal, setConvertModal] = useState<{ quoteId: string; quoteNumber: string; customerName: string } | null>(null);

  // ── Status transition overlay ──
  const [transitionInfo, setTransitionInfo] = useState<TransitionInfo | null>(null);

  const getColumnMeta = useCallback((status: QuoteStatus) => {
    const col = KANBAN_COLUMNS.find(c => c.status === status);
    return col ? { label: col.label, color: col.dotColor } : { label: status, color: '#6B7280' };
  }, []);

  const handleDrop = useCallback((quoteId: string, fromStatus: QuoteStatus, toStatus: QuoteStatus) => {
    if (fromStatus === toStatus) return;
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return;

    // If dropping to Converted to SO, show confirm modal
    if (toStatus === 'Confirmed SO') {
      setConvertModal({ quoteId, quoteNumber: quote.quoteNumber, customerName: quote.customer.name });
      return;
    }

    // Show transition overlay animation
    const from = getColumnMeta(fromStatus);
    const to = getColumnMeta(toStatus);
    setTransitionInfo({
      quoteNumber: quote.quoteNumber,
      fromLabel: from.label,
      toLabel: to.label,
      fromColor: from.color,
      toColor: to.color,
    });

    // Apply status change
    onStatusChange(quoteId, toStatus);
  }, [quotes, onStatusChange, getColumnMeta]);

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
                      border: '1px solid #E5E7EB', borderRadius: '10px',
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
                    border: '1px solid #E5E7EB', borderRadius: '10px',
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

        {/* Kanban Columns — use absolute positioning for reliable scroll */}
        <div className="relative flex-1 min-h-0">
          <div
            className="absolute inset-0 flex overflow-x-auto"
            style={{
              padding: '20px', gap: '14px',
              scrollbarWidth: 'thin', scrollbarColor: '#D1D5DB #F3F4F6',
            }}
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

      {/* Status transition overlay animation */}
      {transitionInfo && (
        <StatusTransitionOverlay info={transitionInfo} onDone={() => setTransitionInfo(null)} />
      )}

      {/* Convert to SO Modal — reuses the full modal from details page */}
      {convertModal && (
        <ConvertToSOModal
          isOpen
          quoteNumber={convertModal.quoteNumber}
          customerName={convertModal.customerName}
          onClose={() => setConvertModal(null)}
          onConfirm={(_data) => {
            const quote = quotes.find(q => q.id === convertModal.quoteId);
            const from = getColumnMeta(quote?.status || 'Draft');
            const to = getColumnMeta('Confirmed SO');
            setTransitionInfo({
              quoteNumber: convertModal.quoteNumber,
              fromLabel: from.label,
              toLabel: to.label,
              fromColor: from.color,
              toColor: to.color,
            });
            onStatusChange(convertModal.quoteId, 'Confirmed SO');
            setConvertModal(null);
          }}
        />
      )}
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // Expired & Cancelled columns collapse after 10 cards
  const isCollapsibleColumn = status === 'Expired' || status === 'Cancelled';
  const INITIAL_CARD_LIMIT = 10;

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
      q.customer.name.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
      q.primaryPoC.name.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
      q.salesRep.name.toLowerCase().includes(activeSearchTerm.toLowerCase())
    );
  }

  processedQuotes = [...processedQuotes].sort((a, b) => {
    switch (sortBy) {
      case 'value': return b.totalValue - a.totalValue;
      case 'created': return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
      case 'expiry': return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      default: return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
    }
  });

  const groupedQuotes = groupBy === 'none'
    ? { 'All': processedQuotes }
    : processedQuotes.reduce((acc, quote) => {
        const key = groupBy === 'salesRep' ? quote.salesRep.name : groupBy === 'customer' ? quote.customer.name : quote.priority;
        if (!acc[key]) acc[key] = [];
        acc[key].push(quote);
        return acc;
      }, {} as Record<string, Quote[]>);

  return (
    <div
      ref={drop}
      className="flex-shrink-0 flex flex-col"
      style={{ width: '290px', minWidth: '290px', height: '100%' }}
    >
      {/* Column Header */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderTop: `1px solid ${isOver && canDrop ? dotColor : '#E5E7EB'}`,
          borderLeft: `1px solid ${isOver && canDrop ? dotColor : '#E5E7EB'}`,
          borderRight: `1px solid ${isOver && canDrop ? dotColor : '#E5E7EB'}`,
          borderRadius: '8px 8px 0 0',
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
              backgroundColor: '#F3F4F6', borderRadius: '10px', padding: '1px 8px', lineHeight: '1.6',
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
                <ArrowUpDown style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
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
                      { value: 'expiry', label: 'Expiry Date' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value as any); setShowSort(false); }}
                        className="w-full px-3 py-2 text-left text-[13px] hover:bg-[#F9FAFB] transition-colors flex items-center justify-between"
                        style={{ color: sortBy === opt.value ? '#1B6EF3' : '#374151' }}
                      >
                        {opt.label}
                        {sortBy === opt.value && <span style={{ color: '#1B6EF3' }}>✓</span>}
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

      {/* Column Body — scrollable vertically */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        style={{
          backgroundColor: isOver && canDrop ? `${dotColor}08` : tint,
          borderLeft: `1px solid ${isOver && canDrop ? dotColor : tintBorder}`,
          borderRight: `1px solid ${isOver && canDrop ? dotColor : tintBorder}`,
          borderBottom: `1px solid ${isOver && canDrop ? dotColor : tintBorder}`,
          borderRadius: '0 0 8px 8px',
          padding: '6px',
          scrollbarWidth: 'thin',
          scrollbarColor: '#D1D5DB transparent',
          minHeight: '120px',
          transition: 'background-color 250ms ease, border-color 200ms ease',
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
                      backgroundColor: '#F3F4F6', borderRadius: '10px', padding: '1px 6px',
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
                const shouldLimit = isCollapsibleColumn && !showAll && groupQuotes.length > INITIAL_CARD_LIMIT;
                const displayQuotes = shouldLimit ? groupQuotes.slice(0, INITIAL_CARD_LIMIT) : groupQuotes;
                const hiddenCount = groupQuotes.length - INITIAL_CARD_LIMIT;
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
                    {shouldLimit && (
                      <button
                        onClick={() => setShowAll(true)}
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
                          See {hiddenCount} more {hiddenCount === 1 ? 'quote' : 'quotes'}
                        </span>
                      </button>
                    )}
                    {isCollapsibleColumn && showAll && groupQuotes.length > INITIAL_CARD_LIMIT && (
                      <button
                        onClick={() => setShowAll(false)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          width: '100%', padding: '8px 12px',
                          background: 'transparent',
                          border: 'none', borderRadius: '8px',
                          cursor: 'pointer', transition: 'all 150ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.7)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: 500, color: '#9CA3AF' }}>
                          Show less
                        </span>
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

  // Status footer
  const getStatusFooter = () => {
    const now = new Date();
    if (columnStatus === 'Unconfirmed SO') {
      const diffDays = Math.floor((now.getTime() - new Date(quote.lastUpdated).getTime()) / 86400000);
      return { icon: <CheckCircle2 style={{ width: '11px', height: '11px' }} />, text: `Confirmed ${diffDays}d ago`, color: '#7C3AED' };
    }
    if (columnStatus === 'Confirmed SO') {
      const diffDays = Math.floor((now.getTime() - new Date(quote.createdDate).getTime()) / 86400000);
      return { icon: <CheckCircle2 style={{ width: '11px', height: '11px' }} />, text: `Converted ${diffDays}d ago`, color: '#16A34A' };
    }
    if (columnStatus === 'Expired') {
      const diffDays = Math.floor((now.getTime() - new Date(quote.expiryDate).getTime()) / 86400000);
      return { icon: <AlertTriangle style={{ width: '11px', height: '11px' }} />, text: `Expired ${diffDays}d ago`, color: '#DC2626' };
    }
    if (columnStatus === 'Cancelled') {
      const diffDays = Math.floor((now.getTime() - new Date(quote.expiryDate).getTime()) / 86400000);
      return { icon: <Ban style={{ width: '11px', height: '11px' }} />, text: `Cancelled ${diffDays}d ago`, color: '#DC2626' };
    }
    if (columnStatus === 'Archived') {
      const diffDays = Math.floor((now.getTime() - new Date(quote.lastUpdated).getTime()) / 86400000);
      return { icon: <Archive style={{ width: '11px', height: '11px' }} />, text: `Archived ${diffDays}d ago`, color: '#DC2626' };
    }
    const diffMs = new Date(quote.expiryDate).getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 0) {
      return { icon: <AlertTriangle style={{ width: '11px', height: '11px' }} />, text: `Expired ${Math.abs(diffDays)}d ago`, color: '#DC2626' };
    }
    if (diffDays <= 30) {
      return { icon: <Clock style={{ width: '11px', height: '11px' }} />, text: `Expires in ${diffDays}d`, color: diffDays <= 7 ? '#DC2626' : '#D97706' };
    }
    const diffMonths = Math.round(diffDays / 30);
    return { icon: <Clock style={{ width: '11px', height: '11px' }} />, text: `Expires in ${diffMonths}mo`, color: '#6B7280' };
  };

  const footer = getStatusFooter();

  // (date removed from card — quote number shown instead)

  return (
    <div
      ref={drag}
      className={`cursor-move ${isDragging ? 'opacity-30 scale-95' : ''}`}
      style={{
        position: 'relative',
        backgroundColor: isHovered ? '#FAFBFC' : '#FFFFFF',
        borderRadius: '8px',
        border: `1px solid ${isHovered ? '#D1D5DB' : '#E5E7EB'}`,
        boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)',
        transform: isHovered && !isDragging ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all 200ms ease',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thin top accent */}
      <div style={{ height: '2px', backgroundColor: accentColor, borderRadius: '8px 8px 0 0', opacity: isHovered ? 1 : 0.4, transition: 'opacity 200ms ease' }} />

      <div style={{ padding: '12px' }}>
        {/* Row 1: Quote number on left, Version on right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
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
              const t = getCardAvatarTint(quote.customer.name);
              const initials = quote.customer.name.split(/[\s&]+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
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
            {quote.description || `${quote.primaryPoC.name} · ${String(quote.createdDate.getMonth() + 1).padStart(2, '0')}/${String(quote.createdDate.getDate()).padStart(2, '0')}`}
          </div>
        </div>

        {/* Row 3: Value + Priority Badge */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#1F2937', lineHeight: '1.2' }}>
              {formatCurrency(quote.totalValue)}
            </div>
            <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 400, marginTop: '2px', lineHeight: '1' }}>Quote Value</div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            {(() => {
              const ps = PRIORITY_STYLES[quote.priority] || PRIORITY_STYLES.Medium;
              return (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  fontSize: '10px', fontWeight: 600, lineHeight: '1',
                  padding: '3px 8px', borderRadius: '4px',
                  backgroundColor: ps.bg, color: ps.text, border: `1px solid ${ps.border}`,
                }}>
                  {quote.priority}
                </span>
              );
            })()}
            <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 400, marginTop: '3px', lineHeight: '1' }}>Priority</div>
          </div>
        </div>

        {/* Row 4: Win Prob + Expiry (compact info row) */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: '1px solid #F3F4F6', paddingTop: '8px', marginBottom: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp style={{ width: '11px', height: '11px', color: winProb >= 60 ? '#059669' : winProb >= 30 ? '#D97706' : '#DC2626' }} />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>{winProb}%</span>
            <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 400 }}>Win Prob</span>
          </div>
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
          borderTop: '1px solid #F3F4F6', paddingTop: '8px',
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
          recipients.push({
            initials: quote.primaryPoC.name.split(' ').map(n => n[0]).join('').slice(0, 2),
            name: quote.primaryPoC.name, bg: '#1E40AF', color: '#FFFFFF',
          });
          if (quote.additionalPoCs) {
            quote.additionalPoCs.forEach(poc => {
              recipients.push({
                initials: poc.name.split(' ').map(n => n[0]).join('').slice(0, 2),
                name: poc.name, bg: '#059669', color: '#FFFFFF',
              });
            });
          }
          if (quote.additionalSalesReps) {
            quote.additionalSalesReps.forEach(rep => {
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
              borderTop: '1px solid #F3F4F6', paddingTop: '8px',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            }}>
              {/* Sales Rep — label + avatar + name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>Sales Representative</span>
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
                    {quote.salesRep.name}
                  </span>
                </div>
              </div>

              {/* Recipients — label + stacked circles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>Recipients</span>
                <div style={{ display: 'flex', alignItems: 'center' }}>
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