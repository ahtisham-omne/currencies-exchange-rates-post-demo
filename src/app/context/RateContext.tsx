import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  MARKET_RATES,
  type RateSnapshot,
  type RateType,
  rateSnapshotFor,
  setActiveRateType,
} from "../data/currencyLibrary";

interface RateContextValue {
  rateType: RateType;
  setRateType: (type: RateType) => void;
  snapshot: RateSnapshot;
  /** Bump the snapshot's `lastSyncAt` to "now" (display-only refresh). */
  refresh: () => void;
}

const RateContext = createContext<RateContextValue | undefined>(undefined);

/**
 * Vendor Invoicing FX provider. Pinned to mid-market — vendor invoices must
 * be recorded at the mid-market rate on invoice date (accounting rule).
 * `setRateType` is exposed for parity with the shared library but VI screens
 * never expose a corporate toggle.
 */
export function RateProvider({ children }: { children: React.ReactNode }) {
  const [rateType, setRateTypeState] = useState<RateType>("market");
  const [lastSyncOverride, setLastSyncOverride] = useState<string | null>(null);

  setActiveRateType(rateType);

  const snapshot = useMemo<RateSnapshot>(() => {
    const base = rateSnapshotFor(rateType);
    if (!lastSyncOverride) return base;
    return { ...base, lastSyncAt: lastSyncOverride };
  }, [rateType, lastSyncOverride]);

  const setRateType = useCallback((type: RateType) => {
    setRateTypeState(type);
    setActiveRateType(type);
    setLastSyncOverride(null);
  }, []);

  const refresh = useCallback(() => {
    setLastSyncOverride(new Date().toISOString());
  }, []);

  const value = useMemo<RateContextValue>(() => ({ rateType, setRateType, snapshot, refresh }), [
    rateType,
    setRateType,
    snapshot,
    refresh,
  ]);

  return <RateContext.Provider value={value}>{children}</RateContext.Provider>;
}

export function useRateContext(): RateContextValue {
  const ctx = useContext(RateContext);
  if (!ctx) {
    return {
      rateType: "market",
      setRateType: () => {},
      snapshot: MARKET_RATES,
      refresh: () => {},
    };
  }
  return ctx;
}
