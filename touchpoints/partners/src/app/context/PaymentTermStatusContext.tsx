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
 */
export type PaymentTermStatus = "active" | "inactive" | "archived";

export function isPresetTerm(id: string): boolean {
  // System presets are pt-1, pt-2, … pt-N. Custom user-created terms
  // are pt-custom-1, pt-custom-2, … so a "-custom-" infix flips the
  // term out of preset territory.
  return id.startsWith("pt-") && !id.includes("-custom-");
}

interface PaymentTermStatusContextType {
  /** Resolve a term's current status. Defaults to "active" for any id
   *  the store hasn't seen yet (matches seed assumption). */
  getStatus: (id: string) => PaymentTermStatus;
  /** Update a term's status. No-op for preset ids — presets cannot be
   *  archived or disabled. */
  setStatus: (id: string, status: PaymentTermStatus) => void;
  /** Convenience: list ids in a particular status (used by the
   *  "Archived" tab on the management page). */
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
    if (isPresetTerm(id)) {
      // Hard guard: preset templates can't be archived or disabled.
      return;
    }
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

export function usePaymentTermStatus() {
  const ctx = useContext(PaymentTermStatusContext);
  if (!ctx) throw new Error("usePaymentTermStatus must be used within a PaymentTermStatusProvider");
  return ctx;
}
