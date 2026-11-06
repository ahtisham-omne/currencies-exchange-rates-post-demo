// Shim — replicates Partner Management's PricingRuleStatusContext so the
// verbatim modal copies can call usePricingRuleStatus() without a provider
// tree. The fallback hook returns an in-memory status map so the modal can
// render and mutate locally. Safe to delete when the canonical context is
// wired into this module.
import React, { createContext, useCallback, useContext, useRef, useState } from "react";

export type PricingRuleStatus = "active" | "inactive" | "archived";

export function isPresetRule(id: string): boolean {
  return id.startsWith("pr-") && !id.includes("-custom-");
}

interface PricingRuleStatusContextType {
  getStatus: (id: string) => PricingRuleStatus;
  setStatus: (id: string, status: PricingRuleStatus) => void;
  idsByStatus: (status: PricingRuleStatus) => string[];
}

const PricingRuleStatusContext = createContext<PricingRuleStatusContextType | undefined>(undefined);

export function PricingRuleStatusProvider({ children }: { children: React.ReactNode }) {
  const [statusMap, setStatusMap] = useState<Record<string, PricingRuleStatus>>({});

  const getStatus = useCallback(
    (id: string): PricingRuleStatus => statusMap[id] ?? "active",
    [statusMap],
  );

  const setStatus = useCallback((id: string, status: PricingRuleStatus) => {
    if (isPresetRule(id)) return;
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  }, []);

  const idsByStatus = useCallback(
    (status: PricingRuleStatus) =>
      Object.entries(statusMap)
        .filter(([, s]) => s === status)
        .map(([id]) => id),
    [statusMap],
  );

  return (
    <PricingRuleStatusContext.Provider value={{ getStatus, setStatus, idsByStatus }}>
      {children}
    </PricingRuleStatusContext.Provider>
  );
}

const fallbackStore: Record<string, PricingRuleStatus> = {};

export function usePricingRuleStatus(): PricingRuleStatusContextType {
  const ctx = useContext(PricingRuleStatusContext);
  const localRef = useRef(fallbackStore);
  const [, setTick] = useState(0);
  if (ctx) return ctx;
  return {
    getStatus: (id: string) => localRef.current[id] ?? "active",
    setStatus: (id: string, status: PricingRuleStatus) => {
      if (isPresetRule(id)) return;
      localRef.current[id] = status;
      setTick((t) => t + 1);
    },
    idsByStatus: (status: PricingRuleStatus) =>
      Object.entries(localRef.current).filter(([, s]) => s === status).map(([id]) => id),
  };
}
