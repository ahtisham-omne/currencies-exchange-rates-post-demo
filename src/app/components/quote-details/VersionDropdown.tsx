import { useState, useRef, useEffect } from 'react';
import { ChevronDown, FileText, RotateCcw, Check, X, Eye, Send, CheckCircle2, Clock, Pencil } from 'lucide-react';

type VersionStatus = 'draft' | 'sent' | 'confirmed';

interface Version {
  version: number;
  versionStatus: VersionStatus;
  date: string;
  sentAt?: string;
  confirmedAt?: string;
  author: string;
  summary: string;
  isRevert?: boolean;
  revertedFrom?: number;
}

interface VersionDropdownProps {
  currentVersion: number;
  currentStatus?: 'draft' | 'sent' | 'confirmed' | 'converted' | 'cancelled' | 'archived' | 'expired';
  viewingVersion?: number | null;
  onVersionChange?: (version: number) => void;
  onViewVersion?: (version: number | null) => void;
  onCompare?: (v1: number, v2: number) => void;
  onEditAsDraft?: (fromVersion: number) => void;
  /** Number of material changes accumulated in current draft version */
  materialChangesCount?: number;
}

const INITIAL_VERSIONS: Version[] = [
  {
    version: 3,
    versionStatus: 'sent',
    date: '02/05/2026',
    sentAt: '02/05/2026',
    author: 'Sarah Chen',
    summary: 'Added emergency lighting + auto-eject, applied govt contract rule',
  },
  {
    version: 2,
    versionStatus: 'confirmed',
    date: '01/28/2026',
    sentAt: '01/28/2026',
    confirmedAt: '02/01/2026',
    author: 'Sarah Chen',
    summary: 'Added medical equipment, fleet volume pricing applied',
  },
  {
    version: 1,
    versionStatus: 'confirmed',
    date: '01/20/2026',
    sentAt: '01/20/2026',
    confirmedAt: '01/22/2026',
    author: 'Sarah Chen',
    summary: 'Initial quote — chassis + ambulance modules',
  },
];

const statusConfig: Record<VersionStatus, { label: string; bg: string; color: string; icon: typeof Send }> = {
  draft: { label: 'Draft', bg: '#F3F4F6', color: '#374151', icon: FileText },
  sent: { label: 'Sent', bg: '#DBEAFE', color: '#1E40AF', icon: Send },
  confirmed: { label: 'Confirmed', bg: '#CCFBF1', color: '#0F766E', icon: CheckCircle2 },
};

