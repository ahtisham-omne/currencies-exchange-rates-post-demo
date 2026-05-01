import React, { useState } from 'react';
import { X, Clock, User, FileText, GitCompare, DollarSign, Package, Plus, Trash2, Edit, Tag, Send, CheckCircle2, Scale, RotateCcw, AlertCircle, Check, Truck, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useSOStore } from './store';
import {
  BASE_CURRENCY,
  convertBetween,
  getLibraryCurrency,
} from '@/app/data/currencyLibrary';
import { MoneyConvertTooltip } from '../currency/MoneyConvertTooltip';
import { formatMoney } from '@/app/data/currencyLibrary';

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
  warehouse: string;
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
}

const changeTypeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
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

/* Renders amounts in the base currency (PKR). Conversion to the customer
 * currency is surfaced via MoneyConvertTooltip on hover throughout this view. */
const BASE_SYMBOL = getLibraryCurrency(BASE_CURRENCY)?.symbol ?? BASE_CURRENCY;
const formatCurrency = (n: number) => `${BASE_SYMBOL} ${formatMoney(n, BASE_CURRENCY)}`;

const versionStatusConfig: Record<SOVersionStatus, { label: string; bg: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', bg: '#F3F4F6', color: '#374151', icon: FileText },
  'pending-review': { label: 'Pending Review', bg: '#FEF3C7', color: '#92400E', icon: Clock },
  cleared: { label: 'Cleared by Ops', bg: '#CCFBF1', color: '#0F766E', icon: CheckCircle2 },
  shipped: { label: 'Shipped', bg: '#DBEAFE', color: '#1E40AF', icon: Truck },
};

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
        lineItemCount: 5, grandTotal: 198500, rulesCount: 1, adjustmentsCount: 1, warehouse: 'Warehouse A — Dallas',
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
        lineItemCount: 4, grandTotal: 156700, rulesCount: 1, adjustmentsCount: 0, warehouse: 'Warehouse A — Dallas',
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
        lineItemCount: 2, grandTotal: 90700, rulesCount: 0, adjustmentsCount: 0, warehouse: 'Warehouse A — Dallas',
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

