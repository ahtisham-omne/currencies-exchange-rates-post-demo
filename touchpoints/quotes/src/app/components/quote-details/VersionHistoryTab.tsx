import React, { useState, useRef } from 'react';
import {
  GitBranch, Clock, ChevronDown, ChevronRight,
  RotateCcw, ArrowLeftRight, X, Check, Package, DollarSign,
  AlertCircle, ArrowRight, ArrowUp, ArrowDown, Tag, Edit, Trash2, User, Plus, Minus, Pencil,
  Send, CheckCircle2, FileText, Scale
} from 'lucide-react';
import { toast } from 'sonner';
import { compareNumbers, compareValueText, compareValuesDiffer, isNumericCompare, type CompareField } from '@/app/components/shared/versionCompare';
import { ConfirmDiscardModal } from '../shared/ConfirmDiscardModal';
import { SearchInput } from '../shared/SearchInput';
import { FiltersButton } from '../shared/FiltersButton';
import { FilterPill } from '../shared/FilterPill';
import {
  FilterModalShell,
  Pill as FilterModalPill,
  Section as FilterModalSection,
  Divider as FilterModalDivider,
} from '../shared/filterModal';
import { useDesignMoney } from '@/app/components/currency/docCurrencyContext';

// ── Types ──────────────────────────────────────────────────────────
type VersionStatus = 'draft' | 'sent' | 'confirmed';

interface VersionChange {
  id: string;
  type: 'line-item-added' | 'line-item-removed' | 'line-item-modified' | 'pricing-changed' |
    'customer-changed' | 'config-changed' | 'attachment-added' | 'rule-applied' | 'adjustment-applied';
  action: 'Added' | 'Removed' | 'Changed';
  subject: string;
  subjectDetail?: string;
  detail?: string;
  itemRef?: string;
  timestamp: string;
  user: string;
}

interface VersionSnapshot {
  lineItemCount: number;
  grandTotal: number;
  rulesCount: number;
  adjustmentsCount: number;
  /* Signed dollar impact of pricing rules on this snapshot (positive
     for premium, negative for discount). Surfaced in the table footer
     instead of PO's shipping / discount line since this domain doesn't
     carry those. */
  pricingRulesTotal?: number;
  /* Signed dollar impact of one-time discounts and premiums on this
     snapshot. Same sign convention as pricing rules. */
  adjustmentsTotal?: number;
  validUntil: string;
  lineItems?: { id: string; description: string; qty: number; uom: string; unitPrice: number; total: number; thumbColor?: string }[];
}

interface Version {
  version: number;
  versionStatus: VersionStatus;
  sentAt?: string;
  confirmedAt?: string;
  sentBy: string;
  avatar: string;
  avatarColor: string;
  reason: string;
  snapshot: VersionSnapshot;
  changes: VersionChange[];
  isRevert?: boolean;
  revertedFrom?: number;
}

