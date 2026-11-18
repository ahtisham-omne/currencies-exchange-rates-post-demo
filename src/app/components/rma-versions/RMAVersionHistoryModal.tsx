import { useEffect, useMemo, useState } from 'react';
import { Clock, User, X, RotateCcw, GitCompare } from 'lucide-react';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import type { RMA } from '@/app/data/mockRMAs';
import { buildInitialVersion, type RMAVersionEntry } from '@/app/data/rmaVersions';
import { useRMAContext } from '@/app/rma-context';
import { rmaCanRevert } from '@/app/data/mockRMAs';

import { versionPalette as C, versionStatusConfig } from './rmaVersionDisplay';
import RMAVersionSnapshotPanel from './RMAVersionSnapshotPanel';
import RMAVersionChangeList from './RMAVersionChangeList';
import RMAVersionCompareView from './RMAVersionCompareView';
import RMAVersionRevertModal from './RMAVersionRevertModal';

/* Lifecycle pill — the chip that answers "which one is live", sitting on the
   same visual row as the status pill so the two read as a set. */
type LifecycleTone = 'latest' | 'approved' | 'superseded' | 'viewing';
const LIFECYCLE_TONES: Record<LifecycleTone, { bg: string; color: string; border: string }> = {
  latest:     { bg: '#EFF6FF', color: '#1E40AF', border: '#93C5FD' },
  approved:   { bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  superseded: { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
  viewing:    { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
};

function LifecyclePill({ label, tone }: { label: string; tone: LifecycleTone }) {
  const t = LIFECYCLE_TONES[tone];
  return (
    <span
      className="inline-flex items-center justify-center gap-1 whitespace-nowrap shrink-0 rounded-full"
      style={{
        padding: '2px 10px',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.4,
        backgroundColor: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
      }}
    >
      {label}
    </span>
  );
}

/** The node that sits on the timeline connector. Tinted by where the return
 *  stood at that version, with the current one always reading as settled. */
function VersionNode({
  version,
  isCurrent,
  versionStatus,
}: {
  version: number;
  isCurrent: boolean;
  versionStatus: RMAVersionEntry['versionStatus'];
}) {
  let bg = '#F9FAFB', color = '#9CA3AF', border = '#E5E7EB';
  if (isCurrent) {
    bg = '#D1FAE5'; color = '#065F46'; border = '#86EFAC';
  } else if (versionStatus === 'approved' || versionStatus === 'closed') {
    bg = '#ECFDF5'; color = '#065F46'; border = '#A7F3D0';
  } else if (versionStatus === 'sent') {
    bg = '#DBEAFE'; color = '#1E40AF'; border = '#93C5FD';
  } else if (versionStatus === 'shipped') {
    bg = '#FEF3C7'; color = '#92400E'; border = '#FDE68A';
  } else if (versionStatus === 'cancelled') {
    bg = '#FEF2F2'; color = '#991B1B'; border = '#FECACA';
  }
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        backgroundColor: bg,
        color,
        border: `2px solid ${border}`,
      }}
    >
      v{version}
    </div>
  );
}

/**
 * Version history reached from the list screen, without opening the return.
 *
 * Ported from the Purchase Order module's `POVersionHistoryModal.tsx`: left
 * timeline rail of version cards, right detail pane reusing the same panels
 * the detail page's Versions tab renders, and a two-slot A/B compare that
 * widens the dialog when both slots are filled.
 *
 * Versions come off the `rma` prop rather than a store read, because the RMA
 * store is React state — the list passes the record by id, so a revert made
 * in here flows back through props on the next render.
 */
