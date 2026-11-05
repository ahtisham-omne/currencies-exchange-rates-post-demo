/* ═══════════════════════════════════════════════════════════════
   PLANNER SNAPSHOTS DROPDOWN
   ───────────────────────────────────────────────────────────────
   Compact dropdown that mirrors the Auto: button pattern. Lists
   every snapshot the buyer has taken for the active item, most
   recent first. Two modes:
     · Default — click a row to open that snapshot. No checkboxes
       visible; the row is a single click target.
     · Compare — buyer clicks "Compare" in the header, checkboxes
       appear on every row, they pick 2+ and click "Compare (N)".
       Exit via "Cancel".

   Copy is deliberately minimal per buyer feedback 2026-07-14 with
   a short explainer sentence under the header so the feature reads
   itself.
   ═══════════════════════════════════════════════════════════════ */

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, GitCompare, Camera, CheckCircle2 } from "lucide-react";
import {
  removeSnapshot,
  type PlannerSnapshot,
} from "./plannerSnapshotStore";

function fmtWhen(ms: number): string {
  const now = Date.now();
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = new Date(ms);
  const day = d.getDate();
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  return `${mon} ${day}`;
}

export function PlannerSnapshotsDrawer({
  trigger,
  snapshots,
  itemCode,
  loadedSnapshotId,
  onOpenSnapshot,
  onCompare,
}: {
  trigger: React.ReactNode;
  snapshots: PlannerSnapshot[];
  itemCode: string | null;
  loadedSnapshotId: string | null;
  onOpenSnapshot: (snap: PlannerSnapshot) => void;
  onCompare: (snaps: PlannerSnapshot[]) => void;
}) {
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  const togglePicked = (id: string) => {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setPickedIds(new Set());
  };

  const pickedList = snapshots.filter((s) => pickedIds.has(s.id));

  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(o) => {
        setMenuOpen(o);
        if (!o) exitCompareMode();
      }}
    >
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[340px] p-0 max-h-[calc(100vh-120px)] overflow-hidden rounded-lg flex flex-col shadow-lg"
      >
        {/* Header */}
        <div className="px-3 pt-2.5 pb-2 border-b border-slate-200/70">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className="text-[10px] font-bold uppercase tracking-wide text-slate-500"
              style={{ letterSpacing: "0.06em" }}
            >
              Snapshots
            </p>
            <div className="flex items-center gap-2">
              {snapshots.length > 0 && (
                <span className="text-[10px] text-slate-400 tabular-nums">{snapshots.length}</span>
              )}
              {snapshots.length >= 2 && !compareMode && (
                <button
                  type="button"
                  onClick={() => setCompareMode(true)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-semibold text-blue-700 transition-colors hover:bg-blue-50"
                >
                  <GitCompare className="h-3 w-3" />
                  Compare
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-[10.5px] leading-snug text-slate-500">
            Save what-if plans and compare them side by side. Click a snapshot below to load it.
          </p>
        </div>

        {/* Compare-mode action bar */}
        {compareMode && (
          <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/70 px-3 py-1.5 text-[11px] text-blue-900">
            <span>
              <span className="font-semibold">{pickedIds.size}</span> selected
              {pickedIds.size < 2 && (
                <span className="text-blue-700/70"> · pick at least 2</span>
              )}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={exitCompareMode}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pickedIds.size < 2}
                onClick={() => {
                  onCompare(pickedList);
                  exitCompareMode();
                  setMenuOpen(false);
                }}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Compare {pickedIds.size > 0 ? `(${pickedIds.size})` : ""}
              </button>
            </div>
          </div>
        )}

        {/* Snapshot list */}
        <div className="flex-1 overflow-y-auto py-1">
          {snapshots.length === 0 && (
            <div className="px-3 py-6 text-center">
              <Camera className="mx-auto h-6 w-6 text-slate-300" />
              <div className="mt-1.5 text-[11.5px] text-slate-500">No snapshots yet.</div>
            </div>
          )}
          {snapshots.map((snap) => {
            const picked = pickedIds.has(snap.id);
            const loaded = loadedSnapshotId === snap.id;
            return (
              <div
                key={snap.id}
                className={`group relative mx-1 my-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                  picked
                    ? "bg-blue-50 ring-1 ring-blue-200"
                    : loaded
                      ? "bg-emerald-50/70 ring-1 ring-emerald-200"
                      : compareMode
                        ? "hover:bg-slate-50"
                        : "cursor-pointer hover:bg-slate-50"
                }`}
                onClick={() => {
                  if (compareMode) {
                    togglePicked(snap.id);
                  } else {
                    onOpenSnapshot(snap);
                    setMenuOpen(false);
                  }
                }}
              >
                {loaded && !compareMode && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-emerald-500"
                  />
                )}
                {/* Compare mode reveals a checkbox on every row. In
                    default mode the row IS the click target — no
                    checkbox, no hover chrome. */}
                {compareMode && (
                  <input
                    type="checkbox"
                    checked={picked}
                    onChange={() => togglePicked(snap.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    aria-label={`Select ${snap.name} for compare`}
                  />
                )}
                <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    <span
                      className={`block text-[12px] font-medium truncate ${
                        loaded && !compareMode ? "text-emerald-900" : "text-slate-800"
                      }`}
                    >
                      {snap.name}
                    </span>
                    {loaded && !compareMode && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wide text-emerald-700">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Currently open
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-slate-500">
                    {fmtWhen(snap.createdAt)}
                  </span>
                </div>
                {!compareMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (itemCode) removeSnapshot(itemCode, snap.id);
                    }}
                    title="Delete snapshot"
                    aria-label="Delete snapshot"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
