import React, { useState } from 'react';
import { X, Clock, User, FileText, GitCompare, DollarSign, Package, Plus, Trash2, Edit, ArrowRight, Tag, Send, CheckCircle2, Scale, RotateCcw, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';

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
}

// ── Change type icon/color config ──────────────────────────────────
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
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const versionStatusConfig: Record<VersionStatus, { label: string; bg: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', bg: '#F3F4F6', color: '#374151', icon: FileText },
  sent: { label: 'Sent', bg: '#DBEAFE', color: '#1E40AF', icon: Send },
  confirmed: { label: 'Confirmed', bg: '#CCFBF1', color: '#0F766E', icon: CheckCircle2 },
};

export function VersionHistoryModal({ quoteId, currentVersion, onClose }: VersionHistoryModalProps) {
  // The "current version" is always the latest confirmed version
  const [versions, setVersions] = useState<Version[]>([
    {
      version: 3,
      versionStatus: 'sent',
      sentAt: '02/05/2026 · 10:30 AM',
      sentBy: 'Sarah Chen',
      avatar: 'SC',
      avatarColor: '#3B82F6',
      notes: 'Added emergency lighting package and auto-eject system per customer request. Applied Tri-County EMS volume adjustment.',
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
      version: 2,
      versionStatus: 'confirmed',
      sentAt: '01/28/2026 · 3:15 PM',
      confirmedAt: '02/01/2026 · 11:00 AM',
      sentBy: 'Sarah Chen',
      avatar: 'SC',
      avatarColor: '#3B82F6',
      notes: 'Added medical equipment per Tri-County EMS build spec. Fleet volume pricing applied for 2+ chassis.',
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
      version: 1,
      versionStatus: 'confirmed',
      sentAt: '01/20/2026 · 10:30 AM',
      confirmedAt: '01/22/2026 · 2:15 PM',
      sentBy: 'Sarah Chen',
      avatar: 'SC',
      avatarColor: '#3B82F6',
      notes: 'Initial quote created from opportunity OPP-2026-0089 for Tri-County EMS fleet build-out.',
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
  ]);

  // Current version = latest confirmed
  const latestConfirmed = versions.find(v => v.versionStatus === 'confirmed');
  const currentVersionNum = latestConfirmed?.version ?? 1;

  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersionNum);
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[number | null, number | null]>([null, null]);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [versionToRevert, setVersionToRevert] = useState<number | null>(null);

  const handleRevert = (toVersion: number, reason: string) => {
    const newV = versions[0].version + 1;
    const source = versions.find(v => v.version === toVersion)!;
    const newVersion: Version = {
      version: newV,
      versionStatus: 'draft',
      sentBy: 'Sarah Chen',
      avatar: 'SC',
      avatarColor: '#3B82F6',
      notes: reason || `Reverted to Version ${toVersion}`,
      isRevert: true,
      revertedFrom: toVersion,
      snapshot: { ...source.snapshot },
      changes: [
        { id: `C${Date.now()}`, type: 'config-changed', action: 'Changed' as const, subject: 'Reverted to Draft', detail: `Created from V${toVersion}`, subjectDetail: reason || undefined, timestamp: 'Just now', user: 'Sarah Chen' },
      ],
    };
    setVersions(prev => [newVersion, ...prev]);
    setShowRevertConfirm(false);
    setVersionToRevert(null);
    setSelectedVersion(newV);
    toast.success(`Reverted to Version ${toVersion} as new Draft (v${newV})`, { description: 'Send it to create the next version.', position: 'top-right' });
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

  const getUserColor = (name: string) => {
    if (name === 'Sarah Chen') return '#3B82F6';
    if (name === 'Michael Rodriguez') return '#8B5CF6';
    if (name === 'David Kim') return '#F59E0B';
    return '#6B7280';
  };

  const getUserInitials = (name: string) => name.split(' ').map(n => n[0]).join('');

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        zIndex: 10001,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(1px)'
      }}
    >
      <div
        className="bg-white shadow-2xl flex flex-col"
        style={{
          width: compareMode && compareVersions[0] !== null && compareVersions[1] !== null ? '1340px' : '1060px',
          height: '85vh',
          borderRadius: '12px',
          transition: 'width 250ms ease',
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
                Version History — {quoteId}
              </h2>
              <p style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: '1', margin: 0, marginTop: '4px' }}>
                Versions are created when sent to customer · Current = latest confirmed
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
                fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1',
                transition: 'all 150ms',
              }}
              onMouseEnter={e => { if (!compareMode) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
              onMouseLeave={e => { if (!compareMode) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <GitCompare style={{ width: '14px', height: '14px' }} />
              {compareMode ? 'Exit Compare' : 'Compare Versions'}
            </button>
            <button
              onClick={onClose}
              style={{
                width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '6px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer',
                transition: 'background-color 100ms',
              }}
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
                const statusCfg = versionStatusConfig[version.versionStatus];
                const StatusIcon = statusCfg.icon;

                // In compare mode, determine if this is "A" or "B"
                const compareLabel = compareMode && isSelected
                  ? compareVersions[0] === version.version ? 'A' : 'B'
                  : null;

                return (
                  <div key={version.version} style={{ position: 'relative' }}>
                    {/* Timeline line — hidden in compare mode for cleaner checkbox layout */}
                    {index < versions.length - 1 && !compareMode && (
                      <div style={{
                        position: 'absolute', left: '19px', top: '40px', bottom: '0',
                        width: '2px', backgroundColor: '#E5E7EB',
                      }} />
                    )}

                    <div style={{ display: 'flex', alignItems: 'stretch', gap: '0px', marginBottom: '8px' }}>
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
                          {/* Version Badge */}
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

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1' }}>
                                Version {version.version}
                              </span>
                              {isCurrent && (
                                <span style={{
                                  fontSize: '10px', fontWeight: 500, padding: '2px 5px', borderRadius: '4px',
                                  backgroundColor: '#D1FAE5', color: '#065F46', lineHeight: '1',
                                }}>Current</span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9CA3AF', lineHeight: '1', marginBottom: '5px' }}>
                              <User style={{ width: '11px', height: '11px' }} />
                              <span>{version.sentBy}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#9CA3AF', lineHeight: '1', marginBottom: '8px' }}>
                              <Clock style={{ width: '11px', height: '11px' }} />
                              <span>{version.sentAt ? version.sentAt.split(' · ')[0] : '—'}</span>
                            </div>

                            {/* Version status badge */}
                            <div style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontSize: '10px', fontWeight: 500, padding: '3px 6px',
                              borderRadius: '4px', lineHeight: '1',
                              backgroundColor: statusCfg.bg, color: statusCfg.color,
                            }}>
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

                  const summaryFields = [
                    { label: 'Line Items', val1: String(v1.snapshot.lineItemCount), val2: String(v2.snapshot.lineItemCount) },
                    { label: 'Grand Total', val1: formatCurrency(v1.snapshot.grandTotal), val2: formatCurrency(v2.snapshot.grandTotal) },
                    { label: 'Rules', val1: String(v1.snapshot.rulesCount), val2: String(v2.snapshot.rulesCount) },
                    { label: 'Adjustments', val1: String(v1.snapshot.adjustmentsCount), val2: String(v2.snapshot.adjustmentsCount) },
                    { label: 'Valid Until', val1: v1.snapshot.validUntil, val2: v2.snapshot.validUntil },
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
                    const sCfg = versionStatusConfig[ver.versionStatus];
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
                            <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>V{ver.version} Line Items</span>
                            <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 500, lineHeight: '1' }}>({ver.snapshot.lineItems.length})</span>
                          </div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 500, padding: '2px 5px', borderRadius: '3px', backgroundColor: sCfg.bg, color: sCfg.color, lineHeight: '1' }}>
                            <SIcon style={{ width: '8px', height: '8px' }} />{sCfg.label}
                          </span>
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

                      {/* Summary field comparison */}
                      <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr) minmax(0, 1fr)', padding: '6px 12px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                          <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>Field</span>
                          <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>v{v1.version} · {v1.sentAt?.split(' · ')[0]}</span>
                          <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', lineHeight: '1' }}>v{v2.version} · {v2.sentAt?.split(' · ')[0]}</span>
                        </div>
                        {summaryFields.map((f, idx) => {
                          const changed = f.val1 !== f.val2;
                          const isEven = idx % 2 === 0;
                          return (
                            <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0, 1fr) minmax(0, 1fr)', padding: '7px 12px', borderBottom: '1px solid #E5E7EB', backgroundColor: isEven ? '#FFFFFF' : '#F9FAFB', borderLeft: changed ? '3px solid #F59E0B' : '3px solid transparent' }}>
                              <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B7280', lineHeight: '1' }}>{f.label}</span>
                              <span style={{ fontSize: '12px', fontWeight: 500, color: changed ? '#92400E' : '#1F2937', lineHeight: '1' }}>{f.val1}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 500, color: changed ? '#065F46' : '#1F2937', lineHeight: '1' }}>{f.val2}</span>
                                {changed && <span style={{ fontSize: '9px', fontWeight: 600, color: '#D97706', lineHeight: '1' }}>●</span>}
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

                      {/* Two-column changes comparison */}
                      {(v1.changes.length > 0 || v2.changes.length > 0) && (() => {
                        const maxRows = Math.max(v1.changes.length, v2.changes.length);
                        const evenRowBg = '#FFFFFF';
                        const oddRowBg = '#F9FAFB';
                        const placeholderBg = '#F3F4F6';
                        const renderChangeCell = (change: DetailedChange | undefined) => {
                          if (!change) {
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 10px', height: '100%' }}>
                                <span style={{ fontSize: '11px', color: '#D1D5DB', fontStyle: 'italic' }}>—</span>
                              </div>
                            );
                          }
                          const ct = changeTypeConfig[change.type] || changeTypeConfig['config-changed'];
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
                              <span style={{ fontSize: '10px', color: '#9CA3AF', flexShrink: 0, lineHeight: '1', marginTop: '3px', whiteSpace: 'nowrap' as const }}>{change.timestamp}</span>
                            </div>
                          );
                        };

                        return (
                          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', tableLayout: 'fixed' as any }}>
                            {/* Column headers */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
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
                                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                                    borderTop: i > 0 ? '1px solid #F3F4F6' : 'none',
                                  }}
                                >
                                  <div style={{
                                    borderRight: '1px solid #E5E7EB',
                                    backgroundColor: leftChange ? rowBaseBg : placeholderBg,
                                    overflow: 'hidden',
                                  }}>
                                    {renderChangeCell(leftChange)}
                                  </div>
                                  <div style={{
                                    backgroundColor: rightChange ? rowBaseBg : placeholderBg,
                                    overflow: 'hidden',
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
                      {(() => {
                        const sCfg = versionStatusConfig[selectedVersionData.versionStatus];
                        const SIcon = sCfg.icon;
                        return (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '10px', fontWeight: 500, padding: '3px 8px', borderRadius: '4px', lineHeight: '1',
                            backgroundColor: sCfg.bg, color: sCfg.color,
                          }}>
                            <SIcon style={{ width: '10px', height: '10px' }} />
                            {sCfg.label}
                          </span>
                        );
                      })()}
                      {selectedVersionData.version === currentVersionNum && (
                        <span style={{
                          fontSize: '10px', fontWeight: 500, padding: '3px 8px', borderRadius: '4px', lineHeight: '1',
                          backgroundColor: '#D1FAE5', color: '#065F46',
                        }}>Current</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedVersionData.version !== currentVersionNum && selectedVersionData.versionStatus !== 'sent' && (
                        <button
                          onClick={() => {
                            setVersionToRevert(selectedVersionData.version);
                            setShowRevertConfirm(true);
                          }}
                          style={{
                            height: '32px', padding: '0 12px', fontSize: '13px', fontWeight: 500,
                            color: '#1B6EF3', backgroundColor: '#FFFFFF', border: '1px solid #1B6EF3',
                            borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                            lineHeight: '1', transition: 'background-color 150ms',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F0F9FF'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                        >
                          Revert to this version
                        </button>
                      )}
                      <button
                        onClick={() => {}}
                        style={{
                          height: '32px', padding: '0 16px', fontSize: '13px', fontWeight: 500,
                          color: '#FFFFFF', backgroundColor: '#1B6EF3', border: 'none',
                          borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                          lineHeight: '1', transition: 'background-color 150ms',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#1B6EF3'; }}
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
                          <p style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4', margin: 0 }}>
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
                    {selectedVersionData.snapshot.lineItems.length > 0 ? (
                      <div style={{ backgroundColor: '#FFFFFF' }}>
                        {selectedVersionData.snapshot.lineItems.map((li, liIdx) => (
                          <div key={li.id} style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                            borderTop: liIdx > 0 ? '1px solid #F7F8F9' : 'none',
                          }}>
                            <div style={{
                              width: '22px', height: '22px', borderRadius: '3px', flexShrink: 0,
                              backgroundColor: li.thumbColor || '#F3F4F6',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Package style={{ width: '10px', height: '10px', color: '#6B7280', opacity: 0.5 }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', lineHeight: '1', marginBottom: '1px' }}>
                                {li.id}
                              </div>
                              <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                                {li.description}
                              </div>
                            </div>
                            <span style={{ fontSize: '10px', color: '#6B7280', lineHeight: '1', flexShrink: 0, width: '28px', textAlign: 'right' as const }}>
                              {li.qty}
                            </span>
                            <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1', flexShrink: 0, width: '28px', textAlign: 'center' as const }}>
                              {li.uom}
                            </span>
                            <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1', flexShrink: 0, width: '64px', textAlign: 'right' as const }}>
                              {formatCurrency(li.unitPrice)}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#1F2937', lineHeight: '1', flexShrink: 0, minWidth: '64px', textAlign: 'right' as const }}>
                              {formatCurrency(li.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '8px 10px', fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic' }}>No line items</div>
                    )}
                    {/* Subtotal row */}
                    {selectedVersionData.snapshot.lineItems.length > 0 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                        padding: '4px 10px', borderTop: '1px solid #E5E7EB', backgroundColor: '#FFFFFF',
                      }}>
                        <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.3px', lineHeight: '1', marginRight: '8px' }}>Subtotal</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151', lineHeight: '1', minWidth: '64px', textAlign: 'right' as const }}>
                          {formatCurrency(selectedVersionData.snapshot.lineItems.reduce((s, li) => s + li.total, 0))}
                        </span>
                      </div>
                    )}
                    {/* Footer: Rules/Adjustments left, Grand Total right */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '5px 10px', backgroundColor: '#F9FAFB', borderTop: '1px solid #E5E7EB',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {(selectedVersionData.snapshot.rulesCount > 0 || selectedVersionData.snapshot.adjustmentsCount > 0) && (
                          <span style={{ fontSize: '10px', color: '#6B7280', lineHeight: '1' }}>
                            {selectedVersionData.snapshot.rulesCount} rule{selectedVersionData.snapshot.rulesCount !== 1 ? 's' : ''} · {selectedVersionData.snapshot.adjustmentsCount} adjustment{selectedVersionData.snapshot.adjustmentsCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {selectedVersionData.snapshot.rulesCount === 0 && selectedVersionData.snapshot.adjustmentsCount === 0 && (
                          <span style={{ fontSize: '10px', color: '#9CA3AF', lineHeight: '1' }}>No rules or adjustments</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 500, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.3px', lineHeight: '1' }}>Total</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1F2937', lineHeight: '1' }}>{formatCurrency(selectedVersionData.snapshot.grandTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── CHANGES ────────────────────────────────────────── */}
                  {selectedVersionData.changes.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: '8px', lineHeight: '1' }}>
                        Changes ({selectedVersionData.changes.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' as const }}>
                        {selectedVersionData.changes.map((change, cidx) => {
                          const ct = changeTypeConfig[change.type] || changeTypeConfig['config-changed'];
                          const CIcon = ct.icon;
                          const userInitials = getUserInitials(change.user);
                          const userColor = getUserColor(change.user);

                          return (
                            <div
                              key={change.id}
                              style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                padding: '9px 0',
                                borderTop: cidx > 0 ? '1px solid #F7F8F9' : 'none',
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
                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#1F2937', lineHeight: '1.3', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap' as const }}>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: change.action === 'Added' ? '#059669' : change.action === 'Removed' ? '#DC2626' : '#D97706', marginRight: '5px', lineHeight: '1' }}>{change.action}:</span>
                                  <span style={{ fontWeight: 600, color: '#1F2937', marginRight: '4px' }}>{change.subject}</span>
                                  {change.itemRef && <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>on {change.itemRef}</span>}
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
      </div>

      {/* Revert Confirmation Modal */}
      {showRevertConfirm && versionToRevert !== null && (
        <RevertConfirmModal
          version={versionToRevert}
          nextVersion={versions[0].version + 1}
          onClose={() => { setShowRevertConfirm(false); setVersionToRevert(null); }}
          onConfirm={(reason: string) => handleRevert(versionToRevert, reason)}
        />
      )}
    </div>
  );
}

// ── Revert Confirm Modal ──────────────────────────────────────────
function RevertConfirmModal({ version, nextVersion, onClose, onConfirm }: {
  version: number; nextVersion: number; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10002, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

          <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: '0.5px', display: 'block', marginBottom: '6px', lineHeight: '1' }}>
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
              lineHeight: '1.5', boxSizing: 'border-box' as const, transition: 'border-color 150ms',
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