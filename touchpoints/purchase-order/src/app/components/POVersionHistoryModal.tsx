import { useState, useEffect, useMemo } from "react";
import {
  Check,
  Clock,
  User,
  X,
  RotateCcw,
  GitCompare,
  Package,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { FONT } from "./designTokens";
import { Dialog, DialogContent } from "./ui/dialog";
import {
  getPO,
  getPOVersions,
  revertPOToVersion,
  type POVersionEntry,
} from "./poStore";
import {
  versionStatusConfig,
  versionPalette as C,
  currencyShiftVersions,
  formatCurrency,
  formatSignedCurrency,
  versionCompareFields,
  versionFx,
} from "./poVersionDisplay";
import POVersionSnapshotPanel from "./POVersionSnapshotPanel";
import POVersionChangeList from "./POVersionChangeList";
import POVersionRevertModal from "./POVersionRevertModal";
import { snapshotOneTimeNet } from "./poOrderPricing";
import { getCurrency } from "@/app/currency/currencies";
import { poFx, type PoFx } from "@/app/currency/poFx";
import { CurrencyFlag } from "./currency/CurrencyChip";
import { Money } from "./currency/Money";

/* ── Lifecycle pill — matches Sales Orders V5 vocabulary + chrome.
   Latest / Last Approved / Superseded / Revert. Rounded-full, tinted
   bg + border, sits on the same visual row as the status pill so the
   two chips read as a set. */
type LifecycleTone = "latest" | "approved" | "superseded" | "viewing";
const LIFECYCLE_TONES: Record<LifecycleTone, { bg: string; color: string; border: string }> = {
  latest:     { bg: "#EFF6FF", color: "#1E40AF", border: "#93C5FD" },
  approved:   { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" },
  superseded: { bg: "#F8FAFC", color: "#64748B", border: "#E2E8F0" },
  viewing:    { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
};
function LifecyclePill({ label, tone }: { label: string; tone: LifecycleTone }) {
  const t = LIFECYCLE_TONES[tone];
  return (
    <span
      className="inline-flex items-center justify-center gap-1 whitespace-nowrap shrink-0 rounded-full"
      style={{
        padding: "2px 10px",
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.4,
        backgroundColor: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        fontFamily: FONT,
      }}
    >
      {label}
    </span>
  );
}

/* Circular version badge — 36px node that sits on the timeline
   connector in the left rail. Status-tinted (emerald for current,
   emerald for confirmed, blue for sent, amber for partial, grey for
   draft) so buyers can scan the timeline by lifecycle at a glance. */
function VersionBadge({
  version,
  isCurrent,
  versionStatus,
}: {
  version: number;
  isCurrent: boolean;
  versionStatus: POVersionEntry["versionStatus"];
}) {
  let bg = "#F9FAFB", color = "#9CA3AF", border = "#E5E7EB";
  if (isCurrent) {
    bg = "#D1FAE5"; color = "#065F46"; border = "#86EFAC";
  } else if (versionStatus === "confirmed") {
    bg = "#ECFDF5"; color = "#065F46"; border = "#A7F3D0";
  } else if (versionStatus === "sent") {
    bg = "#DBEAFE"; color = "#1E40AF"; border = "#93C5FD";
  } else if (versionStatus === "partially-received") {
    bg = "#FEF3C7"; color = "#92400E"; border = "#FDE68A";
  }
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        backgroundColor: bg,
        color,
        border: `2px solid ${border}`,
        fontFamily: FONT,
      }}
    >
      v{version}
    </div>
  );
}

/**
 * Listing-side version-history modal.
 *
 * Opens from the V{n} chip in `PODataTable.tsx` (see
 * `PurchaseOrdersListing.tsx` for the wire-up). Mirrors SO's
 * `pages/quotes-list/components/version-history/QuoteVersionHistoryModal.tsx`
 * shape: left timeline + right detail. Detail panel reuses the extracted
 * `POVersionSnapshotPanel` + `POVersionChangeList` so the visual language
 * matches the detail-page Versions tab exactly.
 *
 * Data comes directly from `poStore.getPOVersions(poId)` — the PO app is
 * synchronous, so no query cache / mock-api layer is needed.
 */
interface POVersionHistoryModalProps {
  /** PO id whose history to show. `null` keeps the modal closed. */
  poId: string | null;
  /** Called to close the modal (V-chip parent clears state). */
  onClose: () => void;
  /** Displayed in the header — e.g. "PO-1234". */
  poNumber?: string;
  /** When set, seeds the timeline selection to this version on open
      (buyer 2026-07-22 — opening from the Duplicate PO dialog's
      "View details" affordance preselects whichever version the
      picker is currently on). */
  initialSelectedVersion?: number;
  /** When provided, the detail pane renders a "Use this version"
      button and the "Revert to V{n}" action is hidden — the modal
      is running in duplicate-source-picker mode. Clicking fires
      with the currently-selected version's number so the caller can
      sync the Duplicate PO dialog's picker. */
  onSelectForDuplicate?: (version: number) => void;
}

