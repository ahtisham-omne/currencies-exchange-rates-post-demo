import { useState, useMemo } from 'react';
import { Lock, Package } from 'lucide-react';
import { toast } from 'sonner';

import type { RMAVersionEntry } from '@/app/data/rmaVersions';
import { versionPalette as C } from './rmaVersionDisplay';
import {
  EMPTY_RMA_VERSION_FILTERS,
  filterRMAVersions,
  type RMAVersionFilterState,
} from './rmaVersionFilters';
import RMAVersionsToolbar from './RMAVersionsToolbar';
import RMAVersionRow from './RMAVersionRow';
import RMAVersionSnapshotPanel from './RMAVersionSnapshotPanel';
import RMAVersionChangeList from './RMAVersionChangeList';
import RMAVersionRevertModal from './RMAVersionRevertModal';
import RMAVersionCompareView from './RMAVersionCompareView';

/**
 * The Versions tab shell. Ported from the Purchase Order module's
 * `POVersionHistoryTab.tsx`: a thin composer that owns the search, expand,
 * compare and revert state and delegates everything it renders.
 */
export default function RMAVersionHistoryTab({
  versions,
  currentVersion,
  onRevert,
  lockedNote,
}: {
  versions: RMAVersionEntry[];
  /** Which version is in force. Drives the Current pill and hides Revert on
   *  that row. */
  currentVersion: number;
  /** Absent once the return is locked (DQ-09). */
  onRevert?: ((version: number, reason: string) => void) | undefined;
  /** Why no version can be reverted to, said above the list. */
  lockedNote?: string | undefined;
}) {
  const [filterState, setFilterState] = useState<RMAVersionFilterState>(
    EMPTY_RMA_VERSION_FILTERS,
  );
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(
    new Set([versions[0]?.version ?? 1]),
  );
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelections, setCompareSelections] = useState<number[]>([]);
  const [showRevertConfirm, setShowRevertConfirm] = useState<number | null>(null);
  const [inlineCompare, setInlineCompare] = useState<{
    v1: RMAVersionEntry;
    v2: RMAVersionEntry;
  } | null>(null);

  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );

  const distinctCreators = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of sorted) {
      if (v.createdBy && !seen.has(v.createdBy)) {
        seen.add(v.createdBy);
        out.push(v.createdBy);
      }
    }
    return out;
  }, [sorted]);

  const toggleExpanded = (v: number) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };

  const handleCompareSelect = (v: number) => {
    setCompareSelections((prev) => {
      if (prev.includes(v)) return prev.filter((x) => x !== v);
      if (prev.length >= 2) return [prev[1]!, v];
      return [...prev, v];
    });
  };

  const handleToggleCompareMode = () => {
    setCompareMode((v) => !v);
    setCompareSelections([]);
    setInlineCompare(null);
  };

  const handleStartComparison = () => {
    if (compareSelections.length !== 2) return;
    const v1 = sorted.find((v) => v.version === Math.min(...compareSelections));
    const v2 = sorted.find((v) => v.version === Math.max(...compareSelections));
    if (!v1 || !v2) return;
    setInlineCompare({ v1, v2 });
  };

  const filteredVersions = useMemo(
    () => filterRMAVersions(sorted, filterState),
    [sorted, filterState],
  );

  return (
    <div style={{ width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
      <div
        className="bg-white rounded-xl border overflow-hidden w-full"
        style={{ borderColor: C.border, maxWidth: '100%' }}
      >
        <RMAVersionsToolbar
          filterState={filterState}
          onFilterChange={(patch) => setFilterState((prev) => ({ ...prev, ...patch }))}
          creators={distinctCreators}
          compareMode={compareMode}
          onToggleCompareMode={handleToggleCompareMode}
          compareSelectionCount={compareSelections.length}
          onStartComparison={handleStartComparison}
          {...(compareSelections.length === 2
            ? {
                minCompareVersion: Math.min(...compareSelections),
                maxCompareVersion: Math.max(...compareSelections),
              }
            : {})}
        />

        {lockedNote && (
          <div
            className="flex items-center gap-2 border-b px-4 py-2.5"
            style={{ borderColor: C.border, backgroundColor: '#F8FAFC', fontSize: 12, color: C.text700 }}
          >
            <Lock style={{ width: 13, height: 13, color: C.text500 }} />
            {lockedNote}
          </div>
        )}

        <div className="w-full overflow-hidden" style={{ maxWidth: '100%' }}>
          {filteredVersions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Package style={{ width: 32, height: 32, color: C.text400 }} strokeWidth={1.75} />
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text700 }}>
                No matching changes found
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: C.text500 }}>
                Clear the search to see every version of this return.
              </div>
            </div>
          ) : (
            filteredVersions.map((ver, vidx) => {
              const isExpanded = expandedVersions.has(ver.version);
              const isCompareSelected = compareSelections.includes(ver.version);
              const isCurrent = ver.version === currentVersion;
              return (
                <div key={ver.version} className="overflow-hidden" style={{ maxWidth: '100%' }}>
                  {vidx > 0 && <div style={{ height: 1, backgroundColor: C.border }} />}
                  <RMAVersionRow
                    version={ver}
                    isExpanded={isExpanded}
                    isCurrent={isCurrent}
                    compareMode={compareMode}
                    isCompareSelected={isCompareSelected}
                    onClick={() =>
                      compareMode ? handleCompareSelect(ver.version) : toggleExpanded(ver.version)
                    }
                    onRevertClick={onRevert ? () => setShowRevertConfirm(ver.version) : undefined}
                  />
                  {isExpanded && !compareMode && (
                    <div
                      className="overflow-hidden min-w-0"
                      style={{ padding: '0 16px 16px 60px', maxWidth: '100%' }}
                    >
                      <RMAVersionSnapshotPanel version={ver} />
                      <RMAVersionChangeList changes={ver.changes} versionNumber={ver.version} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {inlineCompare && (
        <div style={{ marginTop: 12 }}>
          <RMAVersionCompareView
            v1={inlineCompare.v1}
            v2={inlineCompare.v2}
            onClose={() => setInlineCompare(null)}
          />
        </div>
      )}

      {showRevertConfirm !== null && (
        <RMAVersionRevertModal
          version={showRevertConfirm}
          onClose={() => setShowRevertConfirm(null)}
          onConfirm={(reason: string) => {
            onRevert?.(showRevertConfirm, reason);
            setShowRevertConfirm(null);
            toast.success(`Reverted to Version ${showRevertConfirm}`, {
              description: 'The return now reads as that version recorded it.',
              position: 'top-right',
            });
          }}
        />
      )}
    </div>
  );
}
