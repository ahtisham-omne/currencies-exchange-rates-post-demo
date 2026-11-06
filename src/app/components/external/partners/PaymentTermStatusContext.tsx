// Shim — replicates Partner Management's PaymentTermStatusContext so the
// verbatim modal copies can call usePaymentTermStatus() without a provider
// tree. The fallback hook returns an in-memory status map so the modal can
// render and mutate locally. Safe to delete when the canonical context is
// wired into this module.
import React, { createContext, useCallback, useContext, useRef, useState } from "react";

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

// Module-scoped fallback store keyed off the absence of a provider so
// repeated calls within the same render tree share state.
const fallbackStore: Record<string, PaymentTermStatus> = {};

export function usePaymentTermStatus(): PaymentTermStatusContextType {
  const ctx = useContext(PaymentTermStatusContext);
  const localRef = useRef(fallbackStore);
  const [, setTick] = useState(0);
  if (ctx) return ctx;
  return {
    getStatus: (id: string) => localRef.current[id] ?? "active",
    setStatus: (id: string, status: PaymentTermStatus) => {
      if (isPresetTerm(id)) return;
      localRef.current[id] = status;
      setTick((t) => t + 1);
    },
    idsByStatus: (status: PaymentTermStatus) =>
      Object.entries(localRef.current).filter(([, s]) => s === status).map(([id]) => id),
  };
}
