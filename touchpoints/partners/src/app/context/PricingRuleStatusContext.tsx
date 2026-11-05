import React, { createContext, useCallback, useContext, useState } from "react";

/**
 * Mirror of PaymentTermStatusContext for Pricing Rules.
 * Same lifecycle (active / inactive / archived) and same preset
 * guard — system rules can never be archived or disabled.
 */
export type PricingRuleStatus = "active" | "inactive" | "archived";

export function isPresetRule(id: string): boolean {
  // System presets are pr-1, pr-2, … pr-N. Custom user-created rules
  // are pr-custom-1, pr-custom-2, … so a "-custom-" infix flips the
  // rule out of preset territory.
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

export function usePricingRuleStatus() {
  const ctx = useContext(PricingRuleStatusContext);
  if (!ctx) throw new Error("usePricingRuleStatus must be used within a PricingRuleStatusProvider");
  return ctx;
}
