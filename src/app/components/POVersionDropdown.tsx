import { useState, useRef, useEffect } from 'react';
import { ChevronDown, FileText, RotateCcw, Eye, Send, CheckCircle2, Clock } from 'lucide-react';
import type { POVersionEntry, POStatus, POVersionStatus } from './poStore';

/* ── Status config ── */
const statusConfig: Record<POVersionStatus, { label: string; bg: string; color: string; icon: typeof Send }> = {
  draft: { label: 'Draft', bg: '#F3F4F6', color: '#374151', icon: FileText },
  sent: { label: 'Sent', bg: '#DBEAFE', color: '#1E40AF', icon: Send },
  confirmed: { label: 'Confirmed', bg: '#CCFBF1', color: '#0F766E', icon: CheckCircle2 },
  'partially-received': { label: 'Partial', bg: '#FEF3C7', color: '#92400E', icon: Clock },
};

/* ── Map PO lifecycle status → version status ── */
function mapPOStatus(s: POStatus): POVersionStatus {
  switch (s) {
    case 'Draft': return 'draft';
    case 'Sent': return 'sent';
    case 'Confirmed': return 'confirmed';
    case 'Partially Received':
    case 'Active with Cancellations':
      return 'partially-received';
    default: return 'confirmed';
  }
}

interface LocalVersion {
  version: number;
  versionStatus: POVersionStatus;
  date: string;
  sentAt?: string;
  confirmedAt?: string;
  author: string;
  summary: string;
  isRevert?: boolean;
  revertedFrom?: number;
}

interface POVersionDropdownProps {
  currentVersion: number;
  currentStatus: POStatus;
  viewingVersion: number | null;
  onViewVersion: (version: number | null) => void;
  onEditAsDraft?: (fromVersion: number) => void;
  materialChangesCount?: number;
  versions: POVersionEntry[];
}

function toLocalVersion(v: POVersionEntry): LocalVersion {
  const d = new Date(v.createdAt);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return {
    version: v.version,
    versionStatus: v.versionStatus,
    date: `${mm}/${dd}/${d.getFullYear()}`,
    author: v.createdBy,
    summary: v.reason || `Version ${v.version}`,
    isRevert: v.isRevert,
    revertedFrom: v.revertedFrom,
  };
}

