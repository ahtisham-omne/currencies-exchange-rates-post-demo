/* ═══════════════════════════════════════════════════════════════
   PLANNER SNAPSHOT VIEW CHROME
   ───────────────────────────────────────────────────────────────
   Two-part visual treatment that surfaces "you're viewing a saved
   snapshot, not the live plan" everywhere across the workspace:

     · SnapshotBanner        — sticky top strip with the snapshot
                               name, static-can't-edit hint, and the
                               Back / Make active CTAs.
     · SnapshotFrameOverlay  — pointer-events-none border ring +
                               corner tag around the workspace so
                               the treatment is unmissable even when
                               the banner scrolls off small screens.

   Buyer feedback 2026-07-20: "nothing outside the snapshot tells you
   which snapshot you're in." Split into two pieces so the workspace
   can mount the banner inside its flex column and the frame overlay
   independently at whatever layer clips cleanly.
   ═══════════════════════════════════════════════════════════════ */

import { Camera, ChevronLeft, RotateCcw } from "lucide-react";
import { FONT } from "./designTokens";

/** Format a snapshot's createdAt as "Jul 15" — mirrors the drawer's
 *  short-date treatment. Kept local because the chrome is the only
 *  surface that needs this exact shape. */
function fmtShortDate(ms: number): string {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(ms);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export interface SnapshotBannerProps {
  snapshotName: string;
  createdAt: number;
  onBack: () => void;
  onMakeActive: () => void;
}

/** Snapshot header strip. Compact single-row treatment (buyer
 *  feedback 2026-07-20 revision: "header is way too much, try
 *  something like we don't need to push the height of the graph")
 *  — one row, tiny icon, name + static hint on one line, ghost
 *  action buttons on the right. Mounted inside the graph panel
 *  above the chart. */
export function SnapshotBanner({
  snapshotName,
  createdAt,
  onBack,
  onMakeActive,
}: SnapshotBannerProps) {
  return (
    <div
      className="relative z-30 flex items-center justify-between gap-2 rounded-md px-2.5 py-1 shadow-sm"
      style={{
        fontFamily: FONT,
        background:
          "linear-gradient(90deg, #1F2937 0%, #334155 60%, #1F2937 100%)",
        color: "#F1F5F9",
      }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Camera className="size-3 shrink-0 text-slate-200" />
        <span className="truncate text-[11px] font-semibold 2xl:text-[11.5px]">
          Snapshot: {snapshotName}
        </span>
        <span className="text-slate-500">·</span>
        <span className="hidden text-[10.5px] text-slate-300 sm:inline 2xl:text-[11px]">
          {fmtShortDate(createdAt)} · static, read-only
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-6 items-center gap-0.5 rounded px-1.5 text-[10.5px] font-medium text-slate-100 transition-colors hover:bg-slate-700/60 2xl:text-[11px]"
        >
          <ChevronLeft className="size-3" />
          Back
        </button>
        <button
          type="button"
          onClick={onMakeActive}
          className="inline-flex h-6 items-center gap-0.5 rounded bg-emerald-500 px-2 text-[10.5px] font-semibold text-white transition-colors hover:bg-emerald-600 2xl:text-[11px]"
        >
          <RotateCcw className="size-3" />
          Make active
        </button>
      </div>
    </div>
  );
}

/** Photo-frame overlay scoped to whichever panel it's mounted inside
 *  (buyer feedback 2026-07-20: "only on the graph area, not the
 *  entire screen"). Uses `absolute inset-0` — its parent must be
 *  `position: relative`. Pointer-events-none so every mutation lock
 *  is the child component's responsibility, not this frame's. */
export function SnapshotFrameOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      style={{ fontFamily: FONT }}
      aria-hidden
    >
      {/* Dashed slate border — buyer feedback 2026-07-20 revision:
          "need the dashed line instead of the clear." Rounded to
          match the panel corners; pointer-events-none from the
          parent so the graph underneath still receives hover /
          scroll (mutation locks are handled by PlannerGapGraph's
          viewOnly prop). */}
      <div
        className="absolute inset-0 rounded-[10px] border-2 border-dashed"
        style={{ borderColor: "#64748B" }}
      />
    </div>
  );
}