export default function POVersionHistoryModal({
  poId,
  onClose,
  poNumber,
  initialSelectedVersion,
  onSelectForDuplicate,
}: POVersionHistoryModalProps) {
  const open = poId !== null;
  const [versions, setVersions] = useState<POVersionEntry[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [revertTarget, setRevertTarget] = useState<number | null>(null);
  /* Compare mode — mirrors SO's VersionHistoryModal. `compareMode`
     toggles the whole right pane between the single-version detail
     view and the side-by-side CompareView. `compareVersions` is a
     two-slot tuple (A, B). Clicking a version card cycles the slots
     the same way SO does: fills A first, then B, then rotates B when
     both are filled and a new card is clicked. */
  const [compareMode, setCompareMode] = useState(false);
  const [compareVersions, setCompareVersions] = useState<
    [number | null, number | null]
  >([null, null]);

  /* Load versions from the store whenever the target PO changes.
     poStore uses an in-memory Map so this is a synchronous read. When the
     modal is closed we reset state so the next open lands fresh. */
  useEffect(() => {
    if (!open || !poId) {
      setVersions([]);
      setCurrentVersion(null);
      setSelectedVersion(null);
      setRevertTarget(null);
      setCompareMode(false);
      setCompareVersions([null, null]);
      return;
    }
    const vs = getPOVersions(poId);
    setVersions(vs);
    setCurrentVersion(getPO(poId)?.currentVersion ?? null);
    /* When opened from the Duplicate PO dialog, honor the caller's
       preferred initial version so the timeline opens on whatever
       the picker currently has. Falls through to the default
       (latest) via the sort effect below if unset or missing. */
    if (
      initialSelectedVersion != null &&
      vs.some((v) => v.version === initialSelectedVersion)
    ) {
      setSelectedVersion(initialSelectedVersion);
    }
  }, [open, poId, initialSelectedVersion]);

  /* Newest → oldest, matching the detail-page Versions tab and SO's
     timeline order. */
  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );
  const latestVersionNum = sorted[0]?.version ?? 1;

  /* The PO's currency now — the fallback for snapshots that recorded
     none (there is no DocCurrency when this opens from the listing).
     Re-read with `versions` so a revert's restored currency shows. */
  const poCurrentFx = useMemo(() => {
    const po = poId && versions.length > 0 ? getPO(poId) : undefined;
    return po ? poFx(po) : null;
  }, [poId, versions]);
  /* Versions whose currency differs from a neighbour's: their timeline
     cards mark the currency. */
  const currencyShifts = useMemo(
    () => currencyShiftVersions(sorted, poCurrentFx),
    [sorted, poCurrentFx],
  );

  /* Default selection = the latest (top of the timeline). Restored whenever
     the versions list changes so an outside data refresh doesn't blank the
     right pane. */
  useEffect(() => {
    if (sorted.length === 0) {
      setSelectedVersion(null);
      return;
    }
    setSelectedVersion((prev) =>
      prev != null && sorted.some((v) => v.version === prev)
        ? prev
        : latestVersionNum,
    );
  }, [sorted, latestVersionNum]);

  const selected =
    selectedVersion != null
      ? sorted.find((v) => v.version === selectedVersion) ?? null
      : null;
  const nextVersion = latestVersionNum + 1;
  void nextVersion;

  /* Version-card click handler — cycles the A/B slots when compareMode
     is on (rotate-B pattern from SO). Falls back to setSelectedVersion
     when compareMode is off. Also syncs `selectedVersion` so the right
     pane tracks the most-recently-clicked version while the buyer is
     still filling the second compare slot (buyer 2026-07-28: "we are
     not hiding the right side we need to show version and the compare"). */
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

  /* When both compare slots are filled, the right pane switches to
     the side-by-side CompareView and the modal widens to fit the two
     tables (matches SO's 1340px compare-wide layout). */
  const isCompareWide =
    compareMode && compareVersions[0] !== null && compareVersions[1] !== null;
  const compareV1 =
    isCompareWide && compareVersions[0] !== null
      ? sorted.find(
          (v) =>
            v.version === Math.min(compareVersions[0]!, compareVersions[1]!),
        ) ?? null
      : null;
  const compareV2 =
    isCompareWide && compareVersions[1] !== null
      ? sorted.find(
          (v) =>
            v.version === Math.max(compareVersions[0]!, compareVersions[1]!),
        ) ?? null
      : null;

  const handleRevertConfirm = (reason: string) => {
    if (!poId || revertTarget == null) return;
    const restored = revertPOToVersion(poId, revertTarget, reason);
    if (restored) {
      /* poStore mutates in place; re-read to refresh the timeline. */
      setVersions(getPOVersions(poId));
      setCurrentVersion(getPO(poId)?.currentVersion ?? restored);
      setSelectedVersion(restored);
      toast.success(`Reverted to V${revertTarget}`, {
        description: `V${revertTarget} is now the current version.`,
        position: "top-right",
      });
    } else {
      toast.error(`Revert failed`, { position: "top-right" });
    }
    setRevertTarget(null);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        {/* `[&>button]:hidden` suppresses shadcn DialogContent's built-in
            X close button (line 68 of ui/dialog.tsx) so our header-owned
            close button doesn't collide with a duplicate in the corner.
            Same trick the transactions drawer uses. */}
        <DialogContent
          className="p-0 gap-0 overflow-hidden bg-white [&>button]:hidden"
          style={{
            maxWidth: isCompareWide ? "1340px" : "1100px",
            width: `min(95vw, ${isCompareWide ? "1340px" : "1100px"})`,
            height: "min(85vh, 720px)",
            fontFamily: FONT,
            transition: "max-width 300ms cubic-bezier(0.32,0.72,0,1), width 300ms cubic-bezier(0.32,0.72,0,1)",
          }}
        >
            {/* Header — icon tile + title + close button (Dialog primitive's
                built-in X is hidden via [&>button]:hidden pattern; we render
                our own for consistency with the extracted revert modal). */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b shrink-0"
              style={{ borderColor: C.border }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex items-center justify-center rounded-lg shrink-0"
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: "hsl(var(--primary-tint))",
                  }}
                >
                  <Clock
                    style={{
                      width: 18,
                      height: 18,
                      color: "hsl(var(--primary))",
                    }}
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: C.text900,
                      lineHeight: 1.3,
                      fontFamily: FONT,
                    }}
                  >
                    Version History{poNumber ? ` — ${poNumber}` : ""}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: C.text500,
                      lineHeight: 1.4,
                      fontFamily: FONT,
                    }}
                  >
                    Versions are created when sent · Current = latest confirmed
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Version count — matches SO's "N versions" chip. */}
                <span
                  className="text-sm tabular-nums hidden sm:inline"
                  style={{ fontWeight: 500, fontFamily: FONT }}
                >
                  <span style={{ color: C.text900 }}>{sorted.length}</span>
                  <span style={{ color: C.text500, opacity: 0.7 }}>
                    {" "}
                    {sorted.length === 1 ? "version" : "versions"}
                  </span>
                </span>
                {/* Compare button — hidden when the PO has one version.
                    Green tint when off, blue when on (SO parity). Not
                    shown in duplicate-source-picker mode either — the
                    buyer's flow there is single-select. */}
                {sorted.length > 1 && !onSelectForDuplicate && (() => {
                  const tint = compareMode
                    ? { bg: "#EFF6FF", hoverBg: "#DBEAFE", border: "#BFDBFE", color: "#1E40AF" }
                    : { bg: "#ECFDF5", hoverBg: "#D1FAE5", border: "#A7F3D0", color: "#065F46" };
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (compareMode) setCompareVersions([null, null]);
                        setCompareMode(!compareMode);
                      }}
                      className="inline-flex items-center gap-1.5 h-8 rounded-lg border transition-colors cursor-pointer"
                      style={{
                        padding: "0 12px",
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: FONT,
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
                        {compareMode ? "Exit Compare" : "Compare Versions"}
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
                    border: "none",
                    backgroundColor: "transparent",
                    color: C.text500,
                  }}
                >
                  <X style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>

            {/* Body — left timeline (28%) + right detail (72%). Ported
                from Sales Orders V5's VersionHistoryModal. */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* ── Timeline rail ── */}
              <div
                className="shrink-0 overflow-y-auto flex flex-col"
                style={{
                  width: "28%",
                  minWidth: 260,
                  borderRight: `1px solid #E5E7EB`,
                  backgroundColor: "#FAFBFC",
                }}
              >
                {/* Compare-mode banner — surfaces the two-slot picker
                    state so the buyer knows how many more clicks are
                    left. Mirrors SO's blue "Compare Mode" strip. */}
                {compareMode && (
                  <div
                    style={{
                      padding: "10px 16px",
                      flexShrink: 0,
                      backgroundColor: "#EFF6FF",
                      borderBottom: "1px solid #BFDBFE",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: FONT,
                    }}
                  >
                    <GitCompare
                      style={{ width: 14, height: 14, color: "#1B6EF3", flexShrink: 0 }}
                    />
                    <div>
                      <div
                        style={{ fontSize: 12, fontWeight: 600, color: "#1E40AF", lineHeight: 1.3 }}
                      >
                        Compare Mode
                      </div>
                      <div
                        style={{ fontSize: 11, color: "#3B82F6", lineHeight: 1.3, marginTop: 1 }}
                      >
                        {compareVersions[0] === null
                          ? "Select 2 versions to compare"
                          : compareVersions[1] === null
                            ? "1 selected — pick one more"
                            : "2 versions selected"}
                      </div>
                    </div>
                  </div>
                )}
                {sorted.length === 0 ? (
                  <div
                    className="flex items-center justify-center py-14 px-4 text-center"
                    style={{ fontSize: 12, color: C.text500, fontFamily: FONT }}
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
                            ? "A"
                            : "B"
                          : null;
                      const displayDate = new Date(v.createdAt).toLocaleDateString("en-US", {
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                      });
                      return (
                        <div
                          key={v.version}
                          style={{ position: "relative", paddingBottom: isLast ? 0 : 10 }}
                        >
                          {/* Timeline connector — hidden in compare mode
                              because the checkbox column replaces the
                              node-on-a-line pattern. */}
                          {!isLast && !compareMode && (
                            <div
                              style={{
                                position: "absolute",
                                left: 17,
                                top: 38,
                                bottom: 0,
                                width: 2,
                                backgroundColor: "#E2E8F0",
                                zIndex: 0,
                              }}
                            />
                          )}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 12,
                              position: "relative",
                              zIndex: 1,
                            }}
                          >
                            {/* Compare-mode checkbox column — 28px wide,
                                18px checkbox with the A/B label rendered
                                inside when the card is picked. A short
                                connector line runs below each checkbox
                                except on the last card to keep the rail
                                feel. Mirrors SO's implementation. */}
                            {compareMode && (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
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
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginTop: 14,
                                    border: "none",
                                    background: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                  aria-label={`Toggle version ${v.version} for compare`}
                                >
                                  <div
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 4,
                                      border: isSelected ? "none" : "2px solid #D1D5DB",
                                      backgroundColor: isSelected ? "#1B6EF3" : "#FFFFFF",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      transition: "all 150ms",
                                      boxShadow: isSelected
                                        ? "0 1px 3px rgba(27,110,243,0.3)"
                                        : "none",
                                    }}
                                  >
                                    {isSelected && (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 700,
                                          color: "#FFFFFF",
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
                                      backgroundColor: "#E5E7EB",
                                      marginTop: 4,
                                      minHeight: 8,
                                    }}
                                  />
                                )}
                              </div>
                            )}
                            {/* Timeline rail (non-compare mode) — version
                                badge sits ON the connector line so it
                                reads as a node on a timeline. */}
                            {!compareMode && (
                              <div
                                style={{
                                  flexShrink: 0,
                                  width: 36,
                                  display: "flex",
                                  justifyContent: "center",
                                  position: "relative",
                                  zIndex: 2,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleVersionClick(v.version)}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    padding: 0,
                                    cursor: "pointer",
                                  }}
                                  aria-label={`Open version ${v.version}`}
                                >
                                  <VersionBadge
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
                                padding: "10px 12px",
                                borderRadius: 8,
                                border: "none",
                                backgroundColor: isSelected
                                  ? compareMode
                                    ? "#EFF6FF"
                                    : "#F0F7FF"
                                  : "#FFFFFF",
                                outline: isSelected
                                  ? compareMode
                                    ? "2px solid #60A5FA"
                                    : "2px solid #93C5FD"
                                  : "1px solid #E5E7EB",
                                fontFamily: FONT,
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected)
                                  e.currentTarget.style.backgroundColor = "#F9FAFB";
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected)
                                  e.currentTarget.style.backgroundColor = "#FFFFFF";
                              }}
                            >
                              {/* Card body wrapper — in compare mode, an
                                  extra flex row hosts the version badge
                                  on the left of the copy. Non-compare
                                  mode keeps the copy full-width because
                                  the badge lives in the timeline rail. */}
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                                {compareMode && (
                                  <div style={{ flexShrink: 0 }}>
                                    <VersionBadge
                                      version={v.version}
                                      isCurrent={isCurrent}
                                      versionStatus={v.versionStatus}
                                    />
                                  </div>
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Title row — "Version {n}". A/B label is
                                  rendered inside the checkbox column
                                  above; no inline chip. */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
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
                                {/* Currency chip — only where the currency
                                    changed between versions. */}
                                {currencyShifts.has(v.version) && (() => {
                                  const code = versionFx(v.snapshot, poCurrentFx).currency;
                                  return (
                                    <span
                                      className="inline-flex items-center rounded-md"
                                      title={`In ${getCurrency(code)?.name ?? code}`}
                                      style={{
                                        gap: 4,
                                        padding: "1px 6px",
                                        backgroundColor: C.divider,
                                        color: C.text600,
                                        fontSize: 10,
                                        fontWeight: 600,
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      <CurrencyFlag code={code} size={10} />
                                      {code}
                                    </span>
                                  );
                                })()}
                              </div>

                              {/* Lifecycle pill row — only "Current Version"
                                  now (buyer 2026-07-28: "we only need to
                                  show current version nothing else").
                                  Superseded + Revert pills dropped
                                  because the card layout was already
                                  cramped and the Current pill alone
                                  answers "which one is live". */}
                              {isCurrent && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    marginBottom: 6,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <LifecyclePill label="Current Version" tone="latest" />
                                </div>
                              )}

                              {/* Creator + date rows — small, muted, icon + text. */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
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
                                  display: "flex",
                                  alignItems: "center",
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

              {/* ── Detail pane — reuses the extracted single-version
                  panels for the line-items + changes body, but the
                  header is rewritten to match SO's "Version {n}" + status
                  pill + lifecycle pill + right-side actions. */}
              <div className="flex-1 min-w-0 overflow-y-auto">
                {compareMode && compareV1 && compareV2 ? (
                  <CompareView v1={compareV1} v2={compareV2} fallbackFx={poCurrentFx} />
                ) : selected ? (() => {
                  const selCfg =
                    versionStatusConfig[selected.versionStatus] ||
                    versionStatusConfig["confirmed"];
                  const SelIcon = selCfg.icon;
                  const isCurrentSel = selected.version === currentVersion;
                  return (
                    <div style={{ padding: "20px 24px" }}>
                      {/* Title bar — SO parity. Version {n} + status pill
                          + lifecycle pills on the left; action buttons on
                          the right. */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          marginBottom: 16,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <h3
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: C.text900,
                              margin: 0,
                              lineHeight: 1,
                              fontFamily: FONT,
                            }}
                          >
                            Version {selected.version}
                          </h3>
                          {/* Status pill — same palette as the version-status
                              config used elsewhere (poVersionDisplay.ts). */}
                          <span
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full"
                            style={{
                              padding: "2px 10px",
                              fontSize: 11,
                              fontWeight: 500,
                              lineHeight: 1.4,
                              backgroundColor: selCfg.bg,
                              color: selCfg.color,
                              border: `1px solid ${selCfg.border}`,
                              fontFamily: FONT,
                            }}
                          >
                            <SelIcon style={{ width: 11, height: 11 }} />
                            {selCfg.label}
                          </span>
                          {/* Lifecycle pill — only Current Version now
                              (buyer 2026-07-28). Same treatment as the
                              left rail. */}
                          {isCurrentSel && <LifecyclePill label="Current Version" tone="latest" />}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* Header action — swap the yellow Revert
                              button for the primary blue "Use for
                              duplicate" button when running in
                              duplicate-source-picker mode. Hidden
                              entirely while compare mode is on since
                              the buyer's flow there is inspection, not
                              action. */}
                          {compareMode ? null : onSelectForDuplicate ? (
                            <button
                              type="button"
                              onClick={() => onSelectForDuplicate(selected.version)}
                              className="inline-flex items-center gap-1.5 h-8 rounded-lg border cursor-pointer shadow-sm transition-colors"
                              style={{
                                padding: "0 12px",
                                fontSize: 13,
                                fontWeight: 600,
                                fontFamily: FONT,
                                lineHeight: 1,
                                color: "#FFFFFF",
                                backgroundColor: "#0A77FF",
                                borderColor: "#0A77FF",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#0866DE";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#0A77FF";
                              }}
                            >
                              <Check style={{ width: 12, height: 12 }} strokeWidth={3} />
                              Use V{selected.version} for duplicate
                            </button>
                          ) : !isCurrentSel ? (
                            <button
                              type="button"
                              onClick={() => setRevertTarget(selected.version)}
                              className="inline-flex items-center gap-1.5 h-8 rounded-lg border cursor-pointer transition-colors"
                              style={{
                                padding: "0 12px",
                                fontSize: 13,
                                fontWeight: 600,
                                fontFamily: FONT,
                                lineHeight: 1,
                                color: "#374151",
                                backgroundColor: "#FFFFFF",
                                borderColor: "#E5E7EB",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#F9FAFB";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#FFFFFF";
                              }}
                            >
                              <RotateCcw style={{ width: 12, height: 12 }} />
                              Revert to this version
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Reason line — surfaced as a Notes-style tinted
                          card when the buyer wrote a reason for this
                          version. Matches SO's blue-tint Notes card. */}
                      {selected.reason && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid #BFDBFE",
                            backgroundColor: "#F0F7FF",
                            marginBottom: 16,
                          }}
                        >
                          <User style={{ width: 14, height: 14, color: "#1E40AF", marginTop: 2 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#1E40AF",
                                marginBottom: 2,
                                lineHeight: 1.2,
                                fontFamily: FONT,
                              }}
                            >
                              Notes
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: C.text700,
                                lineHeight: 1.5,
                                fontFamily: FONT,
                              }}
                            >
                              {selected.reason}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Reuse the extracted panels so styling stays 1:1
                          with the detail-page Versions tab. */}
                      <POVersionSnapshotPanel version={selected} fallbackFx={poCurrentFx} />
                      <POVersionChangeList
                        changes={selected.changes}
                        versionNumber={selected.version}
                      />
                    </div>
                  );
                })() : (
                  <div
                    className="h-full flex items-center justify-center p-6"
                    style={{
                      fontSize: 13,
                      color: C.text500,
                      fontFamily: FONT,
                    }}
                  >
                    Select a version to view its details.
                  </div>
                )}
              </div>
            </div>
        </DialogContent>
      </Dialog>

      {revertTarget !== null && (
        <POVersionRevertModal
          version={revertTarget}
          snapshot={sorted.find((v) => v.version === revertTarget)?.snapshot}
          currentFx={poCurrentFx}
          onClose={() => setRevertTarget(null)}
          onConfirm={handleRevertConfirm}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  CompareView — side-by-side line-item diff between two versions.
 *  Ported from SO's VersionHistoryModal (v1/v2 snapshots → merged
 *  line-item id list → per-row diff status: unchanged / added /
 *  removed / modified). Summary card + line-items table pair rendered
 *  for each side with color-coded diff highlighting.
 * ═══════════════════════════════════════════════════════════════════ */

type CompareDiffStatus = "unchanged" | "added" | "removed" | "modified";
const DIFF_BG: Record<CompareDiffStatus, string> = {
  unchanged: "#FFFFFF",
  added: "#F0FDF4",
  removed: "#FEF2F2",
  modified: "#FFFBEB",
};
const DIFF_BORDER: Record<CompareDiffStatus, string> = {
  unchanged: "#F7F8F9",
  added: "#BBF7D0",
  removed: "#FECACA",
  modified: "#FDE68A",
};

/* Price / Total columns: wide enough for ₨3,453,648.00 or MXN 12,400.00. */
const COMPARE_AMOUNT_W = 76;

function CompareView({
  v1,
  v2,
  fallbackFx,
}: {
  v1: POVersionEntry;
  v2: POVersionEntry;
  /** The PO's current currency, for snapshots that recorded none. */
  fallbackFx: PoFx | null;
}) {
  // Each side's amounts are in its own version's currency.
  const fx1 = versionFx(v1.snapshot, fallbackFx);
  const fx2 = versionFx(v2.snapshot, fallbackFx);
  const v1Map = new Map(v1.snapshot.lineItems.map((li) => [li.id, li]));
  const v2Map = new Map(v2.snapshot.lineItems.map((li) => [li.id, li]));
  const allIds = Array.from(
    new Set([
      ...v1.snapshot.lineItems.map((li) => li.id),
      ...v2.snapshot.lineItems.map((li) => li.id),
    ]),
  );

  const getDiffStatus = (id: string): CompareDiffStatus => {
    const inV1 = v1Map.has(id);
    const inV2 = v2Map.has(id);
    if (inV1 && !inV2) return "removed";
    if (!inV1 && inV2) return "added";
    if (inV1 && inV2) {
      const a = v1Map.get(id)!;
      const b = v2Map.get(id)!;
      if (
        a.quantity !== b.quantity ||
        a.unitPrice !== b.unitPrice ||
        a.lineTotal !== b.lineTotal
      ) {
        return "modified";
      }
    }
    return "unchanged";
  };

  const addedCount = allIds.filter((id) => getDiffStatus(id) === "added").length;
  const removedCount = allIds.filter((id) => getDiffStatus(id) === "removed").length;
  const modifiedCount = allIds.filter((id) => getDiffStatus(id) === "modified").length;

  /* Same rows as the Versions tab's compare, Currency and Exchange rate
     included, so a currency/rate change is highlighted like any field. */
  const summaryFields = versionCompareFields(v1, v2, fx1, fx2);

  const colHeaderStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 500,
    color: "#9CA3AF",
    lineHeight: 1,
  };

  const renderCompareRow = (
    li: (typeof v1.snapshot.lineItems)[number] | null,
    status: CompareDiffStatus,
    code: string,
  ) => {
    if (!li) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            backgroundColor:
              status === "removed" ? "#FEF2F2" : status === "added" ? "#F0FDF4" : "#F9FAFB",
            borderBottom: "1px solid #F3F4F6",
            minHeight: 30,
            opacity: 0.4,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 3,
              flexShrink: 0,
              backgroundColor: "#F3F4F6",
            }}
          />
          <div style={{ flex: 1, fontSize: 10, color: "#D1D5DB", fontStyle: "italic" }}>—</div>
        </div>
      );
    }
    const isChanged = status === "modified";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "4px 8px",
          backgroundColor: DIFF_BG[status],
          borderBottom: `1px solid ${DIFF_BORDER[status]}`,
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 3,
            flexShrink: 0,
            backgroundColor: "#F3F4F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Package style={{ width: 9, height: 9, color: "#6B7280", opacity: 0.6 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 9, fontWeight: 600, color: "#6B7280", lineHeight: 1, marginBottom: 1 }}
          >
            {li.itemNumber}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#374151",
              lineHeight: 1.1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {li.descriptiveName}
          </div>
        </div>
        <span
          style={{
            fontSize: 10,
            color: isChanged ? "#92400E" : "#6B7280",
            fontWeight: isChanged ? 600 : 400,
            width: 24,
            textAlign: "right",
          }}
        >
          {li.quantity}
        </span>
        <span style={{ fontSize: 10, color: "#9CA3AF", width: 32, textAlign: "center" }}>
          {li.vendorUOM}
        </span>
        <span
          style={{
            fontSize: 10,
            color: isChanged ? "#92400E" : "#9CA3AF",
            fontWeight: isChanged ? 500 : 400,
            width: COMPARE_AMOUNT_W,
            textAlign: "right",
          }}
        >
          {formatCurrency(li.unitPrice, code)}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: isChanged ? "#92400E" : "#1F2937",
            width: COMPARE_AMOUNT_W,
            textAlign: "right",
          }}
        >
          {formatCurrency(li.lineTotal, code)}
        </span>
      </div>
    );
  };

  const renderVersionTable = (ver: POVersionEntry, side: "left" | "right") => {
    const itemMap = side === "left" ? v1Map : v2Map;
    const code = (side === "left" ? fx1 : fx2).currency;
    const subtotal = ver.snapshot.subtotal;
    const oppositeSubtotal = side === "left" ? v2.snapshot.subtotal : v1.snapshot.subtotal;
    const subtotalChanged = subtotal !== oppositeSubtotal;
    const totalChanged = v1.snapshot.total !== v2.snapshot.total;

    return (
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 8px",
            backgroundColor: "#F9FAFB",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Package style={{ width: 10, height: 10, color: "#6B7280" }} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              V{ver.version} Line Items
            </span>
            <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>
              ({ver.snapshot.lineItems.length})
            </span>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {ver.versionStatus}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            backgroundColor: "#F7F8F9",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <div style={{ width: 20, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={colHeaderStyle}>Item</span>
          </div>
          <span style={{ ...colHeaderStyle, width: 24, textAlign: "right" }}>Qty</span>
          <span style={{ ...colHeaderStyle, width: 32, textAlign: "center" }}>UOM</span>
          <span style={{ ...colHeaderStyle, width: COMPARE_AMOUNT_W, textAlign: "right" }}>Price</span>
          <span style={{ ...colHeaderStyle, width: COMPARE_AMOUNT_W, textAlign: "right" }}>Total</span>
        </div>
        {allIds.map((id) => {
          const status = getDiffStatus(id);
          const li = itemMap.get(id) || null;
          return <div key={id}>{renderCompareRow(li, status, code)}</div>;
        })}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "3px 8px",
            borderTop: "1px solid #E5E7EB",
            backgroundColor: subtotalChanged && side === "right" ? "#FFFBEB" : "#FFFFFF",
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 500,
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: 0.3,
              marginRight: 6,
            }}
          >
            Subtotal
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: subtotalChanged && side === "right" ? "#92400E" : "#374151",
              minWidth: 64,
              textAlign: "right",
            }}
          >
            {formatCurrency(subtotal, code)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 8px",
            backgroundColor: totalChanged && side === "right" ? "#FFFBEB" : "#F9FAFB",
            borderTop: "1px solid #E5E7EB",
          }}
        >
          <span style={{ fontSize: 9, color: "#6B7280" }}>
            Discount {formatCurrency(ver.snapshot.discountTotal, code)} · One-Time{" "}
            {formatSignedCurrency(snapshotOneTimeNet(ver.snapshot), code)}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 500,
                color: "#6B7280",
                textTransform: "uppercase",
                letterSpacing: 0.3,
              }}
            >
              Total
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: totalChanged && side === "right" ? "#92400E" : "#1F2937",
              }}
            >
              {formatCurrency(ver.snapshot.total, code)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* Header — V{n} → V{n} + diff counts */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <GitCompare style={{ width: 16, height: 16, color: "#1B6EF3" }} />
          <h3
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#1F2937",
              margin: 0,
              fontFamily: FONT,
            }}
          >
            Version {v1.version} → Version {v2.version}
          </h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {addedCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                padding: "2px 6px",
                borderRadius: 4,
                backgroundColor: "#D1FAE5",
                color: "#065F46",
              }}
            >
              +{addedCount} added
            </span>
          )}
          {removedCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                padding: "2px 6px",
                borderRadius: 4,
                backgroundColor: "#FEE2E2",
                color: "#991B1B",
              }}
            >
              {removedCount} removed
            </span>
          )}
          {modifiedCount > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                padding: "2px 6px",
                borderRadius: 4,
                backgroundColor: "#FEF3C7",
                color: "#92400E",
              }}
            >
              {modifiedCount} changed
            </span>
          )}
          {addedCount === 0 && removedCount === 0 && modifiedCount === 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                padding: "2px 6px",
                borderRadius: 4,
                backgroundColor: "#F3F4F6",
                color: "#6B7280",
              }}
            >
              No line-item changes
            </span>
          )}
        </div>
      </div>

      {/* Summary cards — side by side, changed fields highlighted with
          amber left rail + up/down arrow on the right side. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {([v1, v2] as const).map((v, sideIdx) => {
          const side: "left" | "right" = sideIdx === 0 ? "left" : "right";
          return (
            <div
              key={v.version}
              style={{ border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#FAFBFC",
                  borderBottom: "1px solid #E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  V{v.version} · {v.createdAt}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    padding: "2px 6px",
                    borderRadius: 4,
                    backgroundColor: "#EFF6FF",
                    color: "#1E40AF",
                    textTransform: "uppercase",
                  }}
                >
                  {v.versionStatus}
                </span>
              </div>
              {summaryFields.map((f) => {
                const val = side === "left" ? f.val1 : f.val2;
                const sideFx = side === "left" ? fx1 : fx2;
                const changed = f.val1 !== f.val2;
                // Arrows only between numbers in the same unit (see versionCompareFields).
                const n1 = f.n1 ?? NaN;
                const n2 = f.n2 ?? NaN;
                const numeric =
                  changed && Number.isFinite(n1) && Number.isFinite(n2) && n1 !== n2;
                const direction =
                  numeric && side === "right" ? (n2 > n1 ? "up" : "down") : null;
                const isStruck = changed && side === "left" && !numeric;
                return (
                  <div
                    key={f.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "120px minmax(0, 1fr)",
                      padding: "7px 12px",
                      borderBottom: "1px solid #E5E7EB",
                      backgroundColor: changed ? "rgba(245, 158, 11, 0.04)" : "#FFFFFF",
                      borderLeft: changed
                        ? "3px solid #F59E0B"
                        : "3px solid transparent",
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 500, color: "#6B7280" }}>
                      {f.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: side === "right" && changed ? 600 : 500,
                          color:
                            side === "right" && changed
                              ? "#0F172A"
                              : changed
                                ? "#6B7280"
                                : "#1F2937",
                          textDecoration: isStruck ? "line-through" : "none",
                          textDecorationColor: "rgba(107, 114, 128, 0.4)",
                          fontFamily: FONT,
                        }}
                      >
                        {f.kind === "currency" ? (
                          <span
                            className="inline-flex items-center"
                            style={{ gap: 6 }}
                            title={getCurrency(val)?.name}
                          >
                            <CurrencyFlag code={val} size={12} />
                            {val}
                          </span>
                        ) : f.label === "Total" ? (
                          // Hover: the total in the base currency, at this side's rate.
                          <Money value={v.snapshot.total} currency={sideFx.currency} fx={sideFx} dateLabel="PO date">
                            {val}
                          </Money>
                        ) : (
                          val
                        )}
                      </span>
                      {direction === "up" && (
                        <ArrowUp
                          style={{ width: 12, height: 12, color: "#10B981" }}
                          strokeWidth={2.5}
                        />
                      )}
                      {direction === "down" && (
                        <ArrowDown
                          style={{ width: 12, height: 12, color: "#EF4444" }}
                          strokeWidth={2.5}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Side-by-side line-item tables */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {renderVersionTable(v1, "left")}
        {renderVersionTable(v2, "right")}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "8px 12px",
          backgroundColor: "#F9FAFB",
          borderRadius: 6,
          fontFamily: FONT,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 500, color: "#6B7280" }}>Legend:</span>
        <LegendSwatch label="Added" bg="#D1FAE5" border="#BBF7D0" color="#065F46" />
        <LegendSwatch label="Removed" bg="#FEE2E2" border="#FECACA" color="#991B1B" />
        <LegendSwatch label="Changed" bg="#FEF3C7" border="#FDE68A" color="#92400E" />
      </div>
    </div>
  );
}

function LegendSwatch({
  label,
  bg,
  border,
  color,
}: {
  label: string;
  bg: string;
  border: string;
  color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 2,
          backgroundColor: bg,
          border: `1px solid ${border}`,
        }}
      />
      <span style={{ fontSize: 10, color }}>{label}</span>
    </div>
  );
}
