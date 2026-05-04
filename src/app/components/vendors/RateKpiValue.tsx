import * as React from "react";
import { type RateType } from "@/app/data/currencyLibrary";
import { useRateContext } from "@/app/context/RateContext";

export const RATE_UPDATED_LABEL: Record<RateType, string> = {
  market: "Updated as of 30th April at 19:30 pm",
  corporate: "Updated as of 23rd April at 12:00 pm",
};

/**
 * KPI value cell for the Mid-market / Corporate rate insights. Mirrors the
 * Sales Order module — colored dot (purple = market, amber = corporate) plus
 * the static "Updated as of …" sync timestamp.
 */
export function RateKpiValue({ rateType }: { rateType: RateType }) {
  // Subscribe so the cell re-renders if the surrounding rate provider changes.
  useRateContext();
  const hex = rateType === "market" ? "#7c3aed" : "#d97706";
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: hex }}
      />
      <span>{RATE_UPDATED_LABEL[rateType]}</span>
    </span>
  );
}
