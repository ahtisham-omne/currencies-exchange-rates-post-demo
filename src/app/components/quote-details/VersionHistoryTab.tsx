import React, { useState, useRef } from 'react';
import {
  Search, Filter, GitBranch, Clock, ChevronDown, ChevronRight,
  RotateCcw, ArrowLeftRight, X, Check, Package, DollarSign,
  AlertCircle, ArrowRight, Tag, Edit, Trash2, User, Plus,
  Send, CheckCircle2, FileText, Scale
} from 'lucide-react';
import { toast } from 'sonner';
import { BASE_CURRENCY, convertBetween, getLibraryCurrency } from '@/app/data/currencyLibrary';
import { QuoteMoney } from '@/app/components/currency/QuoteMoney';

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
  validUntil: string;
  lineItems?: { id: string; description: string; qty: number; uom: string; unitPrice: number; total: number; thumbColor?: string }[];
}

/** FX snapshot frozen with each version. Captures the rate type, customer→base rate, customer currency, lock timestamp. */
interface VersionRateSnapshot {
  rateType: 'market' | 'corporate';
  /** Number of base currency (PKR) units per 1 unit of the customer currency at this version's lock time. */
  customerRate: number;
  customerCurrency: string;
  /** ISO timestamp the rate was locked (matches version sent date when status === 'sent' / 'confirmed'). */
  lockedAt: string;
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
  /** FX snapshot for this version. Older versions stay frozen at their lock-time rate. */
  rateSnapshot?: VersionRateSnapshot;
  changes: VersionChange[];
  isRevert?: boolean;
  revertedFrom?: number;
}

// ── Mock Data ──────────────────────────────────────────────────────
const MOCK_VERSIONS: Version[] = [
  {
    version: 3, versionStatus: 'sent',
    sentAt: '02/05/2026 · 10:30 AM',
    sentBy: 'Sarah Chen',
    avatar: 'SC', avatarColor: '#3B82F6',
    reason: 'Added emergency lighting package and auto-eject system per customer request. Applied Tri-County EMS volume adjustment.',
    snapshot: {
      lineItemCount: 7, grandTotal: 472070, rulesCount: 2, adjustmentsCount: 1, validUntil: '03/07/2026',
      lineItems: [
        { id: '501-100-001', description: 'E-450 stripped chassis, 176" WB, 7.3L V8, DRW, 16,000 GVWR, ambulance prep package.', qty: 2, uom: 'EA', unitPrice: 48200, total: 96400, thumbColor: '#DBEAFE' },
        { id: '501-100-002', description: 'Cutaway-mount modular body, 152in patient compartment, 72in headroom, KKK compliant.', qty: 3, uom: 'EA', unitPrice: 94200, total: 282600, thumbColor: '#D1FAE5' },
        { id: '501-100-003', description: 'P25 Phase II mobile radio, all-band, AES 256 encryption.', qty: 3, uom: 'EA', unitPrice: 7850, total: 23550, thumbColor: '#FEE2E2' },
        { id: '501-100-004', description: 'Powered stretcher, 700 lb cap, Power-LOAD compatible.', qty: 3, uom: 'EA', unitPrice: 18500, total: 55500, thumbColor: '#E0E7FF' },
        { id: '501-100-005', description: '3000W pure sine inverter with 75A charger auto transfer.', qty: 3, uom: 'EA', unitPrice: 1650, total: 4950, thumbColor: '#FEF3C7' },
        { id: '501-100-006', description: 'Linear Super-LED lightbar, 62in, red/blue/amber, low-profile roof mount.', qty: 2, uom: 'EA', unitPrice: 3200, total: 6400, thumbColor: '#FCE7F3' },
        { id: '501-100-007', description: 'Auto-eject shoreline with weatherproof inlet, 30A, auto-disconnect on engine start.', qty: 3, uom: 'EA', unitPrice: 890, total: 2670, thumbColor: '#F3E8FF' },
      ],
    },
    changes: [
      { id: 'C301', type: 'line-item-added', action: 'Added', subject: '501-100-006', subjectDetail: 'Linear Super-LED lightbar, 62in, red/blue/amber, low-profile roof mount.', detail: 'Qty: 2 EA · $3,200/EA · Total: $6,400', timestamp: '10:25 AM', user: 'Sarah Chen' },
      { id: 'C302', type: 'line-item-added', action: 'Added', subject: '501-100-007', subjectDetail: 'Auto-eject shoreline with weatherproof inlet, 30A, auto-disconnect on engine start.', detail: 'Qty: 3 EA · $890/EA · Total: $2,670', timestamp: '10:22 AM', user: 'Sarah Chen' },
      { id: 'C303', type: 'rule-applied', action: 'Added', subject: 'Pricing Rule', subjectDetail: 'Government Contract Pricing', detail: 'Eligible items flagged for govt contract pricing tier', timestamp: '10:18 AM', user: 'Michael Rodriguez' },
      { id: 'C304', type: 'adjustment-applied', action: 'Added', subject: 'Adjustment', subjectDetail: 'Tri-County EMS volume adjustment', detail: '−3% on total per Tri-County EMS fleet agreement', timestamp: '10:15 AM', user: 'Sarah Chen' },
      { id: 'C305', type: 'config-changed', action: 'Changed', subject: 'Valid Until', detail: '02/27 → 03/07 (additional 7 days per customer request)', timestamp: '10:12 AM', user: 'Sarah Chen' },
    ],
  },
  {
    version: 2, versionStatus: 'confirmed',
    sentAt: '01/28/2026 · 3:15 PM',
    confirmedAt: '02/01/2026 · 11:00 AM',
    sentBy: 'Sarah Chen',
    avatar: 'SC', avatarColor: '#3B82F6',
    reason: 'Added medical equipment per Tri-County EMS build spec. Fleet volume pricing applied for 2+ chassis.',
    snapshot: {
      lineItemCount: 5, grandTotal: 463000, rulesCount: 1, adjustmentsCount: 0, validUntil: '02/27/2026',
      lineItems: [
        { id: '501-100-001', description: 'E-450 stripped chassis, 176" WB, 7.3L V8, DRW, 16,000 GVWR, ambulance prep package.', qty: 2, uom: 'EA', unitPrice: 48200, total: 96400, thumbColor: '#DBEAFE' },
        { id: '501-100-002', description: 'Cutaway-mount modular body, 152in patient compartment, 72in headroom, KKK compliant.', qty: 3, uom: 'EA', unitPrice: 94200, total: 282600, thumbColor: '#D1FAE5' },
        { id: '501-100-003', description: 'P25 Phase II mobile radio, all-band, AES 256 encryption.', qty: 3, uom: 'EA', unitPrice: 7850, total: 23550, thumbColor: '#FEE2E2' },
        { id: '501-100-004', description: 'Powered stretcher, 700 lb cap, Power-LOAD compatible.', qty: 3, uom: 'EA', unitPrice: 18500, total: 55500, thumbColor: '#E0E7FF' },
        { id: '501-100-005', description: '3000W pure sine inverter with 75A charger auto transfer.', qty: 3, uom: 'EA', unitPrice: 1650, total: 4950, thumbColor: '#FEF3C7' },
      ],
    },
    changes: [
      { id: 'C201', type: 'line-item-modified', action: 'Changed', subject: 'Qty', detail: '1 → 2', itemRef: '501-100-001', timestamp: '3:10 PM', user: 'David Kim' },
      { id: 'C202', type: 'pricing-changed', action: 'Changed', subject: 'Unit Price', detail: '$49,200 → $48,200', itemRef: '501-100-001', subjectDetail: 'Fleet Volume Pricing triggered at 2+ units', timestamp: '3:08 PM', user: 'Sarah Chen' },
      { id: 'C203', type: 'line-item-added', action: 'Added', subject: '501-100-003', subjectDetail: 'P25 Phase II mobile radio, all-band, AES 256 encryption.', detail: 'Qty: 3 EA · $7,850/EA · Total: $23,550', timestamp: '2:55 PM', user: 'Sarah Chen' },
      { id: 'C204', type: 'line-item-added', action: 'Added', subject: '501-100-004', subjectDetail: 'Powered stretcher, 700 lb cap, Power-LOAD compatible.', detail: 'Qty: 3 EA · $18,500/EA · Total: $55,500', timestamp: '2:50 PM', user: 'Sarah Chen' },
      { id: 'C205', type: 'line-item-added', action: 'Added', subject: '501-100-005', subjectDetail: '3000W pure sine inverter with 75A charger auto transfer.', detail: 'Qty: 3 EA · $1,650/EA · Total: $4,950', timestamp: '2:45 PM', user: 'Sarah Chen' },
      { id: 'C206', type: 'rule-applied', action: 'Added', subject: 'Pricing Rule', subjectDetail: 'Fleet Volume Pricing', detail: '−$1,000/unit on E-450 chassis when ordering 2+ units', timestamp: '3:12 PM', user: 'Sarah Chen' },
      { id: 'C207', type: 'config-changed', action: 'Changed', subject: 'Payment Terms', detail: 'Net 30 → Net 45 (per customer request)', timestamp: '2:40 PM', user: 'Sarah Chen' },
    ],
  },
  {
    version: 1, versionStatus: 'confirmed',
    sentAt: '01/20/2026 · 10:30 AM',
    confirmedAt: '01/22/2026 · 2:15 PM',
    sentBy: 'Sarah Chen',
    avatar: 'SC', avatarColor: '#3B82F6',
    reason: 'Initial quote created from opportunity OPP-2026-0089 for Tri-County EMS fleet build-out.',
    snapshot: {
      lineItemCount: 2, grandTotal: 331800, rulesCount: 0, adjustmentsCount: 0, validUntil: '02/19/2026',
      lineItems: [
        { id: '501-100-001', description: 'E-450 stripped chassis, 176" WB, 7.3L V8, DRW, 16,000 GVWR, ambulance prep package.', qty: 1, uom: 'EA', unitPrice: 49200, total: 49200, thumbColor: '#DBEAFE' },
        { id: '501-100-002', description: 'Cutaway-mount modular body, 152in patient compartment, 72in headroom, KKK compliant.', qty: 3, uom: 'EA', unitPrice: 94200, total: 282600, thumbColor: '#D1FAE5' },
      ],
    },
    changes: [
      { id: 'C101', type: 'line-item-added', action: 'Added', subject: '501-100-001', subjectDetail: 'E-450 stripped chassis, 176" WB, 7.3L V8, DRW, 16,000 GVWR, ambulance prep package.', detail: 'Qty: 1 EA · $49,200/EA · Total: $49,200', timestamp: '10:00 AM', user: 'Sarah Chen' },
      { id: 'C102', type: 'line-item-added', action: 'Added', subject: '501-100-002', subjectDetail: 'Cutaway-mount modular body, 152in patient compartment, 72in headroom, KKK compliant.', detail: 'Qty: 3 EA · $94,200/EA · Total: $282,600', timestamp: '10:00 AM', user: 'Sarah Chen' },
      { id: 'C103', type: 'customer-changed', action: 'Changed', subject: 'Customer', detail: 'Tri-County EMS Authority', subjectDetail: 'Contact: Karen Rodriguez · k.rodriguez@tricountyems.gov', timestamp: '9:55 AM', user: 'Sarah Chen' },
      { id: 'C104', type: 'config-changed', action: 'Changed', subject: 'Valid Until', detail: '02/19/2026 (30-day validity period)', timestamp: '9:52 AM', user: 'Sarah Chen' },
      { id: 'C105', type: 'config-changed', action: 'Changed', subject: 'Payment Terms', detail: 'Net 30', timestamp: '9:50 AM', user: 'Sarah Chen' },
    ],
  },
];

