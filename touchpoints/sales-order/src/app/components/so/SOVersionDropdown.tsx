import { useState, useRef, useEffect } from 'react';
import { ChevronDown, FileText, RotateCcw, Check, Eye, Send, CheckCircle2, Clock, Pencil, Truck, Package } from 'lucide-react';

type VersionStatus = 'draft' | 'pending_review' | 'cleared' | 'partially_shipped' | 'shipped';

interface Version {
  version: number;
  versionStatus: VersionStatus;
  date: string;
  sentAt?: string;
  clearedAt?: string;
  author: string;
  summary: string;
  isRevert?: boolean;
  revertedFrom?: number;
}

interface SOVersionDropdownProps {
  currentVersion: number;
  currentStatus?: string;
  viewingVersion?: number | null;
  onVersionChange?: (version: number) => void;
  onViewVersion?: (version: number | null) => void;
  onEditAsDraft?: (fromVersion: number) => void;
  materialChangesCount?: number;
  isScrolled?: boolean;
}

const statusConfig: Record<VersionStatus, { label: string; bg: string; color: string; icon: typeof Send }> = {
  draft: { label: 'Draft', bg: '#F3F4F6', color: '#374151', icon: FileText },
  pending_review: { label: 'Pending Review', bg: '#FEF3C7', color: '#92400E', icon: Clock },
  cleared: { label: 'Cleared', bg: '#CCFBF1', color: '#0F766E', icon: CheckCircle2 },
  partially_shipped: { label: 'Partially Shipped', bg: '#EDE9FE', color: '#6D28D9', icon: Truck },
  shipped: { label: 'Shipped', bg: '#D1FAE5', color: '#047857', icon: Package },
};

function mapSOStatusToVersionStatus(status: string): VersionStatus {
  const m: Record<string, VersionStatus> = {
    'Draft': 'draft',
    'Pending Review': 'pending_review',
    'Cleared': 'cleared',
    'Partially Shipped': 'partially_shipped',
    'Shipped': 'shipped',
  };
  return m[status] ?? 'draft';
}

const INITIAL_VERSIONS: Version[] = [
  {
    version: 3,
    versionStatus: 'cleared',
    date: '03/25/2026',
    clearedAt: '03/25/2026',
    author: 'Sarah Chen',
    summary: 'Added rush delivery terms, updated payment schedule',
  },
  {
    version: 2,
    versionStatus: 'cleared',
    date: '03/18/2026',
    clearedAt: '03/20/2026',
    author: 'Sarah Chen',
    summary: 'Adjusted quantities and pricing after customer review',
  },
  {
    version: 1,
    versionStatus: 'cleared',
    date: '03/10/2026',
    clearedAt: '03/12/2026',
    author: 'Sarah Chen',
    summary: 'Initial sales order — core line items',
  },
];

