import { useState, useMemo } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { FONT } from "./designTokens";
import type { POVersionEntry } from "./poStore";
import {
  versionPalette as C,
  currencyShiftVersions,
  useDocFx,
} from "./poVersionDisplay";
import {
  filterPOVersions,
  type POVersionFilterState,
} from "./poVersionFilters";
import POVersionsToolbar from "./POVersionsToolbar";
import POVersionRow from "./POVersionRow";
import POVersionSnapshotPanel from "./POVersionSnapshotPanel";
import POVersionChangeList from "./POVersionChangeList";
import POVersionRevertModal from "./POVersionRevertModal";
import POCompareFullScreen from "./POCompareFullScreen";

/**
 * PO version-history tab shell.
 *
 * Was a 774-LOC file that owned the whole UI inline. Refactored 2026-07-10
 * to be a thin composer: this file now owns just the state (search /
 * expanded / compare / revert) and the top-level layout. Everything below
 * lives in its own file:
 *   · `poVersionDisplay.ts`       — palette + config + formatters
 *   · `POVersionsToolbar`         — search + compare toggle + action bar
 *   · `POVersionRow`              — clickable version header
 *   · `POVersionSnapshotPanel`    — expanded body's line-items table
 *   · `POVersionChangeList`       — expanded body's changes list
 *   · `POVersionRevertModal`      — revert confirmation modal
 *
 * Default export + prop shape are unchanged so `PurchaseOrderDraft` (the
 * lone consumer) doesn't need to be touched.
 */

interface POVersionHistoryTabProps {
  poNumber: string;
  versions: POVersionEntry[];
  /** Which version is currently in force (drives the "Current" pill and
      hides the Revert action on the current version's row). */
  currentVersion: number;
  onRevert: (version: number, reason: string) => void;
  /** False once receiving has started — the PO is locked to its
      current version, so Revert is hidden on every row. */
  canRevert?: boolean;
}