type VersionFilter = 'all' | 'pricing' | 'line-items' | 'config';


const CURRENT_USER = 'Sarah Chen';

const versionStatusConfig: Record<VersionStatus, { label: string; bg: string; color: string; icon: typeof Send }> = {
  draft: { label: 'Draft', bg: '#F3F4F6', color: '#374151', icon: FileText },
  sent: { label: 'Sent', bg: '#DBEAFE', color: '#1E40AF', icon: Send },
  confirmed: { label: 'Confirmed', bg: '#CCFBF1', color: '#0F766E', icon: CheckCircle2 },
};

interface VersionHistoryTabProps {
  quoteNumber?: string;
  customerName?: string;
  /** Customer's quote currency. Drives the per-version rate display + tracked rate-change rows. Defaults to PKR (no FX context). */
  customerCurrency?: string;
  /** Page-level Base ↔ Customer currency view. When `customer`, version totals/line-items render in the customer currency using each version's locked rate. */
  viewMode?: 'base' | 'customer';
}

/**
 * Hydrate `MOCK_VERSIONS` with deterministic per-version rate snapshots.
 * Older versions get slightly older rates so the rate-change tracked entry
 * surfaces between adjacent versions out of the box.
 */
function withRateSnapshots(versions: Version[], customerCurrency?: string): Version[] {
  const cur = (customerCurrency || 'PKR').toUpperCase();
  if (cur === 'PKR') {
    // No FX leg — clear any existing snapshot to prevent stale rates from showing.
    return versions.map(v => ({ ...v, rateSnapshot: undefined }));
  }
  // Slightly different rates per version to demo locked-rate drift.
  // Newer version (index 0) → most recent rate; older versions stretched back.
  const baseRates: Record<string, number[]> = {
    USD: [281.50, 278.00, 276.20, 274.10, 272.50, 270.00],
    EUR: [307.20, 305.00, 303.50, 302.10, 300.50, 299.00],
    GBP: [357.40, 355.00, 352.80, 351.20, 349.50, 348.00],
    AED: [76.20, 75.70, 75.30, 74.90, 74.50, 74.10],
    CAD: [206.40, 205.00, 203.80, 202.50, 201.20, 200.00],
    AUD: [183.30, 182.00, 181.20, 180.40, 179.50, 178.50],
    JPY: [1.86, 1.85, 1.84, 1.83, 1.82, 1.81],
    INR: [3.36, 3.35, 3.34, 3.33, 3.32, 3.31],
    SAR: [74.20, 74.10, 74.00, 73.90, 73.80, 73.70],
  };
  const series = baseRates[cur] ?? [278, 277, 276, 275, 274, 273];
  return versions.map((v, idx) => ({
    ...v,
    rateSnapshot: {
      // Treat the latest version as "market" and older ones as "corporate"
      // for visual variety; in production this comes from the actual lock-time pointer.
      rateType: idx === 0 ? 'market' : 'corporate',
      customerRate: series[Math.min(idx, series.length - 1)],
      customerCurrency: cur,
      lockedAt: v.sentAt ?? v.confirmedAt ?? new Date().toISOString(),
    },
  }));
}