export function VersionDropdown({ currentVersion, currentStatus, viewingVersion, onVersionChange, onViewVersion, onCompare, onEditAsDraft, materialChangesCount }: VersionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>(INITIAL_VERSIONS);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Last approved = latest confirmed version
  const lastApproved = versions.find(v => v.versionStatus === 'confirmed');
  const lastApprovedVersionNum = lastApproved?.version ?? 1;
  const latestVersion = versions[0];

  const isViewingOld = viewingVersion != null && viewingVersion !== latestVersion.version;
  const displayVersion = isViewingOld
    ? versions.find(v => v.version === viewingVersion) || latestVersion
    : latestVersion;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);



  // Called externally when a revert is performed from the QuoteDetails banner
  const addRevertedVersion = (fromVersion: number, reason: string) => {
    const newV = latestVersion.version + 1;
    const today = new Date();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${m}/${d}/${today.getFullYear()}`;
    const newVersion: Version = {
      version: newV,
      versionStatus: 'draft',
      date: dateStr,
      author: 'Sarah Chen',
      summary: reason,
      isRevert: true,
      revertedFrom: fromVersion,
    };
    setVersions(prev => [newVersion, ...prev]);
  };

  // Called externally when overwriting the existing draft with reverted data
  const overwriteExistingDraft = (fromVersion: number) => {
    setVersions(prev => {
      const latest = prev[0];
      if (!latest || latest.versionStatus !== 'draft') return prev;
      const today = new Date();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const dateStr = `${m}/${d}/${today.getFullYear()}`;
      const updated: Version = {
        ...latest,
        date: dateStr,
        summary: `Updated with data from V${fromVersion}`,
        isRevert: true,
        revertedFrom: fromVersion,
      };
      return [updated, ...prev.slice(1)];
    });
  };

  useEffect(() => {
    (window as any).__versionDropdownAddRevert = addRevertedVersion;
    (window as any).__versionDropdownOverwriteDraft = overwriteExistingDraft;
    return () => {
      delete (window as any).__versionDropdownAddRevert;
      delete (window as any).__versionDropdownOverwriteDraft;
    };
  });

  // Sync with parent status/version changes
  useEffect(() => {
    if (!currentStatus) return;
    // Map lifecycle status to version status
    const mappedStatus: VersionStatus | null =
      currentStatus === 'draft' ? 'draft' :
      currentStatus === 'sent' ? 'sent' :
      currentStatus === 'confirmed' ? 'confirmed' : null;
    if (!mappedStatus) return;

    setVersions(prev => {
      const latest = prev[0];
      if (!latest) return prev;

      // If parent version is higher than our latest — a new draft was created
      if (currentVersion > latest.version) {
        const today = new Date();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const dateStr = `${m}/${d}/${today.getFullYear()}`;
        const newEntry: Version = {
          version: currentVersion,
          versionStatus: mappedStatus,
          date: dateStr,
          author: 'Sarah Chen',
          summary: mappedStatus === 'draft' ? 'Draft in progress' : latest.summary,
        };
        return [newEntry, ...prev];
      }

      // If parent version matches latest — just update its status
      if (currentVersion === latest.version && latest.versionStatus !== mappedStatus) {
        const updated = { ...latest, versionStatus: mappedStatus };
        if (mappedStatus === 'sent') {
          const today = new Date();
          const m = String(today.getMonth() + 1).padStart(2, '0');
          const d = String(today.getDate()).padStart(2, '0');
          updated.sentAt = `${m}/${d}/${today.getFullYear()}`;
        }
        if (mappedStatus === 'confirmed') {
          const today = new Date();
          const m = String(today.getMonth() + 1).padStart(2, '0');
          const d = String(today.getDate()).padStart(2, '0');
          updated.confirmedAt = `${m}/${d}/${today.getFullYear()}`;
        }
        return [updated, ...prev.slice(1)];
      }

      return prev;
    });
  }, [currentVersion, currentStatus]);

  const dsCfg = statusConfig[displayVersion.versionStatus];
  const DSIcon = dsCfg.icon;
  const isDarkBg = currentStatus === 'converted';

  // Determine trigger pill label
  const isLatest = displayVersion.version === latestVersion.version;
  const isLastApproved = displayVersion.version === lastApprovedVersionNum;
  const triggerPillLabel = isViewingOld ? 'Viewing' : isLatest ? 'Latest' : isLastApproved ? 'Last Approved' : dsCfg.label;
  const triggerPillColor = isViewingOld ? '#92400E' : isDarkBg ? '#FFFFFF' : isLatest && displayVersion.versionStatus === 'draft' ? '#374151' : dsCfg.color;
  const triggerPillBg = isViewingOld ? '#FEF3C7' : isDarkBg ? 'rgba(255,255,255,0.25)' : isLatest && displayVersion.versionStatus === 'draft' ? '#F3F4F6' : dsCfg.bg;

  return (
    <div className="relative" ref={dropdownRef} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 transition-all"
        style={{
          padding: '4px 10px 4px 8px',
          borderRadius: '6px',
          border: '1px solid',
          borderColor: isViewingOld ? '#FDE68A' : isDarkBg ? 'rgba(255,255,255,0.2)' : isOpen ? '#D1D5DB' : '#E5E7EB',
          backgroundColor: isViewingOld ? '#FFFBEB' : isDarkBg ? 'rgba(255,255,255,0.1)' : isOpen ? '#F9FAFB' : '#FFFFFF',
          cursor: 'pointer',
          height: '28px',
        }}
        onMouseEnter={(e) => {
          if (!isOpen && !isViewingOld) {
            e.currentTarget.style.borderColor = isDarkBg ? 'rgba(255,255,255,0.35)' : '#D1D5DB';
            e.currentTarget.style.backgroundColor = isDarkBg ? 'rgba(255,255,255,0.18)' : '#F9FAFB';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen && !isViewingOld) {
            e.currentTarget.style.borderColor = isDarkBg ? 'rgba(255,255,255,0.2)' : '#E5E7EB';
            e.currentTarget.style.backgroundColor = isDarkBg ? 'rgba(255,255,255,0.1)' : '#FFFFFF';
          }
        }}
      >
        {isViewingOld ? (
          <Eye style={{ width: '12px', height: '12px', color: '#D97706', flexShrink: 0 }} />
        ) : (
          <DSIcon style={{ width: '12px', height: '12px', color: isDarkBg ? '#FFFFFF' : dsCfg.color, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: '12px', fontWeight: 600, color: isViewingOld ? '#92400E' : isDarkBg ? '#FFFFFF' : '#1F2937', lineHeight: '1' }}>
          V{displayVersion.version}
        </span>
        {/* Pill in trigger */}
        <span style={{
          fontSize: '9px', fontWeight: 600, color: triggerPillColor, backgroundColor: triggerPillBg,
          padding: '2px 5px', borderRadius: '3px', lineHeight: '1',
        }}>
          {triggerPillLabel}
        </span>
        <span style={{ fontSize: '11px', color: isViewingOld ? '#B45309' : isDarkBg ? 'rgba(255,255,255,0.85)' : '#9CA3AF', lineHeight: '1' }}>
          {displayVersion.date}
        </span>
        {/* Material changes count chip — shown when draft has accumulated changes */}
        {!isViewingOld && materialChangesCount != null && materialChangesCount > 0 && displayVersion.versionStatus === 'draft' && (
          <span style={{
            fontSize: '9px', fontWeight: 700, color: '#FFFFFF', backgroundColor: '#1B6EF3',
            width: '16px', height: '16px', borderRadius: '50%', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', lineHeight: '1', flexShrink: 0,
          }}>
            {materialChangesCount}
          </span>
        )}
        <ChevronDown
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ width: '12px', height: '12px', color: isViewingOld ? '#D97706' : isDarkBg ? 'rgba(255,255,255,0.7)' : '#9CA3AF', marginLeft: '2px' }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 bg-white z-50"
          style={{
            width: '400px',
            borderRadius: '10px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #F3F4F6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', lineHeight: '1', marginBottom: '4px' }}>
                Version History
              </div>
              <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1' }}>
                {versions.length} versions{lastApproved ? ` · Last approved: V${lastApprovedVersionNum}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isViewingOld && (
                <button
                  onClick={() => {
                    onViewVersion?.(null);
                    setIsOpen(false);
                  }}
                  style={{
                    fontSize: '11px', fontWeight: 600, color: '#FFFFFF', backgroundColor: '#1B6EF3',
                    padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', lineHeight: '1',
                    transition: 'all 100ms',
                    fontFamily: 'Inter, system-ui, sans-serif',
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
          <div style={{ maxHeight: '360px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {versions.map((version, index) => {
              const isLatestVer = index === 0;
              const isBeingViewed = isViewingOld && version.version === viewingVersion;
              const isLastApprovedVer = version.version === lastApprovedVersionNum;
              const vsCfg = statusConfig[version.versionStatus];
              const VSIcon = vsCfg.icon;

              // Can this version be edited as a new draft?
              const canEditAsDraft = !isLatestVer && currentStatus !== 'converted' && onEditAsDraft;

              return (
                <div
                  key={version.version}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    backgroundColor: isBeingViewed ? '#FFFBEB' : 'transparent',
                    borderBottom: index < versions.length - 1 ? '1px solid #F7F8F9' : 'none',
                    transition: 'background-color 100ms',
                    borderLeft: isBeingViewed ? '3px solid #D97706' : '3px solid transparent',
                  }}
                  onClick={() => {
                    if (isLatestVer) {
                      onViewVersion?.(null);
                    } else {
                      onViewVersion?.(version.version);
                    }
                    setIsOpen(false);
                  }}
                  onMouseEnter={(e) => {
                    if (!isBeingViewed) {
                      e.currentTarget.style.backgroundColor = '#FAFBFC';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isBeingViewed) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {/* Version icon */}
                  {(
                    <div
                      style={{
                        width: '24px', height: '24px', borderRadius: '6px',
                        backgroundColor: isBeingViewed ? '#FEF3C7' : isLastApprovedVer ? '#CCFBF1' : version.versionStatus === 'sent' ? '#DBEAFE' : version.isRevert ? '#FFFBEB' : '#F9FAFB',
                        border: `1px solid ${isBeingViewed ? '#FDE68A' : isLastApprovedVer ? '#5EEAD4' : version.versionStatus === 'sent' ? '#93C5FD' : version.isRevert ? '#FDE68A' : '#F3F4F6'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >
                      {isBeingViewed ? (
                        <Eye style={{ width: '11px', height: '11px', color: '#D97706' }} />
                      ) : version.isRevert ? (
                        <RotateCcw style={{ width: '11px', height: '11px', color: '#D97706' }} />
                      ) : isLastApprovedVer ? (
                        <CheckCircle2 style={{ width: '12px', height: '12px', color: '#0D9488' }} />
                      ) : version.versionStatus === 'sent' ? (
                        <Send style={{ width: '11px', height: '11px', color: '#2563EB' }} />
                      ) : (
                        <FileText style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', lineHeight: '1' }}>
                        V{version.version}
                      </span>
                      {/* Status badge */}
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        fontSize: '10px', fontWeight: 600, color: vsCfg.color, backgroundColor: vsCfg.bg,
                        padding: '2px 5px', borderRadius: '3px', lineHeight: '1',
                      }}>
                        <VSIcon style={{ width: '9px', height: '9px' }} />
                        {vsCfg.label}
                      </span>
                      {/* Latest tag for top version */}
                      {isLatestVer && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, color: '#374151', backgroundColor: '#F3F4F6',
                          padding: '2px 5px', borderRadius: '3px', lineHeight: '1',
                          border: '1px solid #E5E7EB',
                        }}>Latest</span>
                      )}
                      {/* Last Approved tag */}
                      {isLastApprovedVer && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, color: '#0F766E', backgroundColor: '#F0FDFA',
                          padding: '2px 5px', borderRadius: '3px', lineHeight: '1',
                          border: '1px solid #99F6E4',
                        }}>Last Approved</span>
                      )}
                      {isBeingViewed && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, color: '#92400E', backgroundColor: '#FEF3C7',
                          padding: '2px 5px', borderRadius: '3px', lineHeight: '1',
                        }}>Viewing</span>
                      )}
                      {version.isRevert && !isBeingViewed && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, color: '#92400E', backgroundColor: '#FEF3C7',
                          padding: '2px 5px', borderRadius: '3px', lineHeight: '1',
                        }}>Revert</span>
                      )}
                      {/* Pending indicator for sent but unconfirmed */}
                      {version.versionStatus === 'sent' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#D97706', lineHeight: '1' }}>
                          <Clock style={{ width: '9px', height: '9px' }} />
                          Pending
                        </span>
                      )}
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1', flexShrink: 0 }}>
                        {version.date}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
                        {version.isRevert && version.revertedFrom
                          ? `Reverted from v${version.revertedFrom} · ${version.summary}`
                          : version.summary}
                      </div>
                      {/* Revert to this version action — icon-only with tooltip */}
                      {canEditAsDraft && (
                        <button
                          title="Revert to this Version"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditAsDraft(version.version);
                            setIsOpen(false);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '20px', height: '20px',
                            color: '#9CA3AF',
                            backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                            borderRadius: '4px', flexShrink: 0,
                            transition: 'all 100ms',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EFF6FF'; e.currentTarget.style.color = '#3B82F6'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9CA3AF'; }}
                        >
                          <RotateCcw style={{ width: '11px', height: '11px' }} />
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