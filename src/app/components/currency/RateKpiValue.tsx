import * as React from "react";
import { rateSnapshotFor, type RateType } from "@/app/data/currencyLibrary";
import { useRateContext } from "@/app/context/RateContext";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round(diffMs / 1000));
  if (diffSec < 45) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

/** Whole-day count since `iso`, floored. 0 = today. */
function daysSince(iso: string): number {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

/**
 * Standard KPI value cell for a rate type. Shows a colored dot (purple = market,
 * amber = corporate) plus a freshness label tuned to the cadence of the book —
 *   • market    → relative time (live feed, minute-grain)
 *   • corporate → "N days ago"  (treasury-locked, day-grain)
 * The full source / sync metadata lives in the KPI's tooltip.
 */
export function RateKpiValue({ rateType }: { rateType: RateType }) {
  // Subscribe so the cell updates when the live snapshot's `lastSyncAt` is
  // bumped via the refresh action.
  useRateContext();
  const snap = rateSnapshotFor(rateType);
  const hex = rateType === "market" ? "#7c3aed" : "#d97706";
  let label: string;
  if (rateType === "market") {
    label = `Updated ${relativeTime(snap.lastSyncAt)}`;
  } else {
    const days = daysSince(snap.lastSyncAt);
    const phrase = days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`;
    label = `Updated ${phrase}`;
  }
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: hex }}
      />
      <span>{label}</span>
    </span>
  );
}
