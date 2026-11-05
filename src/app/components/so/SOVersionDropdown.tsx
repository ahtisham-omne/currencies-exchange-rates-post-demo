import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, FileText, RotateCcw, Check, Eye, Send, CheckCircle2, Clock, Pencil, Truck, Package, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDiscardModal } from '../shared/ConfirmDiscardModal';
import { StateTransitionOverlay } from '../shared/StateTransitionOverlay';

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
  onEditAsDraft?: (fromVersion: number, originalStatus: 'draft' | 'pending_review' | 'cleared' | 'partially_shipped' | 'shipped') => void;
  materialChangesCount?: number;
  isScrolled?: boolean;
}

const statusConfig: Record<VersionStatus, { label: string; bg: string; color: string; icon: typeof Send }> = {
  draft: { label: 'Draft', bg: '#F3F4F6', color: '#374151', icon: FileText },
  pending_review: { label: 'Pending Review', bg: '#FEF3C7', color: '#92400E', icon: Clock },
  cleared: { label: 'Released', bg: '#CCFBF1', color: '#0F766E', icon: CheckCircle2 },
  partially_shipped: { label: 'Partially Shipped', bg: '#EDE9FE', color: '#6D28D9', icon: Truck },
  shipped: { label: 'Shipped', bg: '#D1FAE5', color: '#047857', icon: Package },
};

/* Lifecycle pill chrome — same vocabulary and palette as the listing
   VersionHistoryModal and the SO VersionHistoryTab so all three
   surfaces read consistently. */
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

/**
 * Seeds the dropdown's version list from the parent's `currentVersion`
 * prop. Previously this was a hardcoded `[V3, V2, V1]` list which made
 * the dropdown render V3 even when the SO's actual version was V1 —
 * the notice bar (driven by `so.version.number`) and the dropdown
 * (driven by INITIAL_VERSIONS) ended up out of sync. Building the seed
 * from `currentVersion` keeps both surfaces dynamic and consistent.
 */
