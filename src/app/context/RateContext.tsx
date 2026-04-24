import React, { createContext, useContext, useMemo } from "react";
import {
  MARKET_RATES,
  type RateSnapshot,
  type RateType,
  setActiveRateType,
} from "../data/currencyLibrary";

interface RateContextValue {
  rateType: RateType;
  snapshot: RateSnapshot;
}

const RateContext = createContext<RateContextValue | undefined>(undefined);

/**
 * Wraps the Partners module with the active FX snapshot. Rates are always
 * mid-market and refresh automatically each day at 19:30 — no display-time
 * toggle or manual refresh.
 */
export function RateProvider({ children }: { children: React.ReactNode }) {
  // Mirror the selection synchronously so descendants' convertToBase calls
  // during this render read the correct snapshot.
  setActiveRateType("market");

  const value = useMemo<RateContextValue>(
    () => ({ rateType: "market", snapshot: MARKET_RATES }),
    [],
  );

  return <RateContext.Provider value={value}>{children}</RateContext.Provider>;
}

export function useRateContext(): RateContextValue {
  const ctx = useContext(RateContext);
  if (!ctx) {
    return { rateType: "market", snapshot: MARKET_RATES };
  }
  return ctx;
}
