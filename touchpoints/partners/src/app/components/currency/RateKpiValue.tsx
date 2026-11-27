import * as React from "react";
import { CORPORATE_RATES_SET, MID_RATE_UPDATED } from "@/app/currency/partnerCurrency";

/**
 * The value of the Daily Market Rate and Corporate Rate insights, as the
 * Sales Order touchpoint shows them: the rate type's colour (purple daily
 * market rate, amber corporate rate) and when its rates were read or set.
 */
export function RateKpiValue({ rateType }: { rateType: "mid" | "corporate" }) {
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: rateType === "mid" ? "#7C3AED" : "#B45309" }} />
      <span>{rateType === "mid" ? MID_RATE_UPDATED : CORPORATE_RATES_SET}</span>
    </span>
  );
}