export default function POVersionHistoryTab({
  versions,
  currentVersion,
  onRevert,
  canRevert = true,
}: POVersionHistoryTabProps) {
  /* Toolbar filter state — mirrors SO's `VersionFilterState` (see
     poVersionFilters.ts). Search + quick filter live together so the
     child toolbar stays purely presentational. Advanced status/creator
     filters are wired but the popover trigger will land in a follow-up. */
  const [filterState, setFilterState] = useState<POVersionFilterState>({
    search: "",
    changeFilter: "all",
    creator: "all",
    status: "any",
  });
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(
    new Set([versions[0]?.version ?? 1]),
  );
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelections, setCompareSelections] = useState<number[]>([]);
  const [showRevertConfirm, setShowRevertConfirm] = useState<number | null>(null);
  /* Inline compare view — mirrors SO's `VersionHistoryTab` (buyer
     2026-07-28: "improve version tab same as sales orders").
     Set when the buyer clicks the "Compare V{a} → V{b}" CTA in the
     toolbar's compare action bar; renders `POCompareFullScreen` below
     the version list so the diff is visible alongside the two picked
     rows. Cleared by the compare view's own close button or by
     leaving compare mode. */
  const [inlineCompare, setInlineCompare] = useState<{
    v1: POVersionEntry;
    v2: POVersionEntry;
  } | null>(null);

  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );

  /* The PO's current currency (PO page) and the versions whose currency
     differs from a neighbour's — their rows mark the currency. */
  const docFx = useDocFx();
  const currencyShifts = useMemo(
    () => currencyShiftVersions(sorted, docFx),
    [sorted, docFx],
  );

  /* Distinct creators for the advanced popover's Created-by list. Stable
     order (insertion order — most-recent version's author first). */
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
      if (prev.length >= 2) return [prev[1], v];
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

  /* Filter — delegated to the pure `filterPOVersions` helper so the same
     logic can be reused by the future listing-side history modal. */
  const filteredVersions = useMemo(
    () => filterPOVersions(sorted, filterState),
    [sorted, filterState],
  );

  return (
    <div
      style={{
        fontFamily: FONT,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Outer card chrome — matches the Partners-aligned LineItemsPanel
          card (`rounded-xl border border-border bg-card`). */}
      <div
        className="bg-white rounded-xl border overflow-hidden w-full"
        style={{ borderColor: C.border, maxWidth: "100%" }}
      >
        <POVersionsToolbar
          filterState={filterState}
          onFilterChange={(patch) =>
            setFilterState((prev) => ({ ...prev, ...patch }))
          }
          creators={distinctCreators}
          compareMode={compareMode}
          onToggleCompareMode={handleToggleCompareMode}
          compareSelectionCount={compareSelections.length}
          onStartComparison={handleStartComparison}
          minCompareVersion={
            compareSelections.length === 2
              ? Math.min(...compareSelections)
              : undefined
          }
          maxCompareVersion={
            compareSelections.length === 2
              ? Math.max(...compareSelections)
              : undefined
          }
        />

        {/* ── Version list ── */}
        <div className="w-full overflow-hidden" style={{ maxWidth: "100%" }}>
          {filteredVersions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <Package
                style={{ width: 32, height: 32, color: C.text400 }}
                strokeWidth={1.75}
              />
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: C.text700,
                  fontFamily: FONT,
                }}
              >
                No matching changes found
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: C.text500,
                  fontFamily: FONT,
                }}
              >
                Try clearing your search to see all versions.
              </div>
            </div>
          ) : (
            filteredVersions.map((ver, vidx) => {
              const isExpanded = expandedVersions.has(ver.version);
              const isCompareSelected = compareSelections.includes(ver.version);
              const isCurrent = ver.version === currentVersion;
              return (
                <div
                  key={ver.version}
                  className="overflow-hidden"
                  style={{ maxWidth: "100%" }}
                >
                  {vidx > 0 && (
                    <div style={{ height: 1, backgroundColor: C.border }} />
                  )}
                  <POVersionRow
                    version={ver}
                    isExpanded={isExpanded}
                    isCurrent={isCurrent}
                    compareMode={compareMode}
                    isCompareSelected={isCompareSelected}
                    onClick={() =>
                      compareMode
                        ? handleCompareSelect(ver.version)
                        : toggleExpanded(ver.version)
                    }
                    onRevertClick={canRevert ? () => setShowRevertConfirm(ver.version) : undefined}
                    showCurrency={currencyShifts.has(ver.version)}
                  />
                  {isExpanded && !compareMode && (
                    <div
                      className="overflow-hidden min-w-0"
                      style={{
                        padding: "0 16px 16px 60px",
                        maxWidth: "100%",
                      }}
                    >
                      <POVersionSnapshotPanel version={ver} />
                      <POVersionChangeList
                        changes={ver.changes}
                        versionNumber={ver.version}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Inline Compare view — SO parity. Sits directly below the
          list card so the buyer keeps the two picked rows in view
          while inspecting the diff. Closing it clears the local state;
          the compare-mode + selections stay so the buyer can pick a
          different pair without reopening. ── */}
      {inlineCompare && (
        <div style={{ marginTop: 12 }}>
          <POCompareFullScreen
            v1={inlineCompare.v1}
            v2={inlineCompare.v2}
            onClose={() => setInlineCompare(null)}
          />
        </div>
      )}

      {/* ── Revert Confirm Modal ── */}
      {showRevertConfirm !== null && (
        <POVersionRevertModal
          version={showRevertConfirm}
          snapshot={sorted.find((v) => v.version === showRevertConfirm)?.snapshot}
          onClose={() => setShowRevertConfirm(null)}
          onConfirm={(reason: string) => {
            onRevert(showRevertConfirm, reason);
            setShowRevertConfirm(null);
            toast.success(`Reverted to Version ${showRevertConfirm}`, {
              description: "Created as a new version in the history.",
              position: "top-right",
            });
          }}
        />
      )}
    </div>
  );
}
