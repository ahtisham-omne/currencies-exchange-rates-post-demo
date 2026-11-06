import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, FileText, RotateCcw, Check, X, Eye, Send, CheckCircle2, Clock, Pencil, AlertCircle, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDiscardModal } from '../shared/ConfirmDiscardModal';
import { StateTransitionOverlay } from '../shared/StateTransitionOverlay';

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
  onEditAsDraft?: (fromVersion: number, originalStatus: 'draft' | 'sent' | 'confirmed') => void;
  /** Number of material changes accumulated in current draft version */
  materialChangesCount?: number;
  /** Pre-seeded versions list — overrides the static INITIAL_VERSIONS
   *  fallback so the dropdown reflects the quote's actual history. The
   *  list is expected to be newest-first; the top entry's `version`
   *  should match `currentVersion`. */
  initialVersions?: Version[];
  /** Notified when the local versions list changes (new draft, revert,
   *  status flip). Parent uses this to bubble the change back to the
   *  quote record so the listing badge + history modal stay in sync. */
  onVersionsChange?: (versions: Version[]) => void;
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
  draft: { label: 'Draft', bg: 'var(--muted)', color: 'var(--foreground)', icon: FileText },
  sent: { label: 'Sent', bg: 'var(--accent)', color: 'var(--primary)', icon: Send },
  confirmed: { label: 'Confirmed', bg: '#CCFBF1', color: 'var(--success)', icon: CheckCircle2 },
};

/* Lifecycle pill chrome — same vocabulary and palette as
   VersionHistoryModal and VersionHistoryTab so the three surfaces
   read consistently. */
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