// ── Mock Data ──────────────────────────────────────────────────────
// Minimal data shape mirrors Sales Order V5's VersionHistoryTab — terse
// subject/detail strings, 3-4 changes per version, short item descriptions.
const MOCK_VERSIONS: Version[] = [
  {
    version: 3, versionStatus: 'sent',
    sentAt: '02/05/2026 · 10:30 AM',
    sentBy: 'Sarah Chen',
    avatar: 'SC', avatarColor: 'var(--primary)',
    reason: 'Added emergency items per customer request. Applied volume adjustment.',
    snapshot: {
      lineItemCount: 7, grandTotal: 472070, rulesCount: 2, adjustmentsCount: 1, pricingRulesTotal: -8400, adjustmentsTotal: -3120, validUntil: '03/07/2026',
      lineItems: [
        { id: '501-100-001', description: 'E-450 stripped chassis.', qty: 2, uom: 'EA', unitPrice: 48200, total: 96400, thumbColor: 'var(--accent)' },
        { id: '501-100-002', description: 'Cutaway-mount modular body.', qty: 3, uom: 'EA', unitPrice: 94200, total: 282600, thumbColor: 'rgba(5, 150, 105, 0.2)' },
        { id: '501-100-003', description: 'P25 Phase II mobile radio.', qty: 3, uom: 'EA', unitPrice: 7850, total: 23550, thumbColor: 'rgba(220, 38, 38, 0.2)' },
        { id: '501-100-004', description: 'Powered stretcher, 700 lb cap.', qty: 3, uom: 'EA', unitPrice: 18500, total: 55500, thumbColor: 'var(--accent)' },
        { id: '501-100-005', description: '3000W pure sine inverter.', qty: 3, uom: 'EA', unitPrice: 1650, total: 4950, thumbColor: 'rgba(217, 119, 6, 0.2)' },
        { id: '501-100-006', description: 'Linear Super-LED lightbar.', qty: 2, uom: 'EA', unitPrice: 3200, total: 6400, thumbColor: 'rgba(220, 38, 38, 0.1)' },
        { id: '501-100-007', description: 'Auto-eject shoreline, 30A.', qty: 3, uom: 'EA', unitPrice: 890, total: 2670, thumbColor: 'var(--accent)' },
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
    version: 2, versionStatus: 'confirmed',
    sentAt: '01/28/2026 · 3:15 PM',
    confirmedAt: '02/01/2026 · 11:00 AM',
    sentBy: 'Sarah Chen',
    avatar: 'SC', avatarColor: 'var(--primary)',
    reason: 'Added medical equipment per build spec. Fleet volume pricing applied.',
    snapshot: {
      lineItemCount: 5, grandTotal: 463000, rulesCount: 1, adjustmentsCount: 0, pricingRulesTotal: -2000, adjustmentsTotal: 0, validUntil: '02/27/2026',
      lineItems: [
        { id: '501-100-001', description: 'E-450 stripped chassis.', qty: 2, uom: 'EA', unitPrice: 48200, total: 96400, thumbColor: 'var(--accent)' },
        { id: '501-100-002', description: 'Cutaway-mount modular body.', qty: 3, uom: 'EA', unitPrice: 94200, total: 282600, thumbColor: 'rgba(5, 150, 105, 0.2)' },
        { id: '501-100-003', description: 'P25 Phase II mobile radio.', qty: 3, uom: 'EA', unitPrice: 7850, total: 23550, thumbColor: 'rgba(220, 38, 38, 0.2)' },
        { id: '501-100-004', description: 'Powered stretcher, 700 lb cap.', qty: 3, uom: 'EA', unitPrice: 18500, total: 55500, thumbColor: 'var(--accent)' },
        { id: '501-100-005', description: '3000W pure sine inverter.', qty: 3, uom: 'EA', unitPrice: 1650, total: 4950, thumbColor: 'rgba(217, 119, 6, 0.2)' },
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
    version: 1, versionStatus: 'confirmed',
    sentAt: '01/20/2026 · 10:30 AM',
    confirmedAt: '01/22/2026 · 2:15 PM',
    sentBy: 'Sarah Chen',
    avatar: 'SC', avatarColor: 'var(--primary)',
    reason: 'Initial quote created for fleet build-out.',
    snapshot: {
      lineItemCount: 2, grandTotal: 331800, rulesCount: 0, adjustmentsCount: 0, pricingRulesTotal: 0, adjustmentsTotal: 0, validUntil: '02/19/2026',
      lineItems: [
        { id: '501-100-001', description: 'E-450 stripped chassis.', qty: 1, uom: 'EA', unitPrice: 49200, total: 49200, thumbColor: 'var(--accent)' },
        { id: '501-100-002', description: 'Cutaway-mount modular body.', qty: 3, uom: 'EA', unitPrice: 94200, total: 282600, thumbColor: 'rgba(5, 150, 105, 0.2)' },
      ],
    },
    changes: [
      { id: 'C101', type: 'line-item-added', action: 'Added', subject: '501-100-001', subjectDetail: 'E-450 stripped chassis.', detail: 'Qty: 1 EA', timestamp: '10:00 AM', user: 'Sarah Chen' },
      { id: 'C103', type: 'customer-changed', action: 'Changed', subject: 'Customer', detail: 'Tri-County EMS Authority', timestamp: '9:55 AM', user: 'Sarah Chen' },
      { id: 'C104', type: 'config-changed', action: 'Changed', subject: 'Payment Terms', detail: 'Net 30', timestamp: '9:50 AM', user: 'Sarah Chen' },
    ],
  },
];

type VersionFilter = 'all' | 'pricing' | 'line-items' | 'config';

const CURRENT_USER = 'Sarah Chen';

const versionStatusConfig: Record<VersionStatus, { label: string; bg: string; color: string; icon: typeof Send }> = {
  draft: { label: 'Draft', bg: 'var(--muted)', color: 'var(--foreground)', icon: FileText },
  sent: { label: 'Sent', bg: 'var(--accent)', color: 'var(--primary)', icon: Send },
  confirmed: { label: 'Confirmed', bg: '#CCFBF1', color: 'var(--success)', icon: CheckCircle2 },
};

/* ── Status pill palette — Partner v7 parity (AAA-contrast bg/text/border).
   Used inside the compare table so a status field reads as a real status
   chip instead of a colored word + dot. */
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
  if (!p) return <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', lineHeight: 1 }}>{value}</span>;
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

/* Lifecycle pill — shared chrome with VersionHistoryModal + VersionDropdown.
   Same vocabulary across listing modal, dropdown, and this tab. */
type LifecycleTone = 'latest' | 'approved' | 'superseded' | 'viewing';
const LIFECYCLE_TONES: Record<LifecycleTone, { bg: string; color: string; border: string }> = {
  latest:     { bg: '#EFF6FF', color: '#1E40AF', border: '#93C5FD' },
  approved:   { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  superseded: { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
  viewing:    { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
};

function LifecycleTag({ label, tone }: { label: string; tone: LifecycleTone }) {
  const t = LIFECYCLE_TONES[tone];
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border whitespace-nowrap"
      style={{
        fontSize: 11, fontWeight: 500, padding: '2px 10px', lineHeight: 1.4,
        backgroundColor: t.bg, color: t.color, borderColor: t.border,
      }}
    >
      {label}
    </span>
  );
}

function LifecyclePillTab({
  latest, approved, superseded, revert, revertFrom,
}: {
  latest: boolean;
  approved: boolean;
  superseded: boolean;
  revert: boolean;
  revertFrom?: number;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {latest && <LifecycleTag label="Current Version" tone="latest" />}
      {approved && <LifecycleTag label="Last Approved" tone="approved" />}
      {superseded && <LifecycleTag label="Superseded" tone="superseded" />}
      {revert && (
        <LifecycleTag
          label={revertFrom ? `Revert from V${revertFrom}` : 'Revert'}
          tone="viewing"
        />
      )}
    </span>
  );
}

interface VersionHistoryTabProps {
  quoteNumber?: string;
  customerName?: string;
  /** Quote's actual `version` so the tab's row list extends to match
   *  what the listing badge shows. Without this the tab always renders
   *  the static 3-row MOCK_VERSIONS list regardless of the quote. */
  currentVersion?: number;
  onEditAsDraft?: (fromVersion: number, originalStatus?: 'draft' | 'sent' | 'confirmed') => void;
}

export function VersionHistoryTab({ quoteNumber = 'Q-000-000-000', customerName = 'Tri-County EMS Authority', currentVersion, onEditAsDraft }: VersionHistoryTabProps) {
  /* Pad/renumber the rich MOCK_VERSIONS so its top entry equals
     `currentVersion`. Same approach as VersionHistoryModal — keeps the
     listing badge ("v4"), dropdown trigger, and the History tab all on
     one shared count. */
  const [versions, setVersions] = useState<Version[]>(() => {
    const target = Math.max(1, Math.floor(currentVersion || MOCK_VERSIONS[0]?.version || 1));
    const list: Version[] = [];
    for (let i = 0; i < target; i++) {
      const vNum = target - i;
      const tpl = MOCK_VERSIONS[i] || MOCK_VERSIONS[MOCK_VERSIONS.length - 1];
      list.push({ ...tpl, version: vNum, versionStatus: i === 0 ? tpl.versionStatus : 'confirmed' });
    }
    return list;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<VersionFilter>('all');
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set([3]));
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelections, setCompareSelections] = useState<number[]>([]);
  const [showCompareView, setShowCompareView] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState<number | null>(null);

  /* Advanced filters — staged through the shared `FilterModalShell`.
     Lists let the user pick more than one creator or status; an empty
     list means "any". Mirrors the listing FiltersModal's `statuses`/
     `salesReps` pattern so this tab feels like the same component. */
  type AdvancedHistoryFilters = { versionStatuses: string[]; creators: string[] };
  const EMPTY_HISTORY_FILTERS: AdvancedHistoryFilters = { versionStatuses: [], creators: [] };
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<AdvancedHistoryFilters>(EMPTY_HISTORY_FILTERS);
  const advancedFilterCount = historyFilters.versionStatuses.length + historyFilters.creators.length;
  const creators = [...new Set(versions.map(v => v.sentBy))];

  /* "Latest" follows the parent's `currentVersion` pointer so a
     revert-in-place flips the pill onto V[N] without reordering the
     versions array. "Last Approved" is the highest confirmed version
     that ISN'T the active one — so V[max] keeps the Last Approved
     pill after the user reverts back to an earlier V. */
  const latestVersionNum = currentVersion ?? versions[0]?.version ?? 1;
  const lastApprovedVersionNum = versions
    .filter(v => v.versionStatus === 'confirmed' && v.version !== latestVersionNum)
    .reduce((max, v) => v.version > max ? v.version : max, -1);

  /* Pure predicate so both the filter pipeline below and the
     FilterModalShell's CTA count call the same matcher. */
  const versionMatchesAdvanced = (v: Version, f: AdvancedHistoryFilters) => {
    if (f.versionStatuses.length > 0 && !f.versionStatuses.includes(v.versionStatus)) return false;
    if (f.creators.length > 0 && !f.creators.includes(v.sentBy)) return false;
    return true;
  };

  /* The version history is the design's mock, written in USD: restated in
     the quote's currency at its rate date (useDesignMoney). */
  const design = useDesignMoney();
  const formatCurrency = design.whole;

  const toggleExpanded = (v: number) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  const handleCompareSelect = (v: number) => {
    setCompareSelections(prev => {
      if (prev.includes(v)) return prev.filter(x => x !== v);
      if (prev.length >= 2) return [prev[1], v];
      return [...prev, v];
    });
  };

  // Draft conflict state for VersionHistoryTab internal reverts
  const [draftConflictRevert, setDraftConflictRevert] = useState<{ toVersion: number; reason: string } | null>(null);

  const doRevert = (toVersion: number, reason: string, _overwriteDraft: boolean) => {
    const source = versions.find(v => v.version === toVersion);
    if (source) {
      onEditAsDraft?.(toVersion, source.versionStatus);
      const trimmed = reason.trim();
      if (trimmed) {
        const stamp = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        const appended = `Reverted to this version on ${stamp} · ${CURRENT_USER}: ${trimmed}`;
        setVersions(prev => prev.map(v => v.version === toVersion
          ? { ...v, reason: v.reason ? `${appended}\n\n${v.reason}` : appended }
          : v));
      }
      toast.success(`Reverted to V${toVersion}`, {
        description: trimmed || `V${toVersion} is now the latest version.`,
        position: 'top-right',
      });
    }
    setShowRevertConfirm(null);
    setDraftConflictRevert(null);
  };

  const handleRevert = (toVersion: number, reason: string) => {
    doRevert(toVersion, reason, false);
  };

  /* Change-kind icon + color — keyed by `change.action` (Added /
     Removed / Changed) only. Mirror of the same collapse done in
     `VersionHistoryModal`: one icon per kind, three colours total,
     never varied by modification sub-type. */
  const changeKindConfig: Record<'Added' | 'Removed' | 'Changed', { icon: any; color: string; bg: string }> = {
    Added:   { icon: Plus,   color: 'var(--success)',     bg: 'rgba(5, 150, 105, 0.15)' },
    Removed: { icon: Minus,  color: 'var(--destructive)', bg: 'rgba(220, 38, 38, 0.15)' },
    Changed: { icon: Pencil, color: 'var(--warning)',     bg: 'rgba(217, 119, 6, 0.15)' },
  };

  // ── Filter logic ──────────────────────────────────────────────
  const filteredVersions = versions.map(v => {
    const filteredChanges = v.changes.filter(c => {
      const matchesSearch = !searchQuery ||
        c.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.subjectDetail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.detail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.user.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesFilter = true;
      if (activeFilter === 'pricing') matchesFilter = c.type === 'pricing-changed' || c.type === 'rule-applied' || c.type === 'adjustment-applied';
      else if (activeFilter === 'line-items') matchesFilter = c.type.startsWith('line-item');
      else if (activeFilter === 'config') matchesFilter = c.type === 'customer-changed' || (c.type === 'config-changed' && /customer|partner|ship.to|bill.to|contact/i.test(c.subject + ' ' + (c.detail || '')));

      return matchesSearch && matchesFilter;
    });
    return { ...v, changes: filteredChanges };
  }).filter(v => {
    if (!searchQuery && activeFilter === 'all') return true;
    if (v.changes.length > 0) return true;
    const matchesVersionSearch = v.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.sentBy.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesVersionSearch;
  }).filter(v => versionMatchesAdvanced(v, historyFilters));

  const filters: { key: VersionFilter; label: string }[] = [
    { key: 'all', label: 'All Changes' },
    { key: 'line-items', label: 'Line Items' },
    { key: 'pricing', label: 'Pricing & Rules' },
    { key: 'config', label: 'Customer Info' },
  ];

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── Single unified card ─────────────────────────────── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.04)',
        }}
      >
      {/* ── Toolbar area ── */}
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Row 1: Search + Filters button + Compare */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search changes..."
          widthClassName="w-[260px] shrink-0"
        />

        {/* Filter trigger — opens the shared FilterModalShell so this
            surface looks and behaves identically to the listing
            FiltersModal (Dialog + staged-apply + Show N CTA). */}
        <FiltersButton
          count={advancedFilterCount}
          active={showFilterModal}
          onClick={() => setShowFilterModal(true)}
        />
        <FilterModalShell<AdvancedHistoryFilters>
          open={showFilterModal}
          onOpenChange={setShowFilterModal}
          applied={historyFilters}
          empty={EMPTY_HISTORY_FILTERS}
          onApply={(next) => setHistoryFilters(next)}
          countActive={(f) => f.versionStatuses.length + f.creators.length}
          getDraftMatchCount={(draft) => versions.filter(v => versionMatchesAdvanced(v, draft)).length}
          itemLabel="version"
          itemLabelPlural="versions"
        >
          {({ draft, update, toggleMulti }) => (
            <>
              <FilterModalSection title="Version status" subtitle="Filter by where each version sits in its lifecycle.">
                <div className="flex flex-wrap gap-1.5">
                  <FilterModalPill
                    label="Any"
                    selected={draft.versionStatuses.length === 0}
                    onClick={() => update('versionStatuses', [])}
                  />
                  {[
                    { key: 'confirmed', label: 'Confirmed' },
                    { key: 'sent', label: 'Sent' },
                    { key: 'draft', label: 'Draft' },
                  ].map(d => (
                    <FilterModalPill
                      key={d.key}
                      label={d.label}
                      selected={draft.versionStatuses.includes(d.key)}
                      onClick={() => toggleMulti('versionStatuses', d.key)}
                      count={versions.filter(v => v.versionStatus === d.key).length}
                    />
                  ))}
                </div>
              </FilterModalSection>
              <FilterModalDivider />
              <FilterModalSection title="Sent by" subtitle="Filter by the user who recorded the version.">
                <div className="flex flex-wrap gap-1.5">
                  <FilterModalPill
                    label="Everyone"
                    selected={draft.creators.length === 0}
                    onClick={() => update('creators', [])}
                  />
                  {creators.map(c => {
                    const isYou = c === CURRENT_USER;
                    return (
                      <FilterModalPill
                        key={c}
                        label={isYou ? `${c} (you)` : c}
                        selected={draft.creators.includes(c)}
                        onClick={() => toggleMulti('creators', c)}
                        count={versions.filter(v => v.sentBy === c).length}
                      />
                    );
                  })}
                </div>
              </FilterModalSection>
            </>
          )}
        </FilterModalShell>

        <div style={{ flex: 1 }} />

        {/* Compare toggle — same Partners chrome as the listing modal:
            green tint when off (affirmative enter-compare), blue tint
            when active (Exit Compare). Hidden when the quote has only
            one version (nothing to compare against). */}
        {versions.length > 1 && (() => {
          const tint = compareMode
            ? { bg: '#EFF6FF', hoverBg: '#DBEAFE', border: '#BFDBFE', color: '#1E40AF' }
            : { bg: '#ECFDF5', hoverBg: '#D1FAE5', border: '#A7F3D0', color: '#065F46' };
          return (
            <button
              type="button"
              onClick={() => { setCompareMode(!compareMode); setCompareSelections(compareMode ? [] : []); setShowCompareView(false); }}
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
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {compareMode ? 'Exit Compare' : 'Compare'}
            </button>
          );
        })()}
        </div>

        {/* Row 2: Quick filter pills + active filter tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {filters.map(f => (
          <FilterPill
            key={f.key}
            label={f.label}
            active={activeFilter === f.key}
            onClick={() => setActiveFilter(f.key)}
          />
        ))}

        {/* Active filter tags — one chip per selected value in the
            applied advanced filter set. Clicking the X removes just
            that entry from the applied filters (the modal's own
            staged-apply pattern stays untouched here). */}
        {advancedFilterCount > 0 && (
          <>
            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--border)', flexShrink: 0 }} />
            {historyFilters.versionStatuses.map(s => (
              <span key={`vs-${s}`} style={{
                display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                fontSize: '11px', fontWeight: 500, color: 'var(--primary)', backgroundColor: 'var(--accent)',
                borderRadius: '6px', whiteSpace: 'nowrap', lineHeight: '1',
              }}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
                <button onClick={() => setHistoryFilters(prev => ({ ...prev, versionStatuses: prev.versionStatuses.filter(x => x !== s) }))} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X style={{ width: '10px', height: '10px', color: 'var(--primary)' }} />
                </button>
              </span>
            ))}
            {historyFilters.creators.map(c => (
              <span key={`cr-${c}`} style={{
                display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                fontSize: '11px', fontWeight: 500, color: 'var(--primary)', backgroundColor: 'var(--accent)',
                borderRadius: '6px', whiteSpace: 'nowrap', lineHeight: '1',
              }}>
                {c === CURRENT_USER ? 'You' : c}
                <button onClick={() => setHistoryFilters(prev => ({ ...prev, creators: prev.creators.filter(x => x !== c) }))} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X style={{ width: '10px', height: '10px', color: 'var(--primary)' }} />
                </button>
              </span>
            ))}
          </>
        )}

        <div style={{ flex: 1 }} />
        </div>
      </div>

      {/* Divider between toolbar and content */}
      {!compareMode && <div style={{ height: '1px', backgroundColor: 'var(--border)' }} />}

      {/* ── Compare action bar ────────────────────────────────── */}
      {compareMode && (
        <div style={{
          backgroundColor: 'var(--accent)', borderTop: '1px solid var(--accent)', borderBottom: '1px solid var(--accent)',
          padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <ArrowLeftRight style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--primary)', lineHeight: '1' }}>
            Select two versions to compare
            {compareSelections.length > 0 && ` · ${compareSelections.length}/2 selected`}
          </span>
          <div style={{ flex: 1 }} />
          {compareSelections.length === 2 && (
            <button
              onClick={() => setShowCompareView(true)}
              style={{
                height: '28px', padding: '0 12px', fontSize: '12px', fontWeight: 500,
                color: '#FFFFFF', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '6px',
                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
            >
              Compare V{Math.min(...compareSelections)} ↔ V{Math.max(...compareSelections)}
            </button>
          )}
        </div>
      )}

      {/* ── Version list (inline within same card) ──────────── */}
      <div>
        {filteredVersions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <GitBranch style={{ width: '24px', height: '24px', color: 'var(--border)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>No matching changes found</div>
          </div>
        ) : (
          filteredVersions.map((ver, vidx) => {
            const isExpanded = expandedVersions.has(ver.version);
            const isCompareSelected = compareSelections.includes(ver.version);
            const isLastApproved = ver.version === lastApprovedVersionNum;
            const isLatestVersion = ver.version === latestVersionNum;
            /* Same vocabulary as the listing's VersionHistoryModal —
               older confirmed versions read as "Superseded" instead of
               "Confirmed" so two versions never appear co-current. */
            const isSuperseded = ver.versionStatus === 'confirmed' && !isLatestVersion && !isLastApproved;
            const vsCfg = versionStatusConfig[ver.versionStatus];
            const VSIcon = vsCfg.icon;

            return (
              <div key={ver.version}>
                {vidx > 0 && <div style={{ height: '1px', backgroundColor: 'var(--border)' }} />}

                {/* Version header — Purchase Order parity: slate hover
                    tint on expand, no blue left rail. Sits flush with the
                    surrounding card. */}
                <div
                  onClick={() => compareMode ? handleCompareSelect(ver.version) : toggleExpanded(ver.version)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', cursor: 'pointer',
                    backgroundColor: isCompareSelected ? '#EFF6FF' : isExpanded ? 'var(--muted)' : 'transparent',
                    transition: 'background-color 150ms',
                  }}
                  onMouseEnter={e => { if (!isExpanded && !isCompareSelected) e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--muted) 30%, transparent)'; }}
                  onMouseLeave={e => { if (!isExpanded && !isCompareSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* Compare checkbox or expand chevron */}
                  {compareMode ? (
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '4px',
                      border: isCompareSelected ? 'none' : '1.5px solid var(--border)',
                      backgroundColor: isCompareSelected ? 'var(--primary)' : '#FFFFFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 150ms',
                    }}>
                      {isCompareSelected && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} strokeWidth={3} />}
                    </div>
                  ) : (
                    isExpanded
                      ? <ChevronDown style={{ width: '14px', height: '14px', color: 'var(--muted-foreground)', flexShrink: 0 }} />
                      : <ChevronRight style={{ width: '14px', height: '14px', color: 'var(--muted-foreground)', flexShrink: 0 }} />
                  )}

                  {/* Avatar — 30×30 round chip with soft shadow,
                      Purchase Order parity. */}
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    backgroundColor: ver.avatarColor, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#FFFFFF',
                    flexShrink: 0, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.06)',
                  }}>
                    {ver.avatar}
                  </div>

                  {/* Version info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span className="tabular-nums" style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', lineHeight: '1' }}>
                        V{ver.version}
                      </span>
                      {/* Lifecycle pills — same chrome / vocabulary as
                          the listing's VersionHistoryModal and the
                          detail-page VersionDropdown. The internal
                          "Draft/Sent/Confirmed" sub-badge is dropped
                          here too: it duplicated the lifecycle pills
                          and made two versions read as co-current. */}
                      <LifecyclePillTab
                        latest={isLatestVersion}
                        approved={isLastApproved}
                        superseded={isSuperseded}
                        revert={!!ver.isRevert}
                        revertFrom={ver.revertedFrom}
                      />
                      {ver.versionStatus === 'sent' && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                          fontSize: '10px', color: 'var(--warning)', lineHeight: '1',
                        }}>
                          <Clock style={{ width: '9px', height: '9px' }} />
                          Pending confirmation
                        </span>
                      )}
                      {/* `VSIcon` and `vsCfg` are retained on the row for
                          legacy callers in nested compare-mode rendering
                          below; the inline status pill itself moved out. */}
                      {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                      {(() => { void VSIcon; void vsCfg; return null; })()}
                      <span style={{ fontSize: '11px', color: '#94A3B8', lineHeight: '1' }}>·</span>
                      <span className="tabular-nums" style={{ fontSize: '11px', fontWeight: 500, color: '#64748B', lineHeight: '1' }}>{ver.sentAt || 'Not sent'}</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8', lineHeight: '1' }}>·</span>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: '#475569', lineHeight: '1' }}>{ver.sentBy}</span>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 400, color: '#475569', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ver.reason}
                    </div>
                  </div>

                  {/* Snapshot badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1' }}>
                      {ver.snapshot.lineItemCount} items
                    </span>
                    {(ver.snapshot.rulesCount > 0 || ver.snapshot.adjustmentsCount > 0) && (
                      <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', lineHeight: '1' }}>
                        {ver.snapshot.rulesCount}R / {ver.snapshot.adjustmentsCount}A
                      </span>
                    )}
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1' }}>
                      {formatCurrency(ver.snapshot.grandTotal)}
                    </span>
                  </div>

                  {/* Revert action (only for confirmed versions that are not current) */}
                  {!compareMode && ver.versionStatus === 'confirmed' && !isLastApproved && (
                    <button
                      onClick={e => { e.stopPropagation(); setShowRevertConfirm(ver.version); }}
                      title="Revert to this version"
                      style={{
                        width: '28px', height: '28px', borderRadius: '6px', border: 'none',
                        backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <RotateCcw style={{ width: '13px', height: '13px', color: 'var(--muted-foreground)' }} />
                    </button>
                  )}
                </div>

                {/* Expanded content — Purchase Order parity: flat white
                    background, no left rail, no "Viewing snapshot" banner.
                    Indented to align with the avatar gutter from the
                    version row above. */}
                {isExpanded && !compareMode && (
                  <div style={{ padding: '0 16px 16px 60px' }}>
                    {ver.reason && (
                      <div style={{ marginBottom: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                        <div style={{ padding: '10px 12px', backgroundColor: '#F0F9FF', borderLeft: '3px solid var(--primary)', borderRadius: '0 6px 6px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <FileText style={{ width: '14px', height: '14px', color: 'var(--primary)', marginTop: '1px', flexShrink: 0 }} />
                            <div>
                              <p style={{ fontSize: '11px', fontWeight: 500, color: '#1E40AF', lineHeight: '1', margin: 0, marginBottom: '4px' }}>Notes</p>
                              <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' as const }}>
                                {ver.reason}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Compact timestamp strip — small icon chips on a top
                        divider line. Matches PO's Created + Delivery row. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' as const }}>
                      {ver.sentAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Send style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
                          <span className="tabular-nums" style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1' }}>Sent {ver.sentAt}</span>
                        </div>
                      )}
                      {ver.confirmedAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <CheckCircle2 style={{ width: '12px', height: '12px', color: 'var(--success)' }} />
                          <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--success)', lineHeight: '1' }}>Confirmed {ver.confirmedAt}</span>
                        </div>
                      )}
                      {ver.versionStatus === 'sent' && !ver.confirmedAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock style={{ width: '12px', height: '12px', color: 'var(--warning)' }} />
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--warning)', lineHeight: '1' }}>Awaiting confirmation</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
                        <span className="tabular-nums" style={{ fontSize: '12px', color: 'var(--muted-foreground)', lineHeight: '1' }}>Valid until {ver.snapshot.validUntil}</span>
                      </div>
                    </div>

                    {/* Snapshot + Line Items (combined) */}
                    <div style={{
                      border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px',
                    }}>
                      {/* Line Items header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                        <Package style={{ width: '11px', height: '11px', color: 'var(--muted-foreground)' }} />
                        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'none', lineHeight: '1' }}>Line Items</span>
                        <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 500, lineHeight: '1' }}>({ver.snapshot.lineItems ? ver.snapshot.lineItems.length : 0})</span>
                      </div>
                      {/* Column headings row — Purchase Order parity: 10/600
                          slate-500 uppercase labels, slightly tinted bg, wider
                          numeric column reserves (40 / 44 / 80 / 80). */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px',
                        backgroundColor: 'color-mix(in srgb, var(--muted) 30%, transparent)', borderBottom: '1px solid var(--border)',
                      }}>
                        <div style={{ width: '24px', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1' }}>Item</span>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', flexShrink: 0, width: '40px', textAlign: 'right' as const }}>Qty</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', flexShrink: 0, width: '44px', textAlign: 'center' as const }}>UoM</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', flexShrink: 0, width: '80px', textAlign: 'right' as const }}>Price</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', flexShrink: 0, width: '80px', textAlign: 'right' as const }}>Total</span>
                      </div>
                      {/* Line item rows */}
                      {ver.snapshot.lineItems && ver.snapshot.lineItems.length > 0 ? (
                        <div style={{ backgroundColor: '#FFFFFF' }}>
                          {ver.snapshot.lineItems.map((li, liIdx) => (
                            <div key={li.id} style={{
                              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
                              borderTop: liIdx > 0 ? '1px solid var(--border)' : 'none',
                            }}>
                              <div style={{ width: '24px', height: '24px', borderRadius: '4px', flexShrink: 0, backgroundColor: li.thumbColor || 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Package style={{ width: '11px', height: '11px', color: 'var(--muted-foreground)', opacity: 0.6 }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155', lineHeight: '1', marginBottom: '2px' }}>{li.id}</div>
                                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{li.description}</div>
                              </div>
                              <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 500, color: '#334155', lineHeight: '1', flexShrink: 0, width: '40px', textAlign: 'right' as const }}>{li.qty}</span>
                              <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', flexShrink: 0, width: '44px', textAlign: 'center' as const }}>{li.uom}</span>
                              <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 400, color: '#475569', lineHeight: '1', flexShrink: 0, width: '80px', textAlign: 'right' as const }}>{formatCurrency(li.unitPrice)}</span>
                              <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', lineHeight: '1', flexShrink: 0, width: '80px', textAlign: 'right' as const }}>{formatCurrency(li.total)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No line items</div>
                      )}
                      {/* Subtotal row — Purchase Order parity: 10/600
                          uppercase label + 12/600 value, 8px vertical gap. */}
                      {ver.snapshot.lineItems && ver.snapshot.lineItems.length > 0 && (
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                          padding: '8px 14px', borderTop: '1px solid var(--border)', backgroundColor: '#FFFFFF',
                        }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1', marginRight: '8px' }}>Subtotal</span>
                          <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', lineHeight: '1', width: '80px', textAlign: 'right' as const }}>
                            {formatCurrency(ver.snapshot.lineItems.reduce((s, li) => s + li.total, 0))}
                          </span>
                        </div>
                      )}
                      {/* Footer — Pricing Rules / One-Time Discounts/Premiums on
                          the left, Total on the right. Replaces PO's Shipping /
                          Discount line since those don't apply to quotes. */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 14px', backgroundColor: 'color-mix(in srgb, var(--muted) 40%, transparent)', borderTop: '1px solid var(--border)',
                      }}>
                        <span className="tabular-nums" style={{ fontSize: '11px', fontWeight: 400, color: 'var(--muted-foreground)', lineHeight: '1' }}>
                          Pricing Rules: <span style={{ fontWeight: 500, color: '#334155' }}>{formatCurrency(ver.snapshot.pricingRulesTotal ?? 0)}</span>
                          {' '}&nbsp;·&nbsp;{' '}
                          One-Time Discounts/Premiums: <span style={{ fontWeight: 500, color: '#334155' }}>{formatCurrency(ver.snapshot.adjustmentsTotal ?? 0)}</span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1' }}>Total</span>
                          <span className="tabular-nums" style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', lineHeight: '1' }}>{formatCurrency(ver.snapshot.grandTotal)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Changes list — Purchase Order parity: uppercase
                        eyebrow with the count chip on the right, Edit icon
                        on the left, divider below. Heading reads "Creation
                        Summary" on V1, "Changes" everywhere else. */}
                    {ver.changes.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontStyle: 'italic', lineHeight: '1' }}>
                        No recorded changes in this version
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', marginBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                          <Edit style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', lineHeight: '1' }}>
                            {ver.version === 1 ? 'Creation Summary' : 'Changes'}
                          </span>
                          <span className="inline-flex items-center rounded-md tabular-nums" style={{ padding: '1px 6px', backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: '10px', fontWeight: 600, lineHeight: 1.4 }}>
                            {ver.changes.length}
                          </span>
                        </div>
                        {ver.changes.map((change, cidx) => {
                          const ct = changeKindConfig[change.action];
                          const CIcon = ct.icon;
                          const userInitials = change.user.split(' ').map(n => n[0]).join('');
                          const userColor = change.user === 'Sarah Chen' ? 'var(--primary)' : change.user === 'Michael Rodriguez' ? 'var(--primary)' : change.user === 'David Kim' ? 'var(--warning)' : 'var(--muted-foreground)';
                          return (
                            <div
                              key={change.id}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                padding: '8px 0',
                                borderTop: cidx > 0 ? '1px solid #F7F8F9' : 'none',
                              }}
                            >
                              <div style={{
                                width: '22px', height: '22px', borderRadius: '6px',
                                backgroundColor: ct.bg, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                              }}>
                                <CIcon style={{ width: '11px', height: '11px', color: ct.color }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1.3', display: 'flex', alignItems: 'baseline', gap: '0', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: change.action === 'Added' ? 'var(--success)' : change.action === 'Removed' ? 'var(--destructive)' : 'var(--warning)', marginRight: '5px', lineHeight: '1' }}>{change.action}:</span>
                                  <span style={{ fontWeight: 600, color: 'var(--foreground)', marginRight: '4px' }}>{change.subject}</span>
                                  {change.itemRef && (
                                    <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--muted-foreground)', marginRight: '4px' }}>on {change.itemRef}</span>
                                  )}
                                </div>
                                {change.subjectDetail && (
                                  <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.3', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {change.subjectDetail}
                                  </div>
                                )}
                                {change.detail && (
                                  <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.3', marginTop: '1px' }}>
                                    {design.text(change.detail)}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                <div style={{
                                  width: '18px', height: '18px', borderRadius: '50%',
                                  backgroundColor: userColor, display: 'flex', alignItems: 'center',
                                  justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#FFFFFF',
                                  lineHeight: '1',
                                }}>
                                  {userInitials}
                                </div>
                                <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', lineHeight: '1' }}>
                                  {change.timestamp}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </div>{/* close unified card */}

      {/* ── Compare View ──────────────────────────────────────── */}
      {showCompareView && compareSelections.length === 2 && (
        <CompareView
          v1={versions.find(v => v.version === Math.min(...compareSelections))!}
          v2={versions.find(v => v.version === Math.max(...compareSelections))!}
          formatCurrency={formatCurrency}
          onClose={() => setShowCompareView(false)}
        />
      )}

      {/* ── Revert Confirm Modal ──────────────────────────────── */}
      {showRevertConfirm !== null && (
        <RevertConfirmModal
          version={showRevertConfirm}
          onClose={() => setShowRevertConfirm(null)}
          onConfirm={(reason: string) => handleRevert(showRevertConfirm, reason)}
        />
      )}

      {/* ── Draft Conflict Modal (VersionHistoryTab internal) ── */}
      {draftConflictRevert !== null && (
        <DraftConflictInlineModal
          existingDraftVersion={versions[0].version}
          revertFromVersion={draftConflictRevert.toVersion}
          onClose={() => setDraftConflictRevert(null)}
          onOverwrite={() => doRevert(draftConflictRevert.toVersion, draftConflictRevert.reason, true)}
          onCreateNew={() => doRevert(draftConflictRevert.toVersion, draftConflictRevert.reason, false)}
        />
      )}
    </div>
  );
}

// ── Compare View ──────────────────────────────────────────────────
function CompareView({ v1, v2, formatCurrency, onClose }: {
  v1: Version; v2: Version; formatCurrency: (n: number) => string; onClose: () => void;
}) {
  const design = useDesignMoney();
  /* Local kind config so CompareView stays self-contained (mirrors the
     parent component's `changeKindConfig`). Three entries only — icon +
     colour come from `change.action`, never from `change.type`. */
  const changeKindConfig: Record<'Added' | 'Removed' | 'Changed', { icon: any; color: string; bg: string }> = {
    Added:   { icon: Plus,   color: 'var(--success)',     bg: 'rgba(5, 150, 105, 0.15)' },
    Removed: { icon: Minus,  color: 'var(--destructive)', bg: 'rgba(220, 38, 38, 0.15)' },
    Changed: { icon: Pencil, color: 'var(--warning)',     bg: 'rgba(217, 119, 6, 0.15)' },
  };
  const fields: CompareField[] = [
    { label: 'Status', val1: versionStatusConfig[v1.versionStatus].label, val2: versionStatusConfig[v2.versionStatus].label, kind: 'status' },
    { label: 'Line Items', val1: String(v1.snapshot.lineItemCount), val2: String(v2.snapshot.lineItemCount) },
    { label: 'Grand Total', val1: formatCurrency(v1.snapshot.grandTotal), val2: formatCurrency(v2.snapshot.grandTotal) },
    { label: 'Rules', val1: String(v1.snapshot.rulesCount), val2: String(v2.snapshot.rulesCount) },
    { label: 'Adjustments', val1: String(v1.snapshot.adjustmentsCount), val2: String(v2.snapshot.adjustmentsCount) },
    { label: 'Valid Until', val1: v1.snapshot.validUntil, val2: v2.snapshot.validUntil },
  ];

  return (
    <div style={{
      backgroundColor: '#FFFFFF', borderRadius: '0 0 8px 8px',
      border: '1px solid var(--border)', borderTop: 'none', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', backgroundColor: '#F7F8F9', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeftRight style={{ width: '14px', height: '14px', color: 'var(--primary)' }} />
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1' }}>
            Comparing V{v1.version} ↔ V{v2.version}
          </span>
        </div>
        <button onClick={onClose} style={{
          width: '28px', height: '28px', borderRadius: '6px', border: 'none',
          backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <X style={{ width: '14px', height: '14px', color: 'var(--muted-foreground)' }} />
        </button>
      </div>

      {/* Comparison body — two side-by-side summary cards, then the
          line-items pair, then the changes pair. Matches the layout of
          the standalone Version History modal so a user navigating
          between the inline tab and the modal sees the same shape. */}
      <div style={{ padding: '16px' }}>
        {(() => {
          const renderSummaryCard = (v: typeof v1, side: 'left' | 'right') => (
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#FAFBFC', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>V{v.version} · {v.sentAt?.split(' · ')[0] || '—'}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', padding: '6px 12px', backgroundColor: '#FAFBFC', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Field</span>
                <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Value</span>
              </div>
              {fields.map((f) => {
                const val = compareValueText(side === 'left' ? f.val1 : f.val2);
                const changed = compareValuesDiffer(f.val1, f.val2);
                const { n1, n2 } = compareNumbers(f);
                const numeric = changed && isNumericCompare(f);
                const direction = numeric && side === 'right' ? (n2 > n1 ? 'up' : 'down') : null;
                const isStruck = changed && side === 'left' && !numeric && !f.kind;
                return (
                  <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', padding: '10px 12px', borderBottom: '1px solid var(--border)', backgroundColor: changed ? 'rgba(245, 158, 11, 0.04)' : 'var(--card)', borderLeft: changed ? '3px solid var(--warning)' : '3px solid transparent' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted-foreground)' }}>{f.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: side === 'right' && changed ? 600 : 500, color: side === 'right' && changed ? '#0F172A' : (changed ? 'var(--foreground-soft)' : 'var(--foreground)'), textDecoration: isStruck ? 'line-through' : 'none', textDecorationColor: 'rgba(107, 114, 128, 0.4)' }}>{f.kind === 'status' ? <StatusPill value={val} /> : val}</span>
                      {direction === 'up' && <ArrowUp style={{ width: '12px', height: '12px', color: 'var(--success)' }} strokeWidth={2.5} />}
                      {direction === 'down' && <ArrowDown style={{ width: '12px', height: '12px', color: 'var(--destructive)' }} strokeWidth={2.5} />}
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

        {/* Changes comparison — split into two side-by-side cards so the
            visual rhythm matches the summary + line-items panes above.
            Icon + colour come from `changeKindConfig` (action-based, three
            kinds total); the per-modification-type icon switch is gone. */}
        {(v1.changes.length > 0 || v2.changes.length > 0) && (() => {
          const renderChangeRow = (change: VersionChange) => {
            const ct = changeKindConfig[change.action];
            const CIcon = ct.icon;
            return (
              <div key={change.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: ct.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CIcon style={{ width: '11px', height: '11px', color: ct.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--foreground)', lineHeight: '1.3' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: ct.color, marginRight: '4px' }}>{change.action}:</span>
                    {change.subject}
                    {change.itemRef && <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginLeft: '3px' }}>on {change.itemRef}</span>}
                  </div>
                  {change.subjectDetail && <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', lineHeight: '1.3', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{change.subjectDetail}</div>}
                  {change.detail && <div style={{ fontSize: '10px', color: 'var(--muted-foreground)', lineHeight: '1.3', marginTop: '1px' }}>{design.text(change.detail)}</div>}
                </div>
                <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', flexShrink: 0, lineHeight: '1', marginTop: '3px', whiteSpace: 'nowrap' as const }}>{change.timestamp}</span>
              </div>
            );
          };
          const renderChangesCard = (v: typeof v1) => (
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', backgroundColor: '#F7F8F9', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>Changes in V{v.version}</span>
                <span style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 500, lineHeight: '1' }}>({v.changes.length})</span>
              </div>
              {v.changes.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center' as const }}>
                  <span style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontStyle: 'italic' as const }}>No changes recorded</span>
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
    </div>
  );
}

// ── Revert Confirm Modal — Partner red-themed discard chrome ─────
function RevertConfirmModal({ version, onClose, onConfirm }: {
  version: number; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

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
            textTransform: 'none',
            marginBottom: '6px', lineHeight: '1',
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

// ── Draft Conflict Inline Modal ──────────────────────────────────
function DraftConflictInlineModal({ existingDraftVersion, revertFromVersion, onClose, onOverwrite, onCreateNew }: {
  existingDraftVersion: number; revertFromVersion: number; onClose: () => void; onOverwrite: () => void; onCreateNew: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', backgroundColor: 'var(--card)', borderRadius: '12px', width: '460px', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle style={{ width: '16px', height: '16px', color: 'var(--warning)' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--foreground)', lineHeight: '1' }}>Draft Already Exists</span>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: '16px', height: '16px', color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', padding: '8px 10px', backgroundColor: 'rgba(217, 119, 6, 0.1)', borderRadius: '6px' }}>
            <AlertCircle style={{ width: '13px', height: '13px', color: 'var(--warning)', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: 'var(--warning)', lineHeight: '1.3' }}>
              V{existingDraftVersion} is currently a draft. Choose how to apply data from V{revertFromVersion}:
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={onOverwrite}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px',
                borderRadius: '8px', border: '1.5px solid var(--border)', backgroundColor: '#FFFFFF',
                cursor: 'pointer', textAlign: 'left', transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <Edit style={{ width: '14px', height: '14px', color: 'var(--primary)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1', marginBottom: '5px' }}>
                  Update Draft V{existingDraftVersion}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.2' }}>
                  Replace existing draft data with V{revertFromVersion}'s content
                </div>
              </div>
            </button>

            <button
              onClick={onCreateNew}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px',
                borderRadius: '8px', border: '1.5px solid var(--border)', backgroundColor: '#FFFFFF',
                cursor: 'pointer', textAlign: 'left', transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <FileText style={{ width: '14px', height: '14px', color: 'var(--muted-foreground)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1', marginBottom: '5px' }}>
                  Create New Draft V{existingDraftVersion + 1}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1.2' }}>
                  Discard V{existingDraftVersion} draft and create a new version
                </div>
              </div>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{
            height: '36px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: 'var(--muted-foreground)',
            backgroundColor: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px',
            cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
