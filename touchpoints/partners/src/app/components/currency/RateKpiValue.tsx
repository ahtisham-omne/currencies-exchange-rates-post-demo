import * as React from "react";
import { CORPORATE_RATE_EFFECTIVE, MID_RATE_UPDATED } from "@/app/currency/partnerCurrency";

/**
 * The value of the Mid-market Rate and Corporate Rate insights, as the Sales
 * Order touchpoint shows them: the rate type's colour (purple mid-market,
 * amber corporate) and when its rates were last updated.
 */
export function RateKpiValue({ rateType }: { rateType: "mid" | "corporate" }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: rateType === "mid" ? "#7c3aed" : "#d97706" }} />
      <span>{rateType === "mid" ? MID_RATE_UPDATED : CORPORATE_RATE_EFFECTIVE}</span>
    </span>
  );
}