export function VersionHistoryTab({ quoteNumber = 'Q-000-000-000', customerName = 'Tri-County EMS Authority', customerCurrency, viewMode = 'base' }: VersionHistoryTabProps) {
  const [versions, setVersions] = useState(() => withRateSnapshots(MOCK_VERSIONS, customerCurrency));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<VersionFilter>('all');
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set([3]));
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelections, setCompareSelections] = useState<number[]>([]);
  const [showCompareView, setShowCompareView] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState<number | null>(null);

  // Advanced filters
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [versionStatusFilter, setVersionStatusFilter] = useState<string>('any');
  const filterRef = useRef<HTMLDivElement>(null);

  const advancedFilterCount = (creatorFilter !== 'all' ? 1 : 0) + (versionStatusFilter !== 'any' ? 1 : 0);
  const creators = [...new Set(versions.map(v => v.sentBy))];

  // Last approved = latest confirmed
  const latestConfirmed = versions.find(v => v.versionStatus === 'confirmed');
  const lastApprovedVersionNum = latestConfirmed?.version ?? 1;
  const latestVersionNum = versions[0]?.version ?? 1;

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    if (showFilterDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterDropdown]);

  // View-aware money formatter. All snapshot values are stored in PKR (base);
  // when the page is in customer view, convert through the version's locked
  // rate so each version stays anchored to the FX rate it was sent at.
  const cur = (customerCurrency || BASE_CURRENCY).toUpperCase();
  const showCustomer = cur !== BASE_CURRENCY && viewMode === 'customer';
  const baseSym = getLibraryCurrency(BASE_CURRENCY)?.symbol ?? BASE_CURRENCY;
  const customerSym = getLibraryCurrency(cur)?.symbol ?? cur;
  const formatCurrency = (n: number, lockedRate?: number): string => {
    if (showCustomer) {
      const customerValue = typeof lockedRate === 'number' ? n / lockedRate : convertBetween(n, BASE_CURRENCY, cur);
      return `${customerSym} ${customerValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    }
    return `${baseSym} ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

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

  // Draft conflict state for VersionHistoryTab internal reverts.
  const [draftConflictRevert, setDraftConflictRevert] = useState<{ toVersion: number; reason: string } | null>(null);

  /** Reverts always re-lock at today's Mid-market rate, so the new version is
   *  labeled Mid-market regardless of the source's type. */
  const buildRateSnapshotForRevert = (source: Version): VersionRateSnapshot | undefined => {
    if (!source.rateSnapshot) return undefined;
    const headRate = versions[0]?.rateSnapshot?.customerRate ?? source.rateSnapshot.customerRate;
    return {
      ...source.rateSnapshot,
      rateType: 'market',
      customerRate: headRate,
      lockedAt: new Date().toISOString(),
    };
  };

  const doRevert = (toVersion: number, reason: string, overwriteExisting: boolean) => {
    const source = versions.find(v => v.version === toVersion)!;
    const latestVer = versions[0];
    const nextRateSnapshot = buildRateSnapshotForRevert(source);

    if (overwriteExisting && latestVer.versionStatus === 'draft') {
      // Overwrite existing draft
      const updated: Version = {
        ...latestVer,
        reason: reason || `Reverted to Version ${toVersion}`,
        isRevert: true,
        revertedFrom: toVersion,
        snapshot: { ...source.snapshot },
        rateSnapshot: nextRateSnapshot,
        changes: [
          { id: `C${Date.now()}`, type: 'config-changed', action: 'Changed' as const, subject: 'Reverted Draft', detail: `Restored from V${toVersion}`, subjectDetail: reason || undefined, timestamp: 'Just now', user: 'Sarah Chen' },
        ],
      };
      setVersions(prev => [updated, ...prev.slice(1)]);
      setExpandedVersions(new Set([latestVer.version]));
      toast.success(`Updated V${latestVer.version} Draft with data from V${toVersion}`, { description: 'Draft content replaced. Send when ready.', position: 'top-right' });
    } else {
      // Create new draft version
      const newV = latestVer.version + 1;
      const newVersion: Version = {
        ...source,
        version: newV,
        versionStatus: 'draft',
        sentAt: undefined,
        confirmedAt: undefined,
        sentBy: 'Sarah Chen',
        reason: reason || `Reverted to Version ${toVersion}`,
        isRevert: true,
        revertedFrom: toVersion,
        snapshot: { ...source.snapshot },
        rateSnapshot: nextRateSnapshot,
        changes: [
          { id: `C${Date.now()}`, type: 'config-changed', action: 'Changed' as const, subject: 'Reverted to Draft', detail: `Created from V${toVersion}`, subjectDetail: reason || undefined, timestamp: 'Just now', user: 'Sarah Chen' },
        ],
      };
      setVersions(prev => [newVersion, ...prev]);
      setExpandedVersions(new Set([newV]));
      toast.success(`Reverted to Version ${toVersion} as new Draft (v${newV})`, { description: 'Send when ready.', position: 'top-right' });
    }
    setShowRevertConfirm(null);
    setDraftConflictRevert(null);
  };

  const handleRevert = (toVersion: number, reason: string) => {
    const latestVer = versions[0];
    // Check if latest version is already a draft — show conflict
    if (latestVer && latestVer.versionStatus === 'draft') {
      setDraftConflictRevert({ toVersion, reason });
      return;
    }
    doRevert(toVersion, reason, false);
  };

  // ── Change type config ────────────────────────────────────────
  const changeTypeConfig: Record<string, { icon: any; color: string; bg: string }> = {
    'line-item-added': { icon: Plus, color: '#059669', bg: '#D1FAE5' },
    'line-item-removed': { icon: Trash2, color: '#DC2626', bg: '#FEE2E2' },
    'line-item-modified': { icon: Edit, color: '#D97706', bg: '#FEF3C7' },
    'pricing-changed': { icon: DollarSign, color: '#2563EB', bg: '#DBEAFE' },
    'customer-changed': { icon: User, color: '#7C3AED', bg: '#EDE9FE' },
    'config-changed': { icon: Tag, color: '#6B7280', bg: '#F3F4F6' },
    'attachment-added': { icon: Package, color: '#0891B2', bg: '#CFFAFE' },
    'rule-applied': { icon: Scale, color: '#2563EB', bg: '#DBEAFE' },
    'adjustment-applied': { icon: DollarSign, color: '#059669', bg: '#D1FAE5' },
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
  }).filter(v => {
    if (creatorFilter !== 'all' && v.sentBy !== creatorFilter) return false;
    if (versionStatusFilter !== 'any' && v.versionStatus !== versionStatusFilter) return false;
    return true;
  });

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
          borderRadius: '10px',
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ position: 'relative', width: '240px', flexShrink: 0 }}>
          <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF', pointerEvents: 'none' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search changes..."
            style={{
              width: '100%', height: '32px', padding: '0 12px 0 32px', fontSize: '13px',
              fontWeight: 400, color: '#1F2937', border: '1px solid #E5E7EB', borderRadius: '6px',
              outline: 'none', backgroundColor: '#FFFFFF', fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'border-color 150ms', boxSizing: 'border-box',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px #DBEAFE'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                width: '20px', height: '20px', borderRadius: '4px', border: 'none',
                backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: 0,
                transition: 'background-color 100ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <X style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
            </button>
          )}
        </div>

        {/* Filter button with dropdown */}
        <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setShowFilterDropdown(p => !p)}
            style={{
              height: '32px', padding: '0 10px', fontSize: '12px', fontWeight: 500,
              color: advancedFilterCount > 0 ? '#1B6EF3' : '#6B7280',
              backgroundColor: advancedFilterCount > 0 ? '#E7F3FF' : '#FFFFFF',
              border: `1px solid ${advancedFilterCount > 0 ? '#1B6EF3' : '#E5E7EB'}`,
              borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: '5px', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
              transition: 'all 150ms', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (!advancedFilterCount) { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; } }}
            onMouseLeave={e => { if (!advancedFilterCount) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; } }}
          >
            <Filter style={{ width: '13px', height: '13px' }} />
            Filters
            {advancedFilterCount > 0 && (
              <span style={{
                fontSize: '10px', fontWeight: 700, color: '#FFFFFF', backgroundColor: '#1B6EF3',
                width: '16px', height: '16px', borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', lineHeight: '1',
              }}>
                {advancedFilterCount}
              </span>
            )}
          </button>

          {showFilterDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 20,
              backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E5E7EB',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: '260px',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>Filters</span>
                {advancedFilterCount > 0 && (
                  <button
                    onClick={() => { setCreatorFilter('all'); setVersionStatusFilter('any'); }}
                    style={{ fontSize: '11px', fontWeight: 500, color: '#EF4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', padding: '2px 6px', borderRadius: '4px', transition: 'background-color 100ms' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              {/* Version status */}
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <GitBranch style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Version Status</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {([
                    { key: 'any', label: 'Any' },
                    { key: 'confirmed', label: 'Confirmed' },
                    { key: 'sent', label: 'Sent' },
                    { key: 'draft', label: 'Draft' },
                  ]).map(d => {
                    const active = versionStatusFilter === d.key;
                    return (
                      <button key={d.key} onClick={() => setVersionStatusFilter(d.key)} style={{
                        height: '26px', padding: '0 10px', fontSize: '11px', fontWeight: 500,
                        color: active ? '#1B6EF3' : '#6B7280', backgroundColor: active ? '#EFF6FF' : '#F9FAFB',
                        border: `1px solid ${active ? '#BFDBFE' : '#E5E7EB'}`, borderRadius: '5px',
                        cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 100ms',
                      }}>
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Sent by */}
              <div style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <User style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sent By</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <button onClick={() => setCreatorFilter('all')} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px',
                    fontSize: '12px', fontWeight: creatorFilter === 'all' ? 600 : 400,
                    color: creatorFilter === 'all' ? '#1B6EF3' : '#374151',
                    backgroundColor: creatorFilter === 'all' ? '#EFF6FF' : 'transparent',
                    border: 'none', borderRadius: '5px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                    textAlign: 'left', transition: 'background-color 100ms',
                  }}
                    onMouseEnter={e => { if (creatorFilter !== 'all') e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                    onMouseLeave={e => { if (creatorFilter !== 'all') e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Everyone
                  </button>
                  {creators.map(c => {
                    const active = creatorFilter === c;
                    const isYou = c === CURRENT_USER;
                    return (
                      <button key={c} onClick={() => setCreatorFilter(c)} style={{
                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px',
                        fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? '#1B6EF3' : '#374151',
                        backgroundColor: active ? '#EFF6FF' : 'transparent', border: 'none', borderRadius: '5px',
                        cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left', transition: 'background-color 100ms',
                      }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {c}{isYou && <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 400 }}>(you)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Compare toggle */}
        <button
          onClick={() => { setCompareMode(!compareMode); setCompareSelections(compareMode ? [] : []); setShowCompareView(false); }}
          style={{
            height: '32px', padding: '0 12px', fontSize: '13px', fontWeight: 500,
            color: compareMode ? '#DC2626' : '#6B7280',
            backgroundColor: compareMode ? '#FEF2F2' : '#FFFFFF',
            border: `1px solid ${compareMode ? '#FECACA' : '#E5E7EB'}`,
            borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            gap: '5px', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
            transition: 'all 150ms',
          }}
        >
          <ArrowLeftRight style={{ width: '14px', height: '14px' }} />
          {compareMode ? 'Cancel' : 'Compare'}
        </button>
        </div>

        {/* Row 2: Quick filter pills + active filter tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {filters.map(f => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              style={{
                height: '28px', padding: '0 10px', fontSize: '12px', fontWeight: 500,
                color: isActive ? '#1B6EF3' : '#6B7280',
                backgroundColor: isActive ? '#E7F3FF' : '#FFFFFF',
                border: `1px solid ${isActive ? '#1B6EF3' : '#E2E8F0'}`,
                borderRadius: '14px', cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                transition: 'all 150ms', flexShrink: 0,
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; } }}
            >
              {f.label}
            </button>
          );
        })}

        {/* Active filter tags */}
        {advancedFilterCount > 0 && (
          <>
            <div style={{ width: '1px', height: '20px', backgroundColor: '#E5E7EB', flexShrink: 0 }} />
            {versionStatusFilter !== 'any' && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                fontSize: '11px', fontWeight: 500, color: '#1B6EF3', backgroundColor: '#EFF6FF',
                borderRadius: '5px', whiteSpace: 'nowrap', lineHeight: '1',
              }}>
                {versionStatusFilter.charAt(0).toUpperCase() + versionStatusFilter.slice(1)}
                <button onClick={() => setVersionStatusFilter('any')} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X style={{ width: '10px', height: '10px', color: '#3B82F6' }} />
                </button>
              </span>
            )}
            {creatorFilter !== 'all' && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px',
                fontSize: '11px', fontWeight: 500, color: '#1B6EF3', backgroundColor: '#EFF6FF',
                borderRadius: '5px', whiteSpace: 'nowrap', lineHeight: '1',
              }}>
                {creatorFilter === CURRENT_USER ? 'You' : creatorFilter}
                <button onClick={() => setCreatorFilter('all')} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  <X style={{ width: '10px', height: '10px', color: '#3B82F6' }} />
                </button>
              </span>
            )}
          </>
        )}

        <div style={{ flex: 1 }} />
        </div>
      </div>

      {/* Divider between toolbar and content */}
      {!compareMode && <div style={{ height: '1px', backgroundColor: '#E5E7EB' }} />}

      {/* ── Compare action bar ────────────────────────────────── */}
      {compareMode && (
        <div style={{
          backgroundColor: '#EFF6FF', borderTop: '1px solid #BFDBFE', borderBottom: '1px solid #BFDBFE',
          padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <ArrowLeftRight style={{ width: '14px', height: '14px', color: '#3B82F6' }} />
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#1E40AF', lineHeight: '1' }}>
            Select two versions to compare
            {compareSelections.length > 0 && ` · ${compareSelections.length}/2 selected`}
          </span>
          <div style={{ flex: 1 }} />
          {compareSelections.length === 2 && (
            <button
              onClick={() => setShowCompareView(true)}
              style={{
                height: '28px', padding: '0 12px', fontSize: '12px', fontWeight: 500,
                color: '#FFFFFF', backgroundColor: '#3B82F6', border: 'none', borderRadius: '6px',
                cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                transition: 'background-color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#2563EB'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#3B82F6'; }}
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
            <GitBranch style={{ width: '24px', height: '24px', color: '#D1D5DB', margin: '0 auto 8px' }} />
            <div style={{ fontSize: '13px', color: '#9CA3AF' }}>No matching changes found</div>
          </div>
        ) : (
          filteredVersions.map((ver, vidx) => {
            const isExpanded = expandedVersions.has(ver.version);
            const isCompareSelected = compareSelections.includes(ver.version);
            const isLastApproved = ver.version === lastApprovedVersionNum;
            const isLatestVersion = ver.version === latestVersionNum;
            const vsCfg = versionStatusConfig[ver.versionStatus];
            const VSIcon = vsCfg.icon;
            // Detect a rate change vs the previous (older) version. When the
            // user reverts with "apply current rate" or saves a new draft that
            // re-pulls today's market rate, the locked rate shifts — surface
            // that as a tracked change at the top of the version's change list.
            const prevRateSnapshot = filteredVersions[vidx + 1]?.rateSnapshot;
            const rateChangeEntry: VersionChange | null = (() => {
              if (!ver.rateSnapshot || !prevRateSnapshot) return null;
              const prev = prevRateSnapshot;
              const next = ver.rateSnapshot;
              const sameRate = Math.abs(prev.customerRate - next.customerRate) < 0.001 && prev.rateType === next.rateType;
              if (sameRate) return null;
              const typeLabel = next.rateType === 'market' ? 'Mid-market' : 'Corporate';
              return {
                id: `RATE-${ver.version}`,
                type: 'config-changed',
                action: 'Changed',
                subject: 'Exchange rate',
                detail: `1 ${next.customerCurrency} = ${prev.customerRate.toFixed(2)} PKR → 1 ${next.customerCurrency} = ${next.customerRate.toFixed(2)} PKR (${typeLabel})`,
                timestamp: ver.sentAt?.split(' · ')[1] ?? '—',
                user: ver.sentBy,
              };
            })();

            return (
              <div key={ver.version}>
                {vidx > 0 && <div style={{ height: '1px', backgroundColor: '#E5E7EB' }} />}

                {/* Version header */}
                <div
                  onClick={() => compareMode ? handleCompareSelect(ver.version) : toggleExpanded(ver.version)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', cursor: 'pointer',
                    backgroundColor: isCompareSelected ? '#F0F7FF' : isExpanded ? '#F9FAFB' : 'transparent',
                    transition: 'background-color 150ms',
                  }}
                  onMouseEnter={e => { if (!isExpanded && !isCompareSelected) e.currentTarget.style.backgroundColor = '#FAFBFC'; }}
                  onMouseLeave={e => { if (!isExpanded && !isCompareSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* Compare checkbox or expand chevron */}
                  {compareMode ? (
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '4px',
                      border: isCompareSelected ? 'none' : '1.5px solid #D1D5DB',
                      backgroundColor: isCompareSelected ? '#3B82F6' : '#FFFFFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, transition: 'all 150ms',
                    }}>
                      {isCompareSelected && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} strokeWidth={3} />}
                    </div>
                  ) : (
                    isExpanded
                      ? <ChevronDown style={{ width: '14px', height: '14px', color: '#9CA3AF', flexShrink: 0 }} />
                      : <ChevronRight style={{ width: '14px', height: '14px', color: '#9CA3AF', flexShrink: 0 }} />
                  )}

                  {/* Avatar */}
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    backgroundColor: ver.avatarColor, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#FFFFFF',
                    flexShrink: 0,
                  }}>
                    {ver.avatar}
                  </div>

                  {/* Version info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
                        V{ver.version}
                      </span>
                      {/* Version status badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                        backgroundColor: vsCfg.bg, color: vsCfg.color, lineHeight: '1',
                      }}>
                        <VSIcon style={{ width: '9px', height: '9px' }} />
                        {vsCfg.label}
                      </span>
                      {isLatestVersion && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                          backgroundColor: '#F3F4F6', color: '#374151', lineHeight: '1',
                          border: '1px solid #E5E7EB',
                        }}>Latest</span>
                      )}
                      {isLastApproved && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                          backgroundColor: '#F0FDFA', color: '#0F766E', lineHeight: '1',
                          border: '1px solid #99F6E4',
                        }}>Last Approved</span>
                      )}
                      {ver.versionStatus === 'sent' && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '3px',
                          fontSize: '10px', color: '#D97706', lineHeight: '1',
                        }}>
                          <Clock style={{ width: '9px', height: '9px' }} />
                          Pending confirmation
                        </span>
                      )}
                      {ver.isRevert && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                          backgroundColor: '#FEF3C7', color: '#92400E', lineHeight: '1',
                        }}>Revert from v{ver.revertedFrom}</span>
                      )}
                      <span style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1' }}>·</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1' }}>{ver.sentAt || 'Not sent'}</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1' }}>·</span>
                      <span style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1' }}>{ver.sentBy}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ver.reason}
                    </div>
                  </div>

                  {/* Snapshot badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1' }}>
                      {ver.snapshot.lineItemCount} items
                    </span>
                    {(ver.snapshot.rulesCount > 0 || ver.snapshot.adjustmentsCount > 0) && (
                      <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1' }}>
                        {ver.snapshot.rulesCount}R / {ver.snapshot.adjustmentsCount}A
                      </span>
                    )}
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
                      <QuoteMoney
                        valuePKR={ver.snapshot.grandTotal}
                        customerCurrency={customerCurrency}
                        view={viewMode}
                        lockedRate={ver.rateSnapshot?.customerRate}
                        lockedAt={ver.rateSnapshot?.lockedAt}
                      />
                    </span>
                    {ver.rateSnapshot && (() => {
                      const rs = ver.rateSnapshot;
                      const hex = rs.rateType === 'market' ? '#7c3aed' : '#d97706';
                      const bg = rs.rateType === 'market'
                        ? 'color-mix(in srgb, #7c3aed 8%, transparent)'
                        : 'color-mix(in srgb, #d97706 10%, transparent)';
                      return (
                        <span
                          title={`${rs.rateType === 'market' ? 'Mid-market' : 'Corporate'} rate locked ${rs.lockedAt ? `on ${rs.lockedAt}` : ''}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 10, color: hex, backgroundColor: bg,
                            padding: '1px 6px', borderRadius: 999, fontWeight: 600,
                            cursor: 'help', flexShrink: 0,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: hex }} />
                          @ {rs.customerRate.toFixed(2)} PKR/{rs.customerCurrency}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Revert action (only for confirmed versions that are not current) */}
                  {!compareMode && ver.versionStatus === 'confirmed' && !isLastApproved && (
                    <button
                      onClick={e => { e.stopPropagation(); setShowRevertConfirm(ver.version); }}
                      title="Revert to this version"
                      style={{
                        width: '28px', height: '28px', borderRadius: '5px', border: 'none',
                        backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <RotateCcw style={{ width: '13px', height: '13px', color: '#9CA3AF' }} />
                    </button>
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && !compareMode && (
                  <div style={{ padding: '10px 16px 14px 56px' }}>
                    {/* Sent / Confirmed / Valid Until timestamps */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', paddingTop: '10px', borderTop: '1px solid #E5E7EB', flexWrap: 'wrap' as const }}>
                      {ver.sentAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Send style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                          <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1' }}>Sent {ver.sentAt}</span>
                        </div>
                      )}
                      {ver.confirmedAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <CheckCircle2 style={{ width: '12px', height: '12px', color: '#059669' }} />
                          <span style={{ fontSize: '12px', color: '#065F46', lineHeight: '1' }}>Confirmed {ver.confirmedAt}</span>
                        </div>
                      )}
                      {ver.versionStatus === 'sent' && !ver.confirmedAt && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Clock style={{ width: '12px', height: '12px', color: '#D97706' }} />
                          <span style={{ fontSize: '12px', fontWeight: 500, color: '#92400E', lineHeight: '1' }}>Awaiting confirmation</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                        <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1' }}>Valid until {ver.snapshot.validUntil}</span>
                      </div>
                      {ver.rateSnapshot && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Scale style={{ width: '12px', height: '12px', color: ver.rateSnapshot.rateType === 'market' ? '#7c3aed' : '#d97706' }} />
                          <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1', fontVariantNumeric: 'tabular-nums' as const }}>
                            Rate locked: 1 {ver.rateSnapshot.customerCurrency} = {ver.rateSnapshot.customerRate.toFixed(2)} PKR
                            <span style={{ color: ver.rateSnapshot.rateType === 'market' ? '#7c3aed' : '#d97706', fontWeight: 600, marginLeft: '6px' }}>
                              {ver.rateSnapshot.rateType === 'market' ? 'Mid-market' : 'Corporate'}
                            </span>
                            {ver.rateSnapshot.lockedAt && <span style={{ color: '#9CA3AF', marginLeft: '6px' }}>· {ver.rateSnapshot.lockedAt}</span>}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Snapshot + Line Items (combined) */}
                    <div style={{
                      border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px',
                    }}>
                      {/* Line Items header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                        <Package style={{ width: '11px', height: '11px', color: '#6B7280' }} />
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>Line Items</span>
                        <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>({ver.snapshot.lineItems ? ver.snapshot.lineItems.length : 0})</span>
                      </div>
                      {/* Column headings row */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px',
                        backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB',
                      }}>
                        <div style={{ width: '22px', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>Item</span>
                        </div>
                        <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', flexShrink: 0, width: '28px', textAlign: 'right' as const }}>Qty</span>
                        <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', flexShrink: 0, width: '28px', textAlign: 'center' as const }}>Unit</span>
                        <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', flexShrink: 0, width: '64px', textAlign: 'right' as const }}>Price</span>
                        <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1', flexShrink: 0, minWidth: '64px', textAlign: 'right' as const }}>Total</span>
                      </div>
                      {/* Line item rows */}
                      {ver.snapshot.lineItems && ver.snapshot.lineItems.length > 0 ? (
                        <div style={{ backgroundColor: '#FFFFFF' }}>
                          {ver.snapshot.lineItems.map((li, liIdx) => (
                            <div key={li.id} style={{
                              display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                              borderTop: liIdx > 0 ? '1px solid #F7F8F9' : 'none',
                            }}>
                              <div style={{ width: '22px', height: '22px', borderRadius: '3px', flexShrink: 0, backgroundColor: li.thumbColor || '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Package style={{ width: '10px', height: '10px', color: '#6B7280', opacity: 0.5 }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', lineHeight: '1', marginBottom: '1px' }}>{li.id}</div>
                                <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{li.description}</div>
                              </div>
                              <span style={{ fontSize: '10px', color: '#6B7280', lineHeight: '1', flexShrink: 0, width: '28px', textAlign: 'right' as const }}>{li.qty}</span>
                              <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1', flexShrink: 0, width: '28px', textAlign: 'center' as const }}>{li.uom}</span>
                              <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1', flexShrink: 0, width: '64px', textAlign: 'right' as const }}>
                                <QuoteMoney
                                  valuePKR={li.unitPrice}
                                  customerCurrency={customerCurrency}
                                  view={viewMode}
                                  lockedRate={ver.rateSnapshot?.customerRate}
                                  lockedAt={ver.rateSnapshot?.lockedAt}
                                />
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#1F2937', lineHeight: '1', flexShrink: 0, minWidth: '64px', textAlign: 'right' as const }}>
                                <QuoteMoney
                                  valuePKR={li.total}
                                  customerCurrency={customerCurrency}
                                  view={viewMode}
                                  lockedRate={ver.rateSnapshot?.customerRate}
                                  lockedAt={ver.rateSnapshot?.lockedAt}
                                />
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: '8px 10px', fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic' }}>No line items</div>
                      )}
                      {/* Subtotal row */}
                      {ver.snapshot.lineItems && ver.snapshot.lineItems.length > 0 && (
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                          padding: '4px 10px', borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
                        }}>
                          <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.3px', lineHeight: '1', marginRight: '8px' }}>Subtotal</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', lineHeight: '1', minWidth: '64px', textAlign: 'right' as const }}>
                            <QuoteMoney
                              valuePKR={ver.snapshot.lineItems.reduce((s, li) => s + li.total, 0)}
                              customerCurrency={customerCurrency}
                              view={viewMode}
                              lockedRate={ver.rateSnapshot?.customerRate}
                              lockedAt={ver.rateSnapshot?.lockedAt}
                            />
                          </span>
                        </div>
                      )}
                      {/* Footer: Rules/Adjustments left, Grand Total right */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '5px 10px', backgroundColor: '#F9FAFB', borderTop: '1px solid #E5E7EB',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {(ver.snapshot.rulesCount > 0 || ver.snapshot.adjustmentsCount > 0) ? (
                            <span style={{ fontSize: '10px', color: '#6B7280', lineHeight: '1' }}>
                              {ver.snapshot.rulesCount} rule{ver.snapshot.rulesCount !== 1 ? 's' : ''} · {ver.snapshot.adjustmentsCount} adjustment{ver.snapshot.adjustmentsCount !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1' }}>No rules or adjustments</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.3px', lineHeight: '1' }}>Total</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#1F2937', lineHeight: '1' }}>
                            <QuoteMoney
                              valuePKR={ver.snapshot.grandTotal}
                              customerCurrency={customerCurrency}
                              view={viewMode}
                              lockedRate={ver.rateSnapshot?.customerRate}
                              lockedAt={ver.rateSnapshot?.lockedAt}
                            />
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Changes list — prepend rate-change tracked entry when this version's locked rate differs from the previous version's. */}
                    {(ver.changes.length === 0 && !rateChangeEntry) ? (
                      <div style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic', lineHeight: '1' }}>
                        No recorded changes in this version
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', lineHeight: '1' }}>
                          Changes ({ver.changes.length + (rateChangeEntry ? 1 : 0)})
                        </div>
                        {[...(rateChangeEntry ? [rateChangeEntry] : []), ...ver.changes].map((change, cidx) => {
                          const ct = changeTypeConfig[change.type] || changeTypeConfig['config-changed'];
                          const CIcon = ct.icon;
                          const userInitials = change.user.split(' ').map(n => n[0]).join('');
                          const userColor = change.user === 'Sarah Chen' ? '#3B82F6' : change.user === 'Michael Rodriguez' ? '#8B5CF6' : change.user === 'David Kim' ? '#F59E0B' : '#6B7280';
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
                                width: '22px', height: '22px', borderRadius: '5px',
                                backgroundColor: ct.bg, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', flexShrink: 0, marginTop: '1px',
                              }}>
                                <CIcon style={{ width: '11px', height: '11px', color: ct.color }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: 500, color: '#1F2937', lineHeight: '1.3', display: 'flex', alignItems: 'baseline', gap: '0', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: change.action === 'Added' ? '#059669' : change.action === 'Removed' ? '#DC2626' : '#D97706', marginRight: '5px', lineHeight: '1' }}>{change.action}:</span>
                                  <span style={{ fontWeight: 600, color: '#1F2937', marginRight: '4px' }}>{change.subject}</span>
                                  {change.itemRef && (
                                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', marginRight: '4px' }}>on {change.itemRef}</span>
                                  )}
                                </div>
                                {change.subjectDetail && (
                                  <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.3', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {change.subjectDetail}
                                  </div>
                                )}
                                {change.detail && (
                                  <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1.3', marginTop: '1px' }}>
                                    {change.detail}
                                  </div>
                                )}
                                {ver.rateSnapshot && (change.type === 'rule-applied' || change.type === 'adjustment-applied' || change.type === 'pricing-changed') && (
                                  <div style={{ marginTop: '4px' }}>
                                    <span
                                      title={`Pricing-rule values were computed using V${ver.version}'s locked ${ver.rateSnapshot.rateType === 'market' ? 'mid-market' : 'corporate'} rate. Newer versions may re-rate at a different lock-time rate.`}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                        fontSize: '9px', fontWeight: 600, lineHeight: '1',
                                        padding: '2px 6px', borderRadius: '999px',
                                        color: ver.rateSnapshot.rateType === 'market' ? '#7c3aed' : '#d97706',
                                        backgroundColor: ver.rateSnapshot.rateType === 'market'
                                          ? 'color-mix(in srgb, #7c3aed 8%, transparent)'
                                          : 'color-mix(in srgb, #d97706 10%, transparent)',
                                        fontVariantNumeric: 'tabular-nums' as const,
                                        cursor: 'help',
                                      }}
                                    >
                                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: ver.rateSnapshot.rateType === 'market' ? '#7c3aed' : '#d97706' }} />
                                      Computed @ 1 {ver.rateSnapshot.customerCurrency} = {ver.rateSnapshot.customerRate.toFixed(2)} PKR · V{ver.version} rate
                                    </span>
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
                                <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1' }}>
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
      {showRevertConfirm !== null && (() => {
        const targetVer = versions.find(v => v.version === showRevertConfirm);
        // Today's rate: take the active rate from the latest (head) version's
        // snapshot when present, otherwise fall back to a static value. In
        // production this would read from RateContext.
        const todayRate = versions[0]?.rateSnapshot?.customerRate ?? 278;
        return (
          <RevertConfirmModal
            version={showRevertConfirm}
            nextVersion={versions[0].version + 1}
            onClose={() => setShowRevertConfirm(null)}
            onConfirm={(reason) => handleRevert(showRevertConfirm, reason)}
            rateSnapshot={targetVer?.rateSnapshot}
            todayRate={todayRate}
            customerCurrency={customerCurrency}
          />
        );
      })()}

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
  v1: Version; v2: Version; formatCurrency: (n: number, lockedRate?: number) => string; onClose: () => void;
}) {
  const rateText = (v: Version) => {
    if (!v.rateSnapshot) return '—';
    const rs = v.rateSnapshot;
    const typeLabel = rs.rateType === 'market' ? 'Mid-market' : 'Corporate';
    return `1 ${rs.customerCurrency} = ${rs.customerRate.toFixed(2)} PKR · ${typeLabel}`;
  };
  const fields = [
    { label: 'Line Items', val1: String(v1.snapshot.lineItemCount), val2: String(v2.snapshot.lineItemCount) },
    { label: 'Grand Total', val1: formatCurrency(v1.snapshot.grandTotal, v1.rateSnapshot?.customerRate), val2: formatCurrency(v2.snapshot.grandTotal, v2.rateSnapshot?.customerRate) },
    // FX columns surface the locked rate per version + rate type. When the
    // versions used different rate books or rates, the field is highlighted
    // by the existing changed-row treatment below.
    { label: 'Currency / Rate', val1: rateText(v1), val2: rateText(v2) },
    { label: 'Rules', val1: String(v1.snapshot.rulesCount), val2: String(v2.snapshot.rulesCount) },
    { label: 'Adjustments', val1: String(v1.snapshot.adjustmentsCount), val2: String(v2.snapshot.adjustmentsCount) },
    { label: 'Status', val1: versionStatusConfig[v1.versionStatus].label, val2: versionStatusConfig[v2.versionStatus].label },
    { label: 'Valid Until', val1: v1.snapshot.validUntil, val2: v2.snapshot.validUntil },
  ];

  return (
    <div style={{
      backgroundColor: '#FFFFFF', borderRadius: '0 0 8px 8px',
      border: '1px solid #E5E7EB', borderTop: 'none', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeftRight style={{ width: '14px', height: '14px', color: '#3B82F6' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', lineHeight: '1' }}>
            Comparing V{v1.version} ↔ V{v2.version}
          </span>
        </div>
        <button onClick={onClose} style={{
          width: '28px', height: '28px', borderRadius: '6px', border: 'none',
          backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <X style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
        </button>
      </div>

      {/* Comparison table */}
      <div style={{ padding: '0' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '160px 1fr 1fr',
          padding: '8px 16px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>
            Field
          </span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>
            V{v1.version} · {v1.sentAt?.split(' · ')[0] || '—'}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>
            V{v2.version} · {v2.sentAt?.split(' · ')[0] || '—'}
          </span>
        </div>

        {fields.map((f, idx) => {
          const changed = f.val1 !== f.val2;
          const isEven = idx % 2 === 0;
          return (
            <div
              key={f.label}
              style={{
                display: 'grid', gridTemplateColumns: '160px 1fr 1fr',
                padding: '10px 16px', borderBottom: '1px solid #E5E7EB',
                backgroundColor: isEven ? '#FFFFFF' : '#F9FAFB',
                borderLeft: changed ? '3px solid #F59E0B' : '3px solid transparent',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280', lineHeight: '1' }}>{f.label}</span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: changed ? '#92400E' : '#1F2937', lineHeight: '1' }}>{f.val1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: changed ? '#065F46' : '#1F2937', lineHeight: '1' }}>{f.val2}</span>
                {changed && <span style={{ fontSize: '9px', fontWeight: 600, color: '#D97706', lineHeight: '1' }}>●</span>}
              </div>
            </div>
          );
        })}

        {/* Two-column changes comparison */}
        {(v1.changes.length > 0 || v2.changes.length > 0) && (() => {
          const ctConfig: Record<string, { icon: any; color: string; bg: string }> = {
            'line-item-added': { icon: Plus, color: '#059669', bg: '#D1FAE5' },
            'line-item-removed': { icon: Trash2, color: '#DC2626', bg: '#FEE2E2' },
            'line-item-modified': { icon: Edit, color: '#D97706', bg: '#FEF3C7' },
            'pricing-changed': { icon: DollarSign, color: '#2563EB', bg: '#DBEAFE' },
            'customer-changed': { icon: User, color: '#7C3AED', bg: '#EDE9FE' },
            'config-changed': { icon: Tag, color: '#6B7280', bg: '#F3F4F6' },
            'attachment-added': { icon: Package, color: '#0891B2', bg: '#CFFAFE' },
            'rule-applied': { icon: Scale, color: '#2563EB', bg: '#DBEAFE' },
            'adjustment-applied': { icon: DollarSign, color: '#059669', bg: '#D1FAE5' },
          };
          const maxRows = Math.max(v1.changes.length, v2.changes.length);
          const evenRowBg = '#FFFFFF';
          const oddRowBg = '#F9FAFB';
          const placeholderBg = '#F3F4F6';
          const renderChangeCell = (change: VersionChange | undefined) => {
            if (!change) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', height: '100%' }}>
                  <span style={{ fontSize: '11px', color: '#D1D5DB', fontStyle: 'italic' }}>—</span>
                </div>
              );
            }
            const ct = ctConfig[change.type] || ctConfig['config-changed'];
            const CIcon = ct.icon;
            return (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', height: '100%' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '5px', backgroundColor: ct.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CIcon style={{ width: '11px', height: '11px', color: ct.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#1F2937', lineHeight: '1.3' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: change.action === 'Added' ? '#059669' : change.action === 'Removed' ? '#DC2626' : '#D97706', marginRight: '4px' }}>{change.action}:</span>
                    {change.subject}
                    {change.itemRef && <span style={{ fontSize: '10px', color: '#6B7280', marginLeft: '3px' }}>on {change.itemRef}</span>}
                  </div>
                  {change.subjectDetail && <div style={{ fontSize: '10px', color: '#6B7280', lineHeight: '1.3', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{change.subjectDetail}</div>}
                  {change.detail && <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.3', marginTop: '1px' }}>{change.detail}</div>}
                </div>
                <span style={{ fontSize: '10px', color: '#9CA3AF', flexShrink: 0, lineHeight: '1', marginTop: '3px', whiteSpace: 'nowrap' as const }}>{change.timestamp}</span>
              </div>
            );
          };

          return (
            <div style={{ borderTop: '1px solid #E5E7EB', overflow: 'hidden' }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                <div style={{ padding: '7px 12px', backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>
                    Changes in V{v1.version}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>({v1.changes.length})</span>
                </div>
                <div style={{ padding: '7px 12px', backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>
                    Changes in V{v2.version}
                  </span>
                  <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>({v2.changes.length})</span>
                </div>
              </div>
              {/* Unified rows — each row spans both columns for aligned heights */}
              {Array.from({ length: maxRows }).map((_, i) => {
                const leftChange = v1.changes[i];
                const rightChange = v2.changes[i];
                const isEven = i % 2 === 0;
                const rowBaseBg = isEven ? evenRowBg : oddRowBg;
                return (
                  <div
                    key={leftChange?.id ?? rightChange?.id ?? `row-${i}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      borderTop: '1px solid #E5E7EB',
                      minHeight: '44px',
                    }}
                  >
                    <div style={{
                      borderRight: '1px solid #E5E7EB',
                      backgroundColor: leftChange ? rowBaseBg : placeholderBg,
                    }}>
                      {renderChangeCell(leftChange)}
                    </div>
                    <div style={{
                      backgroundColor: rightChange ? rowBaseBg : placeholderBg,
                    }}>
                      {renderChangeCell(rightChange)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── Revert Confirm Modal ──────────────────────────────────────────

function RevertConfirmModal({ version, nextVersion, onClose, onConfirm, rateSnapshot, todayRate, customerCurrency }: {
  version: number;
  nextVersion: number;
  onClose: () => void;
  /** Reason text. Reverts always re-lock at today's Mid-market rate; the modal
   *  surfaces an indicator of that rate so the user knows what they're getting. */
  onConfirm: (reason: string) => void;
  /** Locked rate snapshot from the version being reverted to — used purely for
   *  the "vs locked" drift annotation in the indicator. */
  rateSnapshot?: VersionRateSnapshot;
  /** Today's customer→base Mid-market rate. Surfaces in the indicator. */
  todayRate?: number;
  /** Customer currency code, used to render the rate hint. */
  customerCurrency?: string;
}) {
  const [reason, setReason] = useState('');
  const showFx = !!customerCurrency && customerCurrency.toUpperCase() !== 'PKR' && !!rateSnapshot;
  const drift = (rateSnapshot && todayRate)
    ? Math.round(((todayRate - rateSnapshot.customerRate) / rateSnapshot.customerRate) * 1000) / 10
    : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '440px', boxShadow: '0 16px 48px rgba(0,0,0,0.12)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw style={{ width: '16px', height: '16px', color: '#D97706' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827', lineHeight: '1' }}>Revert to V{version}</span>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: '16px', height: '16px', color: '#9CA3AF' }} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '8px 10px', backgroundColor: '#FFFBEB', borderRadius: '6px' }}>
            <AlertCircle style={{ width: '13px', height: '13px', color: '#D97706', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#92400E', lineHeight: '1.3' }}>
              This will create a new draft (V{nextVersion}) based on V{version}. You'll need to send it to create the next version.
            </span>
          </div>

          {/* ── Rate indicator — reverts always re-lock at today's Mid-market.
                Shown only for non-PKR customers; the rest of the modal stays
                a simple confirm. ── */}
          {showFx && (
            <div
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', marginBottom: 14,
                borderRadius: 8,
                border: '1px solid color-mix(in srgb, #7c3aed 22%, transparent)',
                backgroundColor: 'color-mix(in srgb, #7c3aed 6%, transparent)',
              }}
            >
              <div
                style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'color-mix(in srgb, #7c3aed 14%, transparent)',
                  marginTop: 1,
                }}
              >
                <Send style={{ width: 11, height: 11, color: '#7c3aed' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2937', lineHeight: 1.3, marginBottom: 3 }}>
                  Today's Mid-market rate will be applied to this revert
                </div>
                <div style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' }}>
                  {todayRate
                    ? <>1 {customerCurrency} = ₨ {todayRate.toFixed(2)} PKR</>
                    : 'The latest live mid-market rate will be locked when you confirm.'}
                  {drift !== 0 && rateSnapshot && (
                    <span style={{ marginLeft: 6, color: drift > 0 ? '#92400E' : '#065F46' }}>
                      ({drift > 0 ? '+' : ''}{drift}% vs V{version} locked rate of ₨ {rateSnapshot.customerRate.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px', lineHeight: '1' }}>
            Reason for revert <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g., Customer wants to go back to the original configuration..."
            rows={3}
            style={{
              width: '100%', fontSize: '13px', fontWeight: 400, color: '#1F2937',
              border: '1px solid #E5E7EB', borderRadius: '6px', padding: '8px 12px',
              outline: 'none', resize: 'none', fontFamily: 'Inter, system-ui, sans-serif',
              lineHeight: '1.5', boxSizing: 'border-box', transition: 'border-color 150ms',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid #E5E7EB' }}>
          <button onClick={onClose} style={{
            height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500, color: '#6B7280',
            backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px',
            cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
          }}>
            Cancel
          </button>
          <button
            disabled={false}
            onClick={() => onConfirm(reason.trim())}
            style={{
              height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500,
              color: '#FFFFFF', backgroundColor: '#D97706',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms',
            }}
          >
            <RotateCcw style={{ width: '14px', height: '14px' }} />
            Revert to V{version}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Draft Conflict Inline Modal ──────────────────────────────────
function DraftConflictInlineModal({ existingDraftVersion, revertFromVersion, onClose, onOverwrite, onCreateNew }: {
  existingDraftVersion: number; revertFromVersion: number; onClose: () => void; onOverwrite: () => void; onCreateNew: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '460px', boxShadow: '0 16px 48px rgba(0,0,0,0.12)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle style={{ width: '16px', height: '16px', color: '#D97706' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827', lineHeight: '1' }}>Draft Already Exists</span>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: '16px', height: '16px', color: '#9CA3AF' }} />
          </button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', padding: '8px 10px', backgroundColor: '#FFFBEB', borderRadius: '6px' }}>
            <AlertCircle style={{ width: '13px', height: '13px', color: '#D97706', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#92400E', lineHeight: '1.3' }}>
              V{existingDraftVersion} is currently a draft. Choose how to apply data from V{revertFromVersion}:
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={onOverwrite}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px',
                borderRadius: '8px', border: '1.5px solid #E5E7EB', backgroundColor: '#FFFFFF',
                cursor: 'pointer', textAlign: 'left', transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.backgroundColor = '#F0F7FF'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <Edit style={{ width: '14px', height: '14px', color: '#3B82F6', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1', marginBottom: '5px' }}>
                  Update Draft V{existingDraftVersion}
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.2' }}>
                  Replace existing draft data with V{revertFromVersion}'s content
                </div>
              </div>
            </button>

            <button
              onClick={onCreateNew}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px',
                borderRadius: '8px', border: '1.5px solid #E5E7EB', backgroundColor: '#FFFFFF',
                cursor: 'pointer', textAlign: 'left', transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.backgroundColor = '#F0F7FF'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <FileText style={{ width: '14px', height: '14px', color: '#6B7280', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1', marginBottom: '5px' }}>
                  Create New Draft V{existingDraftVersion + 1}
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.2' }}>
                  Discard V{existingDraftVersion} draft and create a new version
                </div>
              </div>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px', borderTop: '1px solid #E5E7EB' }}>
          <button onClick={onClose} style={{
            height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500, color: '#6B7280',
            backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px',
            cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
          }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
