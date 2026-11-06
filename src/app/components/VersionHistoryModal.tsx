import React, { useState } from 'react';
import { X, Clock, User, FileText, GitCompare, DollarSign, Package, Plus, Minus, Pencil, Trash2, Edit, ArrowRight, ArrowUp, ArrowDown, Tag, Send, CheckCircle2, Scale, RotateCcw, AlertCircle, Check, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { compareNumbers, compareValueText, compareValuesDiffer, isNumericCompare, type CompareField } from '@/app/components/shared/versionCompare';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { ConfirmDiscardModal } from './shared/ConfirmDiscardModal';
import { StatusBadge } from './StatusBadge';
import { StateTransitionOverlay } from './shared/StateTransitionOverlay';
import type { QuoteStatus } from '@/app/types/quote';

/* Right-pane "Order Status" badge mapping.
   The version's internal status (draft / sent / confirmed) is mapped
   to the same QuoteStatus value the listing's Status column uses, so
   the pill in the modal reads with the same vocabulary and chrome as
   the row the user just clicked. Confirmed maps to 'Unconfirmed SO'
   which the StatusBadge re-labels to "Confirmed by Customer". */
function versionStatusToListingStatus(vs: 'draft' | 'sent' | 'confirmed'): QuoteStatus {
  switch (vs) {
    case 'draft':     return 'Draft' as QuoteStatus;
    case 'sent':      return 'Sent to Customer' as QuoteStatus;
    case 'confirmed': return 'Unconfirmed SO' as QuoteStatus;
  }
}

// ── Types ──────────────────────────────────────────────────────────
type ChangeType = 'line-item-added' | 'line-item-removed' | 'line-item-modified' | 'pricing-changed' |
  'customer-changed' | 'config-changed' | 'attachment-added' | 'rule-applied' | 'adjustment-applied';

type VersionStatus = 'draft' | 'sent' | 'confirmed';

interface DetailedChange {
  id: string;
  type: ChangeType;
  action: 'Added' | 'Removed' | 'Changed';
  subject: string;
  subjectDetail?: string;
  detail?: string;
  itemRef?: string;
  timestamp: string;
  user: string;
}

interface LineItem {
  id: string;
  description: string;
  qty: number;
  uom: string;
  unitPrice: number;
  total: number;
  thumbColor: string;
}

interface VersionSnapshot {
  lineItemCount: number;
  grandTotal: number;
  rulesCount: number;
  adjustmentsCount: number;
  /* Signed dollar impact of pricing rules / one-time adjustments —
     surfaced in the table footer instead of the Shipping / Discount
     line PO uses since this domain doesn't carry those. */
  pricingRulesTotal?: number;
  adjustmentsTotal?: number;
  validUntil: string;
  lineItems: LineItem[];
}

interface Version {
  version: number;
  versionStatus: VersionStatus;
  sentAt?: string;
  confirmedAt?: string;
  sentBy: string;
  avatar: string;
  avatarColor: string;
  snapshot: VersionSnapshot;
  changes: DetailedChange[];
  notes?: string;
  isRevert?: boolean;
  revertedFrom?: number;
}

interface VersionHistoryModalProps {
  quoteId: string;
  currentVersion: number;
  onClose: () => void;
  onRevert?: (toVersion: number) => void;
}

/* Change-kind icon + color — keyed by the high-level action (Added /
   Removed / Changed) only. We previously kept a 9-entry map keyed by
   the modification type (line-item-added, pricing-changed, customer-
   changed, etc.) and rotated icons + colours by sub-type. That made the
   change feed feel noisy: a `User` icon for a customer change, `Scale`
   for a rule, `Package` for an attachment, `Edit` for a modification.
   The user-readable distinction the feed is actually communicating is
   "what kind of delta is this" — green +, red −, amber edit — so the
   map collapses to three entries. Icon + colour are now driven purely
   by `change.action`, never by `change.type`. */
const changeKindConfig: Record<'Added' | 'Removed' | 'Changed', { icon: React.ElementType; color: string; bg: string }> = {
  Added:   { icon: Plus,   color: '#059669', bg: '#D1FAE5' },
  Removed: { icon: Minus,  color: '#DC2626', bg: '#FEE2E2' },
  Changed: { icon: Pencil, color: '#D97706', bg: '#FEF3C7' },
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const versionStatusConfig: Record<VersionStatus, { label: string; bg: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', bg: '#F3F4F6', color: '#374151', icon: FileText },
  sent: { label: 'Sent', bg: '#DBEAFE', color: '#1E40AF', icon: Send },
  confirmed: { label: 'Confirmed', bg: '#CCFBF1', color: '#0F766E', icon: CheckCircle2 },
};

/* Status pill palette — Partner v7 parity, used inside the compare table. */
const STATUS_PILL: Record<string, { bg: string; text: string; border: string }> = {
  Draft:            { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  Sent:             { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  Confirmed:        { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'Pending Review': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  Cleared:          { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  Shipped:          { bg: '#ECFEFF', text: '#155E75', border: '#A5F3FC' },
  Archived:         { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
};

function StatusPill({ value }: { value: string }) {
  const p = STATUS_PILL[value];
  if (!p) return <span style={{ fontSize: 12, fontWeight: 500, color: '#1F2937', lineHeight: 1 }}>{value}</span>;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border whitespace-nowrap"
      style={{
        fontSize: 11, fontWeight: 500, padding: '2px 10px', lineHeight: 1.4,
        backgroundColor: p.bg, color: p.text, borderColor: p.border,
      }}
    >
      {value}
    </span>
  );
}

export function VersionHistoryModal({ quoteId, currentVersion, onClose, onRevert }: VersionHistoryModalProps) {
  // The "current version" is always the latest confirmed version.
  // Minimal data shape mirrors Sales Order V5's VersionHistoryTab — terse
  // subject/detail strings, 3-4 changes per version, short item descriptions.
  //
  // The "template" entries below are renumbered + padded to match the
  // quote's actual `currentVersion` so the listing badge (`v4`) and
  // the modal's version count reconcile. Without this remap the modal
  // always showed v1–v3 regardless of what the quote claimed.
  const [versions, setVersions] = useState<Version[]>(() => {
    const templates: Version[] = ([
    {
      version: 3,
      versionStatus: 'sent',
      sentAt: '02/05/2026 · 10:30 AM',
      sentBy: 'Sarah Chen',
      avatar: 'SC',
      avatarColor: '#3B82F6',
      notes: 'Added emergency items per customer request. Applied volume adjustment.',
      snapshot: {
        lineItemCount: 7, grandTotal: 472070, rulesCount: 2, adjustmentsCount: 1, pricingRulesTotal: -8400, adjustmentsTotal: -3120, validUntil: '03/07/2026',
        lineItems: [
          { id: '501-100-001', description: 'E-450 stripped chassis.', qty: 2, uom: 'EA', unitPrice: 48200, total: 96400, thumbColor: '#DBEAFE' },
          { id: '501-100-002', description: 'Cutaway-mount modular body.', qty: 3, uom: 'EA', unitPrice: 94200, total: 282600, thumbColor: '#D1FAE5' },
          { id: '501-100-003', description: 'P25 Phase II mobile radio.', qty: 3, uom: 'EA', unitPrice: 7850, total: 23550, thumbColor: '#FEE2E2' },
          { id: '501-100-004', description: 'Powered stretcher, 700 lb cap.', qty: 3, uom: 'EA', unitPrice: 18500, total: 55500, thumbColor: 'hsl(var(--accent))' },
          { id: '501-100-005', description: '3000W pure sine inverter.', qty: 3, uom: 'EA', unitPrice: 1650, total: 4950, thumbColor: '#FEF3C7' },
          { id: '501-100-006', description: 'Linear Super-LED lightbar.', qty: 2, uom: 'EA', unitPrice: 3200, total: 6400, thumbColor: 'hsl(var(--destructive) / 0.1)' },
          { id: '501-100-007', description: 'Auto-eject shoreline, 30A.', qty: 3, uom: 'EA', unitPrice: 890, total: 2670, thumbColor: 'hsl(var(--accent))' },
        ],
      },
      changes: [
        { id: 'C301', type: 'line-item-added', action: 'Added', subject: '501-100-006', subjectDetail: 'Linear Super-LED lightbar.', detail: 'Qty: 2 EA · $3,200/EA', timestamp: '10:25 AM', user: 'Sarah Chen' },
        { id: 'C302', type: 'line-item-added', action: 'Added', subject: '501-100-007', subjectDetail: 'Auto-eject shoreline, 30A.', detail: 'Qty: 3 EA · $890/EA', timestamp: '10:22 AM', user: 'Sarah Chen' },
        { id: 'C303', type: 'rule-applied', action: 'Added', subject: 'Pricing Rule', subjectDetail: 'Government Contract Pricing', detail: 'Eligible items flagged', timestamp: '10:18 AM', user: 'Michael Rodriguez' },
        { id: 'C304', type: 'adjustment-applied', action: 'Added', subject: 'Adjustment', subjectDetail: 'Volume adjustment', detail: '−3% on total', timestamp: '10:15 AM', user: 'Sarah Chen' },
      ],
    },
    {
      version: 2,
      versionStatus: 'confirmed',
      sentAt: '01/28/2026 · 3:15 PM',
      confirmedAt: '02/01/2026 · 11:00 AM',
      sentBy: 'Sarah Chen',
      avatar: 'SC',
      avatarColor: '#3B82F6',
      notes: 'Added medical equipment per build spec. Fleet volume pricing applied.',
      snapshot: {
        lineItemCount: 5, grandTotal: 463000, rulesCount: 1, adjustmentsCount: 0, pricingRulesTotal: -2000, adjustmentsTotal: 0, validUntil: '02/27/2026',
        lineItems: [
          { id: '501-100-001', description: 'E-450 stripped chassis.', qty: 2, uom: 'EA', unitPrice: 48200, total: 96400, thumbColor: '#DBEAFE' },
          { id: '501-100-002', description: 'Cutaway-mount modular body.', qty: 3, uom: 'EA', unitPrice: 94200, total: 282600, thumbColor: '#D1FAE5' },
          { id: '501-100-003', description: 'P25 Phase II mobile radio.', qty: 3, uom: 'EA', unitPrice: 7850, total: 23550, thumbColor: '#FEE2E2' },
          { id: '501-100-004', description: 'Powered stretcher, 700 lb cap.', qty: 3, uom: 'EA', unitPrice: 18500, total: 55500, thumbColor: 'hsl(var(--accent))' },
          { id: '501-100-005', description: '3000W pure sine inverter.', qty: 3, uom: 'EA', unitPrice: 1650, total: 4950, thumbColor: '#FEF3C7' },
        ],
      },
      changes: [
        { id: 'C201', type: 'line-item-modified', action: 'Changed', subject: 'Qty', detail: '1 → 2', itemRef: '501-100-001', timestamp: '3:10 PM', user: 'David Kim' },
        { id: 'C202', type: 'pricing-changed', action: 'Changed', subject: 'Unit Price', detail: '$49,200 → $48,200', itemRef: '501-100-001', subjectDetail: 'Fleet Volume Pricing', timestamp: '3:08 PM', user: 'Sarah Chen' },
        { id: 'C206', type: 'rule-applied', action: 'Added', subject: 'Pricing Rule', subjectDetail: 'Fleet Volume Pricing', detail: '−$1,000/unit on 2+ units', timestamp: '3:12 PM', user: 'Sarah Chen' },
        { id: 'C207', type: 'config-changed', action: 'Changed', subject: 'Payment Terms', detail: 'Net 30 → Net 45', timestamp: '2:40 PM', user: 'Sarah Chen' },
      ],
    },
    {
      version: 1,
      versionStatus: 'confirmed',
      sentAt: '01/20/2026 · 10:30 AM',
      confirmedAt: '01/22/2026 · 2:15 PM',
      sentBy: 'Sarah Chen',
      avatar: 'SC',
      avatarColor: '#3B82F6',
      notes: 'Initial quote created for fleet build-out.',
      snapshot: {
        lineItemCount: 2, grandTotal: 331800, rulesCount: 0, adjustmentsCount: 0, pricingRulesTotal: 0, adjustmentsTotal: 0, validUntil: '02/19/2026',
        lineItems: [
          { id: '501-100-001', description: 'E-450 stripped chassis.', qty: 1, uom: 'EA', unitPrice: 49200, total: 49200, thumbColor: '#DBEAFE' },
          { id: '501-100-002', description: 'Cutaway-mount modular body.', qty: 3, uom: 'EA', unitPrice: 94200, total: 282600, thumbColor: '#D1FAE5' },
        ],
      },
      changes: [
        { id: 'C101', type: 'line-item-added', action: 'Added', subject: '501-100-001', subjectDetail: 'E-450 stripped chassis.', detail: 'Qty: 1 EA', timestamp: '10:00 AM', user: 'Sarah Chen' },
        { id: 'C103', type: 'customer-changed', action: 'Changed', subject: 'Customer', detail: 'Tri-County EMS Authority', timestamp: '9:55 AM', user: 'Sarah Chen' },
        { id: 'C104', type: 'config-changed', action: 'Changed', subject: 'Payment Terms', detail: 'Net 30', timestamp: '9:50 AM', user: 'Sarah Chen' },
      ],
    },
  ]) as Version[];

    /* Map the rich templates onto the quote's actual version count.
       Templates are newest-first; we splice the latest template up to
       v=currentVersion, second template to v=currentVersion-1, etc.
       If the quote has more versions than templates, pad earlier
       versions with thin entries reusing the oldest template's
       snapshot so the modal still has a coherent timeline. */
    const target = Math.max(1, Math.floor(currentVersion || 1));
    const list: Version[] = [];
    for (let i = 0; i < target; i++) {
      const vNum = target - i;
      const tpl = templates[i] || templates[templates.length - 1];
      list.push({
        ...tpl,
        version: vNum,
        /* Newest version inherits the template's "sent" status; older
           versions read as confirmed historical entries. */
        versionStatus: i === 0 ? tpl.versionStatus : 'confirmed',
      });
    }
    return list;
  });

  const currentVersionNum = currentVersion;

  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersionNum);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[number | null, number | null]>([null, null]);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [versionToRevert, setVersionToRevert] = useState<number | null>(null);

  const [revertOverlay, setRevertOverlay] = useState<{ show: boolean; toVersion: number; fromVersion: number }>({ show: false, toVersion: 0, fromVersion: 0 });

  const handleRevert = (toVersion: number, reason: string) => {
    // Revert-in-place: V[toVersion] becomes the new "current" without
    // creating a new draft entry. Status is preserved. The full-screen
    // overlay plays first so the user has a visible confirmation that
    // the action is in flight; the toast fires on overlay completion.
    const trimmed = reason.trim();
    if (trimmed) {
      const stamp = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const appended = `Reverted to this version on ${stamp} · Sarah Chen: ${trimmed}`;
      setVersions(prev => prev.map(v => v.version === toVersion
        ? { ...v, notes: v.notes ? `${appended}\n\n${v.notes}` : appended }
        : v));
    }
    setShowRevertConfirm(false);
    setVersionToRevert(null);
    setRevertOverlay({ show: true, toVersion, fromVersion: currentVersionNum });
  };

  const finalizeRevert = () => {
    const { toVersion } = revertOverlay;
    setRevertOverlay({ show: false, toVersion: 0, fromVersion: 0 });
    setSelectedVersion(toVersion);
    onRevert?.(toVersion);
    toast.success(`Reverted to V${toVersion}`, {
      description: `V${toVersion} is now the current version of this quote.`,
      position: 'top-right',
    });
  };

  const handleVersionClick = (version: number) => {
    if (compareMode) {
      const [a, b] = compareVersions;
      if (a === version) {
        // Deselect A — promote B to A
        setCompareVersions([b, null]);
      } else if (b === version) {
        // Deselect B
        setCompareVersions([a, null]);
      } else if (a === null) {
        // Nothing selected yet — set A
        setCompareVersions([version, null]);
      } else if (b === null) {
        // A is set, set B
        setCompareVersions([a, version]);
      } else {
        // Both set — replace B with the new pick
        setCompareVersions([a, version]);
      }
    } else {
      setSelectedVersion(version);
    }
  };

  const selectedVersionData = versions.find(v => v.version === selectedVersion);
  /* Lifecycle pill resolution shared by the modal, the version dropdown
     and the Versions tab — keeps the vocabulary aligned across surfaces.
     "Last Approved" = the most-recent confirmed version (the one
     currently in force with the customer); anything older that's
     confirmed is "Superseded". The Versions tab and detail-page
     dropdown use the same three terms (Latest / Last Approved /
     Superseded) plus Viewing / Revert for transient states. */
  /* "Last Approved" = the most recent confirmed version that ISN'T the
     currently-active one. After a revert to V[N], the version that was
     previously head becomes Last Approved; older confirmed versions
     read as Superseded. */
  const lastApprovedVersionNum = versions
    .filter(v => v.versionStatus === 'confirmed' && v.version !== currentVersionNum)
    .reduce((max, v) => v.version > max ? v.version : max, -1);

  const getUserColor = (name: string) => {
    if (name === 'Sarah Chen') return '#3B82F6';
    if (name === 'Michael Rodriguez') return '#8B5CF6';
    if (name === 'David Kim') return '#F59E0B';
    return '#6B7280';
  };

  const getUserInitials = (name: string) => name.split(' ').map(n => n[0]).join('');

  const isCompareWide = compareMode && compareVersions[0] !== null && compareVersions[1] !== null;

  // Partner v7 modal-sizing pattern: kill shadcn's translate-50% centering and
  // re-center via fixed inset-0 + m-auto so the panel sits dead-center in the
  // viewport regardless of ancestor transform / contain containing-blocks.
  // Classic viewport-centering via inline styles. Inline beats shadcn's
  // class-based positioning (which can collide with tailwind-merge and isn't
  // !important). One translate is enough.
  const modalPositioningStyle: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    translate: 'none',
    transform: 'translate(-50%, -50%)',
    margin: 0,
    width: 'calc(100% - 2rem)',
    maxWidth: isCompareWide ? 1340 : 1060,
    maxHeight: 'min(85vh, calc(100dvh - 2rem))',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
    transition: 'max-width 300ms cubic-bezier(0.32,0.72,0,1)',
    zIndex: 220,
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        hideCloseButton
        overlayClassName="z-[215]"
        className="flex flex-col p-0 gap-0 border-0 sm:border"
        style={modalPositioningStyle}
      >
        <DialogTitle className="sr-only">Version History — {quoteId}</DialogTitle>
        <DialogDescription className="sr-only">
          Versions are created when sent to customer. Current is the latest confirmed version.
        </DialogDescription>
        {/* Header — Partners' detail-modal pattern: 40px rounded-[10px]
            primary/10 tile + 16px icon (w-4 h-4) + 17px / weight 700
            foreground title + 12px slate-500 subtitle. Matches
            PartnerGroupDetailModal's configuration header exactly. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 13px', borderBottom: '1px solid var(--border)', flexShrink: 0, backgroundColor: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="w-10 h-10 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--foreground)', lineHeight: '1.25', margin: 0, letterSpacing: '-0.01em' }}>
                Version History — {quoteId}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1.35', margin: 0, marginTop: '2px' }}>
                Versions are created when sent to customer · Current = latest confirmed
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* "N versions" counter — Partner's "<count> carriers" pattern.
                Sits to the left of the primary action so the user reads
                the noun + count before the action button. */}
            <span className="text-sm tabular-nums hidden sm:inline" style={{ fontWeight: 500 }}>
              <span style={{ color: 'var(--foreground)' }}>{versions.length}</span>
              <span style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}>
                {' '}{versions.length === 1 ? 'version' : 'versions'}
              </span>
            </span>
            {/* Compare button hides entirely when the quote has only
                one version — there's nothing to compare against, so
                surfacing the action would be misleading. */}
            {versions.length > 1 && (() => {
              /* Compare button — Partners-faithful tinted action button.
                 Off state uses the green tint so it reads as the
                 affirmative "enter compare" action; on state flips to
                 the blue tint with "Exit Compare" so the two states are
                 visually distinct and the destructive read is muted. */
              const tint = compareMode
                ? { bg: '#EFF6FF', hoverBg: '#DBEAFE', border: '#BFDBFE', color: '#1E40AF' }
                : { bg: '#ECFDF5', hoverBg: '#D1FAE5', border: '#A7F3D0', color: '#065F46' };
              return (
                <button
                  type="button"
                  onClick={() => { if (compareMode) setCompareVersions([null, null]); setCompareMode(!compareMode); }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer"
                  style={{
                    fontWeight: 600,
                    backgroundColor: tint.bg,
                    borderColor: tint.border,
                    color: tint.color,
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tint.hoverBg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tint.bg; }}
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{compareMode ? 'Exit Compare' : 'Compare Versions'}</span>
                </button>
              );
            })()}
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                transition: 'background-color 100ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <X style={{ width: '18px', height: '18px', color: 'var(--muted-foreground)' }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Panel - Timeline (28%) */}
          <div style={{
            width: '28%', borderRight: '1px solid #E5E7EB', overflowY: 'auto',
            backgroundColor: '#FAFBFC',
            scrollbarWidth: 'thin' as const,
            display: 'flex', flexDirection: 'column' as const,
          }}>
            {/* Compare mode header strip */}
            {compareMode && (
              <div style={{
                padding: '10px 16px', flexShrink: 0,
                backgroundColor: '#EFF6FF',
                borderBottom: '1px solid #BFDBFE',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <GitCompare style={{ width: '14px', height: '14px', color: '#1B6EF3', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E40AF', lineHeight: '1.3' }}>
                    Compare Mode
                  </div>
                  <div style={{ fontSize: '11px', color: '#3B82F6', lineHeight: '1.3', marginTop: '1px' }}>
                    {compareVersions[0] === null
                      ? 'Select 2 versions to compare'
                      : compareVersions[1] === null
                        ? '1 selected — pick one more'
                        : '2 versions selected'}
                  </div>
                </div>
              </div>
            )}
            <div style={{ padding: '16px', flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' as const }}>
              {versions.map((version, index) => {
                const isSelected = compareMode
                  ? compareVersions.includes(version.version)
                  : selectedVersion === version.version;
                const isCurrent = version.version === currentVersionNum;
                /* Unified lifecycle tags (replace the prior
                   Draft/Sent/Confirmed inline badge):
                     • Latest        — the active version (currentVersionNum)
                     • Last Approved — most recent confirmed, not the active one
                     • Superseded    — older 'confirmed' versions */
                const isLatestVer = version.version === currentVersionNum;
                const isLastApprovedVer = version.version === lastApprovedVersionNum;
                const isSuperseded = version.versionStatus === 'confirmed' && !isLatestVer;

                // In compare mode, determine if this is "A" or "B"
                const compareLabel = compareMode && isSelected
                  ? compareVersions[0] === version.version ? 'A' : 'B'
                  : null;

                const isLast = index === versions.length - 1;
                return (
                  <div key={version.version} style={{ position: 'relative', paddingBottom: isLast ? '0' : '10px' }}>
                    {/* Timeline connector — runs from the version badge center
                        downward through the row gap into the next row's badge.
                        Positioned to align with the 36-px badge that lives in
                        a dedicated 36-px rail to the left of the card, so the
                        line visually threads each badge like a proper timeline.
                        Hidden in compare mode (checkboxes replace the rail). */}
                    {!isLast && !compareMode && (
                      <div style={{
                        position: 'absolute', left: '17px', top: '38px', bottom: '0',
                        width: '2px', backgroundColor: '#E2E8F0', zIndex: 0,
                      }} />
                    )}

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', position: 'relative', zIndex: 1 }}>
                      {/* Checkbox area — only in compare mode */}
                      {compareMode && (
                        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', flexShrink: 0, width: '28px', marginRight: '4px' }}>
                          <button
                            onClick={() => handleVersionClick(version.version)}
                            style={{
                              width: '28px', height: '28px', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              marginTop: '14px',
                              border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                            }}
                          >
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '4px',
                              border: isSelected ? 'none' : '2px solid #D1D5DB',
                              backgroundColor: isSelected ? '#1B6EF3' : '#FFFFFF',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 150ms',
                              boxShadow: isSelected ? '0 1px 3px rgba(27,110,243,0.3)' : 'none',
                            }}>
                              {isSelected && (
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#FFFFFF', lineHeight: '1' }}>
                                  {compareLabel}
                                </span>
                              )}
                            </div>
                          </button>
                          {/* Connector line between checkboxes */}
                          {index < versions.length - 1 && (
                            <div style={{ flex: 1, width: '2px', backgroundColor: '#E5E7EB', marginTop: '4px', minHeight: '8px' }} />
                          )}
                        </div>
                      )}

                      {/* Timeline rail — 36px wide, holds the version badge
                          that sits ON the connector line so it reads as a
                          node on a timeline. Hidden in compare mode where
                          the checkbox column takes over. */}
                      {!compareMode && (
                        <div style={{ flexShrink: 0, width: '36px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
                          <button
                            onClick={() => handleVersionClick(version.version)}
                            style={{
                              width: '36px', height: '36px', borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: 600, lineHeight: '1', cursor: 'pointer',
                              backgroundColor: isCurrent ? '#D1FAE5' : version.versionStatus === 'sent' ? '#DBEAFE' : '#F9FAFB',
                              color: isCurrent ? '#065F46' : version.versionStatus === 'sent' ? '#1E40AF' : '#9CA3AF',
                              border: isCurrent ? '2px solid #86EFAC' : version.versionStatus === 'sent' ? '2px solid #93C5FD' : '2px solid #E5E7EB',
                              padding: 0,
                            }}
                            aria-label={`Open version ${version.version}`}
                          >
                            v{version.version}
                          </button>
                        </div>
                      )}

                      {/* Version card */}
                      <button
                        onClick={() => handleVersionClick(version.version)}
                        style={{
                          flex: 1, textAlign: 'left' as const, padding: '10px 12px',
                          borderRadius: '8px', cursor: 'pointer', border: 'none',
                          backgroundColor: isSelected
                            ? compareMode ? '#EFF6FF' : '#F0F7FF'
                            : '#FFFFFF',
                          outline: isSelected
                            ? compareMode ? '2px solid #60A5FA' : '2px solid #93C5FD'
                            : '1px solid #E5E7EB',
                          transition: 'all 150ms',
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          {/* In compare mode the badge stays inside the card
                              since the checkbox column owns the left rail. */}
                          {compareMode && (
                            <div style={{
                              flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: 600, lineHeight: '1',
                              backgroundColor: isCurrent ? '#D1FAE5' : version.versionStatus === 'sent' ? '#DBEAFE' : '#F9FAFB',
                              color: isCurrent ? '#065F46' : version.versionStatus === 'sent' ? '#1E40AF' : '#9CA3AF',
                              border: isCurrent ? '2px solid #86EFAC' : version.versionStatus === 'sent' ? '2px solid #93C5FD' : '2px solid #E5E7EB',
                            }}>
                              v{version.version}
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Title row — version number only. Lifecycle
                                pills moved to a dedicated row below so the
                                placement is identical regardless of pill
                                text width (a longer label like "Last
                                Approved" no longer wraps unpredictably
                                while shorter labels stay inline). */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1' }}>
                                Version {version.version}
                              </span>
                            </div>

                            {/* Lifecycle pill row on the left rail. The
                                "Last Approved" pill lives on the right
                                pane and the Versions tab only, so this
                                rail stays uncluttered. */}
                            {(isLatestVer || isSuperseded || version.isRevert) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                {isLatestVer && <LifecyclePill label="Current Version" tone="latest" />}
                                {isSuperseded && <LifecyclePill label="Superseded" tone="superseded" />}
                                {version.isRevert && <LifecyclePill label="Revert" tone="viewing" />}
                              </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1', marginBottom: '5px' }}>
                              <User style={{ width: '11px', height: '11px' }} />
                              <span>{version.sentBy}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1' }}>
                              <Clock style={{ width: '11px', height: '11px' }} />
                              <span>{version.sentAt ? version.sentAt.split(' · ')[0] : 'Not sent'}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel - Detailed View (72%) */}
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' as const }}>
            <div style={{ padding: '20px 24px' }}>
              {compareMode && compareVersions[0] !== null && compareVersions[1] !== null ? (
                // Compare Mode — Rich side-by-side view with diff highlighting
                (() => {
                  const v1 = versions.find(v => v.version === Math.min(compareVersions[0]!, compareVersions[1]!))!;
                  const v2 = versions.find(v => v.version === Math.max(compareVersions[0]!, compareVersions[1]!))!;
                  if (!v1 || !v2) return null;

                  const v1Map = new Map(v1.snapshot.lineItems.map(li => [li.id, li]));
                  const v2Map = new Map(v2.snapshot.lineItems.map(li => [li.id, li]));
                  const allIds = Array.from(new Set([...v1.snapshot.lineItems.map(li => li.id), ...v2.snapshot.lineItems.map(li => li.id)]));

                  type DiffStatus = 'unchanged' | 'added' | 'removed' | 'modified';
                  const getDiffStatus = (id: string): DiffStatus => {
                    const inV1 = v1Map.has(id);
                    const inV2 = v2Map.has(id);
                    if (inV1 && !inV2) return 'removed';
                    if (!inV1 && inV2) return 'added';
                    if (inV1 && inV2) {
                      const a = v1Map.get(id)!;
                      const b = v2Map.get(id)!;
                      if (a.qty !== b.qty || a.unitPrice !== b.unitPrice || a.total !== b.total) return 'modified';
                    }
                    return 'unchanged';
                  };

                  const diffBg: Record<DiffStatus, string> = { unchanged: '#FFFFFF', added: '#F0FDF4', removed: '#FEF2F2', modified: '#FFFBEB' };
                  const diffBorder: Record<DiffStatus, string> = { unchanged: '#F7F8F9', added: '#BBF7D0', removed: '#FECACA', modified: '#FDE68A' };

                  const summaryFields: CompareField[] = [
                    { label: 'Status', val1: versionStatusConfig[v1.versionStatus].label, val2: versionStatusConfig[v2.versionStatus].label, kind: 'status' },
                    { label: 'Line Items', val1: String(v1.snapshot.lineItemCount), val2: String(v2.snapshot.lineItemCount) },
                    { label: 'Grand Total', val1: formatCurrency(v1.snapshot.grandTotal), val2: formatCurrency(v2.snapshot.grandTotal) },
                    { label: 'Rules', val1: String(v1.snapshot.rulesCount), val2: String(v2.snapshot.rulesCount) },
                    { label: 'Adjustments', val1: String(v1.snapshot.adjustmentsCount), val2: String(v2.snapshot.adjustmentsCount) },
                    { label: 'Valid Until', val1: v1.snapshot.validUntil, val2: v2.snapshot.validUntil },
                  ];

                  const addedCount = allIds.filter(id => getDiffStatus(id) === 'added').length;
                  const removedCount = allIds.filter(id => getDiffStatus(id) === 'removed').length;
                  const modifiedCount = allIds.filter(id => getDiffStatus(id) === 'modified').length;

                  const colHeaderStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'none', lineHeight: '1' };

                  const renderCompareRow = (li: LineItem | null, status: DiffStatus) => {
                    if (!li) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: status === 'removed' ? '#FEF2F2' : status === 'added' ? '#F0FDF4' : '#F9FAFB', borderBottom: '1px solid #F3F4F6', minHeight: '30px', opacity: 0.4 }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '3px', flexShrink: 0, backgroundColor: '#F3F4F6' }} />
                          <div style={{ flex: 1, fontSize: '10px', color: '#D1D5DB', fontStyle: 'italic' }}>—</div>
                        </div>
                      );
                    }
                    const isChanged = status === 'modified';
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: diffBg[status], borderBottom: `1px solid ${diffBorder[status]}` }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '3px', flexShrink: 0, backgroundColor: li.thumbColor || '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Package style={{ width: '9px', height: '9px', color: '#6B7280', opacity: 0.5 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '9px', fontWeight: 600, color: '#6B7280', lineHeight: '1', marginBottom: '1px' }}>{li.id}</div>
                          <div style={{ fontSize: '10px', color: '#374151', lineHeight: '1.1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{li.description}</div>
                        </div>
                        <span style={{ fontSize: '10px', color: isChanged ? '#92400E' : '#6B7280', fontWeight: isChanged ? 600 : 400, lineHeight: '1', flexShrink: 0, width: '24px', textAlign: 'right' as const }}>{li.qty}</span>
                        <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1', flexShrink: 0, width: '24px', textAlign: 'center' as const }}>{li.uom}</span>
                        <span style={{ fontSize: '10px', color: isChanged ? '#92400E' : '#9CA3AF', fontWeight: isChanged ? 500 : 400, lineHeight: '1', flexShrink: 0, width: '56px', textAlign: 'right' as const }}>{formatCurrency(li.unitPrice)}</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: isChanged ? '#92400E' : '#1F2937', lineHeight: '1', flexShrink: 0, width: '56px', textAlign: 'right' as const }}>{formatCurrency(li.total)}</span>
                      </div>
                    );
                  };

                  const renderVersionTable = (ver: Version, side: 'left' | 'right') => {
                    /* Right pane reuses the listing's StatusBadge below
                       (rounded-full + matching label vocabulary), so the
                       local sCfg / SIcon look-up is no longer needed. */
                    const itemMap = side === 'left' ? v1Map : v2Map;
                    const otherSubtotal = (side === 'left' ? v1 : v2).snapshot.lineItems.reduce((s, li) => s + li.total, 0);
                    const oppositeSubtotal = (side === 'left' ? v2 : v1).snapshot.lineItems.reduce((s, li) => s + li.total, 0);
                    const subtotalChanged = otherSubtotal !== oppositeSubtotal;
                    const totalChanged = v1.snapshot.grandTotal !== v2.snapshot.grandTotal;

                    return (
                      <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Package style={{ width: '10px', height: '10px', color: '#6B7280' }} />
                            <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>V{ver.version} Line Items</span>
                            <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>({ver.snapshot.lineItems.length})</span>
                          </div>
                          {/* Listing's Status column pill style (rounded-full)
                              + the same label vocabulary the row used,
                              so the modal carries the listing language. */}
                          <StatusBadge status={versionStatusToListingStatus(ver.versionStatus)} />
                        </div>
                        {/* Column header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB' }}>
                          <div style={{ width: '20px', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}><span style={colHeaderStyle}>Item</span></div>
                          <span style={{ ...colHeaderStyle, flexShrink: 0, width: '24px', textAlign: 'right' as const }}>Qty</span>
                          <span style={{ ...colHeaderStyle, flexShrink: 0, width: '24px', textAlign: 'center' as const }}>Unit</span>
                          <span style={{ ...colHeaderStyle, flexShrink: 0, width: '56px', textAlign: 'right' as const }}>Price</span>
                          <span style={{ ...colHeaderStyle, flexShrink: 0, width: '56px', textAlign: 'right' as const }}>Total</span>
                        </div>
                        {/* Rows */}
                        {allIds.map(id => {
                          const status = getDiffStatus(id);
                          const li = itemMap.get(id) || null;
                          return <div key={id}>{renderCompareRow(li, status)}</div>;
                        })}
                        {/* Subtotal */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '3px 8px', borderTop: '1px solid #E5E7EB', backgroundColor: subtotalChanged && side === 'right' ? '#FFFBEB' : '#FFFFFF' }}>
                          <span style={{ fontSize: '9px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.3px', marginRight: '6px' }}>Subtotal</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: subtotalChanged && side === 'right' ? '#92400E' : '#374151', minWidth: '56px', textAlign: 'right' as const }}>{formatCurrency(otherSubtotal)}</span>
                        </div>
                        {/* Footer */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: totalChanged && side === 'right' ? '#FFFBEB' : '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
                          <span style={{ fontSize: '9px', color: '#6B7280', lineHeight: '1' }}>
                            {ver.snapshot.rulesCount} rules · {ver.snapshot.adjustmentsCount} adj.
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.3px' }}>Total</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: totalChanged && side === 'right' ? '#92400E' : '#1F2937' }}>{formatCurrency(ver.snapshot.grandTotal)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div>
                      {/* Compare header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <GitCompare style={{ width: '16px', height: '16px', color: '#1B6EF3' }} />
                          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: 0, lineHeight: '1' }}>
                            Version {v1.version} → Version {v2.version}
                          </h3>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {addedCount > 0 && <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#D1FAE5', color: '#065F46', lineHeight: '1' }}>+{addedCount} added</span>}
                          {removedCount > 0 && <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FEE2E2', color: '#991B1B', lineHeight: '1' }}>{removedCount} removed</span>}
                          {modifiedCount > 0 && <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E', lineHeight: '1' }}>{modifiedCount} changed</span>}
                        </div>
                      </div>

                      {/* Summary field comparison — split into TWO side-by-side
                          cards so the layout matches the line-items + changes
                          panes below. Each card has its own version-stamped
                          header and a 2-column body (Field / Value); the
                          "changed" highlight stays in sync because both cards
                          read off the same `summaryFields` source. */}
                      {(() => {
                        const renderSummaryCard = (v: typeof v1, side: 'left' | 'right') => (
                          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#FAFBFC', borderBottom: '1px solid #E5E7EB' }}>
                              <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>V{v.version} · {v.sentAt?.split(' · ')[0]}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', padding: '6px 12px', backgroundColor: '#FAFBFC', borderBottom: '1px solid #E5E7EB' }}>
                              <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>Field</span>
                              <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>Value</span>
                            </div>
                            {summaryFields.map((f) => {
                              const val = compareValueText(side === 'left' ? f.val1 : f.val2);
                              const changed = compareValuesDiffer(f.val1, f.val2);
                              const { n1, n2 } = compareNumbers(f);
                              const numeric = changed && isNumericCompare(f);
                              const direction = numeric && side === 'right' ? (n2 > n1 ? 'up' : 'down') : null;
                              const isStruck = changed && side === 'left' && !numeric && !f.kind;
                              return (
                                <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', padding: '7px 12px', borderBottom: '1px solid #E5E7EB', backgroundColor: changed ? 'rgba(245, 158, 11, 0.04)' : '#FFFFFF', borderLeft: changed ? '3px solid #F59E0B' : '3px solid transparent' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', lineHeight: '1' }}>{f.label}</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: side === 'right' && changed ? 600 : 500, color: side === 'right' && changed ? '#0F172A' : (changed ? '#6B7280' : '#1F2937'), lineHeight: '1', textDecoration: isStruck ? 'line-through' : 'none', textDecorationColor: 'rgba(107, 114, 128, 0.4)' }}>{f.kind === 'status' ? <StatusPill value={val} /> : val}</span>
                                    {direction === 'up' && <ArrowUp style={{ width: '12px', height: '12px', color: '#10B981' }} strokeWidth={2.5} />}
                                    {direction === 'down' && <ArrowDown style={{ width: '12px', height: '12px', color: '#EF4444' }} strokeWidth={2.5} />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', marginBottom: '16px' }}>
                            {renderSummaryCard(v1, 'left')}
                            {renderSummaryCard(v2, 'right')}
                          </div>
                        );
                      })()}

                      {/* Side-by-side line item tables */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px', marginBottom: '16px' }}>
                        {renderVersionTable(v1, 'left')}
                        {renderVersionTable(v2, 'right')}
                      </div>

                      {/* Legend */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '8px 12px', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', lineHeight: '1' }}>Legend:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#D1FAE5', borderWidth: '1px', borderStyle: 'solid', borderColor: '#BBF7D0' }} />
                          <span style={{ fontSize: '10px', color: '#065F46', lineHeight: '1' }}>Added</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#FEE2E2', borderWidth: '1px', borderStyle: 'solid', borderColor: '#FECACA' }} />
                          <span style={{ fontSize: '10px', color: '#991B1B', lineHeight: '1' }}>Removed</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#FEF3C7', borderWidth: '1px', borderStyle: 'solid', borderColor: '#FDE68A' }} />
                          <span style={{ fontSize: '10px', color: '#92400E', lineHeight: '1' }}>Changed</span>
                        </div>
                      </div>

                      {/* Changes comparison — split into two side-by-side
                          cards so the visual rhythm matches the summary +
                          line-items panes above. Icon + colour come from
                          `changeKindConfig` (action-based, three kinds
                          total); the per-modification-type icon switch
                          and the unified-row pair grid are gone. */}
                      {(v1.changes.length > 0 || v2.changes.length > 0) && (() => {
                        const renderChangeRow = (change: DetailedChange) => {
                          const ct = changeKindConfig[change.action];
                          const CIcon = ct.icon;
                          return (
                            <div key={change.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '10px 12px', borderBottom: '1px solid #F3F4F6', overflow: 'hidden' }}>
                              <div style={{ width: '20px', height: '20px', borderRadius: '6px', backgroundColor: ct.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <CIcon style={{ width: '10px', height: '10px', color: ct.color }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                <div style={{ fontSize: '11px', fontWeight: 500, color: '#1F2937', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                  <span style={{ fontWeight: 600, color: ct.color, marginRight: '4px' }}>{change.action}:</span>
                                  <span style={{ fontWeight: 600, color: '#1F2937', marginRight: '3px' }}>{change.subject}</span>
                                  {change.itemRef && <span style={{ fontWeight: 500, color: '#6B7280' }}>on {change.itemRef}</span>}
                                </div>
                                {change.subjectDetail && <div style={{ fontSize: '10px', color: '#6B7280', lineHeight: '1.3', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{change.subjectDetail}</div>}
                                {change.detail && <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.3', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{change.detail}</div>}
                              </div>
                              <span style={{ fontSize: '10px', color: '#9CA3AF', flexShrink: 0, lineHeight: '1', marginTop: '3px', whiteSpace: 'nowrap' as const }}>{change.timestamp}</span>
                            </div>
                          );
                        };
                        const renderChangesCard = (v: typeof v1) => (
                          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                            {/* Card header — Purchase Order parity: Edit
                                icon + uppercase eyebrow + count chip. */}
                            <div style={{ padding: '8px 14px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Edit style={{ width: '12px', height: '12px', color: '#64748B' }} />
                              <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1' }}>Changes in V{v.version}</span>
                              <span className="inline-flex items-center rounded-md tabular-nums" style={{ padding: '1px 6px', backgroundColor: '#F1F5F9', color: '#64748B', fontSize: '10px', fontWeight: 600, lineHeight: 1.4 }}>
                                {v.changes.length}
                              </span>
                            </div>
                            {v.changes.length === 0 ? (
                              <div style={{ padding: '24px 12px', textAlign: 'center' as const }}>
                                <span style={{ fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic' as const }}>No changes recorded</span>
                              </div>
                            ) : v.changes.map(renderChangeRow)}
                          </div>
                        );
                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                            {renderChangesCard(v1)}
                            {renderChangesCard(v2)}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()
              ) : selectedVersionData ? (
                // Single Version View
                <div>
                  {/* Title bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: 0, lineHeight: '1' }}>
                        Version {selectedVersionData.version}
                      </h3>
                      {/* Order status — listing pill style + listing vocabulary. */}
                      <StatusBadge status={versionStatusToListingStatus(selectedVersionData.versionStatus)} />
                      {/* Lifecycle pills — same three terms as the
                          left rail / Versions tab / VersionDropdown. */}
                      {(() => {
                        const isLatestVer = selectedVersionData.version === currentVersionNum;
                        const isLastApprovedVer = selectedVersionData.version === lastApprovedVersionNum;
                        const isSuperseded = selectedVersionData.versionStatus === 'confirmed' && !isLatestVer && !isLastApprovedVer;
                        return (
                          <>
                            {isLatestVer && <LifecyclePill label="Current Version" tone="latest" />}
                            {isLastApprovedVer && <LifecyclePill label="Last Approved" tone="approved" />}
                            {isSuperseded && <LifecyclePill label="Superseded" tone="superseded" />}
                          </>
                        );
                      })()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedVersionData.version !== currentVersionNum && selectedVersionData.versionStatus !== 'sent' && (
                        <button
                          onClick={() => {
                            setVersionToRevert(selectedVersionData.version);
                            setShowRevertConfirm(true);
                          }}
                          type="button"
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer"
                          style={{
                            fontWeight: 600,
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E5E7EB',
                            color: '#374151',
                            fontFamily: 'Inter, system-ui, sans-serif',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                        >
                          Revert to this version
                        </button>
                      )}
                      {/* Primary action — solid blue. The tinted-blue
                          treatment was only meant for the modal-header
                          pill, not the row CTA. */}
                      <button
                        onClick={() => {}}
                        type="button"
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-[13px] transition-colors cursor-pointer"
                        style={{
                          fontWeight: 600,
                          backgroundColor: 'var(--primary)',
                          borderColor: 'var(--primary)',
                          color: 'var(--primary-foreground, #FFFFFF)',
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0866da'; e.currentTarget.style.borderColor = '#0866da'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
                      >
                        Open Version
                      </button>
                    </div>
                  </div>

                  {/* Sent / Confirmed / Valid Until timestamps */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', paddingTop: '12px', borderTop: '1px solid #E5E7EB', flexWrap: 'wrap' as const }}>
                    {selectedVersionData.sentAt && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Send style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                        <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1' }}>
                          Sent {selectedVersionData.sentAt}
                        </span>
                      </div>
                    )}
                    {selectedVersionData.confirmedAt && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CheckCircle2 style={{ width: '12px', height: '12px', color: '#059669' }} />
                        <span style={{ fontSize: '12px', color: '#065F46', lineHeight: '1' }}>
                          Confirmed {selectedVersionData.confirmedAt}
                        </span>
                      </div>
                    )}
                    {selectedVersionData.versionStatus === 'sent' && !selectedVersionData.confirmedAt && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock style={{ width: '12px', height: '12px', color: '#D97706' }} />
                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#92400E', lineHeight: '1' }}>
                          Awaiting confirmation
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Clock style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                      <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1' }}>
                        Valid until {selectedVersionData.snapshot.validUntil}
                      </span>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedVersionData.notes && (
                    <div style={{
                      marginBottom: '16px', padding: '10px 12px',
                      backgroundColor: '#F0F9FF', borderLeft: '3px solid #1B6EF3', borderRadius: '0 6px 6px 0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <FileText style={{ width: '14px', height: '14px', color: '#1B6EF3', marginTop: '1px', flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: '11px', fontWeight: 500, color: '#1E40AF', lineHeight: '1', margin: 0, marginBottom: '4px' }}>Notes</p>
                          <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' as const }}>
                            {selectedVersionData.notes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── SNAPSHOT + LINE ITEMS (combined) ──────────────── */}
                  <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' }}>
                    {/* Line Items header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      <Package style={{ width: '11px', height: '11px', color: '#6B7280' }} />
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>Line Items</span>
                      <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>({selectedVersionData.snapshot.lineItems.length})</span>
                    </div>
                    {/* Column headings row */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px',
                      backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB',
                    }}>
                      <div style={{ width: '24px', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1' }}>Item</span>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', flexShrink: 0, width: '40px', textAlign: 'right' as const }}>Qty</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', flexShrink: 0, width: '44px', textAlign: 'center' as const }}>UoM</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', flexShrink: 0, width: '80px', textAlign: 'right' as const }}>Price</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', flexShrink: 0, width: '80px', textAlign: 'right' as const }}>Total</span>
                    </div>
                    {/* Line item rows — Purchase Order parity. */}
                    {selectedVersionData.snapshot.lineItems.length > 0 ? (
                      <div style={{ backgroundColor: '#FFFFFF' }}>
                        {selectedVersionData.snapshot.lineItems.map((li, liIdx) => (
                          <div key={li.id} style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
                            borderTop: liIdx > 0 ? '1px solid #F1F5F9' : 'none',
                          }}>
                            <div style={{
                              width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0,
                              backgroundColor: li.thumbColor || '#F1F5F9',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Package style={{ width: '11px', height: '11px', color: '#94A3B8' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155', lineHeight: '1', marginBottom: '2px' }}>
                                {li.id}
                              </div>
                              <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                {li.description}
                              </div>
                            </div>
                            <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 500, color: '#334155', lineHeight: '1', flexShrink: 0, width: '40px', textAlign: 'right' as const }}>
                              {li.qty}
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: 500, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', flexShrink: 0, width: '44px', textAlign: 'center' as const }}>
                              {li.uom}
                            </span>
                            <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 400, color: '#475569', lineHeight: '1', flexShrink: 0, width: '80px', textAlign: 'right' as const }}>
                              {formatCurrency(li.unitPrice)}
                            </span>
                            <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', lineHeight: '1', flexShrink: 0, width: '80px', textAlign: 'right' as const }}>
                              {formatCurrency(li.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '8px 10px', fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic' }}>No line items</div>
                    )}
                    {/* Subtotal row — Purchase Order parity. */}
                    {selectedVersionData.snapshot.lineItems.length > 0 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                        padding: '8px 14px', borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
                      }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', marginRight: '8px' }}>Subtotal</span>
                        <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', lineHeight: '1', width: '80px', textAlign: 'right' as const }}>
                          {formatCurrency(selectedVersionData.snapshot.lineItems.reduce((s, li) => s + li.total, 0))}
                        </span>
                      </div>
                    )}
                    {/* Footer — Pricing Rules / One-Time Discounts/Premiums
                        on the left, Total on the right. */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 14px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E5E7EB',
                    }}>
                      <span className="tabular-nums" style={{ fontSize: '11px', fontWeight: 400, color: '#64748B', lineHeight: '1' }}>
                        Pricing Rules: <span style={{ fontWeight: 500, color: '#334155' }}>{formatCurrency(selectedVersionData.snapshot.pricingRulesTotal ?? 0)}</span>
                        {' '}&nbsp;·&nbsp;{' '}
                        One-Time Discounts/Premiums: <span style={{ fontWeight: 500, color: '#334155' }}>{formatCurrency(selectedVersionData.snapshot.adjustmentsTotal ?? 0)}</span>
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1' }}>Total</span>
                        <span className="tabular-nums" style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', lineHeight: '1' }}>{formatCurrency(selectedVersionData.snapshot.grandTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── CHANGES — Purchase Order parity: Edit icon +
                      uppercase eyebrow + count chip, divider below. Heading
                      reads "Creation Summary" on V1, "Changes" elsewhere. */}
                  {selectedVersionData.changes.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', marginBottom: '10px', borderBottom: '1px solid #E5E7EB' }}>
                        <Edit style={{ width: '12px', height: '12px', color: '#64748B' }} />
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1' }}>
                          {selectedVersionData.version === 1 ? 'Creation Summary' : 'Changes'}
                        </span>
                        <span className="inline-flex items-center rounded-md tabular-nums" style={{ padding: '1px 6px', backgroundColor: '#F1F5F9', color: '#64748B', fontSize: '10px', fontWeight: 600, lineHeight: 1.4 }}>
                          {selectedVersionData.changes.length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                        {selectedVersionData.changes.map((change, cidx) => {
                          const ct = changeKindConfig[change.action];
                          const CIcon = ct.icon;
                          const userInitials = getUserInitials(change.user);
                          const userColor = getUserColor(change.user);

                          return (
                            <div
                              key={change.id}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                padding: '9px 0',
                                borderTop: cidx > 0 ? '1px solid #F1F5F9' : 'none',
                              }}
                            >
                              <div style={{
                                width: '24px', height: '24px', borderRadius: '6px',
                                backgroundColor: ct.bg, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', flexShrink: 0, marginTop: '0px',
                              }}>
                                <CIcon style={{ width: '12px', height: '12px', color: ct.color }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A', lineHeight: '1.3', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' as const }}>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: change.action === 'Added' ? '#059669' : change.action === 'Removed' ? '#DC2626' : '#D97706', marginRight: '5px', lineHeight: '1' }}>{change.action}:</span>
                                  <span style={{ fontWeight: 600, color: '#0F172A', marginRight: '4px' }}>{change.subject}</span>
                                  {change.itemRef && <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>on {change.itemRef}</span>}
                                </div>
                                {change.subjectDetail && (
                                  <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.3', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                    {change.subjectDetail}
                                  </div>
                                )}
                                {change.detail && (
                                  <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.3', marginTop: '2px' }}>
                                    {change.detail}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                <div style={{
                                  width: '20px', height: '20px', borderRadius: '50%',
                                  backgroundColor: userColor, display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#FFFFFF',
                                  lineHeight: '1',
                                }}>
                                  {userInitials}
                                </div>
                                <span style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1' }}>
                                  {change.timestamp}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' as const }}>
                  <div style={{ width: '64px', height: '64px', backgroundColor: compareMode ? '#E7F3FF' : '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    {compareMode ? (
                      <GitCompare style={{ width: '32px', height: '32px', color: '#93C5FD' }} />
                    ) : (
                      <Clock style={{ width: '32px', height: '32px', color: '#D1D5DB' }} />
                    )}
                  </div>
                  <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
                    {compareMode
                      ? compareVersions[0] !== null
                        ? 'Select a second version to compare'
                        : 'Select two versions to compare'
                      : 'Select a version to view changes'}
                  </p>
                  {compareMode && (
                    <p style={{ fontSize: '12px', color: '#D1D5DB', margin: 0, marginTop: '6px' }}>
                      Click versions in the left panel to select them
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      </DialogContent>

      {/* Revert Confirmation Modal — stacked Dialog (rendered via portal at higher z) */}
      {showRevertConfirm && versionToRevert !== null && (
        <RevertConfirmModal
          version={versionToRevert}
          onClose={() => { setShowRevertConfirm(false); setVersionToRevert(null); }}
          onConfirm={(reason: string) => handleRevert(versionToRevert, reason)}
        />
      )}

      <StateTransitionOverlay
        isActive={revertOverlay.show}
        fromLabel={`V${revertOverlay.fromVersion} · Latest`}
        toLabel={`V${revertOverlay.toVersion} · Latest`}
        tone="version"
        Icon={GitBranch}
        heading={`Reverting to V${revertOverlay.toVersion}`}
        meta={`V${revertOverlay.fromVersion} → V${revertOverlay.toVersion}`}
        duration={2000}
        onComplete={finalizeRevert}
      />
    </Dialog>
  );
}

// ── Revert Confirm Modal ──────────────────────────────────────────
function RevertConfirmModal({ version, onClose, onConfirm }: {
  version: number; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  // Routes through the shared `ConfirmDiscardModal` (Partner v7 chrome:
  // gradient banner, glow icon, h-11 stacked buttons) — same component the
  // version tab's Revert button uses, so the modal looks identical wherever
  // a revert is initiated.
  return (
    <ConfirmDiscardModal
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      badge={`Revert to V${version}`}
      title={`Revert to V${version}?`}
      description={`V${version} will become the latest version of this quote. Its existing status is preserved. The next material change will auto-create a new version.`}
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
          onChange={e => setReason(e.target.value)}
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
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>
    </ConfirmDiscardModal>
  );
}

/* Shared lifecycle pill — rounded-full chrome that matches the
   listing's Status column pill, used for Latest / Last Approved /
   Superseded / Viewing across the modal, dropdown, and Versions tab.
   Centralised here so the four tones stay aligned visually no matter
   where they render. */
type LifecycleTone = 'latest' | 'approved' | 'superseded' | 'viewing';
const LIFECYCLE_TONES: Record<LifecycleTone, { bg: string; color: string; border: string }> = {
  latest:     { bg: '#EFF6FF', color: '#1E40AF', border: '#93C5FD' },
  approved:   { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  superseded: { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
  viewing:    { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
};
export function LifecyclePill({ label, tone }: { label: string; tone: LifecycleTone }) {
  const t = LIFECYCLE_TONES[tone];
  /* Same chrome as StatusBadge (`px-2.5 py-1` / `text-xs` / weight 500
     / rounded-full / 1px border) so the quote-status pill and the
     lifecycle pill sit on a row at matching size. */
  return (
    <span
      className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap shrink-0"
      style={{
        fontWeight: 500,
        backgroundColor: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
      }}
    >
      {label}
    </span>
  );
}