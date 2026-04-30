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
 * KPI value cell for the Market / Corporate rate insights. Shows a colored
 * dot (purple = market, amber = corporate) and a freshness label tuned to the
 * cadence of the underlying rate book — minute-grain for the live market feed,
 * day-grain for the treasury-locked corporate book.
 */
export function RateKpiValue({ rateType }: { rateType: RateType }) {
  // Subscribe so the cell re-renders if the surrounding rate provider changes.
  useRateContext();
  const snap = rateSnapshotFor(rateType);
  const hex = rateType === "market" ? "#7c3aed" : "#d97706";
  let label: string;
  if (rateType === "market") {
    label = relativeTime(snap.lastSyncAt);
  } else {
    const days = daysSince(snap.lastSyncAt);
    label = days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`;
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