export function VersionDropdown({ currentVersion, currentStatus, viewingVersion, onVersionChange, onViewVersion, onCompare, onEditAsDraft, materialChangesCount, initialVersions, onVersionsChange }: VersionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  /* Pending revert state — the dropdown's revert action now mirrors the
     Version History modal: open a confirmation, then on confirm play a
     short overlay and fire a toast. Holds the version the user has
     elected to revert to. */
  const [pendingRevert, setPendingRevert] = useState<{ version: number; versionStatus: 'draft' | 'sent' | 'confirmed' } | null>(null);
  const [revertOverlay, setRevertOverlay] = useState<{ show: boolean; toVersion: number } | null>(null);
  /* Seed from `initialVersions` when the parent passes a real list
     (mock-data quotes do so); otherwise fall back to the static
     INITIAL_VERSIONS so legacy callers keep working. The local
     `versions` state is the single source of truth from here on. */
  const [versions, setVersions] = useState<Version[]>(initialVersions && initialVersions.length > 0 ? initialVersions : INITIAL_VERSIONS);
  /* Bubble local changes back to the parent so the quote record can
     stay in sync — keeps the listing badge and history modal aligned
     with what the user just did in the dropdown. */
  useEffect(() => {
    onVersionsChange?.(versions);
  }, [versions, onVersionsChange]);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);

  // Position panel below trigger when opening (portal-based)
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelPos({ top: rect.bottom + 4, left: rect.left });
  }, [isOpen]);

  // Last approved = latest confirmed version
  const lastApproved = versions.find(v => v.versionStatus === 'confirmed');
  const lastApprovedVersionNum = lastApproved?.version ?? 1;
  const latestVersion = versions[0];

  /* The trigger must always show the version the user is on. We anchor
     it to the parent's `currentVersion` prop rather than `versions[0]`
     because the internal list can lag a tick behind the parent after a
     new version is created (parent flips `currentVersion` synchronously;
     the dropdown's internal list updates either via the window-side
     callback or the sync effect below — neither of which is guaranteed
     to land in the same render). Falling back to `latestVersion` only
     if no matching entry exists keeps the trigger correct even before
     the new version has been spliced into the local list. */
  const currentVersionEntry =
    versions.find(v => v.version === currentVersion) || latestVersion;
  const isViewingOld = viewingVersion != null && viewingVersion !== currentVersion;
  const displayVersion = isViewingOld
    ? versions.find(v => v.version === viewingVersion) || currentVersionEntry
    : currentVersionEntry;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      const inTrigger = dropdownRef.current?.contains(t);
      const inPanel = panelRef.current?.contains(t);
      if (!inTrigger && !inPanel) setIsOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);



  // Called externally when a revert is performed from the QuoteDetails banner
  // or VersionHistoryModal. Tags the new entry with `isRevert` so the
  // dropdown renders the "Revert" pill + "Reverted from vN" prefix.
  const addRevertedVersion = (fromVersion: number, reason: string) => {
    const newV = latestVersion.version + 1;
    const today = new Date();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${m}/${d}/${today.getFullYear()}`;
    setVersions(prev => {
      /* Idempotency guard — if the top entry already matches `newV`
         a prior call (or the sync effect below) has already added it.
         Without this guard a fast double-click on the confirm button
         (or an interleaving between the manual call and the sync
         effect) produced two identical draft entries at the head. */
      if (prev[0]?.version === newV) return prev;
      const newVersion: Version = {
        version: newV,
        versionStatus: 'draft',
        date: dateStr,
        author: 'Sarah Chen',
        summary: reason,
        isRevert: true,
        revertedFrom: fromVersion,
      };
      return [newVersion, ...prev];
    });
  };

  // Called externally for non-revert version additions — material-change
  // auto-drafts, reactivations from cancellation, and any other path that
  // creates a fresh forward draft without restoring an older version.
  // Does NOT set `isRevert`, so the "Revert" pill stays off.
  const addNewDraftVersion = (reason: string) => {
    const newV = latestVersion.version + 1;
    const today = new Date();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${m}/${d}/${today.getFullYear()}`;
    setVersions(prev => {
      /* Idempotency guard — see addRevertedVersion. */
      if (prev[0]?.version === newV) return prev;
      const newVersion: Version = {
        version: newV,
        versionStatus: 'draft',
        date: dateStr,
        author: 'Sarah Chen',
        summary: reason,
      };
      return [newVersion, ...prev];
    });
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
    (window as any).__versionDropdownAddNewDraft = addNewDraftVersion;
    (window as any).__versionDropdownOverwriteDraft = overwriteExistingDraft;
    return () => {
      delete (window as any).__versionDropdownAddRevert;
      delete (window as any).__versionDropdownAddNewDraft;
      delete (window as any).__versionDropdownOverwriteDraft;
    };
  });

  useEffect(() => {
    if (!currentStatus) return;
    const mappedStatus: VersionStatus | null =
      currentStatus === 'draft' ? 'draft' :
      currentStatus === 'sent' ? 'sent' :
      currentStatus === 'confirmed' ? 'confirmed' : null;
    if (!mappedStatus) return;

    setVersions(prev => {
      const maxV = prev[0];
      if (!maxV) return prev;
      // currentVersion > max means a brand-new draft was created (material change auto-version)
      if (currentVersion > maxV.version) {
        const today = new Date();
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');
        const dateStr = `${m}/${d}/${today.getFullYear()}`;
        const newEntry: Version = {
          version: currentVersion,
          versionStatus: mappedStatus,
          date: dateStr,
          author: 'Sarah Chen',
          summary: mappedStatus === 'draft' ? 'Draft in progress' : maxV.summary,
        };
        return [newEntry, ...prev];
      }
      // Otherwise, update the status on whichever entry matches currentVersion
      const idx = prev.findIndex(v => v.version === currentVersion);
      if (idx === -1) return prev;
      const target = prev[idx];
      if (target.versionStatus === mappedStatus) return prev;
      const updated = { ...target, versionStatus: mappedStatus };
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
      return prev.map((v, i) => i === idx ? updated : v);
    });
  }, [currentVersion, currentStatus]);

  const dsCfg = statusConfig[displayVersion.versionStatus];
  const DSIcon = dsCfg.icon;

  // Determine trigger pill label — "Current" means the user is on the
  // current head version, not whichever entry happens to be first in
  // the internal list.
  const isLatest = displayVersion.version === currentVersion;
  const isLastApproved = displayVersion.version === lastApprovedVersionNum;
  const triggerPillLabel = isViewingOld ? 'Viewing' : isLatest ? 'Current Version' : dsCfg.label;

  return (
    <div className="relative" ref={dropdownRef} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 transition-all shadow-sm"
        style={{
          padding: '4px 10px 4px 8px',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          backgroundColor: '#FFFFFF',
          cursor: 'pointer',
          height: '28px',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = '#F8FAFC';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
          }
        }}
      >
        {isViewingOld ? (
          <Eye style={{ width: '12px', height: '12px', color: '#B45309', flexShrink: 0 }} />
        ) : (
          <DSIcon style={{ width: '12px', height: '12px', color: dsCfg.color, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', lineHeight: '1' }}>
          V{displayVersion.version}
        </span>
        {/* Pill in trigger — Latest reads in blue to match the list rows / tab / modal.
            Viewing-old keeps the amber treatment; everything else falls back to the
            version-status palette. */}
        <span style={{
          fontSize: '9px', fontWeight: 600,
          color: isViewingOld ? '#92400E' : isLatest ? '#1E40AF' : dsCfg.color,
          backgroundColor: isViewingOld ? '#FFFBEB' : isLatest ? '#EFF6FF' : dsCfg.bg,
          border: `1px solid ${isViewingOld ? '#FDE68A' : isLatest ? '#93C5FD' : dsCfg.color}`,
          padding: '1px 5px', borderRadius: '3px', lineHeight: '1',
        }}>
          {triggerPillLabel}
        </span>
        <span style={{ fontSize: '11px', color: '#64748B', lineHeight: '1' }}>
          {displayVersion.date}
        </span>
        {/* Material changes count chip — shown when draft has accumulated changes */}
        {!isViewingOld && materialChangesCount != null && materialChangesCount > 0 && displayVersion.versionStatus === 'draft' && (
          <span style={{
            fontSize: '9px', fontWeight: 700, color: '#FFFFFF', backgroundColor: 'var(--primary)',
            width: '16px', height: '16px', borderRadius: '50%', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', lineHeight: '1', flexShrink: 0,
          }}>
            {materialChangesCount}
          </span>
        )}
        <ChevronDown
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ width: '12px', height: '12px', color: '#94A3B8', marginLeft: '2px' }}
        />
      </button>

      {isOpen && panelPos && createPortal(
        <div
          ref={panelRef}
          className="bg-white"
          style={{
            position: 'fixed',
            top: panelPos.top,
            left: panelPos.left,
            width: '400px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            zIndex: 9999,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1', marginBottom: '4px' }}>
                Version History
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1' }}>
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
                    fontSize: '11px', fontWeight: 600, color: '#FFFFFF', backgroundColor: 'var(--primary)',
                    padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', lineHeight: '1',
                    transition: 'all 100ms',
                    fontFamily: 'Inter, system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0D5ED7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary)'; }}
                >
                  Back to Current
                </button>
              )}
            </div>
          </div>

          {/* Version List */}
          <div style={{ maxHeight: '360px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {versions.map((version, index) => {
              const isLatestVer = version.version === currentVersion;
              const isBeingViewed = isViewingOld && version.version === viewingVersion;
              const isLastApprovedVer = version.version === lastApprovedVersionNum;
              const vsCfg = statusConfig[version.versionStatus];
              const VSIcon = vsCfg.icon;
              /* Bug C2: a confirmed version that's older than the most
                 recently approved version is "Superseded" — keeping the
                 green "Confirmed" pill on those rows made two versions
                 look co-current. The latest approved confirmed stays
                 "Confirmed"; everything older flips to "Superseded". */
              const isSuperseded = version.versionStatus === 'confirmed' && !isLatestVer;

              // Can this version be edited as a new draft?
              const canEditAsDraft = !isLatestVer && currentStatus !== 'converted' && onEditAsDraft;

              return (
                <div
                  key={version.version}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor: isBeingViewed ? 'rgba(217, 119, 6, 0.1)' : 'transparent',
                    borderBottom: index < versions.length - 1 ? '1px solid #F7F8F9' : 'none',
                    transition: 'background-color 100ms',
                    borderLeft: isBeingViewed ? '3px solid var(--warning)' : '3px solid transparent',
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
                        backgroundColor: isBeingViewed ? 'rgba(217, 119, 6, 0.2)' : version.versionStatus === 'sent' ? 'var(--accent)' : version.isRevert ? 'rgba(217, 119, 6, 0.1)' : 'var(--muted)',
                        border: `1px solid ${isBeingViewed ? 'rgba(217, 119, 6, 0.3)' : version.versionStatus === 'sent' ? 'rgba(10, 119, 255, 0.4)' : version.isRevert ? 'rgba(217, 119, 6, 0.3)' : 'var(--muted)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}
                    >
                      {isBeingViewed ? (
                        <Eye style={{ width: '11px', height: '11px', color: 'var(--warning)' }} />
                      ) : version.isRevert ? (
                        <RotateCcw style={{ width: '11px', height: '11px', color: 'var(--warning)' }} />
                      ) : version.versionStatus === 'sent' ? (
                        <Send style={{ width: '11px', height: '11px', color: 'var(--primary)' }} />
                      ) : (
                        <FileText style={{ width: '12px', height: '12px', color: 'var(--muted-foreground)' }} />
                      )}
                    </div>
                  )}

                  {/* Content — single-line layout. V-number + lifecycle
                      pills on the left, date pushed to the right, and
                      the revert icon sits just past the date. The old
                      two-row layout had the revert button alone on a
                      second row, which read as wasted whitespace once
                      the per-version description was dropped. */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 500, color: 'var(--foreground-soft)', lineHeight: '1' }}>
                      V{version.version}
                    </span>
                    {/* Lifecycle pills — same set as before, just lifted
                        onto the single row so the layout reads tighter. */}
                    {isLatestVer && currentStatus !== 'converted' && (
                      <LifecycleTag label="Current Version" tone="latest" />
                    )}
                    {currentStatus === 'converted' && isLatestVer && (
                      <LifecycleTag label="Converted to SO" tone="approved" />
                    )}
                    {isSuperseded && (
                      <LifecycleTag label="Superseded" tone="superseded" />
                    )}
                    {isBeingViewed && (
                      <LifecycleTag label="Viewing" tone="viewing" />
                    )}
                    {version.isRevert && !isBeingViewed && (
                      <LifecycleTag
                        label={version.revertedFrom ? `Revert from V${version.revertedFrom}` : 'Revert'}
                        tone="viewing"
                      />
                    )}
                    {version.versionStatus === 'sent' && !isLastApprovedVer && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--warning)', lineHeight: '1' }}>
                        <Clock style={{ width: '9px', height: '9px' }} />
                        Pending
                      </span>
                    )}
                    {(() => { void vsCfg; void VSIcon; return null; })()}
                    <span className="tabular-nums" style={{ fontSize: '11px', color: 'var(--muted-foreground)', lineHeight: '1', flexShrink: 0, marginLeft: 'auto' }}>
                      {version.date}
                    </span>
                    {canEditAsDraft && (
                      <button
                        title="Revert to this Version"
                        onClick={(e) => {
                          e.stopPropagation();
                          /* Open the confirmation gate instead of
                             firing the revert directly so the flow
                             mirrors what the Version History modal
                             ships: confirm → overlay → toast. */
                          setPendingRevert({ version: version.version, versionStatus: version.versionStatus });
                          setIsOpen(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '22px', height: '22px',
                          color: 'var(--muted-foreground)',
                          backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                          borderRadius: '4px', flexShrink: 0,
                          transition: 'all 100ms',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}
                      >
                        <RotateCcw style={{ width: '11px', height: '11px' }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}

      {/* Revert confirmation + transition overlay — routed through the
          exact same chrome the Version History modal and Versions tab
          use, so the dropdown-driven and modal-driven reverts are
          visually and behaviourally indistinguishable. */}
      {pendingRevert && (
        <RevertConfirmModal
          version={pendingRevert.version}
          onClose={() => setPendingRevert(null)}
          onConfirm={() => {
            const target = pendingRevert;
            setPendingRevert(null);
            setRevertOverlay({ show: true, toVersion: target.version });
          }}
        />
      )}
      <StateTransitionOverlay
        isActive={!!revertOverlay?.show}
        fromLabel={`V${currentVersion} · Current Version`}
        toLabel={`V${revertOverlay?.toVersion ?? 0} · Current Version`}
        tone="version"
        Icon={GitBranch}
        heading={`Reverting to V${revertOverlay?.toVersion ?? 0}`}
        meta={`V${currentVersion} → V${revertOverlay?.toVersion ?? 0}`}
        duration={2000}
        onComplete={() => {
          /* Commit the revert + toast only after the overlay finishes,
             matching the modal's pacing. The target version was
             captured into `revertOverlay.toVersion` when the user
             confirmed; the source-list lookup recovers its status so
             onEditAsDraft can fork a fresh draft from it. */
          const targetVersion = revertOverlay?.toVersion ?? 0;
          const source = versions.find((v) => v.version === targetVersion);
          const status = (source?.versionStatus as 'draft' | 'sent' | 'confirmed' | undefined) ?? 'draft';
          setRevertOverlay(null);
          onEditAsDraft?.(targetVersion, status);
          toast.success(`Reverted to V${targetVersion}`, {
            description: `A new draft was opened with the data from V${targetVersion}.`,
            position: 'top-right',
          });
        }}
      />
    </div>
  );
}

/* ── Revert Confirm Modal ─────────────────────────────────────────
   Verbatim copy of the Versions tab + Version History modal's revert
   gate so all three revert entry points share one piece of chrome:
   ConfirmDiscardModal banner + glow icon + h-11 stacked buttons,
   plus an optional revert-reason textarea. */
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
            textTransform: 'none', marginBottom: '6px', lineHeight: '1',
          }}
        >
          Reason for revert <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
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
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(10, 119, 255, 0.4)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>
    </ConfirmDiscardModal>
  );
}