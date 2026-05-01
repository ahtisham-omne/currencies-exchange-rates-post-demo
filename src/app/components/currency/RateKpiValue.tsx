import * as React from "react";
import { type RateType } from "@/app/data/currencyLibrary";
import { useRateContext } from "@/app/context/RateContext";

export function RateKpiValue({ rateType }: { rateType: RateType }) {
  useRateContext();
  const hex = rateType === "market" ? "#7c3aed" : "#d97706";
  const label = rateType === "market"
    ? "Updated as of 30th April at 19:30 pm"
    : "Updated as of 23rd April at 12:00 pm";
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
