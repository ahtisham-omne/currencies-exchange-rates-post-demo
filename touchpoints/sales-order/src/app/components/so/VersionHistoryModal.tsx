import React, { useState } from 'react';
import { X, Clock, User, FileText, GitCompare, DollarSign, Package, Plus, Minus, Pencil, Trash2, Edit, ArrowUp, ArrowDown, Tag, Send, CheckCircle2, Scale, RotateCcw, AlertCircle, Check, Truck, Lock, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { compareNumbers, compareValueText, compareValuesDiffer, isNumericCompare, type CompareField } from '@/app/components/shared/versionCompare';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { ConfirmDiscardModal } from '../shared/ConfirmDiscardModal';
import { SOStatusBadge } from './StatusBadge';
import { StateTransitionOverlay } from '@/app/components/shared/StateTransitionOverlay';
import type { SOStatus } from './types';
import { useDesignMoney } from "@/app/components/currency/docCurrencyContext";

/* Right-pane "Order Status" badge mapping.
   The version's internal status (draft / pending-review / cleared /
   shipped) maps to the SOStatus value the listing's Status column
   uses, so the pill in the modal matches the row's vocabulary. */
function versionStatusToListingStatus(vs: 'draft' | 'pending-review' | 'cleared' | 'shipped'): SOStatus {
  switch (vs) {
    case 'draft':          return 'Draft' as SOStatus;
    case 'pending-review': return 'Pending Review' as SOStatus;
    case 'cleared':        return 'Cleared' as SOStatus;
    case 'shipped':        return 'Shipped' as SOStatus;
  }
}

/* Shared lifecycle pill (mirrors the Quote module helper) — used for
   Latest / Last Approved / Superseded / Viewing across the modal,
   VersionDropdown, and Versions tab. Centralised here so SO's three
   tones stay aligned with the Quote module visually. */
type LifecycleTone = 'latest' | 'approved' | 'superseded' | 'viewing';
const LIFECYCLE_TONES: Record<LifecycleTone, { bg: string; color: string; border: string }> = {
  latest:     { bg: '#EFF6FF', color: '#1E40AF', border: '#93C5FD' },
  approved:   { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  superseded: { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
  viewing:    { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
};
export function LifecyclePill({ label, tone }: { label: string; tone: LifecycleTone }) {
  const t = LIFECYCLE_TONES[tone];
  /* Same chrome as SOStatusBadge (`px-2.5 py-1` / `text-xs` / weight 500
     / rounded-full / 1px border) so the version-status pill and the
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

// ── Types ──────────────────────────────────────────────────────────
type ChangeType = 'line-item-added' | 'line-item-removed' | 'line-item-modified' | 'pricing-changed' |
  'customer-changed' | 'config-changed' | 'attachment-added' | 'rule-applied' | 'adjustment-applied' | 'shipment';

export type SOVersionStatus = 'draft' | 'pending-review' | 'cleared' | 'shipped';

export interface SOVersionChange {
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
  shippedQty?: number;
}

export interface SOVersionSnapshot {
  lineItemCount: number;
  grandTotal: number;
  rulesCount: number;
  adjustmentsCount: number;
  /* Signed dollar impact of pricing rules / one-time adjustments —
     surfaced in the table footer instead of PO's shipping / discount
     line since this domain doesn't carry those. */
  pricingRulesTotal?: number;
  adjustmentsTotal?: number;
  warehouse: string;
  /** Names of the warehouses the customer picks up from; empty when none. */
  pickupWarehouses: string[];
  lineItems: LineItem[];
}

export interface SOVersionEntry {
  version: number;
  versionStatus: SOVersionStatus;
  clearedAt?: string;
  createdAt?: string;
  sentBy: string;
  avatar: string;
  avatarColor: string;
  snapshot: SOVersionSnapshot;
  changes: SOVersionChange[];
  notes?: string;
  isRevert?: boolean;
  revertedFrom?: number;
}

interface VersionHistoryModalProps {
  soNumber: string;
  currentVersion: number;
  onClose: () => void;
  onRevert?: (toVersion: number) => void;
}

/* Change-kind icon + color — keyed by the high-level action (Added /
   Removed / Changed) only. The previous 10-entry per-type map rotated
   icons by sub-type (User for customer-changed, Truck for shipment,
   Scale for rule-applied, etc.) which made the feed feel noisy. The
   real distinction is just "what kind of delta is this" — green +,
   red −, amber edit — so icon + colour now come purely from
   `change.action`, never from `change.type`. */
const changeKindConfig: Record<'Added' | 'Removed' | 'Changed', { icon: React.ElementType; color: string; bg: string }> = {
  Added:   { icon: Plus,   color: '#059669', bg: '#D1FAE5' },
  Removed: { icon: Minus,  color: '#DC2626', bg: '#FEE2E2' },
  Changed: { icon: Pencil, color: '#D97706', bg: '#FEF3C7' },
};

/* The version history here is the design's mock, written in USD; it is
   restated in the order's currency (useDesignMoney) inside the components. */

const versionStatusConfig: Record<SOVersionStatus, { label: string; bg: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', bg: '#F3F4F6', color: '#374151', icon: FileText },
  'pending-review': { label: 'Pending Review', bg: '#FEF3C7', color: '#92400E', icon: Clock },
  cleared: { label: 'Released', bg: '#CCFBF1', color: '#0F766E', icon: CheckCircle2 },
  shipped: { label: 'Shipped', bg: '#DBEAFE', color: '#1E40AF', icon: Truck },
};

/* Status pill palette — Partner v7 parity, used inside the compare table. */
const STATUS_PILL: Record<string, { bg: string; text: string; border: string }> = {
  Draft:            { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  Sent:             { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  Confirmed:        { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'Pending Review': { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  Cleared:          { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  'Released': { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0' },
  Rejected:         { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
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

function generateSOVersions(): SOVersionEntry[] {
  return [
    {
      version: 3,
      versionStatus: 'draft',
      createdAt: '03/20/2026',
      sentBy: 'Sarah Lindquist',
      avatar: 'SL',
      avatarColor: '#3B82F6',
      notes: 'Modified quantities for 2 line items and added emergency lighting per customer revision request.',
      snapshot: {
        lineItemCount: 5, grandTotal: 198500, rulesCount: 1, adjustmentsCount: 1, pricingRulesTotal: -3500, adjustmentsTotal: -1200, warehouse: 'Warehouse A — Dallas', pickupWarehouses: ['Columbus Conversion Plant', 'Tacoma Cross Dock'],
        lineItems: [
          { id: '000-100-002', description: 'E-450 stripped chassis, 176" WB, 7.3L V8, dual rear wheels, 16,000 GVWR', qty: 2, uom: 'EA', unitPrice: 48200, total: 96400, thumbColor: '#DBEAFE', shippedQty: 1 },
          { id: '000-100-001', description: 'Cutaway cab-chassis with 178" wheelbase, 10,360 GVWR, 3.5L EcoBoost V6', qty: 1, uom: 'EA', unitPrice: 42500, total: 42500, thumbColor: '#D1FAE5' },
          { id: '000-100-026', description: '54" full-size LED lightbar, 16 independently addressable modules', qty: 3, uom: 'EA', unitPrice: 3250, total: 9750, thumbColor: '#FEF3C7' },
          { id: '000-100-049', description: 'P25 Phase II mobile radio, all-band, AES 256 encryption', qty: 2, uom: 'EA', unitPrice: 7850, total: 15700, thumbColor: '#FEE2E2' },
          { id: '000-100-059', description: 'Powered stretcher, 700 lb cap, Power-LOAD compatible', qty: 2, uom: 'EA', unitPrice: 18500, total: 37000, thumbColor: '#E0E7FF' },
        ],
      },
      changes: [
        { id: 'C301', type: 'line-item-modified', action: 'Changed', subject: 'Qty', detail: '1 → 2', itemRef: '000-100-002', timestamp: '10:25 AM', user: 'Sarah Lindquist' },
        { id: 'C302', type: 'line-item-added', action: 'Added', subject: '000-100-026', subjectDetail: '54" full-size LED lightbar', detail: 'Qty: 3 EA · $3,250/EA · Total: $9,750', timestamp: '10:22 AM', user: 'Sarah Lindquist' },
        { id: 'C303', type: 'adjustment-applied', action: 'Added', subject: 'Adjustment', subjectDetail: 'Fleet volume discount', detail: '−2% on total for multi-chassis order', timestamp: '10:15 AM', user: 'Michael Tran' },
      ],
    },
    {
      version: 2,
      versionStatus: 'cleared',
      clearedAt: '03/12/2026 · 11:00 AM',
      createdAt: '03/10/2026',
      sentBy: 'Sarah Lindquist',
      avatar: 'SL',
      avatarColor: '#3B82F6',
      notes: 'Added medical equipment and radio communications per customer build spec.',
      snapshot: {
        lineItemCount: 4, grandTotal: 156700, rulesCount: 1, adjustmentsCount: 0, pricingRulesTotal: -2000, adjustmentsTotal: 0, warehouse: 'Warehouse A — Dallas', pickupWarehouses: ['Columbus Conversion Plant'],
        lineItems: [
          { id: '000-100-002', description: 'E-450 stripped chassis, 176" WB, 7.3L V8, dual rear wheels', qty: 1, uom: 'EA', unitPrice: 48200, total: 48200, thumbColor: '#DBEAFE', shippedQty: 1 },
          { id: '000-100-001', description: 'Cutaway cab-chassis with 178" wheelbase, 10,360 GVWR', qty: 1, uom: 'EA', unitPrice: 42500, total: 42500, thumbColor: '#D1FAE5' },
          { id: '000-100-049', description: 'P25 Phase II mobile radio, all-band, AES 256 encryption', qty: 2, uom: 'EA', unitPrice: 7850, total: 15700, thumbColor: '#FEE2E2' },
          { id: '000-100-059', description: 'Powered stretcher, 700 lb cap, Power-LOAD compatible', qty: 2, uom: 'EA', unitPrice: 18500, total: 37000, thumbColor: '#E0E7FF' },
        ],
      },
      changes: [
        { id: 'C201', type: 'line-item-added', action: 'Added', subject: '000-100-049', subjectDetail: 'P25 Phase II mobile radio', detail: 'Qty: 2 EA · $7,850/EA · Total: $15,700', timestamp: '3:10 PM', user: 'Sarah Lindquist' },
        { id: 'C202', type: 'line-item-added', action: 'Added', subject: '000-100-059', subjectDetail: 'Powered stretcher, 700 lb cap', detail: 'Qty: 2 EA · $18,500/EA · Total: $37,000', timestamp: '3:05 PM', user: 'Sarah Lindquist' },
        { id: 'C203', type: 'rule-applied', action: 'Added', subject: 'Pricing Rule', subjectDetail: 'Government Contract Pricing', detail: 'Eligible items flagged for govt pricing tier', timestamp: '3:12 PM', user: 'Michael Tran' },
      ],
    },
    {
      version: 1,
      versionStatus: 'cleared',
      clearedAt: '03/03/2026 · 2:15 PM',
      createdAt: '03/01/2026',
      sentBy: 'Sarah Lindquist',
      avatar: 'SL',
      avatarColor: '#3B82F6',
      notes: 'Initial Sales Order created from Quote Q-2026-0089.',
      snapshot: {
        lineItemCount: 2, grandTotal: 90700, rulesCount: 0, adjustmentsCount: 0, pricingRulesTotal: 0, adjustmentsTotal: 0, warehouse: 'Warehouse A — Dallas', pickupWarehouses: [],
        lineItems: [
          { id: '000-100-002', description: 'E-450 stripped chassis, 176" WB, 7.3L V8, dual rear wheels', qty: 1, uom: 'EA', unitPrice: 48200, total: 48200, thumbColor: '#DBEAFE' },
          { id: '000-100-001', description: 'Cutaway cab-chassis with 178" wheelbase, 10,360 GVWR', qty: 1, uom: 'EA', unitPrice: 42500, total: 42500, thumbColor: '#D1FAE5' },
        ],
      },
      changes: [
        { id: 'C101', type: 'line-item-added', action: 'Added', subject: '000-100-002', subjectDetail: 'E-450 stripped chassis', detail: 'Qty: 1 EA · $48,200/EA', timestamp: '10:00 AM', user: 'Sarah Lindquist' },
        { id: 'C102', type: 'line-item-added', action: 'Added', subject: '000-100-001', subjectDetail: 'Cutaway cab-chassis', detail: 'Qty: 1 EA · $42,500/EA', timestamp: '10:00 AM', user: 'Sarah Lindquist' },
        { id: 'C103', type: 'customer-changed', action: 'Changed', subject: 'Customer', detail: 'Tri-County EMS Authority', timestamp: '9:55 AM', user: 'Sarah Lindquist' },
      ],
    },
  ];
}

export function VersionHistoryModal({ soNumber, currentVersion, onClose, onRevert }: VersionHistoryModalProps) {
  const formatCurrency = useDesignMoney().whole;
  /* Remap the rich `generateSOVersions()` templates onto the SO's
     actual version count so the modal's row list matches what the
     SO listing badge ("v4") shows for this record. Without this
     remap the modal always rendered v1–v3 regardless of the SO. */
  const [versions, setVersions] = useState<SOVersionEntry[]>(() => {
    const templates = generateSOVersions();
    const target = Math.max(1, Math.floor(currentVersion || 1));
    const list: SOVersionEntry[] = [];
    for (let i = 0; i < target; i++) {
      const vNum = target - i;
      const tpl = templates[i] || templates[templates.length - 1];
      list.push({ ...tpl, version: vNum, versionStatus: i === 0 ? tpl.versionStatus : 'cleared' });
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
      const appended = `Reverted to this version on ${stamp} · Sarah Lindquist: ${trimmed}`;
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
      description: `V${toVersion} is now the latest version of this sales order.`,
      position: 'top-right',
    });
  };

  const handleVersionClick = (version: number) => {
    if (compareMode) {
      const [a, b] = compareVersions;
      if (a === version) setCompareVersions([b, null]);
      else if (b === version) setCompareVersions([a, null]);
      else if (a === null) setCompareVersions([version, null]);
      else if (b === null) setCompareVersions([a, version]);
      else setCompareVersions([a, version]);
    } else {
      setSelectedVersion(version);
    }
  };

  const selectedVersionData = versions.find(v => v.version === selectedVersion);
  /* "Last Approved" = the most recent cleared version that ISN'T the
     currently-active one. After a revert to V[N], the version that was
     previously head becomes Last Approved; everything else cleared
     reads as Superseded. */
  const lastApprovedVersionNum = versions
    .filter(v => v.versionStatus === 'cleared' && v.version !== currentVersionNum)
    .reduce((max, v) => v.version > max ? v.version : max, -1);

  const getUserColor = (name: string) => {
    if (name === 'Sarah Lindquist') return '#3B82F6';
    if (name === 'Michael Tran') return '#8B5CF6';
    if (name === 'Emily Rios') return '#F59E0B';
    if (name === 'David Kowalski') return '#059669';
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
        <DialogTitle className="sr-only">Version History — {soNumber}</DialogTitle>
        <DialogDescription className="sr-only">
          Versions are created when cleared by Ops. Current is the latest cleared version.
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
                Version History — {soNumber}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1.35', margin: 0, marginTop: '2px' }}>
                Versions are created when cleared by Ops · Current = latest cleared
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* "N versions" counter — Partner's "<count> carriers"
                pattern, sits left of the primary action. */}
            <span className="text-sm tabular-nums hidden sm:inline" style={{ fontWeight: 500 }}>
              <span style={{ color: 'var(--foreground)' }}>{versions.length}</span>
              <span style={{ color: 'var(--muted-foreground)', opacity: 0.7 }}>
                {' '}{versions.length === 1 ? 'version' : 'versions'}
              </span>
            </span>
            {/* Compare button hides entirely when the SO has only one
                version — there's nothing to compare against, so
                surfacing the action would be misleading. */}
            {versions.length > 1 && (() => {
              /* Compare button — green tint off, blue tint when active
                 so the two states are visually distinct. Same chrome
                 across Quote + SO modals. */
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
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', transition: 'background-color 100ms' }}
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
          <div style={{ width: '28%', borderRight: '1px solid #E5E7EB', overflowY: 'auto', backgroundColor: '#FAFBFC', scrollbarWidth: 'thin' as const, display: 'flex', flexDirection: 'column' as const }}>
            {compareMode && (
              <div style={{ padding: '10px 16px', flexShrink: 0, backgroundColor: '#EFF6FF', borderBottom: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GitCompare style={{ width: '14px', height: '14px', color: '#1B6EF3', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E40AF', lineHeight: '1.3' }}>Compare Mode</div>
                  <div style={{ fontSize: '11px', color: '#3B82F6', lineHeight: '1.3', marginTop: '1px' }}>
                    {compareVersions[0] === null ? 'Select 2 versions to compare' : compareVersions[1] === null ? '1 selected — pick one more' : '2 versions selected'}
                  </div>
                </div>
              </div>
            )}
            <div style={{ padding: '16px', flex: 1, overflowY: 'auto', scrollbarWidth: 'thin' as const }}>
              {versions.map((version, index) => {
                const isSelected = compareMode ? compareVersions.includes(version.version) : selectedVersion === version.version;
                const isCurrent = version.version === currentVersionNum;
                const hasShippedItems = version.snapshot.lineItems.some(li => (li.shippedQty || 0) > 0);
                const compareLabel = compareMode && isSelected ? compareVersions[0] === version.version ? 'A' : 'B' : null;
                /* Unified lifecycle tags — same vocabulary the Quote
                   module uses, kept consistent so the user reads the
                   same chip set in both modules:
                     • Latest        — the active version (currentVersionNum)
                     • Last Approved — most recent cleared, not the active one
                     • Superseded    — older 'cleared' versions */
                const isLatestVer = version.version === currentVersionNum;
                const isLastApprovedVer = version.version === lastApprovedVersionNum;
                const isSuperseded = version.versionStatus === 'cleared' && !isLatestVer;

                const isLast = index === versions.length - 1;
                return (
                  <div key={version.version} style={{ position: 'relative', paddingBottom: isLast ? '0' : '10px' }}>
                    {/* Timeline connector — threads through the 36-px badge
                        in the rail to the left of the card. Hidden in compare
                        mode where the checkbox column replaces the rail. */}
                    {!isLast && !compareMode && (
                      <div style={{ position: 'absolute', left: '17px', top: '38px', bottom: '0', width: '2px', backgroundColor: '#E2E8F0', zIndex: 0 }} />
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', position: 'relative', zIndex: 1 }}>
                      {compareMode && (
                        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', flexShrink: 0, width: '28px', marginRight: '4px' }}>
                          <button
                            onClick={() => handleVersionClick(version.version)}
                            style={{ width: '28px', height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '14px', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <div style={{
                              width: '18px', height: '18px', borderRadius: '4px',
                              border: isSelected ? 'none' : '2px solid #D1D5DB',
                              backgroundColor: isSelected ? '#1B6EF3' : '#FFFFFF',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 150ms', boxShadow: isSelected ? '0 1px 3px rgba(27,110,243,0.3)' : 'none',
                            }}>
                              {isSelected && <span style={{ fontSize: '10px', fontWeight: 700, color: '#FFFFFF', lineHeight: '1' }}>{compareLabel}</span>}
                            </div>
                          </button>
                          {index < versions.length - 1 && <div style={{ flex: 1, width: '2px', backgroundColor: '#E5E7EB', marginTop: '4px', minHeight: '8px' }} />}
                        </div>
                      )}
                      {/* Timeline rail (non-compare mode) — version badge
                          sits ON the connector line so it reads as a node on
                          a timeline. */}
                      {!compareMode && (
                        <div style={{ flexShrink: 0, width: '36px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
                          <button
                            onClick={() => handleVersionClick(version.version)}
                            style={{
                              width: '36px', height: '36px', borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: 600, lineHeight: '1', cursor: 'pointer', padding: 0,
                              backgroundColor: isCurrent ? '#D1FAE5' : version.versionStatus === 'cleared' ? '#DBEAFE' : version.versionStatus === 'pending-review' ? '#FEF3C7' : '#F9FAFB',
                              color: isCurrent ? '#065F46' : version.versionStatus === 'cleared' ? '#1E40AF' : version.versionStatus === 'pending-review' ? '#92400E' : '#9CA3AF',
                              border: isCurrent ? '2px solid #86EFAC' : version.versionStatus === 'cleared' ? '2px solid #93C5FD' : version.versionStatus === 'pending-review' ? '2px solid #FDE68A' : '2px solid #E5E7EB',
                            }}
                            aria-label={`Open version ${version.version}`}
                          >
                            v{version.version}
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => handleVersionClick(version.version)}
                        style={{
                          flex: 1, textAlign: 'left' as const, padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', border: 'none',
                          backgroundColor: isSelected ? (compareMode ? '#EFF6FF' : '#F0F7FF') : '#FFFFFF',
                          outline: isSelected ? (compareMode ? '2px solid #60A5FA' : '2px solid #93C5FD') : '1px solid #E5E7EB',
                          transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          {compareMode && (
                            <div style={{
                              flexShrink: 0, width: '36px', height: '36px', borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: 600, lineHeight: '1',
                              backgroundColor: isCurrent ? '#D1FAE5' : version.versionStatus === 'cleared' ? '#DBEAFE' : version.versionStatus === 'pending-review' ? '#FEF3C7' : '#F9FAFB',
                              color: isCurrent ? '#065F46' : version.versionStatus === 'cleared' ? '#1E40AF' : version.versionStatus === 'pending-review' ? '#92400E' : '#9CA3AF',
                              border: isCurrent ? '2px solid #86EFAC' : version.versionStatus === 'cleared' ? '2px solid #93C5FD' : version.versionStatus === 'pending-review' ? '2px solid #FDE68A' : '2px solid #E5E7EB',
                            }}>
                              v{version.version}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Title row — version number + the shipped
                                inline icon. Lifecycle pills moved to a
                                dedicated row below so the placement is
                                identical regardless of pill text width. */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1' }}>Version {version.version}</span>
                              {hasShippedItems && <Truck style={{ width: '11px', height: '11px', color: 'var(--success)' }} />}
                            </div>

                            {/* Lifecycle pill row on the left rail.
                                "Last Released" is intentionally left
                                out here — it lives on the right pane and
                                Versions tab only so the rail stays uncluttered. */}
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
                              <span>{version.clearedAt ? version.clearedAt.split(' · ')[0] : version.createdAt || 'Draft'}</span>
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
                <CompareView
                  v1={versions.find(v => v.version === Math.min(compareVersions[0]!, compareVersions[1]!))!}
                  v2={versions.find(v => v.version === Math.max(compareVersions[0]!, compareVersions[1]!))!}
                  formatCurrency={formatCurrency}
                  changeKindConfig={changeKindConfig}
                  versionStatusConfig={versionStatusConfig}
                />
              ) : selectedVersionData ? (
                // SingleVersionView gets currentVersionNum as latestVersionNum so the
                // right-pane pills follow the same source of truth as the left rail.
                <SingleVersionView
                  version={selectedVersionData}
                  currentVersionNum={currentVersionNum}
                  latestVersionNum={currentVersionNum}
                  lastApprovedVersionNum={lastApprovedVersionNum}
                  versionStatusConfig={versionStatusConfig}
                  changeKindConfig={changeKindConfig}
                  formatCurrency={formatCurrency}
                  getUserColor={getUserColor}
                  getUserInitials={getUserInitials}
                  onRevert={(v) => { setVersionToRevert(v); setShowRevertConfirm(true); }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' as const }}>
                  <div style={{ width: '64px', height: '64px', backgroundColor: compareMode ? '#E7F3FF' : '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    {compareMode ? <GitCompare style={{ width: '32px', height: '32px', color: '#93C5FD' }} /> : <Clock style={{ width: '32px', height: '32px', color: '#D1D5DB' }} />}
                  </div>
                  <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0 }}>
                    {compareMode ? compareVersions[0] !== null ? 'Select a second version to compare' : 'Select two versions to compare' : 'Select a version to view changes'}
                  </p>
                  {compareMode && <p style={{ fontSize: '12px', color: '#D1D5DB', margin: 0, marginTop: '6px' }}>Click versions in the left panel to select them</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>

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

// ── Single Version View ──────────────────────────────────────────
function SingleVersionView({ version, currentVersionNum, latestVersionNum, lastApprovedVersionNum, versionStatusConfig: vsCfg, changeKindConfig: ctCfg, formatCurrency: fmt, getUserColor, getUserInitials, onRevert }: {
  version: SOVersionEntry; currentVersionNum: number; latestVersionNum: number; lastApprovedVersionNum: number;
  versionStatusConfig: Record<SOVersionStatus, { label: string; bg: string; color: string; icon: React.ElementType }>;
  changeKindConfig: Record<"Added" | "Removed" | "Changed", { icon: React.ElementType; color: string; bg: string }>;
  formatCurrency: (n: number) => string;
  getUserColor: (name: string) => string;
  getUserInitials: (name: string) => string;
  onRevert: (version: number) => void;
}) {
  const design = useDesignMoney();
  // vsCfg kept on the props list for backward compatibility with
  // other callers; the right-pane pill now uses the listing's
  // SOStatusBadge so the chrome matches the row the user clicked.
  void vsCfg;
  const hasShippedItems = version.snapshot.lineItems.some(li => (li.shippedQty || 0) > 0);
  const isLatestVer = version.version === latestVersionNum;
  const isLastApprovedVer = version.version === lastApprovedVersionNum;
  const isSuperseded = version.versionStatus === 'cleared' && !isLatestVer && !isLastApprovedVer;

  return (
    <div>
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--foreground)', margin: 0, lineHeight: '1' }}>Version {version.version}</h3>
          {/* Order status — listing pill style + listing vocabulary. */}
          <SOStatusBadge status={versionStatusToListingStatus(version.versionStatus)} />
          {/* Lifecycle pills — same three terms as the left rail
              and the detail-page Versions tab. */}
          {isLatestVer && <LifecyclePill label="Current Version" tone="latest" />}
          {isLastApprovedVer && <LifecyclePill label="Last Released" tone="approved" />}
          {isSuperseded && <LifecyclePill label="Superseded" tone="superseded" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {version.version !== currentVersionNum && version.versionStatus !== 'draft' && (
            <button
              onClick={() => onRevert(version.version)}
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
          {/* Primary action — solid blue. The tinted-blue treatment
              was only meant for the modal-header pill, not the row CTA. */}
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

      {/* Timestamps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', paddingTop: '12px', borderTop: '1px solid #E5E7EB', flexWrap: 'wrap' as const }}>
        {version.createdAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FileText style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
            <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1' }}>Created {version.createdAt}</span>
          </div>
        )}
        {version.clearedAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 style={{ width: '12px', height: '12px', color: '#059669' }} />
            <span style={{ fontSize: '12px', color: '#065F46', lineHeight: '1' }}>Cleared {version.clearedAt}</span>
          </div>
        )}
        {version.versionStatus === 'pending-review' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock style={{ width: '12px', height: '12px', color: '#D97706' }} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#92400E', lineHeight: '1' }}>Awaiting Ops clearance</span>
          </div>
        )}
        {/* Warehouse intentionally omitted from version meta — allocation
            happens at the SO line-item level, not on a version snapshot. */}
      </div>

      {/* Notes */}
      {version.notes && (
        <div style={{ marginBottom: '16px', padding: '10px 12px', backgroundColor: '#F0F9FF', borderLeft: '3px solid #1B6EF3', borderRadius: '0 6px 6px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <FileText style={{ width: '14px', height: '14px', color: '#1B6EF3', marginTop: '1px', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '11px', fontWeight: 500, color: '#1E40AF', lineHeight: '1', margin: 0, marginBottom: '4px' }}>Notes</p>
              <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' as const }}>{version.notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Shipped items warning */}
      {hasShippedItems && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', padding: '8px 10px', backgroundColor: 'rgba(39,185,115,0.08)', borderRadius: '6px', border: '1px solid rgba(39,185,115,0.2)' }}>
          <Truck style={{ width: '13px', height: '13px', color: '#059669', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: '#065F46', lineHeight: '1.3' }}>
            Some items in this version have shipped quantities. These will be included as non-editable in any new version.
          </span>
        </div>
      )}

      {/* Line Items Table */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
          <Package style={{ width: '11px', height: '11px', color: '#6B7280' }} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>Line Items</span>
          <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>({version.snapshot.lineItems.length})</span>
        </div>
        {/* Column header — Purchase Order parity. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ width: '24px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}><span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Item</span></div>
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', width: '40px', textAlign: 'right' as const }}>Qty</span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', width: '44px', textAlign: 'center' as const }}>UoM</span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', width: '80px', textAlign: 'right' as const }}>Price</span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', width: '80px', textAlign: 'right' as const }}>Total</span>
        </div>
        <div style={{ backgroundColor: '#FFFFFF' }}>
          {version.snapshot.lineItems.map((li, liIdx) => {
            const isShipped = (li.shippedQty || 0) > 0;
            return (
              <div key={li.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderTop: liIdx > 0 ? '1px solid #F1F5F9' : 'none', opacity: isShipped ? 0.7 : 1 }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0, backgroundColor: li.thumbColor || '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isShipped ? <Lock style={{ width: '11px', height: '11px', color: '#059669' }} /> : <Package style={{ width: '11px', height: '11px', color: '#94A3B8' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155', lineHeight: '1' }}>{li.id}</span>
                    {isShipped && <span style={{ fontSize: '8px', fontWeight: 600, padding: '1px 4px', borderRadius: '3px', backgroundColor: '#D1FAE5', color: '#065F46' }}>SHIPPED</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{li.description}</div>
                </div>
                <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 500, color: '#334155', width: '40px', textAlign: 'right' as const }}>{li.qty}</span>
                <span style={{ fontSize: '10px', fontWeight: 500, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', width: '44px', textAlign: 'center' as const }}>{li.uom}</span>
                <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 400, color: '#475569', width: '80px', textAlign: 'right' as const }}>{fmt(li.unitPrice)}</span>
                <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', width: '80px', textAlign: 'right' as const }}>{fmt(li.total)}</span>
              </div>
            );
          })}
        </div>
        {/* Subtotal — Purchase Order parity. */}
        {version.snapshot.lineItems.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '8px 14px', borderTop: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginRight: '8px' }}>Subtotal</span>
            <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', width: '80px', textAlign: 'right' as const }}>{fmt(version.snapshot.lineItems.reduce((s, li) => s + li.total, 0))}</span>
          </div>
        )}
        {/* Footer — Pricing Rules / One-Time Discounts/Premiums on the
            left, Total on the right. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E5E7EB' }}>
          <span className="tabular-nums" style={{ fontSize: '11px', fontWeight: 400, color: '#64748B', lineHeight: '1' }}>
            Pricing Rules: <span style={{ fontWeight: 500, color: '#334155' }}>{fmt(version.snapshot.pricingRulesTotal ?? 0)}</span>
            {' '}&nbsp;·&nbsp;{' '}
            One-Time Discounts/Premiums: <span style={{ fontWeight: 500, color: '#334155' }}>{fmt(version.snapshot.adjustmentsTotal ?? 0)}</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Total</span>
            <span className="tabular-nums" style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{fmt(version.snapshot.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Changes — Purchase Order parity: Edit icon + uppercase eyebrow
          + count chip, divider below. Heading reads "Creation Summary"
          on V1, "Changes" elsewhere. */}
      {version.changes.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', marginBottom: '10px', borderBottom: '1px solid #E5E7EB' }}>
            <Edit style={{ width: '12px', height: '12px', color: '#64748B' }} />
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1' }}>
              {version.version === 1 ? 'Creation Summary' : 'Changes'}
            </span>
            <span className="inline-flex items-center rounded-md tabular-nums" style={{ padding: '1px 6px', backgroundColor: '#F1F5F9', color: '#64748B', fontSize: '10px', fontWeight: 600, lineHeight: 1.4 }}>
              {version.changes.length}
            </span>
          </div>
          {version.changes.map((change, cidx) => {
            const ct = ctCfg[change.action];
            const CIcon = ct.icon;
            const userInitials = getUserInitials(change.user);
            const userColor = getUserColor(change.user);
            return (
              <div key={change.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 0', borderTop: cidx > 0 ? '1px solid #F1F5F9' : 'none' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: ct.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CIcon style={{ width: '12px', height: '12px', color: ct.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#0F172A', lineHeight: '1.3', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: change.action === 'Added' ? '#059669' : change.action === 'Removed' ? '#DC2626' : '#D97706', marginRight: '5px' }}>{change.action}:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A', marginRight: '4px' }}>{change.subject}</span>
                    {change.itemRef && <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>on {change.itemRef}</span>}
                  </div>
                  {change.subjectDetail && <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.3', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{change.subjectDetail}</div>}
                  {change.detail && <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.3', marginTop: '2px' }}>{design.text(change.detail)}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: userColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#FFFFFF' }}>{userInitials}</div>
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{change.timestamp}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Compare View ──────────────────────────────────────────────────
function CompareView({ v1, v2, formatCurrency: fmt, changeKindConfig: ctCfg, versionStatusConfig: vsCfg }: {
  v1: SOVersionEntry; v2: SOVersionEntry;
  formatCurrency: (n: number) => string;
  changeKindConfig: Record<"Added" | "Removed" | "Changed", { icon: React.ElementType; color: string; bg: string }>;
  versionStatusConfig: Record<SOVersionStatus, { label: string; bg: string; color: string; icon: React.ElementType }>;
}) {
  const design = useDesignMoney();
  const v1Map = new Map(v1.snapshot.lineItems.map(li => [li.id, li]));
  const v2Map = new Map(v2.snapshot.lineItems.map(li => [li.id, li]));
  const allIds = Array.from(new Set([...v1.snapshot.lineItems.map(li => li.id), ...v2.snapshot.lineItems.map(li => li.id)]));

  type DiffStatus = 'unchanged' | 'added' | 'removed' | 'modified';
  const getDiffStatus = (id: string): DiffStatus => {
    const inV1 = v1Map.has(id); const inV2 = v2Map.has(id);
    if (inV1 && !inV2) return 'removed';
    if (!inV1 && inV2) return 'added';
    if (inV1 && inV2) { const a = v1Map.get(id)!; const b = v2Map.get(id)!; if (a.qty !== b.qty || a.unitPrice !== b.unitPrice || a.total !== b.total) return 'modified'; }
    return 'unchanged';
  };

  const diffBg: Record<DiffStatus, string> = { unchanged: '#FFFFFF', added: '#F0FDF4', removed: '#FEF2F2', modified: '#FFFBEB' };
  const diffBorder: Record<DiffStatus, string> = { unchanged: '#F7F8F9', added: '#BBF7D0', removed: '#FECACA', modified: '#FDE68A' };

  const summaryFields: CompareField[] = [
    { label: 'Status', val1: vsCfg[v1.versionStatus].label, val2: vsCfg[v2.versionStatus].label, kind: 'status' },
    { label: 'Line Items', val1: String(v1.snapshot.lineItemCount), val2: String(v2.snapshot.lineItemCount) },
    { label: 'Grand Total', val1: fmt(v1.snapshot.grandTotal), val2: fmt(v2.snapshot.grandTotal) },
    { label: 'Rules', val1: String(v1.snapshot.rulesCount), val2: String(v2.snapshot.rulesCount) },
    { label: 'Adjustments', val1: String(v1.snapshot.adjustmentsCount), val2: String(v2.snapshot.adjustmentsCount) },
    { label: 'Pickup Warehouse(s)', val1: v1.snapshot.pickupWarehouses, val2: v2.snapshot.pickupWarehouses },
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
    const isShipped = (li.shippedQty || 0) > 0;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: diffBg[status], borderBottom: `1px solid ${diffBorder[status]}` }}>
        <div style={{ width: '20px', height: '20px', borderRadius: '3px', flexShrink: 0, backgroundColor: li.thumbColor || '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isShipped ? <Lock style={{ width: '8px', height: '8px', color: '#059669' }} /> : <Package style={{ width: '9px', height: '9px', color: '#6B7280', opacity: 0.5 }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '9px', fontWeight: 600, color: '#6B7280', lineHeight: '1', marginBottom: '1px' }}>{li.id}</div>
          <div style={{ fontSize: '10px', color: '#374151', lineHeight: '1.1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{li.description}</div>
        </div>
        <span style={{ fontSize: '10px', color: isChanged ? '#92400E' : '#6B7280', fontWeight: isChanged ? 600 : 400, width: '24px', textAlign: 'right' as const }}>{li.qty}</span>
        <span style={{ fontSize: '10px', color: '#9CA3AF', width: '24px', textAlign: 'center' as const }}>{li.uom}</span>
        <span style={{ fontSize: '10px', color: isChanged ? '#92400E' : '#9CA3AF', fontWeight: isChanged ? 500 : 400, width: '56px', textAlign: 'right' as const }}>{fmt(li.unitPrice)}</span>
        <span style={{ fontSize: '10px', fontWeight: 600, color: isChanged ? '#92400E' : '#1F2937', width: '56px', textAlign: 'right' as const }}>{fmt(li.total)}</span>
      </div>
    );
  };

  const renderVersionTable = (ver: SOVersionEntry, side: 'left' | 'right') => {
    /* Right pane uses the listing's SOStatusBadge below, so the
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
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>V{ver.version} Line Items</span>
            <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500 }}>({ver.snapshot.lineItems.length})</span>
          </div>
          <SOStatusBadge status={versionStatusToListingStatus(ver.versionStatus)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ width: '20px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}><span style={colHeaderStyle}>Item</span></div>
          <span style={{ ...colHeaderStyle, width: '24px', textAlign: 'right' as const }}>Qty</span>
          <span style={{ ...colHeaderStyle, width: '24px', textAlign: 'center' as const }}>Unit</span>
          <span style={{ ...colHeaderStyle, width: '56px', textAlign: 'right' as const }}>Price</span>
          <span style={{ ...colHeaderStyle, width: '56px', textAlign: 'right' as const }}>Total</span>
        </div>
        {allIds.map(id => {
          const status = getDiffStatus(id);
          const li = itemMap.get(id) || null;
          return <div key={id}>{renderCompareRow(li, status)}</div>;
        })}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '3px 8px', borderTop: '1px solid #E5E7EB', backgroundColor: subtotalChanged && side === 'right' ? '#FFFBEB' : '#FFFFFF' }}>
          <span style={{ fontSize: '9px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.3px', marginRight: '6px' }}>Subtotal</span>
          <span style={{ fontSize: '10px', fontWeight: 600, color: subtotalChanged && side === 'right' ? '#92400E' : '#374151', minWidth: '56px', textAlign: 'right' as const }}>{fmt(otherSubtotal)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: totalChanged && side === 'right' ? '#FFFBEB' : '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: '9px', color: '#6B7280' }}>{ver.snapshot.rulesCount} rules · {ver.snapshot.adjustmentsCount} adj.</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '9px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.3px' }}>Total</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: totalChanged && side === 'right' ? '#92400E' : '#1F2937' }}>{fmt(ver.snapshot.grandTotal)}</span>
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
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: 0 }}>Version {v1.version} → Version {v2.version}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {addedCount > 0 && <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#D1FAE5', color: '#065F46' }}>+{addedCount} added</span>}
          {removedCount > 0 && <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FEE2E2', color: '#991B1B' }}>{removedCount} removed</span>}
          {modifiedCount > 0 && <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E' }}>{modifiedCount} changed</span>}
        </div>
      </div>

      {/* Summary field comparison — split into two side-by-side cards
          so the layout matches the line-items + changes panes below.
          See Quote module `VersionHistoryModal` for the same pattern. */}
      {(() => {
        const renderSummaryCard = (v: typeof v1, side: 'left' | 'right') => (
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#FAFBFC', borderBottom: '1px solid #E5E7EB' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>V{v.version} · {v.clearedAt?.split(' · ')[0] || v.createdAt || '—'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr)', padding: '6px 12px', backgroundColor: '#FAFBFC', borderBottom: '1px solid #E5E7EB' }}>
              <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Field</span>
              <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Value</span>
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
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280' }}>{f.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: side === 'right' && changed ? 600 : 500, color: side === 'right' && changed ? '#0F172A' : (changed ? '#6B7280' : '#1F2937'), textDecoration: isStruck ? 'line-through' : 'none', textDecorationColor: 'rgba(107, 114, 128, 0.4)' }}>{f.kind === 'status' ? <StatusPill value={val} /> : val}</span>
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
        <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280' }}>Legend:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#D1FAE5', border: '1px solid #BBF7D0' }} />
          <span style={{ fontSize: '10px', color: '#065F46' }}>Added</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#FEE2E2', border: '1px solid #FECACA' }} />
          <span style={{ fontSize: '10px', color: '#991B1B' }}>Removed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }} />
          <span style={{ fontSize: '10px', color: '#92400E' }}>Changed</span>
        </div>
      </div>

      {/* Changes comparison — split into two side-by-side cards so the
          visual rhythm matches the summary + line-items panes above.
          Icon + colour come from `changeKindConfig` (action-based, three
          kinds total); the per-modification-type icon switch and the
          unified-row pair grid are gone. */}
      {(v1.changes.length > 0 || v2.changes.length > 0) && (() => {
        const renderChangeRow = (change: SOVersionChange) => {
          const ct = ctCfg[change.action];
          const CIcon = ct.icon;
          return (
            <div key={change.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '10px 12px', borderBottom: '1px solid #F3F4F6', overflow: 'hidden' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '5px', backgroundColor: ct.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CIcon style={{ width: '10px', height: '10px', color: ct.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#1F2937', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  <span style={{ fontWeight: 600, color: ct.color, marginRight: '4px' }}>{change.action}:</span>
                  <span style={{ fontWeight: 600, color: '#1F2937', marginRight: '3px' }}>{change.subject}</span>
                  {change.itemRef && <span style={{ fontWeight: 500, color: '#6B7280' }}>on {change.itemRef}</span>}
                </div>
                {change.subjectDetail && <div style={{ fontSize: '10px', color: '#6B7280', lineHeight: '1.3', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{change.subjectDetail}</div>}
                {change.detail && <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.3', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{design.text(change.detail)}</div>}
              </div>
              <span style={{ fontSize: '10px', color: '#9CA3AF', flexShrink: 0, marginTop: '3px', whiteSpace: 'nowrap' as const }}>{change.timestamp}</span>
            </div>
          );
        };
        const renderChangesCard = (v: typeof v1) => (
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
            {/* Card header — Purchase Order parity: Edit icon +
                uppercase eyebrow + count chip. */}
            <div style={{ padding: '8px 14px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit style={{ width: '12px', height: '12px', color: '#64748B' }} />
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Changes in V{v.version}</span>
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
}

// ── Revert Confirm Modal ──────────────────────────────────────────
function RevertConfirmModal({ version, onClose, onConfirm }: {
  version: number; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  // Routes through the shared `ConfirmDiscardModal` so the listing-level
  // revert (this) and the detail-page version-tab revert use the same
  // Partner v7 chrome (gradient banner, glow icon, h-11 stacked buttons).
  return (
    <ConfirmDiscardModal
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      badge={`Revert to V${version}`}
      title={`Revert to V${version}?`}
      description={`V${version} will become the latest version of this sales order. Its existing status is preserved. The next material change starts a new version.`}
      confirmLabel={`Revert to V${version}`}
      cancelLabel="Cancel"
      onConfirm={() => onConfirm(reason.trim())}
    >
      <div>
        <label
          className="block"
          style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none', marginBottom: '6px', lineHeight: '1' }}
        >
          Reason for revert <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g., Customer wants to go back to the original configuration..."
          rows={3}
          className="w-full"
          style={{ fontSize: '13px', fontWeight: 400, color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', outline: 'none', resize: 'none', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.5', boxSizing: 'border-box', transition: 'border-color 150ms, box-shadow 150ms', backgroundColor: '#FFFFFF' }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(10,119,255,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>
    </ConfirmDiscardModal>
  );
}