export default function POVersionDropdown({
  currentVersion,
  currentStatus,
  viewingVersion,
  onViewVersion,
  onEditAsDraft,
  materialChangesCount,
  versions: poVersions,
}: POVersionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derive local versions from PO store versions
  const versions: LocalVersion[] = [...poVersions]
    .sort((a, b) => b.version - a.version)
    .map(toLocalVersion);

  // Sync latest version status with current PO status
  if (versions.length > 0) {
    const mapped = mapPOStatus(currentStatus);
    versions[0] = { ...versions[0], versionStatus: mapped };
  }

  const lastApproved = null;
  const lastApprovedVersionNum = -1;
  const latestVersion = versions[0];

  const isViewingOld = viewingVersion != null && latestVersion && viewingVersion !== latestVersion.version;
  const displayVersion = isViewingOld
    ? versions.find(v => v.version === viewingVersion) || latestVersion
    : latestVersion;

  // Click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!displayVersion || !latestVersion) return null;

  const dsCfg = statusConfig[displayVersion.versionStatus];
  const DSIcon = dsCfg.icon;

  const isLatest = displayVersion.version === latestVersion.version;
  const triggerPillLabel = isViewingOld ? 'Viewing' : isLatest ? 'Latest' : dsCfg.label;
  const triggerPillColor = isViewingOld ? '#92400E' : isLatest && displayVersion.versionStatus === 'draft' ? '#374151' : dsCfg.color;
  const triggerPillBg = isViewingOld ? '#FEF3C7' : isLatest && displayVersion.versionStatus === 'draft' ? '#F3F4F6' : dsCfg.bg;

  return (
    <div className="relative" ref={dropdownRef} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── Trigger ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 transition-all"
        style={{
          padding: '4px 10px 4px 8px',
          borderRadius: '6px',
          border: '1px solid',
          borderColor: isViewingOld ? '#FDE68A' : isOpen ? '#D1D5DB' : '#E5E7EB',
          backgroundColor: isViewingOld ? '#FFFBEB' : isOpen ? '#F9FAFB' : '#FFFFFF',
          cursor: 'pointer',
          height: '28px',
        }}
        onMouseEnter={(e) => {
          if (!isOpen && !isViewingOld) {
            e.currentTarget.style.borderColor = '#D1D5DB';
            e.currentTarget.style.backgroundColor = '#F9FAFB';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen && !isViewingOld) {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.backgroundColor = '#FFFFFF';
          }
        }}
      >
        {isViewingOld ? (
          <Eye style={{ width: 12, height: 12, color: '#D97706', flexShrink: 0 }} />
        ) : (
          <DSIcon style={{ width: 12, height: 12, color: dsCfg.color, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 12, fontWeight: 600, color: isViewingOld ? '#92400E' : '#1F2937', lineHeight: '1' }}>
          V{displayVersion.version}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 600, color: triggerPillColor, backgroundColor: triggerPillBg,
          padding: '2px 5px', borderRadius: 3, lineHeight: '1',
        }}>
          {triggerPillLabel}
        </span>
        <span style={{ fontSize: 11, color: isViewingOld ? '#B45309' : '#9CA3AF', lineHeight: '1' }}>
          {displayVersion.date}
        </span>
        {!isViewingOld && materialChangesCount != null && materialChangesCount > 0 && displayVersion.versionStatus === 'draft' && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#FFFFFF', backgroundColor: '#1B6EF3',
            width: 16, height: 16, borderRadius: '50%', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', lineHeight: '1', flexShrink: 0,
          }}>
            {materialChangesCount}
          </span>
        )}
        <ChevronDown
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ width: 12, height: 12, color: isViewingOld ? '#D97706' : '#9CA3AF', marginLeft: 2 }}
        />
      </button>

      {/* ── Dropdown panel ── */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 bg-white z-50"
          style={{
            width: 400,
            borderRadius: 10,
            border: '1px solid #E5E7EB',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: '1', marginBottom: 4 }}>
                Version History
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: '1' }}>
                {versions.length} versions
              </div>
            </div>
            {isViewingOld && (
              <button
                onClick={() => { onViewVersion(null); setIsOpen(false); }}
                style={{
                  fontSize: 11, fontWeight: 600, color: '#FFFFFF', backgroundColor: '#1B6EF3',
                  padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', lineHeight: '1',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B6EF3'; }}
              >
                Back to Latest
              </button>
            )}
          </div>

          {/* Version list */}
          <div style={{ maxHeight: 360, overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {versions.map((version, index) => {
              const isLatestVer = index === 0;
              const isBeingViewed = isViewingOld && version.version === viewingVersion;
              const isLastApprovedVer = false;
              const vsCfg = statusConfig[version.versionStatus];
              const VSIcon = vsCfg.icon;
              const canEditAsDraft = !isLatestVer && onEditAsDraft;

              return (
                <div
                  key={version.version}
                  className="group"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    cursor: 'pointer',
                    backgroundColor: isBeingViewed ? '#FFFBEB' : 'transparent',
                    borderBottom: index < versions.length - 1 ? '1px solid #F7F8F9' : 'none',
                    transition: 'background-color 100ms',
                    borderLeft: isBeingViewed ? '3px solid #D97706' : '3px solid transparent',
                  }}
                  onClick={() => {
                    if (isLatestVer) onViewVersion(null);
                    else onViewVersion(version.version);
                    setIsOpen(false);
                  }}
                  onMouseEnter={(e) => { if (!isBeingViewed) e.currentTarget.style.backgroundColor = '#FAFBFC'; }}
                  onMouseLeave={(e) => { if (!isBeingViewed) e.currentTarget.style.backgroundColor = isBeingViewed ? '#FFFBEB' : 'transparent'; }}
                >
                  {/* Version icon */}
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    backgroundColor: isBeingViewed ? '#FEF3C7' : isLastApprovedVer ? '#CCFBF1' : version.versionStatus === 'sent' ? '#DBEAFE' : version.isRevert ? '#FFFBEB' : '#F9FAFB',
                    border: `1px solid ${isBeingViewed ? '#FDE68A' : isLastApprovedVer ? '#5EEAD4' : version.versionStatus === 'sent' ? '#93C5FD' : version.isRevert ? '#FDE68A' : '#F3F4F6'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {isBeingViewed ? (
                      <Eye style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : version.isRevert ? (
                      <RotateCcw style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : isLastApprovedVer ? (
                      <CheckCircle2 style={{ width: 12, height: 12, color: '#0D9488' }} />
                    ) : version.versionStatus === 'sent' ? (
                      <Send style={{ width: 11, height: 11, color: '#2563EB' }} />
                    ) : (
                      <FileText style={{ width: 12, height: 12, color: '#9CA3AF' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
                        V{version.version}
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: 10, fontWeight: 600, color: vsCfg.color, backgroundColor: vsCfg.bg,
                        padding: '2px 5px', borderRadius: 3, lineHeight: '1',
                      }}>
                        <VSIcon style={{ width: 9, height: 9 }} />
                        {vsCfg.label}
                      </span>
                      {isLatestVer && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#374151', backgroundColor: '#F3F4F6',
                          padding: '2px 5px', borderRadius: 3, lineHeight: '1', border: '1px solid #E5E7EB',
                        }}>Latest</span>
                      )}
                      {isBeingViewed && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#92400E', backgroundColor: '#FEF3C7',
                          padding: '2px 5px', borderRadius: 3, lineHeight: '1', border: '1px solid #FDE68A',
                        }}>Viewing</span>
                      )}
                      {version.isRevert && (
                        <span style={{
                          fontSize: 10, fontWeight: 500, color: '#D97706', backgroundColor: '#FFFBEB',
                          padding: '2px 5px', borderRadius: 3, lineHeight: '1', border: '1px solid #FDE68A',
                        }}>Revert</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#6B7280', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {version.summary}
                    </div>
                  </div>

                  {/* Date + revert */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: '1' }}>{version.date}</span>
                    {canEditAsDraft && (
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditAsDraft?.(version.version);
                          setIsOpen(false);
                        }}
                        title={`Edit as draft from V${version.version}`}
                        style={{
                          width: 22, height: 22, borderRadius: 4, border: '1px solid #E5E7EB',
                          backgroundColor: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEF3C7'; e.currentTarget.style.borderColor = '#FDE68A'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                      >
                        <RotateCcw style={{ width: 10, height: 10, color: '#D97706' }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
