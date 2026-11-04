import React, { useState, useRef } from 'react';
import {
  Search, Filter, GitBranch, Clock, ChevronDown, ChevronRight,
  RotateCcw, ArrowLeftRight, X, Check, Package, DollarSign,
  AlertCircle, Tag, Edit, Trash2, User, Plus,
  Send, CheckCircle2, FileText, Scale, Truck, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import type { SalesOrder } from './types';
import { MoneyConvertTooltip } from '../currency/MoneyConvertTooltip';
import { makeFormatOrderMoney } from '../currency/formatOrderMoney';
import { BASE_CURRENCY, convertBetween, getLibraryCurrency } from '@/app/data/currencyLibrary';

// ── Types ──────────────────────────────────────────────────────────
type VersionStatus = 'draft' | 'pending-review' | 'cleared' | 'shipped';

interface VersionChange {
  id: string;
  type: 'line-item-added' | 'line-item-removed' | 'line-item-modified' | 'pricing-changed' |
    'customer-changed' | 'config-changed' | 'attachment-added' | 'rule-applied' | 'adjustment-applied' | 'shipment';
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
  warehouse: string;
  lineItems?: { id: string; description: string; qty: number; uom: string; unitPrice: number; total: number; thumbColor?: string; shippedQty?: number }[];
}

interface VersionRateSnapshot {
  /** Base-per-1-customer rate locked when this version was sent. */
  lockedRate?: number;
  /** ISO timestamp when the rate was captured. */
  lockedAt?: string;
}

interface Version {
  version: number;
  versionStatus: VersionStatus;
  clearedAt?: string;
  createdAt?: string;
  sentBy: string;
  avatar: string;
  avatarColor: string;
  reason: string;
  snapshot: VersionSnapshot;
  changes: VersionChange[];
  isRevert?: boolean;
  revertedFrom?: number;
  /** FX context locked at the time this version was sent. Drives the
   *  "Restore locked rate from V{n}" option in the revert modal. */
  rateSnapshot?: VersionRateSnapshot;
}

function generateMockVersions(so?: SalesOrder): Version[] {
  const lines = so ? so.lines.filter(l => !l.cancelled).map(l => ({
    id: l.itemCode, description: l.itemName, qty: l.orderedQty, uom: 'EA',
    unitPrice: l.unitPrice, total: l.unitPrice * l.orderedQty, thumbColor: '#DBEAFE', shippedQty: l.shippedQty,
  })) : [];
  const grandTotal = lines.reduce((s, l) => s + l.total, 0);
  const warehouse = so?.warehouse || 'Warehouse A — Dallas';

  // Anchor each historical rate snapshot to the order's locked rate so the
  // "Restore locked rate from V{n}" option always shows a meaningful value
  // even on PKR-anchored mocks. Earlier versions trail today's rate slightly
  // so reverting visibly differs from "Refresh to today's rate".
  const anchorRate = typeof so?.lockedRate === 'number' && so.lockedRate > 0 ? so.lockedRate : 278;

  return [
    {
      version: 3, versionStatus: 'cleared',
      clearedAt: '02/05/2026 · 10:30 AM', createdAt: '02/04/2026',
      sentBy: 'Sarah Lindquist', avatar: 'SL', avatarColor: '#3B82F6',
      reason: 'Added emergency items per customer request. Applied volume adjustment.',
      snapshot: { lineItemCount: lines.length + 2, grandTotal: grandTotal + 9070, rulesCount: 2, adjustmentsCount: 1, warehouse, lineItems: [...lines, { id: '501-100-006', description: 'Linear Super-LED lightbar.', qty: 2, uom: 'EA', unitPrice: 3200, total: 6400 }, { id: '501-100-007', description: 'Auto-eject shoreline, 30A.', qty: 3, uom: 'EA', unitPrice: 890, total: 2670 }] },
      changes: [
        { id: 'C301', type: 'line-item-added', action: 'Added', subject: '501-100-006', subjectDetail: 'Linear Super-LED lightbar.', detail: 'Qty: 2 EA · $3,200/EA', timestamp: '10:25 AM', user: 'Sarah Lindquist' },
        { id: 'C302', type: 'line-item-added', action: 'Added', subject: '501-100-007', subjectDetail: 'Auto-eject shoreline, 30A.', detail: 'Qty: 3 EA · $890/EA', timestamp: '10:22 AM', user: 'Sarah Lindquist' },
        { id: 'C303', type: 'rule-applied', action: 'Added', subject: 'Pricing Rule', subjectDetail: 'Government Contract Pricing', detail: 'Eligible items flagged', timestamp: '10:18 AM', user: 'Michael Tran' },
        { id: 'C304', type: 'adjustment-applied', action: 'Added', subject: 'Adjustment', subjectDetail: 'Volume adjustment', detail: '−3% on total', timestamp: '10:15 AM', user: 'Sarah Lindquist' },
      ],
      rateSnapshot: { lockedRate: +(anchorRate * 0.998).toFixed(4), lockedAt: '2026-02-05T10:30:00.000Z' },
    },
    {
      version: 2, versionStatus: 'cleared',
      clearedAt: '01/28/2026 · 3:15 PM', createdAt: '01/27/2026',
      sentBy: 'Sarah Lindquist', avatar: 'SL', avatarColor: '#3B82F6',
      reason: 'Added medical equipment per build spec. Fleet volume pricing applied.',
      snapshot: { lineItemCount: lines.length, grandTotal, rulesCount: 1, adjustmentsCount: 0, warehouse, lineItems: lines },
      changes: [
        { id: 'C201', type: 'line-item-modified', action: 'Changed', subject: 'Qty', detail: '1 → 2', itemRef: lines[0]?.id, timestamp: '3:10 PM', user: 'David Kowalski' },
        { id: 'C202', type: 'pricing-changed', action: 'Changed', subject: 'Unit Price', detail: '$49,200 → $48,200', itemRef: lines[0]?.id, subjectDetail: 'Fleet Volume Pricing', timestamp: '3:08 PM', user: 'Sarah Lindquist' },
        { id: 'C206', type: 'rule-applied', action: 'Added', subject: 'Pricing Rule', subjectDetail: 'Fleet Volume Pricing', detail: '−$1,000/unit on 2+ units', timestamp: '3:12 PM', user: 'Sarah Lindquist' },
        { id: 'C207', type: 'config-changed', action: 'Changed', subject: 'Payment Terms', detail: 'Net 30 → Net 45', timestamp: '2:40 PM', user: 'Sarah Lindquist' },
      ],
      rateSnapshot: { lockedRate: +(anchorRate * 0.992).toFixed(4), lockedAt: '2026-01-28T15:15:00.000Z' },
    },
    {
      version: 1, versionStatus: 'cleared',
      clearedAt: '01/22/2026 · 2:15 PM', createdAt: '01/20/2026',
      sentBy: 'Sarah Lindquist', avatar: 'SL', avatarColor: '#3B82F6',
      reason: 'Initial Sales Order created for fleet build-out.',
      snapshot: { lineItemCount: Math.min(2, lines.length), grandTotal: lines.slice(0, 2).reduce((s, l) => s + l.total, 0), rulesCount: 0, adjustmentsCount: 0, warehouse, lineItems: lines.slice(0, 2) },
      changes: [
        { id: 'C101', type: 'line-item-added', action: 'Added', subject: lines[0]?.id || '501-100-001', subjectDetail: lines[0]?.description, detail: `Qty: ${lines[0]?.qty || 1} EA`, timestamp: '10:00 AM', user: 'Sarah Lindquist' },
        { id: 'C103', type: 'customer-changed', action: 'Changed', subject: 'Customer', detail: so?.customer || 'Customer', timestamp: '9:55 AM', user: 'Sarah Lindquist' },
        { id: 'C104', type: 'config-changed', action: 'Changed', subject: 'Payment Terms', detail: so?.paymentTerms || 'Net 30', timestamp: '9:50 AM', user: 'Sarah Lindquist' },
      ],
      rateSnapshot: { lockedRate: +(anchorRate * 0.985).toFixed(4), lockedAt: '2026-01-22T14:15:00.000Z' },
    },
  ];
}

type VersionFilter = 'all' | 'pricing' | 'line-items' | 'config';

const CURRENT_USER = 'Sarah Lindquist';

const versionStatusConfig: Record<VersionStatus, { label: string; bg: string; color: string; icon: typeof Send }> = {
  draft: { label: 'Draft', bg: '#F3F4F6', color: '#374151', icon: FileText },
  'pending-review': { label: 'Pending Review', bg: '#FEF3C7', color: '#92400E', icon: Clock },
  cleared: { label: 'Cleared', bg: '#CCFBF1', color: '#0F766E', icon: CheckCircle2 },
  shipped: { label: 'Shipped', bg: '#DBEAFE', color: '#1E40AF', icon: Truck },
};

interface VersionHistoryTabProps {
  so: SalesOrder;
  /** Page-level Base ↔ Customer view toggle, threaded from SODetail. */
  viewMode?: "base" | "customer";
}

export function VersionHistoryTab({ so, viewMode = "base" }: VersionHistoryTabProps) {
  const [versions, setVersions] = useState(() => generateMockVersions(so));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<VersionFilter>('all');
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set([3]));
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelections, setCompareSelections] = useState<number[]>([]);
  const [showCompareView, setShowCompareView] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState<number | null>(null);

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [versionStatusFilter, setVersionStatusFilter] = useState<string>('any');
  const filterRef = useRef<HTMLDivElement>(null);

  const advancedFilterCount = (creatorFilter !== 'all' ? 1 : 0) + (versionStatusFilter !== 'any' ? 1 : 0);
  const creators = [...new Set(versions.map(v => v.sentBy))];

  const latestCleared = versions.find(v => v.versionStatus === 'cleared');
  const lastApprovedVersionNum = latestCleared?.version ?? 1;
  const latestVersionNum = versions[0]?.version ?? 1;

  const [draftConflictRevert, setDraftConflictRevert] = useState<{ toVersion: number; reason: string; rateChoice: 'locked' | 'refresh' } | null>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterDropdown(false);
    };
    if (showFilterDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterDropdown]);

  // viewMode-aware formatter — flips between base PKR display and customer
  // currency display when the page-level toggle is in customer mode.
  const formatCurrency = makeFormatOrderMoney(so.currency, viewMode);
  const customerCurrency = so.currency;
  const lockedRate = so.lockedRate;
  const lockedAt = so.lockedAt;

  const toggleExpanded = (v: number) => {
    setExpandedVersions(prev => { const next = new Set(prev); if (next.has(v)) next.delete(v); else next.add(v); return next; });
  };

  const handleCompareSelect = (v: number) => {
    setCompareSelections(prev => {
      if (prev.includes(v)) return prev.filter(x => x !== v);
      if (prev.length >= 2) return [prev[1], v];
      return [...prev, v];
    });
  };

  const doRevert = (toVersion: number, reason: string, overwriteExisting: boolean, rateChoice: 'locked' | 'refresh') => {
    const source = versions.find(v => v.version === toVersion)!;
    const latestVer = versions[0];
    const hasShipped = source.snapshot.lineItems?.some(li => (li.shippedQty || 0) > 0) || false;

    // Pick the rate snapshot the new draft should carry forward. "locked"
    // restores the rate captured in V{toVersion}; "refresh" stamps today's
    // rate (mid-market is the default for SO reverts, mirroring Quotes).
    const upperCustomer = (so.currency || '').toUpperCase();
    const todayRate = upperCustomer && upperCustomer !== BASE_CURRENCY
      ? convertBetween(1, upperCustomer, BASE_CURRENCY)
      : undefined;
    const newRateSnapshot: VersionRateSnapshot | undefined = rateChoice === 'locked'
      ? source.rateSnapshot
      : (typeof todayRate === 'number'
          ? { lockedRate: todayRate, lockedAt: new Date().toISOString() }
          : undefined);

    if (overwriteExisting && latestVer.versionStatus === 'draft') {
      const updated: Version = { ...latestVer, reason: reason || `Reverted to Version ${toVersion}`, isRevert: true, revertedFrom: toVersion, snapshot: { ...source.snapshot }, rateSnapshot: newRateSnapshot, changes: [{ id: `C${Date.now()}`, type: 'config-changed', action: 'Changed' as const, subject: 'Reverted Draft', detail: `Restored from V${toVersion}`, subjectDetail: reason || undefined, timestamp: 'Just now', user: 'Sarah Lindquist' }] };
      setVersions(prev => [updated, ...prev.slice(1)]);
      setExpandedVersions(new Set([latestVer.version]));
      toast.success(`Updated V${latestVer.version} Draft with data from V${toVersion}`, {
        description: rateChoice === 'refresh'
          ? "Draft content replaced. Today's rate applied."
          : 'Draft content replaced. Locked rate restored.',
        position: 'top-right',
      });
    } else {
      const newV = latestVer.version + 1;
      const newVersion: Version = { ...source, version: newV, versionStatus: 'draft', clearedAt: undefined, sentBy: 'Sarah Lindquist', reason: reason || `Reverted to Version ${toVersion}${hasShipped ? ' (shipped items locked)' : ''}`, isRevert: true, revertedFrom: toVersion, snapshot: { ...source.snapshot }, rateSnapshot: newRateSnapshot, changes: [{ id: `C${Date.now()}`, type: 'config-changed', action: 'Changed' as const, subject: 'Reverted to Draft', detail: `Created from V${toVersion}`, subjectDetail: reason || undefined, timestamp: 'Just now', user: 'Sarah Lindquist' }] };
      setVersions(prev => [newVersion, ...prev]);
      setExpandedVersions(new Set([newV]));
      const desc = rateChoice === 'refresh'
        ? "Created as a new draft with today's rate applied."
        : 'Created as a new draft with the locked rate restored.';
      toast.success(`Reverted to Version ${toVersion} as new Draft (v${newV})`, {
        description: hasShipped ? `${desc} Shipped items included as locked.` : desc,
        position: 'top-right',
      });
    }
    setShowRevertConfirm(null);
    setDraftConflictRevert(null);
  };

  const handleRevert = (toVersion: number, reason: string, rateChoice: 'locked' | 'refresh') => {
    const latestVer = versions[0];
    if (latestVer && latestVer.versionStatus === 'draft') {
      setDraftConflictRevert({ toVersion, reason, rateChoice });
      return;
    }
    doRevert(toVersion, reason, false, rateChoice);
  };

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
    'shipment': { icon: Truck, color: '#0891B2', bg: '#CFFAFE' },
  };

  const filteredVersions = versions.map(v => {
    const filteredChanges = v.changes.filter(c => {
      const matchesSearch = !searchQuery || c.subject.toLowerCase().includes(searchQuery.toLowerCase()) || c.subjectDetail?.toLowerCase().includes(searchQuery.toLowerCase()) || c.detail?.toLowerCase().includes(searchQuery.toLowerCase()) || c.user.toLowerCase().includes(searchQuery.toLowerCase());
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
    return v.reason.toLowerCase().includes(searchQuery.toLowerCase()) || v.sentBy.toLowerCase().includes(searchQuery.toLowerCase());
  }).filter(v => {
    if (creatorFilter !== 'all' && v.sentBy !== creatorFilter) return false;
    if (versionStatusFilter !== 'any' && v.versionStatus !== versionStatusFilter) return false;
    return true;
  });

  const filters: { key: VersionFilter; label: string }[] = [
    { key: 'all', label: 'All Changes' }, { key: 'line-items', label: 'Line Items' },
    { key: 'pricing', label: 'Pricing & Rules' }, { key: 'config', label: 'Customer Info' },
  ];

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>

        {/* ── Toolbar ── */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative', width: '240px', flexShrink: 0 }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF', pointerEvents: 'none' }} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search changes..."
                style={{ width: '100%', height: '32px', padding: '0 12px 0 32px', fontSize: '13px', fontWeight: 400, color: '#1F2937', border: '1px solid #E5E7EB', borderRadius: '6px', outline: 'none', backgroundColor: '#FFFFFF', fontFamily: 'Inter, system-ui, sans-serif', transition: 'border-color 150ms', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 0 0 2px #DBEAFE'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <X style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                </button>
              )}
            </div>

            {/* Filter dropdown */}
            <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setShowFilterDropdown(p => !p)} style={{ height: '32px', padding: '0 10px', fontSize: '12px', fontWeight: 500, color: advancedFilterCount > 0 ? '#1B6EF3' : '#6B7280', backgroundColor: advancedFilterCount > 0 ? '#E7F3FF' : '#FFFFFF', border: `1px solid ${advancedFilterCount > 0 ? '#1B6EF3' : '#E5E7EB'}`, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 150ms', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { if (!advancedFilterCount) { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; } }}
                onMouseLeave={e => { if (!advancedFilterCount) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; } }}
              >
                <Filter style={{ width: '13px', height: '13px' }} />Filters
                {advancedFilterCount > 0 && <span style={{ fontSize: '10px', fontWeight: 700, color: '#FFFFFF', backgroundColor: '#1B6EF3', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>{advancedFilterCount}</span>}
              </button>
              {showFilterDropdown && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 20, backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E5E7EB', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: '260px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>Filters</span>
                    {advancedFilterCount > 0 && <button onClick={() => { setCreatorFilter('all'); setVersionStatusFilter('any'); }} style={{ fontSize: '11px', fontWeight: 500, color: '#EF4444', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', padding: '2px 6px', borderRadius: '4px' }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FEF2F2'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >Clear all</button>}
                  </div>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}><GitBranch style={{ width: '12px', height: '12px', color: '#9CA3AF' }} /><span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Version Status</span></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {[{ key: 'any', label: 'Any' }, { key: 'cleared', label: 'Cleared' }, { key: 'pending-review', label: 'Pending' }, { key: 'draft', label: 'Draft' }].map(d => {
                        const active = versionStatusFilter === d.key;
                        return (
                          <button key={d.key} onClick={() => setVersionStatusFilter(d.key)} style={{ height: '26px', padding: '0 10px', fontSize: '11px', fontWeight: 500, color: active ? '#1B6EF3' : '#6B7280', backgroundColor: active ? '#EFF6FF' : '#F9FAFB', border: `1px solid ${active ? '#BFDBFE' : '#E5E7EB'}`, borderRadius: '5px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 100ms' }}>
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}><User style={{ width: '12px', height: '12px', color: '#9CA3AF' }} /><span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created By</span></div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button onClick={() => setCreatorFilter('all')} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px', fontSize: '12px', fontWeight: creatorFilter === 'all' ? 600 : 400, color: creatorFilter === 'all' ? '#1B6EF3' : '#374151', backgroundColor: creatorFilter === 'all' ? '#EFF6FF' : 'transparent', border: 'none', borderRadius: '5px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}
                        onMouseEnter={e => { if (creatorFilter !== 'all') e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                        onMouseLeave={e => { if (creatorFilter !== 'all') e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >Everyone</button>
                      {creators.map(c => {
                        const active = creatorFilter === c;
                        const isYou = c === CURRENT_USER;
                        return (
                          <button key={c} onClick={() => setCreatorFilter(c)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '6px 8px', fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? '#1B6EF3' : '#374151', backgroundColor: active ? '#EFF6FF' : 'transparent', border: 'none', borderRadius: '5px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'left' }}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                            onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >{c}{isYou && <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 400 }}>(you)</span>}</button>
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
              onClick={() => { setCompareMode(!compareMode); setCompareSelections([]); setShowCompareView(false); }}
              style={{ height: '32px', padding: '0 12px', fontSize: '13px', fontWeight: 500, color: compareMode ? '#DC2626' : '#6B7280', backgroundColor: compareMode ? '#FEF2F2' : '#FFFFFF', border: `1px solid ${compareMode ? '#FECACA' : '#E5E7EB'}`, borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 150ms' }}
            >
              <ArrowLeftRight style={{ width: '14px', height: '14px' }} />
              {compareMode ? 'Cancel' : 'Compare'}
            </button>
          </div>

          {/* Row 2: Quick filter pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {filters.map(f => {
              const isActive = activeFilter === f.key;
              return (
                <button key={f.key} onClick={() => setActiveFilter(f.key)} style={{ height: '28px', padding: '0 10px', fontSize: '12px', fontWeight: 500, color: isActive ? '#1B6EF3' : '#6B7280', backgroundColor: isActive ? '#E7F3FF' : '#FFFFFF', border: `1px solid ${isActive ? '#1B6EF3' : '#E2E8F0'}`, borderRadius: '14px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 150ms', flexShrink: 0 }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; } }}
                >{f.label}</button>
              );
            })}
            {advancedFilterCount > 0 && (
              <>
                <div style={{ width: '1px', height: '20px', backgroundColor: '#E5E7EB', flexShrink: 0 }} />
                {versionStatusFilter !== 'any' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px', fontSize: '11px', fontWeight: 500, color: '#1B6EF3', backgroundColor: '#EFF6FF', borderRadius: '5px', whiteSpace: 'nowrap', lineHeight: '1' }}>
                    {versionStatusFilter.charAt(0).toUpperCase() + versionStatusFilter.slice(1)}
                    <button onClick={() => setVersionStatusFilter('any')} style={{ width: '14px', height: '14px', borderRadius: '3px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <X style={{ width: '10px', height: '10px', color: '#3B82F6' }} />
                    </button>
                  </span>
                )}
                {creatorFilter !== 'all' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 6px 0 8px', fontSize: '11px', fontWeight: 500, color: '#1B6EF3', backgroundColor: '#EFF6FF', borderRadius: '5px', whiteSpace: 'nowrap', lineHeight: '1' }}>
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

        {!compareMode && <div style={{ height: '1px', backgroundColor: '#E5E7EB' }} />}

        {/* ── Compare action bar ── */}
        {compareMode && (
          <div style={{ backgroundColor: '#EFF6FF', borderTop: '1px solid #BFDBFE', borderBottom: '1px solid #BFDBFE', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeftRight style={{ width: '14px', height: '14px', color: '#3B82F6' }} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#1E40AF', lineHeight: '1' }}>
              Select two versions to compare{compareSelections.length > 0 && ` · ${compareSelections.length}/2 selected`}
            </span>
            <div style={{ flex: 1 }} />
            {compareSelections.length === 2 && (
              <button onClick={() => setShowCompareView(true)} style={{ height: '28px', padding: '0 12px', fontSize: '12px', fontWeight: 500, color: '#FFFFFF', backgroundColor: '#3B82F6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#2563EB'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#3B82F6'; }}
              >Compare V{Math.min(...compareSelections)} ↔ V{Math.max(...compareSelections)}</button>
            )}
          </div>
        )}

        {/* ── Version list ── */}
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
              const hasShippedItems = ver.snapshot.lineItems?.some(li => (li.shippedQty || 0) > 0) || false;

              return (
                <div key={ver.version}>
                  {vidx > 0 && <div style={{ height: '1px', backgroundColor: '#E5E7EB' }} />}
                  {/* Version header */}
                  <div
                    onClick={() => compareMode ? handleCompareSelect(ver.version) : toggleExpanded(ver.version)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', backgroundColor: isCompareSelected ? '#F0F7FF' : isExpanded ? '#F9FAFB' : 'transparent', transition: 'background-color 150ms' }}
                    onMouseEnter={e => { if (!isExpanded && !isCompareSelected) e.currentTarget.style.backgroundColor = '#FAFBFC'; }}
                    onMouseLeave={e => { if (!isExpanded && !isCompareSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {compareMode ? (
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: isCompareSelected ? 'none' : '2px solid #D1D5DB', backgroundColor: isCompareSelected ? '#1B6EF3' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                        {isCompareSelected && <Check style={{ width: '10px', height: '10px', color: '#FFFFFF' }} />}
                      </div>
                    ) : (
                      <ChevronRight style={{ width: '14px', height: '14px', color: '#9CA3AF', flexShrink: 0, transition: 'transform 150ms', transform: isExpanded ? 'rotate(90deg)' : 'none' }} />
                    )}

                    {/* Version badge */}
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: isLastApproved ? '#CCFBF1' : ver.versionStatus === 'pending-review' ? '#FEF3C7' : ver.versionStatus === 'cleared' ? '#DBEAFE' : ver.isRevert ? '#FFFBEB' : '#F9FAFB', border: `1px solid ${isLastApproved ? '#5EEAD4' : ver.versionStatus === 'pending-review' ? '#FDE68A' : ver.versionStatus === 'cleared' ? '#93C5FD' : ver.isRevert ? '#FDE68A' : '#F3F4F6'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {ver.isRevert ? <RotateCcw style={{ width: '11px', height: '11px', color: '#D97706' }} /> : isLastApproved ? <CheckCircle2 style={{ width: '12px', height: '12px', color: '#0D9488' }} /> : ver.versionStatus === 'pending-review' ? <Clock style={{ width: '11px', height: '11px', color: '#D97706' }} /> : <FileText style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>V{ver.version}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 600, color: vsCfg.color, backgroundColor: vsCfg.bg, padding: '2px 5px', borderRadius: '3px', lineHeight: '1' }}>
                          <VSIcon style={{ width: '9px', height: '9px' }} />{vsCfg.label}
                        </span>
                        {isLatestVersion && <span style={{ fontSize: '10px', fontWeight: 600, color: '#374151', backgroundColor: '#F3F4F6', padding: '2px 5px', borderRadius: '3px', lineHeight: '1', border: '1px solid #E5E7EB' }}>Latest</span>}
                        {isLastApproved && <span style={{ fontSize: '10px', fontWeight: 600, color: '#0F766E', backgroundColor: '#F0FDFA', padding: '2px 5px', borderRadius: '3px', lineHeight: '1', border: '1px solid #99F6E4' }}>Last Approved</span>}
                        {hasShippedItems && <Truck style={{ width: '11px', height: '11px', color: '#059669' }} />}
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1', flexShrink: 0 }}>{ver.clearedAt?.split(' · ')[0] || ver.createdAt || '—'}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ver.reason}</div>
                    </div>

                    {/* Snapshot badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1' }}>{ver.snapshot.lineItemCount} items</span>
                      {(ver.snapshot.rulesCount > 0 || ver.snapshot.adjustmentsCount > 0) && <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1' }}>{ver.snapshot.rulesCount}R / {ver.snapshot.adjustmentsCount}A</span>}
                      <MoneyConvertTooltip valuePKR={ver.snapshot.grandTotal} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt} display={viewMode}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>{formatCurrency(ver.snapshot.grandTotal)}</span>
                      </MoneyConvertTooltip>
                    </div>

                    {!compareMode && ver.versionStatus === 'cleared' && !isLastApproved && (
                      <button onClick={e => { e.stopPropagation(); setShowRevertConfirm(ver.version); }} title="Revert to this version" style={{ width: '28px', height: '28px', borderRadius: '5px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 100ms', flexShrink: 0 }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      ><RotateCcw style={{ width: '13px', height: '13px', color: '#9CA3AF' }} /></button>
                    )}
                  </div>

                  {/* Expanded content */}
                  {isExpanded && !compareMode && (
                    <div style={{ padding: '10px 16px 14px 56px' }}>
                      {/* Timestamps */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', paddingTop: '10px', borderTop: '1px solid #E5E7EB', flexWrap: 'wrap' as const }}>
                        {ver.createdAt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <FileText style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                            <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1' }}>Created {ver.createdAt}</span>
                          </div>
                        )}
                        {ver.clearedAt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <CheckCircle2 style={{ width: '12px', height: '12px', color: '#059669' }} />
                            <span style={{ fontSize: '12px', color: '#065F46', lineHeight: '1' }}>Cleared {ver.clearedAt}</span>
                          </div>
                        )}
                        {ver.versionStatus === 'pending-review' && !ver.clearedAt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Clock style={{ width: '12px', height: '12px', color: '#D97706' }} />
                            <span style={{ fontSize: '12px', fontWeight: 500, color: '#92400E', lineHeight: '1' }}>Awaiting Ops clearance</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Package style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                          <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1' }}>{ver.snapshot.warehouse}</span>
                        </div>
                      </div>

                      {/* Shipped items warning */}
                      {hasShippedItems && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '8px 10px', backgroundColor: 'rgba(39,185,115,0.08)', borderRadius: '6px', border: '1px solid rgba(39,185,115,0.2)' }}>
                          <Truck style={{ width: '13px', height: '13px', color: '#059669', flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', color: '#065F46', lineHeight: '1.3' }}>Some items have shipped quantities and will be locked in any new version.</span>
                        </div>
                      )}

                      {/* Line Items table */}
                      <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                          <Package style={{ width: '11px', height: '11px', color: '#6B7280' }} />
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' }}>Line Items</span>
                          <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>({ver.snapshot.lineItems ? ver.snapshot.lineItems.length : 0})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px', backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB' }}>
                          <div style={{ width: '22px', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Item</span></div>
                          <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', flexShrink: 0, width: '28px', textAlign: 'right' as const }}>Qty</span>
                          <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', flexShrink: 0, width: '28px', textAlign: 'center' as const }}>Unit</span>
                          <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', flexShrink: 0, width: '64px', textAlign: 'right' as const }}>Price</span>
                          <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', flexShrink: 0, minWidth: '64px', textAlign: 'right' as const }}>Total</span>
                        </div>
                        {ver.snapshot.lineItems && ver.snapshot.lineItems.length > 0 ? (
                          <div style={{ backgroundColor: '#FFFFFF' }}>
                            {ver.snapshot.lineItems.map((li, liIdx) => {
                              const isShipped = (li.shippedQty || 0) > 0;
                              return (
                                <div key={li.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderTop: liIdx > 0 ? '1px solid #F7F8F9' : 'none', opacity: isShipped ? 0.7 : 1 }}>
                                  <div style={{ width: '22px', height: '22px', borderRadius: '3px', flexShrink: 0, backgroundColor: li.thumbColor || '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {isShipped ? <Lock style={{ width: '9px', height: '9px', color: '#059669' }} /> : <Package style={{ width: '10px', height: '10px', color: '#6B7280', opacity: 0.5 }} />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', lineHeight: '1' }}>{li.id}</span>
                                      {isShipped && <span style={{ fontSize: '8px', fontWeight: 600, padding: '1px 4px', borderRadius: '3px', backgroundColor: '#D1FAE5', color: '#065F46' }}>SHIPPED</span>}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{li.description}</div>
                                  </div>
                                  <span style={{ fontSize: '10px', color: '#6B7280', lineHeight: '1', flexShrink: 0, width: '28px', textAlign: 'right' as const }}>{li.qty}</span>
                                  <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1', flexShrink: 0, width: '28px', textAlign: 'center' as const }}>{li.uom}</span>
                                  <MoneyConvertTooltip valuePKR={li.unitPrice} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt} display={viewMode}>
                                    <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1', flexShrink: 0, width: '64px', textAlign: 'right' as const, display: 'inline-block' }}>{formatCurrency(li.unitPrice)}</span>
                                  </MoneyConvertTooltip>
                                  <MoneyConvertTooltip valuePKR={li.total} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt} display={viewMode}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#1F2937', lineHeight: '1', flexShrink: 0, minWidth: '64px', textAlign: 'right' as const, display: 'inline-block' }}>{formatCurrency(li.total)}</span>
                                  </MoneyConvertTooltip>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ padding: '8px 10px', fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic' }}>No line items</div>
                        )}
                        {ver.snapshot.lineItems && ver.snapshot.lineItems.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 10px', borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
                            <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.3px', lineHeight: '1', marginRight: '8px' }}>Subtotal</span>
                            <MoneyConvertTooltip valuePKR={ver.snapshot.lineItems.reduce((s, li) => s + li.total, 0)} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt} display={viewMode}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', lineHeight: '1', minWidth: '64px', textAlign: 'right' as const, display: 'inline-block' }}>{formatCurrency(ver.snapshot.lineItems.reduce((s, li) => s + li.total, 0))}</span>
                            </MoneyConvertTooltip>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', backgroundColor: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
                          <span style={{ fontSize: '10px', color: (ver.snapshot.rulesCount > 0 || ver.snapshot.adjustmentsCount > 0) ? '#6B7280' : '#9CA3AF', lineHeight: '1' }}>
                            {(ver.snapshot.rulesCount > 0 || ver.snapshot.adjustmentsCount > 0) ? `${ver.snapshot.rulesCount} rule${ver.snapshot.rulesCount !== 1 ? 's' : ''} · ${ver.snapshot.adjustmentsCount} adjustment${ver.snapshot.adjustmentsCount !== 1 ? 's' : ''}` : 'No rules or adjustments'}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.3px', lineHeight: '1' }}>Total</span>
                            <MoneyConvertTooltip valuePKR={ver.snapshot.grandTotal} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt} display={viewMode}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1F2937', lineHeight: '1' }}>{formatCurrency(ver.snapshot.grandTotal)}</span>
                            </MoneyConvertTooltip>
                          </div>
                        </div>
                      </div>

                      {/* Changes list */}
                      {ver.changes.length === 0 ? (
                        <div style={{ fontSize: '12px', color: '#9CA3AF', fontStyle: 'italic', lineHeight: '1' }}>No recorded changes in this version</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', lineHeight: '1' }}>Changes ({ver.changes.length})</div>
                          {ver.changes.map((change, cidx) => {
                            const ct = changeTypeConfig[change.type] || changeTypeConfig['config-changed'];
                            const CIcon = ct.icon;
                            const userInitials = change.user.split(' ').map((n: string) => n[0]).join('');
                            const userColor = change.user === 'Sarah Lindquist' ? '#3B82F6' : change.user === 'Michael Tran' ? '#8B5CF6' : change.user === 'David Kowalski' ? '#F59E0B' : '#6B7280';
                            return (
                              <div key={change.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderTop: cidx > 0 ? '1px solid #F7F8F9' : 'none' }}>
                                <div style={{ width: '22px', height: '22px', borderRadius: '5px', backgroundColor: ct.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                                  <CIcon style={{ width: '11px', height: '11px', color: ct.color }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#1F2937', lineHeight: '1.3', display: 'flex', alignItems: 'baseline', gap: '0', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: change.action === 'Added' ? '#059669' : change.action === 'Removed' ? '#DC2626' : '#D97706', marginRight: '5px', lineHeight: '1' }}>{change.action}:</span>
                                    <span style={{ fontWeight: 600, color: '#1F2937', marginRight: '4px' }}>{change.subject}</span>
                                    {change.itemRef && <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', marginRight: '4px' }}>on {change.itemRef}</span>}
                                  </div>
                                  {change.subjectDetail && <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.3', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{change.subjectDetail}</div>}
                                  {change.detail && <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1.3', marginTop: '1px' }}>{change.detail}</div>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: userColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#FFFFFF', lineHeight: '1' }}>{userInitials}</div>
                                  <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1' }}>{change.timestamp}</span>
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
      </div>

      {/* ── Compare View ── */}
      {showCompareView && compareSelections.length === 2 && (
        <CompareView
          v1={versions.find(v => v.version === Math.min(...compareSelections))!}
          v2={versions.find(v => v.version === Math.max(...compareSelections))!}
          formatCurrency={formatCurrency}
          onClose={() => setShowCompareView(false)}
          customerCurrency={customerCurrency}
          lockedRate={lockedRate}
          lockedAt={lockedAt}
          viewMode={viewMode}
        />
      )}

      {/* ── Revert Confirm Modal ── */}
      {showRevertConfirm !== null && (
        <RevertConfirmModal
          version={showRevertConfirm}
          nextVersion={versions[0].version + 1}
          hasShippedItems={versions.find(v => v.version === showRevertConfirm)?.snapshot.lineItems?.some(li => (li.shippedQty || 0) > 0) || false}
          customerCurrency={customerCurrency}
          sourceRateSnapshot={versions.find(v => v.version === showRevertConfirm)?.rateSnapshot}
          orderLockedRate={lockedRate}
          onClose={() => setShowRevertConfirm(null)}
          onConfirm={(reason: string, rateChoice: 'locked' | 'refresh') => handleRevert(showRevertConfirm, reason, rateChoice)}
        />
      )}

      {/* ── Draft Conflict Modal ── */}
      {draftConflictRevert !== null && (
        <DraftConflictInlineModal
          existingDraftVersion={versions[0].version}
          revertFromVersion={draftConflictRevert.toVersion}
          onClose={() => setDraftConflictRevert(null)}
          onOverwrite={() => doRevert(draftConflictRevert.toVersion, draftConflictRevert.reason, true, draftConflictRevert.rateChoice)}
          onCreateNew={() => doRevert(draftConflictRevert.toVersion, draftConflictRevert.reason, false, draftConflictRevert.rateChoice)}
        />
      )}
    </div>
  );
}

// ── Compare View ──────────────────────────────────────────────────
function CompareView({ v1, v2, formatCurrency, onClose, customerCurrency, lockedRate, lockedAt, viewMode = "base" }: {
  v1: Version; v2: Version; formatCurrency: (n: number) => string; onClose: () => void;
  customerCurrency?: string; lockedRate?: number; lockedAt?: string;
  viewMode?: "base" | "customer";
}) {
  const fields: Array<{ label: string; val1: string; val2: string; money1?: number; money2?: number }> = [
    { label: 'Line Items', val1: String(v1.snapshot.lineItemCount), val2: String(v2.snapshot.lineItemCount) },
    { label: 'Grand Total', val1: formatCurrency(v1.snapshot.grandTotal), val2: formatCurrency(v2.snapshot.grandTotal), money1: v1.snapshot.grandTotal, money2: v2.snapshot.grandTotal },
    { label: 'Rules', val1: String(v1.snapshot.rulesCount), val2: String(v2.snapshot.rulesCount) },
    { label: 'Adjustments', val1: String(v1.snapshot.adjustmentsCount), val2: String(v2.snapshot.adjustmentsCount) },
    { label: 'Status', val1: versionStatusConfig[v1.versionStatus].label, val2: versionStatusConfig[v2.versionStatus].label },
    { label: 'Warehouse', val1: v1.snapshot.warehouse, val2: v2.snapshot.warehouse },
  ];

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
    'shipment': { icon: Truck, color: '#0891B2', bg: '#CFFAFE' },
  };

  const renderChangeCell = (change: VersionChange | undefined) => {
    if (!change) {
      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', height: '100%' }}><span style={{ fontSize: '11px', color: '#D1D5DB', fontStyle: 'italic' }}>—</span></div>;
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
        <span style={{ fontSize: '10px', color: '#9CA3AF', flexShrink: 0, marginTop: '3px', whiteSpace: 'nowrap' as const }}>{change.timestamp}</span>
      </div>
    );
  };

  const maxRows = Math.max(v1.changes.length, v2.changes.length);

  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '0 0 8px 8px', border: '1px solid #E5E7EB', borderTop: 'none', overflow: 'hidden', marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeftRight style={{ width: '14px', height: '14px', color: '#3B82F6' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', lineHeight: '1' }}>Comparing V{v1.version} ↔ V{v2.version}</span>
        </div>
        <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
        </button>
      </div>
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', padding: '8px 16px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Field</span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>V{v1.version} · {v1.clearedAt?.split(' · ')[0] || v1.createdAt || '—'}</span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>V{v2.version} · {v2.clearedAt?.split(' · ')[0] || v2.createdAt || '—'}</span>
        </div>
        {fields.map((f, idx) => {
          const changed = f.val1 !== f.val2;
          const isEven = idx % 2 === 0;
          return (
            <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', padding: '10px 16px', borderBottom: '1px solid #E5E7EB', backgroundColor: isEven ? '#FFFFFF' : '#F9FAFB', borderLeft: changed ? '3px solid #F59E0B' : '3px solid transparent' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>{f.label}</span>
              {typeof f.money1 === 'number' ? (
                <MoneyConvertTooltip valuePKR={f.money1} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt} display={viewMode}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: changed ? '#92400E' : '#1F2937' }}>{f.val1}</span>
                </MoneyConvertTooltip>
              ) : (
                <span style={{ fontSize: '13px', fontWeight: 500, color: changed ? '#92400E' : '#1F2937' }}>{f.val1}</span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {typeof f.money2 === 'number' ? (
                  <MoneyConvertTooltip valuePKR={f.money2} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt} display={viewMode}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: changed ? '#065F46' : '#1F2937' }}>{f.val2}</span>
                  </MoneyConvertTooltip>
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: 500, color: changed ? '#065F46' : '#1F2937' }}>{f.val2}</span>
                )}
                {changed && <span style={{ fontSize: '9px', fontWeight: 600, color: '#D97706' }}>●</span>}
              </div>
            </div>
          );
        })}

        {(v1.changes.length > 0 || v2.changes.length > 0) && (
          <div style={{ borderTop: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ padding: '7px 12px', backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Changes in V{v1.version}</span>
                <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500 }}>({v1.changes.length})</span>
              </div>
              <div style={{ padding: '7px 12px', backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Changes in V{v2.version}</span>
                <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500 }}>({v2.changes.length})</span>
              </div>
            </div>
            {Array.from({ length: maxRows }).map((_, i) => {
              const isEven = i % 2 === 0;
              return (
                <div key={v1.changes[i]?.id ?? v2.changes[i]?.id ?? `row-${i}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #E5E7EB', minHeight: '44px' }}>
                  <div style={{ borderRight: '1px solid #E5E7EB', backgroundColor: v1.changes[i] ? (isEven ? '#FFFFFF' : '#F9FAFB') : '#F3F4F6' }}>{renderChangeCell(v1.changes[i])}</div>
                  <div style={{ backgroundColor: v2.changes[i] ? (isEven ? '#FFFFFF' : '#F9FAFB') : '#F3F4F6' }}>{renderChangeCell(v2.changes[i])}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Revert Confirm Modal ──────────────────────────────────────────
function RevertConfirmModal({ version, nextVersion, hasShippedItems, customerCurrency, sourceRateSnapshot, orderLockedRate, onClose, onConfirm }: {
  version: number; nextVersion: number; hasShippedItems: boolean;
  /** Customer currency code (e.g. USD). Drives whether the FX choice appears. */
  customerCurrency?: string;
  /** Rate snapshot captured when the source version was sent. Drives the
   *  "Restore locked rate from V{n}" option. */
  sourceRateSnapshot?: VersionRateSnapshot;
  /** Order-level locked rate fallback used when the source version doesn't
   *  carry its own snapshot. */
  orderLockedRate?: number;
  onClose: () => void; onConfirm: (reason: string, rateChoice: 'locked' | 'refresh') => void;
}) {
  const [reason, setReason] = useState('');
  const [rateChoice, setRateChoice] = useState<'locked' | 'refresh'>('locked');

  const upperCustomer = customerCurrency?.toUpperCase();
  const showFx = !!upperCustomer && upperCustomer !== BASE_CURRENCY;
  const baseSym = getLibraryCurrency(BASE_CURRENCY)?.symbol ?? BASE_CURRENCY;

  // Locked rate to restore. Prefer the version's own snapshot; fall back to
  // the order's locked rate so the option still shows on records that
  // pre-date per-version snapshotting.
  const lockedRateToRestore = sourceRateSnapshot?.lockedRate ?? orderLockedRate;
  const lockedAtToRestore = sourceRateSnapshot?.lockedAt;
  const lockedDateLabel = (() => {
    if (!lockedAtToRestore) return null;
    try {
      return new Date(lockedAtToRestore).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    } catch { return null; }
  })();

  const todayRateValue = showFx ? convertBetween(1, upperCustomer!, BASE_CURRENCY) : 0;

  const showRateChoice = showFx && typeof lockedRateToRestore === 'number';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '480px', boxShadow: '0 16px 48px rgba(0,0,0,0.12)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RotateCcw style={{ width: '16px', height: '16px', color: '#D97706' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Revert to V{version}</span>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: '16px', height: '16px', color: '#9CA3AF' }} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '8px 10px', backgroundColor: '#FFFBEB', borderRadius: '6px' }}>
            <AlertCircle style={{ width: '13px', height: '13px', color: '#D97706', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#92400E', lineHeight: '1.3' }}>This will create a new draft (V{nextVersion}) based on V{version}.</span>
          </div>
          {hasShippedItems && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '8px 10px', backgroundColor: 'rgba(39,185,115,0.08)', borderRadius: '6px', border: '1px solid rgba(39,185,115,0.2)' }}>
              <Truck style={{ width: '13px', height: '13px', color: '#059669', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: '#065F46', lineHeight: '1.3' }}>Already-shipped items will be included as non-editable (locked) in the new draft.</span>
            </div>
          )}

          {/* Rate choice — mirrors the Purchase Orders module so users can
              pick between restoring the historical locked rate or refreshing
              to today's market snapshot. */}
          {showRateChoice && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 8, lineHeight: 1 }}>
                Currency rate
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  {
                    key: 'locked' as const,
                    title: `Restore locked rate from V${version}`,
                    sub: `1 ${upperCustomer} = ${baseSym} ${(lockedRateToRestore as number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${BASE_CURRENCY}${lockedDateLabel ? ` · locked on ${lockedDateLabel}` : ''}`,
                  },
                  {
                    key: 'refresh' as const,
                    title: "Refresh to today's rate",
                    sub: showFx && todayRateValue
                      ? `1 ${upperCustomer} = ${baseSym} ${todayRateValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${BASE_CURRENCY} · recompute against today's market snapshot`
                      : "Recompute totals against today's market snapshot",
                  },
                ]).map((opt) => {
                  const active = rateChoice === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setRateChoice(opt.key)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                        borderRadius: 8, border: `1px solid ${active ? '#1B6EF3' : '#E5E7EB'}`,
                        backgroundColor: active ? '#EFF6FF' : '#FFFFFF',
                        textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                    >
                      <span style={{
                        marginTop: 2, width: 14, height: 14, borderRadius: '50%',
                        border: `1.5px solid ${active ? '#1B6EF3' : '#D1D5DB'}`,
                        backgroundColor: active ? '#1B6EF3' : '#FFFFFF',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {active && <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#FFFFFF' }} />}
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>{opt.title}</span>
                        <span className="tabular-nums" style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.3 }}>{opt.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
            Reason for revert <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Customer wants to go back to the original configuration..." rows={3}
            style={{ width: '100%', fontSize: '13px', fontWeight: 400, color: '#1F2937', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '8px 12px', outline: 'none', resize: 'none', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.5', boxSizing: 'border-box', transition: 'border-color 150ms' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid #E5E7EB' }}>
          <button onClick={onClose} style={{ height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500, color: '#6B7280', backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Cancel</button>
          <button onClick={() => onConfirm(reason.trim(), rateChoice)} style={{ height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: '#FFFFFF', backgroundColor: '#D97706', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background-color 150ms' }}>
            <RotateCcw style={{ width: '14px', height: '14px' }} />Revert to V{version}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle style={{ width: '16px', height: '16px', color: '#D97706' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Draft Already Exists</span>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: '16px', height: '16px', color: '#9CA3AF' }} />
          </button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', padding: '8px 10px', backgroundColor: '#FFFBEB', borderRadius: '6px' }}>
            <AlertCircle style={{ width: '13px', height: '13px', color: '#D97706', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#92400E', lineHeight: '1.3' }}>V{existingDraftVersion} is currently a draft. Choose how to apply data from V{revertFromVersion}:</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={onOverwrite} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', backgroundColor: '#FFFFFF', cursor: 'pointer', textAlign: 'left', transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.backgroundColor = '#F0F7FF'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <Edit style={{ width: '14px', height: '14px', color: '#3B82F6', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1', marginBottom: '4px' }}>Overwrite V{existingDraftVersion} Draft</div>
                <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.3' }}>Replace V{existingDraftVersion} content with data from V{revertFromVersion}</div>
              </div>
            </button>
            <button onClick={onCreateNew} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #E5E7EB', backgroundColor: '#FFFFFF', cursor: 'pointer', textAlign: 'left', transition: 'all 150ms', fontFamily: 'Inter, system-ui, sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.backgroundColor = '#F0F7FF'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <Plus style={{ width: '14px', height: '14px', color: '#059669', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1', marginBottom: '4px' }}>Create New V{existingDraftVersion + 1}</div>
                <div style={{ fontSize: '11px', color: '#6B7280', lineHeight: '1.3' }}>Keep existing V{existingDraftVersion} draft and create a new one from V{revertFromVersion}</div>
              </div>
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #E5E7EB' }}>
          <button onClick={onClose} style={{ height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500, color: '#6B7280', backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
