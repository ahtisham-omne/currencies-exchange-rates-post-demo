import React, { createContext, useCallback, useContext, useState } from "react";

/**
 * Runtime status of a Payment Term template.
 *  - active   → available for selection on new partners.
 *  - inactive → user disabled it. Existing partners keep using it; new
 *               partners can't pick it. Restorable via "Enable".
 *  - archived → soft-deleted. Hidden from active lists; existing
 *               partners keep using it; can be restored from the
 *               archived section.
 *
 * Preset (system) templates can never be archived or disabled. The
 * provider treats any preset id passed to setStatus as a no-op so a
 * stray callsite can't accidentally disable a system preset.
 *
 * Adapted for the PO Detail page: `usePaymentTermStatus` returns
 * sensible defaults if no Provider is mounted (everything "active",
 * setStatus is a no-op) so the Browse Templates modal works as a
 * drop-in without needing app-level wiring.
 */
export type PaymentTermStatus = "active" | "inactive" | "archived";

export function isPresetTerm(id: string): boolean {
  return id.startsWith("pt-") && !id.includes("-custom-");
}

interface PaymentTermStatusContextType {
  getStatus: (id: string) => PaymentTermStatus;
  setStatus: (id: string, status: PaymentTermStatus) => void;
  idsByStatus: (status: PaymentTermStatus) => string[];
}

const PaymentTermStatusContext = createContext<PaymentTermStatusContextType | undefined>(undefined);

export function PaymentTermStatusProvider({ children }: { children: React.ReactNode }) {
  const [statusMap, setStatusMap] = useState<Record<string, PaymentTermStatus>>({});

  const getStatus = useCallback(
    (id: string): PaymentTermStatus => statusMap[id] ?? "active",
    [statusMap],
  );

  const setStatus = useCallback((id: string, status: PaymentTermStatus) => {
    if (isPresetTerm(id)) return;
    setStatusMap((prev) => ({ ...prev, [id]: status }));
  }, []);

  const idsByStatus = useCallback(
    (status: PaymentTermStatus) =>
      Object.entries(statusMap)
        .filter(([, s]) => s === status)
        .map(([id]) => id),
    [statusMap],
  );

  return (
    <PaymentTermStatusContext.Provider value={{ getStatus, setStatus, idsByStatus }}>
      {children}
    </PaymentTermStatusContext.Provider>
  );
}

const DEFAULT_CTX: PaymentTermStatusContextType = {
  getStatus: () => "active",
  setStatus: () => {},
  idsByStatus: () => [],
};

export function usePaymentTermStatus() {
  return useContext(PaymentTermStatusContext) ?? DEFAULT_CTX;
}