export function VersionHistoryModal({ soNumber, currentVersion, onClose }: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<SOVersionEntry[]>(generateSOVersions);
  const latestCleared = versions.find(v => v.versionStatus === 'cleared');
  const currentVersionNum = latestCleared?.version ?? 1;
  const store = useSOStore();
  const so = store.salesOrders.find(s => s.soNumber === soNumber);
  const customerCurrency = so?.currency;
  const lockedRate = so?.lockedRate;
  const lockedAt = so?.lockedAt;

  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersionNum);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[number | null, number | null]>([null, null]);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [versionToRevert, setVersionToRevert] = useState<number | null>(null);

  const handleRevert = (toVersion: number, reason: string) => {
    const newV = versions[0].version + 1;
    const source = versions.find(v => v.version === toVersion)!;
    const hasShipped = source.snapshot.lineItems.some(li => (li.shippedQty || 0) > 0);
    const newVersion: SOVersionEntry = {
      version: newV,
      versionStatus: 'draft',
      sentBy: 'Sarah Lindquist',
      avatar: 'SL',
      avatarColor: '#3B82F6',
      notes: reason || `Reverted to Version ${toVersion}${hasShipped ? ' (shipped items locked)' : ''}`,
      isRevert: true,
      revertedFrom: toVersion,
      snapshot: { ...source.snapshot },
      changes: [
        { id: `C${Date.now()}`, type: 'config-changed', action: 'Changed' as const, subject: 'Reverted to Draft', detail: `Created from V${toVersion}`, subjectDetail: reason || undefined, timestamp: 'Just now', user: 'Sarah Lindquist' },
      ],
    };
    setVersions(prev => [newVersion, ...prev]);
    setShowRevertConfirm(false);
    setVersionToRevert(null);
    setSelectedVersion(newV);
    toast.success(`Reverted to Version ${toVersion} as new Draft (v${newV})`, {
      description: hasShipped ? 'Shipped items included as locked.' : 'New draft version created.',
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

  const getUserColor = (name: string) => {
    if (name === 'Sarah Lindquist') return '#3B82F6';
    if (name === 'Michael Tran') return '#8B5CF6';
    if (name === 'Emily Rios') return '#F59E0B';
    if (name === 'David Kowalski') return '#059669';
    return '#6B7280';
  };
  const getUserInitials = (name: string) => name.split(' ').map(n => n[0]).join('');

  return (
    <div
      style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10001, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(1px)',
      }}
    >
      <div
        style={{
          width: compareMode && compareVersions[0] !== null && compareVersions[1] !== null ? '1340px' : '1060px',
          height: '85vh', borderRadius: '12px', transition: 'width 250ms ease',
          backgroundColor: '#FFFFFF', boxShadow: '0 16px 48px rgba(0,0,0,0.12)',
          display: 'flex', flexDirection: 'column' as const,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#E7F3FF', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock style={{ width: '20px', height: '20px', color: '#1B6EF3' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1F2937', lineHeight: '1.2', margin: 0 }}>
                Version History — {soNumber}
              </h2>
              <p style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1', margin: 0, marginTop: '4px' }}>
                Versions are created when cleared by Ops · Current = latest cleared
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => { if (compareMode) setCompareVersions([null, null]); setCompareMode(!compareMode); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px',
                fontSize: '13px', fontWeight: 500, borderRadius: '6px', cursor: 'pointer',
                border: compareMode ? 'none' : '1px solid #E5E7EB',
                backgroundColor: compareMode ? '#1B6EF3' : '#FFFFFF',
                color: compareMode ? '#FFFFFF' : '#374151',
                fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'all 150ms',
              }}
              onMouseEnter={e => { if (!compareMode) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
              onMouseLeave={e => { if (!compareMode) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <GitCompare style={{ width: '14px', height: '14px' }} />
              {compareMode ? 'Exit Compare' : 'Compare Versions'}
            </button>
            <button
              onClick={onClose}
              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', transition: 'background-color 100ms' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F3F4F6'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <X style={{ width: '18px', height: '18px', color: '#6B7280' }} />
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
                const statusCfg = versionStatusConfig[version.versionStatus];
                const StatusIcon = statusCfg.icon;
                const hasShippedItems = version.snapshot.lineItems.some(li => (li.shippedQty || 0) > 0);
                const compareLabel = compareMode && isSelected ? compareVersions[0] === version.version ? 'A' : 'B' : null;

                return (
                  <div key={version.version} style={{ position: 'relative' }}>
                    {index < versions.length - 1 && !compareMode && (
                      <div style={{ position: 'absolute', left: '19px', top: '40px', bottom: '0', width: '2px', backgroundColor: '#E5E7EB' }} />
                    )}
                    <div style={{ display: 'flex', alignItems: 'stretch', gap: '0px', marginBottom: '8px' }}>
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
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1' }}>Version {version.version}</span>
                              {isCurrent && <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 5px', borderRadius: '4px', backgroundColor: '#D1FAE5', color: '#065F46', lineHeight: '1' }}>Current</span>}
                              {hasShippedItems && <Truck style={{ width: '11px', height: '11px', color: '#059669' }} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9CA3AF', lineHeight: '1', marginBottom: '5px' }}>
                              <User style={{ width: '11px', height: '11px' }} />
                              <span>{version.sentBy}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9CA3AF', lineHeight: '1', marginBottom: '8px' }}>
                              <Clock style={{ width: '11px', height: '11px' }} />
                              <span>{version.clearedAt ? version.clearedAt.split(' · ')[0] : version.createdAt || 'Draft'}</span>
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 500, padding: '3px 6px', borderRadius: '4px', lineHeight: '1', backgroundColor: statusCfg.bg, color: statusCfg.color }}>
                              <StatusIcon style={{ width: '10px', height: '10px' }} />
                              {statusCfg.label}
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
                  changeTypeConfig={changeTypeConfig}
                  versionStatusConfig={versionStatusConfig}
                  customerCurrency={customerCurrency}
                  lockedRate={lockedRate}
                  lockedAt={lockedAt}
                />
              ) : selectedVersionData ? (
                <SingleVersionView
                  version={selectedVersionData}
                  currentVersionNum={currentVersionNum}
                  versionStatusConfig={versionStatusConfig}
                  changeTypeConfig={changeTypeConfig}
                  formatCurrency={formatCurrency}
                  getUserColor={getUserColor}
                  getUserInitials={getUserInitials}
                  onRevert={(v) => { setVersionToRevert(v); setShowRevertConfirm(true); }}
                  customerCurrency={customerCurrency}
                  lockedRate={lockedRate}
                  lockedAt={lockedAt}
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
      </div>

      {showRevertConfirm && versionToRevert !== null && (
        <RevertConfirmModal
          version={versionToRevert}
          nextVersion={versions[0].version + 1}
          hasShippedItems={versions.find(v => v.version === versionToRevert)?.snapshot.lineItems.some(li => (li.shippedQty || 0) > 0) ?? false}
          soNumber={soNumber}
          onClose={() => { setShowRevertConfirm(false); setVersionToRevert(null); }}
          onConfirm={(reason: string) => handleRevert(versionToRevert, reason)}
        />
      )}
    </div>
  );
}

// ── Single Version View ──────────────────────────────────────────
function SingleVersionView({ version, currentVersionNum, versionStatusConfig: vsCfg, changeTypeConfig: ctCfg, formatCurrency: fmt, getUserColor, getUserInitials, onRevert, customerCurrency, lockedRate, lockedAt }: {
  version: SOVersionEntry; currentVersionNum: number;
  versionStatusConfig: Record<SOVersionStatus, { label: string; bg: string; color: string; icon: React.ElementType }>;
  changeTypeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }>;
  formatCurrency: (n: number) => string;
  getUserColor: (name: string) => string;
  getUserInitials: (name: string) => string;
  onRevert: (version: number) => void;
  customerCurrency?: string;
  lockedRate?: number;
  lockedAt?: string;
}) {
  const sCfg = vsCfg[version.versionStatus];
  const SIcon = sCfg.icon;
  const hasShippedItems = version.snapshot.lineItems.some(li => (li.shippedQty || 0) > 0);

  return (
    <div>
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: 0, lineHeight: '1' }}>Version {version.version}</h3>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 500, padding: '3px 8px', borderRadius: '4px', lineHeight: '1', backgroundColor: sCfg.bg, color: sCfg.color }}>
            <SIcon style={{ width: '10px', height: '10px' }} />{sCfg.label}
          </span>
          {version.version === currentVersionNum && <span style={{ fontSize: '10px', fontWeight: 500, padding: '3px 8px', borderRadius: '4px', lineHeight: '1', backgroundColor: '#D1FAE5', color: '#065F46' }}>Current</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {version.version !== currentVersionNum && version.versionStatus !== 'draft' && (
            <button
              onClick={() => onRevert(version.version)}
              style={{ height: '32px', padding: '0 12px', fontSize: '13px', fontWeight: 500, color: '#1B6EF3', backgroundColor: '#FFFFFF', border: '1px solid #1B6EF3', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F0F9FF'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              Revert to this version
            </button>
          )}
          <button
            onClick={() => {}}
            style={{ height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: '#FFFFFF', backgroundColor: '#1B6EF3', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1', transition: 'background-color 150ms' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1B6EF3'; }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Package style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
          <span style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1' }}>{version.snapshot.warehouse}</span>
        </div>
      </div>

      {/* Notes */}
      {version.notes && (
        <div style={{ marginBottom: '16px', padding: '10px 12px', backgroundColor: '#F0F9FF', borderLeft: '3px solid #1B6EF3', borderRadius: '0 6px 6px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <FileText style={{ width: '14px', height: '14px', color: '#1B6EF3', marginTop: '1px', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '11px', fontWeight: 500, color: '#1E40AF', lineHeight: '1', margin: 0, marginBottom: '4px' }}>Notes</p>
              <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4', margin: 0 }}>{version.notes}</p>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px', backgroundColor: '#F7F8F9', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ width: '22px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}><span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Item</span></div>
          <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', width: '28px', textAlign: 'right' as const }}>Qty</span>
          <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', width: '28px', textAlign: 'center' as const }}>Unit</span>
          <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', width: '64px', textAlign: 'right' as const }}>Price</span>
          <span style={{ fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase' as const, letterSpacing: '0.5px', minWidth: '64px', textAlign: 'right' as const }}>Total</span>
        </div>
        <div style={{ backgroundColor: '#FFFFFF' }}>
          {version.snapshot.lineItems.map((li, liIdx) => {
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
                  <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{li.description}</div>
                </div>
                <span style={{ fontSize: '10px', color: '#6B7280', width: '28px', textAlign: 'right' as const }}>{li.qty}</span>
                <span style={{ fontSize: '10px', color: '#9CA3AF', width: '28px', textAlign: 'center' as const }}>{li.uom}</span>
                <MoneyConvertTooltip valuePKR={li.unitPrice} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt}>
                  <span style={{ fontSize: '10px', color: '#9CA3AF', width: '64px', textAlign: 'right' as const, display: 'inline-block' }}>{fmt(li.unitPrice)}</span>
                </MoneyConvertTooltip>
                <MoneyConvertTooltip valuePKR={li.total} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#1F2937', minWidth: '64px', textAlign: 'right' as const, display: 'inline-block' }}>{fmt(li.total)}</span>
                </MoneyConvertTooltip>
              </div>
            );
          })}
        </div>
        {version.snapshot.lineItems.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 10px', borderTop: '1px solid #E5E7EB' }}>
            <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.3px', marginRight: '8px' }}>Subtotal</span>
            <MoneyConvertTooltip valuePKR={version.snapshot.lineItems.reduce((s, li) => s + li.total, 0)} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', minWidth: '64px', textAlign: 'right' as const, display: 'inline-block' }}>{fmt(version.snapshot.lineItems.reduce((s, li) => s + li.total, 0))}</span>
            </MoneyConvertTooltip>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', backgroundColor: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: '10px', color: version.snapshot.rulesCount > 0 || version.snapshot.adjustmentsCount > 0 ? '#6B7280' : '#9CA3AF', lineHeight: '1' }}>
            {version.snapshot.rulesCount > 0 || version.snapshot.adjustmentsCount > 0
              ? `${version.snapshot.rulesCount} rule${version.snapshot.rulesCount !== 1 ? 's' : ''} · ${version.snapshot.adjustmentsCount} adjustment${version.snapshot.adjustmentsCount !== 1 ? 's' : ''}`
              : 'No rules or adjustments'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.3px' }}>Total</span>
            <MoneyConvertTooltip valuePKR={version.snapshot.grandTotal} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1F2937' }}>{fmt(version.snapshot.grandTotal)}</span>
            </MoneyConvertTooltip>
          </div>
        </div>
      </div>

      {/* Changes */}
      {version.changes.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '8px', lineHeight: '1' }}>
            Changes ({version.changes.length})
          </div>
          {version.changes.map((change, cidx) => {
            const ct = ctCfg[change.type] || ctCfg['config-changed'];
            const CIcon = ct.icon;
            const userInitials = getUserInitials(change.user);
            const userColor = getUserColor(change.user);
            return (
              <div key={change.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 0', borderTop: cidx > 0 ? '1px solid #F7F8F9' : 'none' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: ct.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CIcon style={{ width: '12px', height: '12px', color: ct.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1.3', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: change.action === 'Added' ? '#059669' : change.action === 'Removed' ? '#DC2626' : '#D97706', marginRight: '5px' }}>{change.action}:</span>
                    <span style={{ fontWeight: 600, color: '#1F2937', marginRight: '4px' }}>{change.subject}</span>
                    {change.itemRef && <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>on {change.itemRef}</span>}
                  </div>
                  {change.subjectDetail && <div style={{ fontSize: '12px', color: '#6B7280', lineHeight: '1.3', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{change.subjectDetail}</div>}
                  {change.detail && <div style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1.3', marginTop: '2px' }}>{change.detail}</div>}
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
function CompareView({ v1, v2, formatCurrency: fmt, changeTypeConfig: ctCfg, versionStatusConfig: vsCfg, customerCurrency, lockedRate, lockedAt }: {
  v1: SOVersionEntry; v2: SOVersionEntry;
  formatCurrency: (n: number) => string;
  changeTypeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }>;
  versionStatusConfig: Record<SOVersionStatus, { label: string; bg: string; color: string; icon: React.ElementType }>;
  customerCurrency?: string;
  lockedRate?: number;
  lockedAt?: string;
}) {
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

  const summaryFields: Array<{ label: string; val1: string; val2: string; money1?: number; money2?: number }> = [
    { label: 'Line Items', val1: String(v1.snapshot.lineItemCount), val2: String(v2.snapshot.lineItemCount) },
    { label: 'Grand Total', val1: fmt(v1.snapshot.grandTotal), val2: fmt(v2.snapshot.grandTotal), money1: v1.snapshot.grandTotal, money2: v2.snapshot.grandTotal },
    { label: 'Rules', val1: String(v1.snapshot.rulesCount), val2: String(v2.snapshot.rulesCount) },
    { label: 'Adjustments', val1: String(v1.snapshot.adjustmentsCount), val2: String(v2.snapshot.adjustmentsCount) },
    { label: 'Status', val1: vsCfg[v1.versionStatus].label, val2: vsCfg[v2.versionStatus].label },
    { label: 'Warehouse', val1: v1.snapshot.warehouse, val2: v2.snapshot.warehouse },
  ];

  const addedCount = allIds.filter(id => getDiffStatus(id) === 'added').length;
  const removedCount = allIds.filter(id => getDiffStatus(id) === 'removed').length;
  const modifiedCount = allIds.filter(id => getDiffStatus(id) === 'modified').length;

  const colHeaderStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1' };

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
        <MoneyConvertTooltip valuePKR={li.unitPrice} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt}>
          <span style={{ fontSize: '10px', color: isChanged ? '#92400E' : '#9CA3AF', fontWeight: isChanged ? 500 : 400, width: '56px', textAlign: 'right' as const, display: 'inline-block' }}>{fmt(li.unitPrice)}</span>
        </MoneyConvertTooltip>
        <MoneyConvertTooltip valuePKR={li.total} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: isChanged ? '#92400E' : '#1F2937', width: '56px', textAlign: 'right' as const, display: 'inline-block' }}>{fmt(li.total)}</span>
        </MoneyConvertTooltip>
      </div>
    );
  };

  const renderVersionTable = (ver: SOVersionEntry, side: 'left' | 'right') => {
    const sCfg = vsCfg[ver.versionStatus];
    const SIcon = sCfg.icon;
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 500, padding: '2px 5px', borderRadius: '3px', backgroundColor: sCfg.bg, color: sCfg.color }}>
            <SIcon style={{ width: '8px', height: '8px' }} />{sCfg.label}
          </span>
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
          <MoneyConvertTooltip valuePKR={otherSubtotal} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: subtotalChanged && side === 'right' ? '#92400E' : '#374151', minWidth: '56px', textAlign: 'right' as const, display: 'inline-block' }}>{fmt(otherSubtotal)}</span>
          </MoneyConvertTooltip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', backgroundColor: totalChanged && side === 'right' ? '#FFFBEB' : '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: '9px', color: '#6B7280' }}>{ver.snapshot.rulesCount} rules · {ver.snapshot.adjustmentsCount} adj.</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '9px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.3px' }}>Total</span>
            <MoneyConvertTooltip valuePKR={ver.snapshot.grandTotal} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: totalChanged && side === 'right' ? '#92400E' : '#1F2937' }}>{fmt(ver.snapshot.grandTotal)}</span>
            </MoneyConvertTooltip>
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

      {/* Summary field comparison */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr) minmax(0, 1fr)', padding: '6px 12px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
          <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>Field</span>
          <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>v{v1.version} · {v1.clearedAt?.split(' · ')[0] || v1.createdAt || '—'}</span>
          <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>v{v2.version} · {v2.clearedAt?.split(' · ')[0] || v2.createdAt || '—'}</span>
        </div>
        {summaryFields.map((f, idx) => {
          const changed = f.val1 !== f.val2;
          const isEven = idx % 2 === 0;
          return (
            <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr) minmax(0, 1fr)', padding: '7px 12px', borderBottom: '1px solid #E5E7EB', backgroundColor: isEven ? '#FFFFFF' : '#F9FAFB', borderLeft: changed ? '3px solid #F59E0B' : '3px solid transparent' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280' }}>{f.label}</span>
              {typeof f.money1 === 'number' ? (
                <MoneyConvertTooltip valuePKR={f.money1} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: changed ? '#92400E' : '#1F2937' }}>{f.val1}</span>
                </MoneyConvertTooltip>
              ) : (
                <span style={{ fontSize: '12px', fontWeight: 500, color: changed ? '#92400E' : '#1F2937' }}>{f.val1}</span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {typeof f.money2 === 'number' ? (
                  <MoneyConvertTooltip valuePKR={f.money2} customerCurrency={customerCurrency} lockedRate={lockedRate} lockedAt={lockedAt}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: changed ? '#065F46' : '#1F2937' }}>{f.val2}</span>
                  </MoneyConvertTooltip>
                ) : (
                  <span style={{ fontSize: '12px', fontWeight: 500, color: changed ? '#065F46' : '#1F2937' }}>{f.val2}</span>
                )}
                {changed && <span style={{ fontSize: '9px', fontWeight: 600, color: '#D97706' }}>●</span>}
              </div>
            </div>
          );
        })}
      </div>

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

      {/* Two-column changes comparison */}
      {(v1.changes.length > 0 || v2.changes.length > 0) && (() => {
        const maxRows = Math.max(v1.changes.length, v2.changes.length);
        const evenRowBg = '#FFFFFF';
        const oddRowBg = '#F9FAFB';
        const placeholderBg = '#F3F4F6';
        const renderChangeCell = (change: SOVersionChange | undefined) => {
          if (!change) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', height: '100%' }}>
                <span style={{ fontSize: '11px', color: '#D1D5DB', fontStyle: 'italic' }}>—</span>
              </div>
            );
          }
          const ct = ctCfg[change.type] || ctCfg['config-changed'];
          const CIcon = ct.icon;
          return (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', height: '100%', overflow: 'hidden' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '5px', backgroundColor: ct.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CIcon style={{ width: '10px', height: '10px', color: ct.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#1F2937', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  <span style={{ fontWeight: 600, color: change.action === 'Added' ? '#059669' : change.action === 'Removed' ? '#DC2626' : '#D97706', marginRight: '4px' }}>{change.action}:</span>
                  <span style={{ fontWeight: 600, color: '#1F2937', marginRight: '3px' }}>{change.subject}</span>
                  {change.itemRef && <span style={{ fontWeight: 500, color: '#6B7280' }}>on {change.itemRef}</span>}
                </div>
                {change.subjectDetail && <div style={{ fontSize: '10px', color: '#6B7280', lineHeight: '1.3', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{change.subjectDetail}</div>}
                {change.detail && <div style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1.3', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{change.detail}</div>}
              </div>
              <span style={{ fontSize: '10px', color: '#9CA3AF', flexShrink: 0, marginTop: '3px', whiteSpace: 'nowrap' as const }}>{change.timestamp}</span>
            </div>
          );
        };

        return (
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
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
              const leftChange = v1.changes[i];
              const rightChange = v2.changes[i];
              const isEven = i % 2 === 0;
              const rowBaseBg = isEven ? evenRowBg : oddRowBg;
              return (
                <div key={leftChange?.id ?? rightChange?.id ?? `row-${i}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', borderTop: i > 0 ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={{ borderRight: '1px solid #E5E7EB', backgroundColor: leftChange ? rowBaseBg : placeholderBg, overflow: 'hidden' }}>{renderChangeCell(leftChange)}</div>
                  <div style={{ backgroundColor: rightChange ? rowBaseBg : placeholderBg, overflow: 'hidden' }}>{renderChangeCell(rightChange)}</div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ── Revert Confirm Modal ──────────────────────────────────────────
function RevertConfirmModal({ version, nextVersion, hasShippedItems, soNumber, onClose, onConfirm }: {
  version: number; nextVersion: number; hasShippedItems: boolean; soNumber: string; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const store = useSOStore();
  const so = store.salesOrders.find(s => s.soNumber === soNumber);
  const customerCurrency = so?.currency?.toUpperCase();
  const showFx = !!customerCurrency && customerCurrency !== BASE_CURRENCY;
  /* Reverts always re-lock at today's Mid-market rate, mirroring the Quotes
   * module's behavior, so the indicator below always reads "Mid-market" and
   * uses the Mid-market rate-type color regardless of the active page rate. */
  const todayRate = showFx ? convertBetween(1, customerCurrency, BASE_CURRENCY) : 0;
  // For the demo we mock the version's locked rate as a small offset from
  // today's rate when no per-version snapshot exists. Order-level lockedRate
  // wins when present.
  const versionLockedRate = showFx
    ? (so?.lockedRate ?? +(todayRate * 0.988).toFixed(4))
    : 0;
  const drift = showFx && versionLockedRate
    ? +(((todayRate - versionLockedRate) / versionLockedRate) * 100).toFixed(1)
    : 0;
  const baseCur = getLibraryCurrency(BASE_CURRENCY)!;
  const baseSym = baseCur.symbol ?? BASE_CURRENCY;
  const REVERT_RATE_HEX = '#7c3aed';
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose} />
      <div style={{ position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '440px', boxShadow: '0 16px 48px rgba(0,0,0,0.12)', fontFamily: 'Inter, system-ui, sans-serif' }}>
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
            <span style={{ fontSize: '11px', color: '#92400E', lineHeight: '1.3' }}>
              This will create a new draft (V{nextVersion}) based on V{version}.
            </span>
          </div>
          {hasShippedItems && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '8px 10px', backgroundColor: 'rgba(39,185,115,0.08)', borderRadius: '6px', border: '1px solid rgba(39,185,115,0.2)' }}>
              <Truck style={{ width: '13px', height: '13px', color: '#059669', flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: '#065F46', lineHeight: '1.3' }}>
                Already-shipped items will be included as non-editable (locked) in the new draft.
              </span>
            </div>
          )}

          {/* FX disclosure — reverts always re-lock at today's Mid-market
              rate (same behavior as the Quotes module's RevertConfirmModal). */}
          {showFx && (
            <div
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', marginBottom: 14,
                borderRadius: 8,
                border: `1px solid color-mix(in srgb, ${REVERT_RATE_HEX} 22%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${REVERT_RATE_HEX} 6%, transparent)`,
              }}
            >
              <div
                style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: `color-mix(in srgb, ${REVERT_RATE_HEX} 14%, transparent)`,
                  marginTop: 1,
                }}
              >
                <Send style={{ width: 11, height: 11, color: REVERT_RATE_HEX }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1F2937', lineHeight: 1.3, marginBottom: 3 }}>
                  Today's Mid-market rate will be applied to this revert
                </div>
                <div style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.5 }} className="tabular-nums">
                  {todayRate
                    ? <>1 {customerCurrency} = {baseSym} {todayRate.toFixed(2)} {BASE_CURRENCY}</>
                    : 'The latest live mid-market rate will be locked when you confirm.'}
                  {drift !== 0 && versionLockedRate > 0 && (
                    <span style={{ marginLeft: 6, color: drift > 0 ? '#92400E' : '#065F46' }}>
                      ({drift > 0 ? '+' : ''}{drift}% vs V{version} locked rate of {baseSym} {versionLockedRate.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
            Reason for revert <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)}
            placeholder="e.g., Customer wants to go back to the original configuration..."
            rows={3}
            style={{ width: '100%', fontSize: '13px', fontWeight: 400, color: '#1F2937', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '8px 12px', outline: 'none', resize: 'none', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.5', boxSizing: 'border-box' as const, transition: 'border-color 150ms' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#93C5FD'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid #E5E7EB' }}>
          <button onClick={onClose} style={{ height: '32px', padding: '0 14px', fontSize: '13px', fontWeight: 500, color: '#6B7280', backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif' }}>Cancel</button>
          <button
            onClick={() => onConfirm(reason.trim())}
            style={{ height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500, color: '#FFFFFF', backgroundColor: '#D97706', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'Inter, system-ui, sans-serif', transition: 'background-color 150ms' }}
          >
            <RotateCcw style={{ width: '14px', height: '14px' }} />Revert to V{version}
          </button>
        </div>
      </div>
    </div>
  );
}