function seedVersions(currentVersion: number, currentStatusMapped: VersionStatus): Version[] {
  const today = new Date();
  const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
  const out: Version[] = [];
  for (let v = currentVersion; v >= 1; v--) {
    const isLatest = v === currentVersion;
    out.push({
      version: v,
      versionStatus: isLatest ? currentStatusMapped : 'cleared',
      date: dateStr,
      author: 'Sarah Chen',
      summary: isLatest
        ? (currentStatusMapped === 'draft' ? 'Draft in progress' : 'Current active version')
        : `Version ${v}. Historical revision.`,
      ...(currentStatusMapped !== 'draft' && isLatest ? { clearedAt: dateStr } : {}),
    });
  }
  return out;
}

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
  const [versions, setVersions] = useState<Version[]>(
    () => seedVersions(currentVersion, currentStatus ? mapSOStatusToVersionStatus(currentStatus) : 'cleared')
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  /* Pending revert state — mirrors the Version History modal: confirm
     gate, brief overlay, toast on commit. */
  const [pendingRevert, setPendingRevert] = useState<{ version: number; versionStatus: Version['versionStatus'] } | null>(null);
  const [revertOverlay, setRevertOverlay] = useState<{ show: boolean; toVersion: number } | null>(null);

  const lastApproved = versions.find(v => v.versionStatus === 'cleared' || v.versionStatus === 'shipped');
  const lastApprovedVersionNum = lastApproved?.version ?? 1;
  const latestVersion = versions[0];

  /* Anchor the trigger to the parent's `currentVersion` prop, not the
     internal `versions[0]`. The internal list can lag the parent by a
     tick after a new version is created (parent flips `currentVersion`
     synchronously while the sync-effect below races to prepend the new
     entry), and we never want the chip in the header to read an older
     version than what the user actually has open. */
  const currentVersionEntry =
    versions.find(v => v.version === currentVersion) || latestVersion;
  const isViewingOld = viewingVersion != null && viewingVersion !== currentVersion;
  const displayVersion = isViewingOld
    ? versions.find(v => v.version === viewingVersion) || currentVersionEntry
    : currentVersionEntry;

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
    setVersions(prev => {
      /* Idempotency guard — see Quote VersionDropdown for the
         rationale. Prevents a fast double-confirm from prepending two
         identical V{N} entries. */
      if (prev[0]?.version === newV) return prev;
      const newVersion: Version = {
        version: newV, versionStatus: 'draft', date: dateStr, author: 'Sarah Chen',
        summary: reason, isRevert: true, revertedFrom: fromVersion,
      };
      return [newVersion, ...prev];
    });
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

  useEffect(() => {
    if (!currentStatus) return;
    const mappedStatus = mapSOStatusToVersionStatus(currentStatus);
    setVersions(prev => {
      const maxV = prev[0];
      if (!maxV) return prev;
      if (currentVersion > maxV.version) {
        const today = new Date();
        const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
        const newEntry: Version = {
          version: currentVersion, versionStatus: mappedStatus, date: dateStr,
          author: 'Sarah Chen', summary: mappedStatus === 'draft' ? 'Draft in progress' : maxV.summary,
        };
        return [newEntry, ...prev];
      }
      const idx = prev.findIndex(v => v.version === currentVersion);
      if (idx === -1) return prev;
      const target = prev[idx];
      if (target.versionStatus === mappedStatus) return prev;
      const updated = { ...target, versionStatus: mappedStatus };
      if (mappedStatus === 'cleared') {
        const today = new Date();
        updated.clearedAt = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
      }
      return prev.map((v, i) => i === idx ? updated : v);
    });
  }, [currentVersion, currentStatus]);

  const dsCfg = statusConfig[displayVersion.versionStatus];
  const DSIcon = dsCfg.icon;

  // "Current" means the user is on the current head version, not
  // whichever entry happens to be first in the internal list.
  const isLatest = displayVersion.version === currentVersion;
  const isLastApprovedVer = displayVersion.version === lastApprovedVersionNum;
  const triggerPillLabel = isViewingOld ? 'Viewing' : isLatest ? 'Current Version' : dsCfg.label;
  /* Current reads in blue so the trigger pill matches the list rows / tab / modal. */
  const triggerPillColor = isViewingOld ? '#92400E' : isLatest ? '#1E40AF' : dsCfg.color;
  const triggerPillBg = isViewingOld ? '#FEF3C7' : isLatest ? '#EFF6FF' : dsCfg.bg;
  const triggerPillBorder = isViewingOld ? '#FDE68A' : isLatest ? '#93C5FD' : dsCfg.color;

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
          border: `1px solid ${triggerPillBorder}`,
          padding: '1px 5px', borderRadius: 3, lineHeight: 1,
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
                {versions.length} versions{lastApproved ? ` · Last cleared by Ops: V${lastApprovedVersionNum}` : ''}
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
                  Back to Current
                </button>
              )}
            </div>
          </div>

          {/* Version List */}
          <div style={{ maxHeight: 360, overflowY: 'auto', scrollbarWidth: 'thin' }}>
            {versions.map((version, index) => {
              const isLatestVer = version.version === currentVersion;
              const isBeingViewed = isViewingOld && version.version === viewingVersion;
              const isLastApprovedV = version.version === lastApprovedVersionNum;
              const vsCfg = statusConfig[version.versionStatus];
              const VSIcon = vsCfg.icon;
              /* A cleared/shipped/partially-shipped version that's older
                 than the last approved one reads as "Superseded" instead
                 of repeating the order-status pill — matches the modal
                 and Versions tab vocabulary. */
              const isSuperseded =
                (version.versionStatus === 'cleared' ||
                  version.versionStatus === 'shipped' ||
                  version.versionStatus === 'partially_shipped') &&
                !isLatestVer;
              const canEditAsDraft = !isLatestVer && currentStatus !== 'Shipped' && currentStatus !== 'Archived' && onEditAsDraft;

              return (
                <div
                  key={version.version}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 16px', cursor: 'pointer',
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
                    backgroundColor: isBeingViewed ? '#FEF3C7' : version.versionStatus === 'pending_review' ? '#FEF3C7' : version.isRevert ? '#FFFBEB' : '#F9FAFB',
                    border: `1px solid ${isBeingViewed ? '#FDE68A' : version.versionStatus === 'pending_review' ? '#FDE68A' : version.isRevert ? '#FDE68A' : '#F3F4F6'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {isBeingViewed ? (
                      <Eye style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : version.isRevert ? (
                      <RotateCcw style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : version.versionStatus === 'pending_review' ? (
                      <Clock style={{ width: 11, height: 11, color: '#D97706' }} />
                    ) : (
                      <FileText style={{ width: 12, height: 12, color: '#9CA3AF' }} />
                    )}
                  </div>

                  {/* Content — single-line layout. V-number + lifecycle
                      pills on the left, date pushed to the right, and
                      the revert icon sits past the date. The old
                      two-row layout left the revert button alone on
                      its own line, which read as wasted whitespace
                      after the per-version description was dropped. */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', lineHeight: 1 }}>
                      V{version.version}
                    </span>
                    {isLatestVer && (
                      <LifecycleTag label="Current Version" tone="latest" />
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
                    {version.versionStatus === 'pending_review' && !isLastApprovedV && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#D97706', lineHeight: 1 }}>
                        <Clock style={{ width: 9, height: 9 }} />
                        Pending
                      </span>
                    )}
                    {(() => { void vsCfg; void VSIcon; return null; })()}
                    <span className="tabular-nums" style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1, flexShrink: 0, marginLeft: 'auto' }}>
                      {version.date}
                    </span>
                    {canEditAsDraft && (
                      <button
                        title="Revert to this Version"
                        onClick={(e) => {
                          e.stopPropagation();
                          /* Open the confirmation gate first so the
                             flow mirrors what the Version History modal
                             ships: confirm → overlay → toast. */
                          setPendingRevert({ version: version.version, versionStatus: version.versionStatus });
                          setIsOpen(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 22, height: 22, color: '#9CA3AF',
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
              );
            })}
          </div>
        </div>
      )}

      {/* Revert confirmation + transition overlay — routed through the
          exact same chrome the SO Version History modal and Versions
          tab use, so the dropdown-driven and modal-driven reverts are
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
          const targetVersion = revertOverlay?.toVersion ?? 0;
          const source = versions.find((v) => v.version === targetVersion);
          /* SO status union differs from Quote's. Default to 'cleared'
             when the source row is missing — the parent's onEditAsDraft
             will normalise downstream. */
          const status = (source?.versionStatus as 'draft' | 'pending_review' | 'cleared' | 'partially_shipped' | 'shipped' | undefined) ?? 'cleared';
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
   Verbatim parity with SO's Versions tab + Version History modal:
   ConfirmDiscardModal banner + glow icon + h-11 stacked buttons,
   plus an optional revert-reason textarea. All three entry points
   share one piece of chrome. */
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
      description={`V${version} will become the latest version of this sales order. Its existing status is preserved. The next material change will auto-create a new version.`}
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
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Customer wants to go back to the original configuration..."
          rows={3}
          className="w-full"
          style={{ fontSize: '13px', fontWeight: 400, color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', outline: 'none', resize: 'none', fontFamily: 'Inter, system-ui, sans-serif', lineHeight: '1.5', boxSizing: 'border-box', transition: 'border-color 150ms', backgroundColor: '#FFFFFF' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(10,119,255,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
        />
      </div>
    </ConfirmDiscardModal>
  );
}
