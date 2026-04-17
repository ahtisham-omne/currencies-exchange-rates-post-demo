import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
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

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencies, setCurrencies] = useState<Currency[]>(() =>
    [...SEED_CURRENCIES].sort((a, b) => a.code.localeCompare(b.code))
  );

  const getCurrency = useCallback(
    (code: string) => currencies.find((c) => c.code === code),
    [currencies]
  );

  const addAuditEntry = (code: string, entry: AuditLogEntry) => {
    setCurrencies((prev) =>
      prev.map((c) =>
        c.code === code ? { ...c, auditLog: [entry, ...c.auditLog] } : c
      )
    );
  };

  const activateCurrency = useCallback((code: string, by = "Ahtisham Ahmad") => {
    const now = new Date().toISOString();
    setCurrencies((prev) =>
      prev.map((c) =>
        c.code === code ? { ...c, status: "active" } : c
      )
    );
    addAuditEntry(code, { dateTime: now, action: "Activated", changedBy: by, reason: "Manually activated" });
  }, []);

  const deactivateCurrency = useCallback((code: string, by = "Ahtisham Ahmad", reason = "Manually deactivated") => {
    const now = new Date().toISOString();
    setCurrencies((prev) =>
      prev.map((c) =>
        c.code === code ? { ...c, status: "inactive" } : c
      )
    );
    addAuditEntry(code, { dateTime: now, action: "Deactivated", changedBy: by, reason });
  }, []);

  const bulkActivate = useCallback((codes: string[]) => {
    let activated = 0;
    let alreadyActive = 0;
    setCurrencies((prev) =>
      prev.map((c) => {
        if (codes.includes(c.code)) {
          if (c.status === "inactive") {
            activated++;
            return { ...c, status: "active" };
          } else {
            alreadyActive++;
          }
        }
        return c;
      })
    );
    const now = new Date().toISOString();
    codes.forEach((code) => {
      addAuditEntry(code, { dateTime: now, action: "Activated", changedBy: "Ahtisham Ahmad", reason: "Bulk activation" });
    });
    return { activated, alreadyActive };
  }, []);

  const bulkDeactivate = useCallback((codes: string[]) => {
    let deactivated = 0;
    let skippedBase = 0;
    const skippedOpenDocs: string[] = [];

    // Pre-check which currencies have open documents
    const currMap = new Map(currencies.map(c => [c.code, c]));

    setCurrencies((prev) =>
      prev.map((c) => {
        if (codes.includes(c.code)) {
          if (c.isBaseCurrency) {
            skippedBase++;
            return c;
          }
          if (hasOpenDocuments(c)) {
            skippedOpenDocs.push(c.code);
            return c;
          }
          if (c.status === "active") {
            deactivated++;
            return { ...c, status: "inactive" };
          }
        }
        return c;
      })
    );
    const now = new Date().toISOString();
    codes.forEach((code) => {
      const cur = currMap.get(code);
      if (cur && !cur.isBaseCurrency && !hasOpenDocuments(cur) && cur.status === "active") {
        addAuditEntry(code, { dateTime: now, action: "Deactivated", changedBy: "Ahtisham Ahmad", reason: "Bulk deactivation" });
      }
    });
    return { deactivated, skippedBase, skippedOpenDocs };
  }, [currencies]);

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