export default function RMAVersionHistoryModal({
  rma,
  onClose,
}: {
  /** Null keeps the modal closed. */
  rma: RMA | null;
  onClose: () => void;
}) {
  const { revertRMAToVersion } = useRMAContext();
  const open = rma !== null;

  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [revertTarget, setRevertTarget] = useState<number | null>(null);
  /* Compare mode toggles the whole right pane between the single-version
     detail view and the side-by-side diff. The tuple is the A/B slot pair;
     clicking a card fills A, then B, then rotates B. */
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[number | null, number | null]>([
    null,
    null,
  ]);

  const sorted = useMemo<RMAVersionEntry[]>(() => {
    if (!rma) return [];
    const list = rma.versions && rma.versions.length > 0 ? rma.versions : [buildInitialVersion(rma)];
    return [...list].sort((a, b) => b.version - a.version);
  }, [rma]);

  const latestVersionNum = sorted[0]?.version ?? 1;
  const currentVersion = rma?.currentVersion ?? latestVersionNum;

  /* Closing resets everything so the next open lands fresh. */
  useEffect(() => {
    if (open) return;
    setSelectedVersion(null);
    setRevertTarget(null);
    setCompareMode(false);
    setCompareVersions([null, null]);
  }, [open]);

  /* Default selection is the latest, restored whenever the history changes so
     a revert made in here does not blank the right pane. */
  useEffect(() => {
    if (sorted.length === 0) {
      setSelectedVersion(null);
      return;
    }
    setSelectedVersion((prev) =>
      prev != null && sorted.some((v) => v.version === prev) ? prev : latestVersionNum,
    );
  }, [sorted, latestVersionNum]);

  const selected =
    selectedVersion != null ? (sorted.find((v) => v.version === selectedVersion) ?? null) : null;

  const handleVersionClick = (version: number) => {
    if (!compareMode) {
      setSelectedVersion(version);
      return;
    }
    setCompareVersions(([a, b]) => {
      if (a === version) return [b, null];
      if (b === version) return [a, null];
      if (a === null) return [version, null];
      if (b === null) return [a, version];
      return [a, version];
    });
    setSelectedVersion(version);
  };

  const isCompareWide =
    compareMode && compareVersions[0] !== null && compareVersions[1] !== null;
  const compareV1 =
    isCompareWide && compareVersions[0] !== null
      ? (sorted.find((v) => v.version === Math.min(compareVersions[0]!, compareVersions[1]!)) ??
        null)
      : null;
  const compareV2 =
    isCompareWide && compareVersions[1] !== null
      ? (sorted.find((v) => v.version === Math.max(compareVersions[0]!, compareVersions[1]!)) ??
        null)
      : null;

  const handleRevertConfirm = (reason: string) => {
    if (!rma || revertTarget == null) return;
    revertRMAToVersion(rma.id, revertTarget, reason);
    // Let the selection effect fall back to the latest once the store hands
    // the rewritten history back down through props.
    setSelectedVersion(null);
    setRevertTarget(null);
    toast.success(`Reverted to V${revertTarget}`, {
      description: 'The return now reads as that version recorded it.',
      position: 'top-right',
    });
  };

  if (!rma) return null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <DialogContent
          className="z-[210] flex flex-col p-0 gap-0 overflow-hidden bg-white border-0 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.18)] sm:max-w-none"
          style={{
            maxWidth: isCompareWide ? '1340px' : '1100px',
            width: `min(95vw, ${isCompareWide ? '1340px' : '1100px'})`,
            height: 'min(85vh, 720px)',
            borderRadius: 16,
            transition:
              'max-width 300ms cubic-bezier(0.32,0.72,0,1), width 300ms cubic-bezier(0.32,0.72,0,1)',
          }}
          showCloseButton={false}
        >
          {/* Header — icon tile + title on the left, version count, compare
              toggle and close on the right. */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b shrink-0"
            style={{ borderColor: C.border }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex items-center justify-center rounded-lg shrink-0"
                style={{ width: 36, height: 36, backgroundColor: 'hsl(var(--accent))' }}
              >
                <Clock style={{ width: 18, height: 18, color: 'hsl(var(--primary))' }} />
              </div>
              <div className="flex flex-col min-w-0">
                <DialogTitle
                  style={{ fontSize: 15, fontWeight: 600, color: C.text900, lineHeight: 1.3 }}
                >
                  Version History — {rma.rmaNumber}
                </DialogTitle>
                <DialogDescription
                  style={{ fontSize: 11, fontWeight: 400, color: C.text500, lineHeight: 1.4 }}
                >
                  A version is kept for every change · Current is the version in force
                </DialogDescription>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="text-sm tabular-nums hidden sm:inline" style={{ fontWeight: 500 }}>
                <span style={{ color: C.text900 }}>{sorted.length}</span>
                <span style={{ color: C.text500, opacity: 0.7 }}>
                  {' '}
                  {sorted.length === 1 ? 'version' : 'versions'}
                </span>
              </span>
              {sorted.length > 1 &&
                (() => {
                  const tint = compareMode
                    ? { bg: '#EFF6FF', hoverBg: '#DBEAFE', border: '#BFDBFE', color: '#1E40AF' }
                    : { bg: '#ECFDF5', hoverBg: '#D1FAE5', border: '#A7F3D0', color: '#065F46' };
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (compareMode) setCompareVersions([null, null]);
                        setCompareMode(!compareMode);
                      }}
                      className="inline-flex items-center gap-1.5 h-8 rounded-lg border transition-colors cursor-pointer"
                      style={{
                        padding: '0 12px',
                        fontSize: 13,
                        fontWeight: 600,
                        backgroundColor: tint.bg,
                        borderColor: tint.border,
                        color: tint.color,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = tint.hoverBg;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = tint.bg;
                      }}
                    >
                      <GitCompare style={{ width: 14, height: 14 }} />
                      <span className="hidden sm:inline">
                        {compareMode ? 'Exit Compare' : 'Compare Versions'}
                      </span>
                    </button>
                  );
                })()}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex items-center justify-center rounded-md transition-colors hover:bg-muted/60"
                style={{
                  width: 32,
                  height: 32,
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: C.text500,
                }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* ── Timeline rail ── */}
            <div
              className="shrink-0 overflow-y-auto flex flex-col"
              style={{
                width: '28%',
                minWidth: 260,
                borderRight: '1px solid #E5E7EB',
                backgroundColor: '#FAFBFC',
              }}
            >
              {compareMode && (
                <div
                  style={{
                    padding: '10px 16px',
                    flexShrink: 0,
                    backgroundColor: '#EFF6FF',
                    borderBottom: '1px solid #BFDBFE',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <GitCompare style={{ width: 14, height: 14, color: '#1B6EF3', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1E40AF', lineHeight: 1.3 }}>
                      Compare Mode
                    </div>
                    <div style={{ fontSize: 11, color: '#3B82F6', lineHeight: 1.3, marginTop: 1 }}>
                      {compareVersions[0] === null
                        ? 'Select 2 versions to compare'
                        : compareVersions[1] === null
                          ? '1 selected · pick one more'
                          : '2 versions selected'}
                    </div>
                  </div>
                </div>
              )}
              {sorted.length === 0 ? (
                <div
                  className="flex items-center justify-center py-14 px-4 text-center"
                  style={{ fontSize: 12, color: C.text500 }}
                >
                  No versions yet.
                </div>
              ) : (
                <div style={{ padding: 16 }}>
                  {sorted.map((v, index) => {
                    const isSelected = compareMode
                      ? compareVersions.includes(v.version)
                      : v.version === selectedVersion;
                    const isCurrent = v.version === currentVersion;
                    const isLast = index === sorted.length - 1;
                    const compareLabel =
                      compareMode && isSelected
                        ? compareVersions[0] === v.version
                          ? 'A'
                          : 'B'
                        : null;
                    // The company date, as the list writes it.
                    const displayDate = new Date(v.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });
                    return (
                      <div
                        key={v.version}
                        style={{ position: 'relative', paddingBottom: isLast ? 0 : 10 }}
                      >
                        {/* Connector — hidden in compare mode, where the
                            checkbox column replaces the node-on-a-line. */}
                        {!isLast && !compareMode && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 17,
                              top: 38,
                              bottom: 0,
                              width: 2,
                              backgroundColor: '#E2E8F0',
                              zIndex: 0,
                            }}
                          />
                        )}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            position: 'relative',
                            zIndex: 1,
                          }}
                        >
                          {compareMode && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                flexShrink: 0,
                                width: 28,
                                marginRight: 4,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleVersionClick(v.version)}
                                style={{
                                  width: 28,
                                  height: 28,
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginTop: 14,
                                  border: 'none',
                                  background: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                                aria-label={`Toggle version ${v.version} for compare`}
                              >
                                <div
                                  style={{
                                    width: 18,
                                    height: 18,
                                    borderRadius: 4,
                                    border: isSelected ? 'none' : '2px solid #D1D5DB',
                                    backgroundColor: isSelected ? '#1B6EF3' : '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 150ms',
                                    boxShadow: isSelected
                                      ? '0 1px 3px rgba(27,110,243,0.3)'
                                      : 'none',
                                  }}
                                >
                                  {isSelected && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: '#FFFFFF',
                                        lineHeight: 1,
                                      }}
                                    >
                                      {compareLabel}
                                    </span>
                                  )}
                                </div>
                              </button>
                              {!isLast && (
                                <div
                                  style={{
                                    flex: 1,
                                    width: 2,
                                    backgroundColor: '#E5E7EB',
                                    marginTop: 4,
                                    minHeight: 8,
                                  }}
                                />
                              )}
                            </div>
                          )}
                          {!compareMode && (
                            <div
                              style={{
                                flexShrink: 0,
                                width: 36,
                                display: 'flex',
                                justifyContent: 'center',
                                position: 'relative',
                                zIndex: 2,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => handleVersionClick(v.version)}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  padding: 0,
                                  cursor: 'pointer',
                                }}
                                aria-label={`Open version ${v.version}`}
                              >
                                <VersionNode
                                  version={v.version}
                                  isCurrent={isCurrent}
                                  versionStatus={v.versionStatus}
                                />
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleVersionClick(v.version)}
                            className="text-left transition-colors cursor-pointer relative"
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: 'none',
                              backgroundColor: isSelected
                                ? compareMode
                                  ? '#EFF6FF'
                                  : '#F0F7FF'
                                : '#FFFFFF',
                              outline: isSelected
                                ? compareMode
                                  ? '2px solid #60A5FA'
                                  : '2px solid #93C5FD'
                                : '1px solid #E5E7EB',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              {compareMode && (
                                <div style={{ flexShrink: 0 }}>
                                  <VersionNode
                                    version={v.version}
                                    isCurrent={isCurrent}
                                    versionStatus={v.versionStatus}
                                  />
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    marginBottom: 6,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 500,
                                      color: C.text900,
                                      lineHeight: 1,
                                    }}
                                  >
                                    Version {v.version}
                                  </span>
                                </div>

                                {isCurrent && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      marginBottom: 6,
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <LifecyclePill label="Current Version" tone="latest" />
                                  </div>
                                )}

                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11,
                                    color: C.text500,
                                    lineHeight: 1,
                                    marginBottom: 5,
                                  }}
                                >
                                  <User style={{ width: 11, height: 11 }} />
                                  <span>{v.createdBy}</span>
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: 11,
                                    color: C.text500,
                                    lineHeight: 1,
                                  }}
                                >
                                  <Clock style={{ width: 11, height: 11 }} />
                                  <span className="tabular-nums">{displayDate}</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Detail pane ── */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              {compareMode && compareV1 && compareV2 ? (
                <RMAVersionCompareView
                  v1={compareV1}
                  v2={compareV2}
                  onClose={() => setCompareVersions([null, null])}
                />
              ) : selected ? (
                (() => {
                  const selCfg =
                    versionStatusConfig[selected.versionStatus] || versionStatusConfig.draft;
                  const SelIcon = selCfg.icon;
                  const isCurrentSel = selected.version === currentVersion;
                  return (
                    <div style={{ padding: '20px 24px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap',
                          marginBottom: 16,
                        }}
                      >
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                        >
                          <h3
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: C.text900,
                              margin: 0,
                              lineHeight: 1,
                            }}
                          >
                            Version {selected.version}
                          </h3>
                          <span
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full"
                            style={{
                              padding: '2px 10px',
                              fontSize: 11,
                              fontWeight: 500,
                              lineHeight: 1.4,
                              backgroundColor: selCfg.bg,
                              color: selCfg.color,
                              border: `1px solid ${selCfg.border}`,
                            }}
                          >
                            <SelIcon style={{ width: 11, height: 11 }} />
                            {selCfg.label}
                          </span>
                          {isCurrentSel && <LifecyclePill label="Current Version" tone="latest" />}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {!compareMode && !isCurrentSel && rmaCanRevert(rma) && (
                            <button
                              type="button"
                              onClick={() => setRevertTarget(selected.version)}
                              className="inline-flex items-center gap-1.5 h-8 rounded-lg border cursor-pointer transition-colors"
                              style={{
                                padding: '0 12px',
                                fontSize: 13,
                                fontWeight: 600,
                                lineHeight: 1,
                                color: '#374151',
                                backgroundColor: '#FFFFFF',
                                borderColor: '#E5E7EB',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#F9FAFB';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#FFFFFF';
                              }}
                            >
                              <RotateCcw style={{ width: 12, height: 12 }} />
                              Revert to this version
                            </button>
                          )}
                        </div>
                      </div>

                      {selected.reason && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            padding: '10px 12px',
                            borderRadius: 8,
                            border: '1px solid #BFDBFE',
                            backgroundColor: '#F0F7FF',
                            marginBottom: 16,
                          }}
                        >
                          <User style={{ width: 14, height: 14, color: '#1E40AF', marginTop: 2 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#1E40AF',
                                marginBottom: 2,
                                lineHeight: 1.2,
                              }}
                            >
                              Notes
                            </div>
                            <div style={{ fontSize: 12, color: C.text700, lineHeight: 1.5 }}>
                              {selected.reason}
                            </div>
                          </div>
                        </div>
                      )}

                      <RMAVersionSnapshotPanel version={selected} />
                      <RMAVersionChangeList
                        changes={selected.changes}
                        versionNumber={selected.version}
                      />
                    </div>
                  );
                })()
              ) : (
                <div
                  className="h-full flex items-center justify-center p-6"
                  style={{ fontSize: 13, color: C.text500 }}
                >
                  Select a version to view its details.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sits outside the Dialog: an AlertDialog nested in Dialog.Root inherits
          the outer layer's dismiss handling and never takes pointer events. */}
      {revertTarget !== null && (
        <RMAVersionRevertModal
          version={revertTarget}
          onClose={() => setRevertTarget(null)}
          onConfirm={handleRevertConfirm}
        />
      )}
    </>
  );
}