export function SOVersionDropdown({
  currentVersion,
  currentStatus,
  viewingVersion,
  onVersionChange,
  onViewVersion,
  onEditAsDraft,
  materialChangesCount,
  isScrolled = false,
}: SOVersionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>(INITIAL_VERSIONS);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const lastApproved = versions.find(v => v.versionStatus === 'cleared' || v.versionStatus === 'shipped');
  const lastApprovedVersionNum = lastApproved?.version ?? 1;
  const latestVersion = versions[0];

  const isViewingOld = viewingVersion != null && viewingVersion !== latestVersion.version;
  const displayVersion = isViewingOld
    ? versions.find(v => v.version === viewingVersion) || latestVersion
    : latestVersion;

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // External API for adding reverted versions
  const addRevertedVersion = (fromVersion: number, reason: string) => {
    const newV = latestVersion.version + 1;
    const today = new Date();
    const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
    const newVersion: Version = {
      version: newV, versionStatus: 'draft', date: dateStr, author: 'Sarah Chen',
      summary: reason, isRevert: true, revertedFrom: fromVersion,
    };
    setVersions(prev => [newVersion, ...prev]);
  };

  const overwriteExistingDraft = (fromVersion: number) => {
    setVersions(prev => {
      const latest = prev[0];
      if (!latest || latest.versionStatus !== 'draft') return prev;
      const today = new Date();
      const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
      const updated: Version = {
        ...latest, date: dateStr, summary: `Updated with data from V${fromVersion}`,
        isRevert: true, revertedFrom: fromVersion,
      };
      return [updated, ...prev.slice(1)];
    });
  };

  useEffect(() => {
    (window as any).__soVersionDropdownAddRevert = addRevertedVersion;
    (window as any).__soVersionDropdownOverwriteDraft = overwriteExistingDraft;
    return () => {
      delete (window as any).__soVersionDropdownAddRevert;
      delete (window as any).__soVersionDropdownOverwriteDraft;
    };
  });

  // Sync with parent status/version
  useEffect(() => {
    if (!currentStatus) return;
    const mappedStatus = mapSOStatusToVersionStatus(currentStatus);
    setVersions(prev => {
      const latest = prev[0];
      if (!latest) return prev;
      if (currentVersion > latest.version) {
        const today = new Date();
        const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
        const newEntry: Version = {
          version: currentVersion, versionStatus: mappedStatus, date: dateStr,
          author: 'Sarah Chen', summary: mappedStatus === 'draft' ? 'Draft in progress' : latest.summary,
        };
        return [newEntry, ...prev];
      }
      if (currentVersion === latest.version && latest.versionStatus !== mappedStatus) {
        const updated = { ...latest, versionStatus: mappedStatus };
        if (mappedStatus === 'cleared') {
          const today = new Date();
          updated.clearedAt = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
        }
        return [updated, ...prev.slice(1)];
      }
      return prev;
    });
  }, [currentVersion, currentStatus]);

  const dsCfg = statusConfig[displayVersion.versionStatus];
  const DSIcon = dsCfg.icon;

  const isLatest = displayVersion.version === latestVersion.version;
  const isLastApprovedVer = displayVersion.version === lastApprovedVersionNum;
  const triggerPillLabel = isViewingOld ? 'Viewing' : isLatest ? 'Latest' : isLastApprovedVer ? 'Last Approved' : dsCfg.label;
  const triggerPillColor = isViewingOld ? '#92400E' : isLatest && displayVersion.versionStatus === 'draft' ? '#374151' : dsCfg.color;
  const triggerPillBg = isViewingOld ? '#FEF3C7' : isLatest && displayVersion.versionStatus === 'draft' ? '#F3F4F6' : dsCfg.bg;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button — matches Quotes exactly */}
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
          height: isScrolled ? '26px' : '28px',
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
        <span style={{ fontSize: 12, fontWeight: 600, color: isViewingOld ? '#92400E' : '#1F2937', lineHeight: 1 }}>
          V{displayVersion.version}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 600, color: triggerPillColor, backgroundColor: triggerPillBg,
          padding: '2px 5px', borderRadius: 3, lineHeight: 1,
        }}>
          {triggerPillLabel}
        </span>
        {!isScrolled && (
          <span style={{ fontSize: 11, color: isViewingOld ? '#B45309' : '#9CA3AF', lineHeight: 1 }}>
            {displayVersion.date}
          </span>
        )}
        {/* Material changes count chip */}
        {!isViewingOld && materialChangesCount != null && materialChangesCount > 0 && displayVersion.versionStatus === 'draft' && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#FFFFFF', backgroundColor: '#1B6EF3',
            width: 16, height: 16, borderRadius: '50%', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0,
          }}>
            {materialChangesCount}
          </span>
        )}
        <ChevronDown
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ width: 12, height: 12, color: isViewingOld ? '#D97706' : '#9CA3AF', marginLeft: 2 }}
        />
      </button>

      {/* Dropdown panel — matches Quotes exactly */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1"
          style={{
            width: 400, borderRadius: 10,
            border: '1px solid #E5E7EB',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden', zIndex: 'var(--z-dropdown)',
            backgroundColor: 'var(--card)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid #F3F4F6',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1, marginBottom: 4 }}>
                Version History
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1 }}>
                {versions.length} versions{lastApproved ? ` · Last approved: V${lastApprovedVersionNum}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isViewingOld && (
                <button
                  onClick={() => { onViewVersion?.(null); setIsOpen(false); }}
                  style={{
                    fontSize: 11, fontWeight: 600, color: '#FFFFFF', backgroundColor: '#1B6EF3',
                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', lineHeight: 1,
                    transition: 'all 100ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1B6EF3'; }}
                >
                  Back to Latest
                </button>
              )}
            </div>
          </div>

          {/* Version List */}
          <div style={{ maxHeight: 360, overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {versions.map((version, index) => {
              const isLatestVer = index === 0;
              const isBeingViewed = isViewingOld && version.version === viewingVersion;
              const isLastApprovedV = version.version === lastApprovedVersionNum;
              const vsCfg = statusConfig[version.versionStatus];
              const VSIcon = vsCfg.icon;
              const canEditAsDraft = !isLatestVer && currentStatus !== 'Shipped' && currentStatus !== 'Archived' && onEditAsDraft;

              return (
                <div
                  key={version.version}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', cursor: 'pointer',
                    backgroundColor: isBeingViewed ? '#FFFBEB' : 'transparent',
                    borderBottom: index < versions.length - 1 ? '1px solid #F7F8F9' : 'none',
                    transition: 'background-color 100ms',
                    borderLeft: isBeingViewed ? '3px solid #D97706' : '3px solid transparent',
                  }}
                  onClick={() => {
                    if (isLatestVer) onViewVersion?.(null);
                    else onViewVersion?.(version.version);
                    setIsOpen(false);
                  }}
                  onMouseEnter={(e) => { if (!isBeingViewed) e.currentTarget.style.backgroundColor = '#FAFBFC'; }}
                  onMouseLeave={(e) => { if (!isBeingViewed) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {/* Version icon */}
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    backgroundColor: isBeingViewed ? '#FEF3C7' : isLastApprovedV ? '#CCFBF1' : version.versionStatus === 'pending_review' ? '#FEF3C7' : version.isRevert ? '#FFFBEB' : '#F9FAFB',
                    border: `1px solid ${isBeingViewed ? '#FDE68A' : isLastApprovedV ? '#5EEAD4' : version.versionStatus === 'pending_review' ? '#FDE68A' : version.isRevert ? '#FDE68A' : '#F3F4F6'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {isBeingViewed ? (
                      <Eye style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : version.isRevert ? (
                      <RotateCcw style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : isLastApprovedV ? (
                      <CheckCircle2 style={{ width: 12, height: 12, color: '#0D9488' }} />
                    ) : version.versionStatus === 'pending_review' ? (
                      <Clock style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : (
                      <FileText style={{ width: 12, height: 12, color: '#9CA3AF' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', lineHeight: 1 }}>
                        V{version.version}
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        fontSize: 10, fontWeight: 600, color: vsCfg.color, backgroundColor: vsCfg.bg,
                        padding: '2px 5px', borderRadius: 3, lineHeight: 1,
                      }}>
                        <VSIcon style={{ width: 9, height: 9 }} />
                        {vsCfg.label}
                      </span>
                      {isLatestVer && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#374151', backgroundColor: '#F3F4F6',
                          padding: '2px 5px', borderRadius: 3, lineHeight: 1, border: '1px solid #E5E7EB',
                        }}>Latest</span>
                      )}
                      {isLastApprovedV && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#0F766E', backgroundColor: '#F0FDFA',
                          padding: '2px 5px', borderRadius: 3, lineHeight: 1, border: '1px solid #99F6E4',
                        }}>Last Approved</span>
                      )}
                      {isBeingViewed && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#92400E', backgroundColor: '#FEF3C7',
                          padding: '2px 5px', borderRadius: 3, lineHeight: 1,
                        }}>Viewing</span>
                      )}
                      {version.isRevert && !isBeingViewed && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: '#92400E', backgroundColor: '#FEF3C7',
                          padding: '2px 5px', borderRadius: 3, lineHeight: 1,
                        }}>Revert</span>
                      )}
                      {version.versionStatus === 'pending_review' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#D97706', lineHeight: 1 }}>
                          <Clock style={{ width: 9, height: 9 }} />
                          Pending
                        </span>
                      )}
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1, flexShrink: 0 }}>
                        {version.date}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        fontSize: 11, color: '#9CA3AF', lineHeight: 1.2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0,
                      }}>
                        {version.isRevert && version.revertedFrom
                          ? `Reverted from v${version.revertedFrom} · ${version.summary}`
                          : version.summary}
                      </div>
                      {canEditAsDraft && (
                        <button
                          title="Revert to this Version"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditAsDraft!(version.version);
                            setIsOpen(false);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 20, height: 20, color: '#9CA3AF',
                            backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                            borderRadius: 4, flexShrink: 0, transition: 'all 100ms',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EFF6FF'; e.currentTarget.style.color = '#3B82F6'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                        >
                          <RotateCcw style={{ width: 11, height: 11 }} />
                        </button>
                      )}
                    </div>
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
