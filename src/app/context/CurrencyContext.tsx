import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { SEED_CURRENCIES, type Currency, type AuditLogEntry, hasOpenDocuments } from "../data/currencies";

interface CurrencyContextType {
  currencies: Currency[];
  getCurrency: (code: string) => Currency | undefined;
  activateCurrency: (code: string, by?: string) => void;
  deactivateCurrency: (code: string, by?: string, reason?: string) => void;
  bulkActivate: (codes: string[]) => { activated: number; alreadyActive: number };
  bulkDeactivate: (codes: string[]) => { deactivated: number; skippedBase: number; skippedOpenDocs: string[] };
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const ACTOR = "Ahtisham Ahmad";

/** A status change and its audit entry, written together. Only a currency whose
 *  status actually changes is touched, so the audit log never records a change
 *  that did not happen. */
function withStatus(c: Currency, status: Currency["status"], entry: AuditLogEntry): Currency {
  if (c.status === status) return c;
  return { ...c, status, auditLog: [entry, ...c.auditLog] };
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencies, setCurrencies] = useState<Currency[]>(() =>
    [...SEED_CURRENCIES].sort((a, b) => a.code.localeCompare(b.code))
  );
  // The latest list, so the bulk actions decide what changes from what is on
  // screen and report counts computed outside the state updater.
  const latest = useRef(currencies);
  latest.current = currencies;

  const getCurrency = useCallback(
    (code: string) => currencies.find((c) => c.code === code),
    [currencies]
  );

  const setStatus = (codes: Set<string>, status: Currency["status"], entry: AuditLogEntry) => {
    if (!codes.size) return;
    setCurrencies((prev) => prev.map((c) => (codes.has(c.code) ? withStatus(c, status, entry) : c)));
  };

  const activateCurrency = useCallback((code: string, by = ACTOR) => {
    const cur = latest.current.find((c) => c.code === code);
    if (!cur || cur.status === "active") return;
    setStatus(new Set([code]), "active", { dateTime: new Date().toISOString(), action: "Activated", changedBy: by, reason: "Manually activated" });
  }, []);

  const deactivateCurrency = useCallback((code: string, by = ACTOR, reason = "Manually deactivated") => {
    const cur = latest.current.find((c) => c.code === code);
    if (!cur || cur.status === "inactive") return;
    setStatus(new Set([code]), "inactive", { dateTime: new Date().toISOString(), action: "Deactivated", changedBy: by, reason });
  }, []);

  const bulkActivate = useCallback((codes: string[]) => {
    const picked = latest.current.filter((c) => codes.includes(c.code));
    const toActivate = picked.filter((c) => c.status === "inactive");
    setStatus(new Set(toActivate.map((c) => c.code)), "active", {
      dateTime: new Date().toISOString(), action: "Activated", changedBy: ACTOR, reason: "Bulk activation",
    });
    return { activated: toActivate.length, alreadyActive: picked.length - toActivate.length };
  }, []);

  const bulkDeactivate = useCallback((codes: string[]) => {
    const picked = latest.current.filter((c) => codes.includes(c.code));
    const skippedBase = picked.filter((c) => c.isBaseCurrency).length;
    const skippedOpenDocs = picked.filter((c) => !c.isBaseCurrency && hasOpenDocuments(c)).map((c) => c.code);
    const toDeactivate = picked.filter((c) => !c.isBaseCurrency && !hasOpenDocuments(c) && c.status === "active");
    setStatus(new Set(toDeactivate.map((c) => c.code)), "inactive", {
      dateTime: new Date().toISOString(), action: "Deactivated", changedBy: ACTOR, reason: "Bulk deactivation",
    });
    return { deactivated: toDeactivate.length, skippedBase, skippedOpenDocs };
  }, []);

  return (
    <CurrencyContext.Provider value={{ currencies, getCurrency, activateCurrency, deactivateCurrency, bulkActivate, bulkDeactivate }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencies() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrencies must be used within CurrencyProvider");
  return ctx;
}
