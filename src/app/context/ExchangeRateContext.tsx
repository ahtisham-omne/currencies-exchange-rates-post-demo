import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from "react";
import {
  SEED_MID_MARKET_RATES,
  SEED_STANDARD_RATES,
  SEED_RATE_AUDIT,
  activeStandardRateFor,
  settleStandardRate,
  type MidMarketRate,
  type StandardRate,
  type RateAuditEntry,
  type RateAuditAction,
} from "../data/exchangeRates";
import { todayIso } from "../coa/lib/utils";

/** Who made a change, and why (the reason lands on its audit entry). */
export interface RateChangeMeta {
  by?: string;
  reason?: string;
}

export const DEFAULT_ACTOR = "Ahtisham Ahmad";

interface ExchangeRateContextValue {
  midMarketRates: MidMarketRate[];
  standardRates: StandardRate[];
  /** Every corporate rate change, newest last: Created / Updated / Archived / Restored. */
  rateAudit: RateAuditEntry[];
  /** Adds a corporate rate and logs "Created". Returns the new record. */
  addStandardRate: (rate: Omit<StandardRate, "id" | "createdAt" | "updatedAt" | "isStale">, meta?: RateChangeMeta) => StandardRate;
  /** Updates a corporate rate and logs "Updated" when its rate or effective date moved. */
  updateStandardRate: (id: string, updates: Partial<StandardRate>, meta?: RateChangeMeta) => void;
  /** Saves a new rate for a later date and logs "Scheduled". The current rate
   *  stays in effect until that date; a second schedule replaces the first. */
  scheduleStandardRate: (id: string, next: { standardRate: number; effectiveDate: string; notes: string }, meta?: RateChangeMeta) => void;
  /** Soft delete: archives the rate and logs "Archived". */
  deleteStandardRate: (id: string, meta?: RateChangeMeta) => void;
  /** Archives several rates at once (active ones only). */
  archiveStandardRates: (ids: string[], meta?: RateChangeMeta) => void;
  /** Brings an archived rate back and logs "Restored". */
  restoreStandardRate: (id: string, meta?: RateChangeMeta) => void;
  /** The active corporate rate record for a currency; archived rates are never current. */
  getActiveStandardRate: (code: string) => StandardRate | undefined;
}

const ExchangeRateContext = createContext<ExchangeRateContextValue | null>(null);

interface RateState {
  standardRates: StandardRate[];
  rateAudit: RateAuditEntry[];
}

let auditSeq = 0;
const auditId = () => `audit-${Date.now().toString(36)}-${(auditSeq++).toString(36)}`;

export function ExchangeRateProvider({ children }: { children: ReactNode }) {
  const [midMarketRates] = useState<MidMarketRate[]>([...SEED_MID_MARKET_RATES]);
  const [state, setState] = useState<RateState>(() => ({
    standardRates: [...SEED_STANDARD_RATES],
    rateAudit: [...SEED_RATE_AUDIT],
  }));

  const midFor = useCallback(
    (code: string) => midMarketRates.find(m => m.sourceCurrency === code)?.rate ?? null,
    [midMarketRates],
  );

  const entry = (
    action: RateAuditAction,
    r: StandardRate,
    at: string,
    meta: RateChangeMeta | undefined,
    values: { oldValue: number | null; newValue: number | null; effectiveDate: string | null },
  ): RateAuditEntry => ({
    id: auditId(),
    dateTime: at,
    action,
    user: meta?.by ?? DEFAULT_ACTOR,
    reason: meta?.reason ?? "",
    sourceCurrency: r.sourceCurrency,
    rateId: r.id,
    midRate: midFor(r.sourceCurrency),
    ...values,
  });

  const addStandardRate = useCallback((rate: Omit<StandardRate, "id" | "createdAt" | "updatedAt" | "isStale">, meta?: RateChangeMeta) => {
    const now = new Date().toISOString();
    const newRate: StandardRate = {
      ...rate,
      id: `std-${rate.sourceCurrency.toLowerCase()}-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      updatedBy: meta?.by ?? rate.createdBy,
      isStale: false,
    };
    const log = entry("Created", newRate, now, { by: meta?.by ?? rate.createdBy, reason: meta?.reason ?? rate.notes }, {
      oldValue: null, newValue: newRate.standardRate, effectiveDate: newRate.effectiveDate,
    });
    setState(prev => ({ standardRates: [...prev.standardRates, newRate], rateAudit: [...prev.rateAudit, log] }));
    return newRate;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midFor]);

  const updateStandardRate = useCallback((id: string, updates: Partial<StandardRate>, meta?: RateChangeMeta) => {
    const now = new Date().toISOString();
    setState(prev => {
      const raw = prev.standardRates.find(r => r.id === id);
      if (!raw) return prev;
      // A scheduled rate whose day has come is the current one now.
      const current = settleStandardRate(raw, todayIso());
      const next: StandardRate = { ...current, ...updates, updatedAt: now, updatedBy: meta?.by ?? DEFAULT_ACTOR };
      const moved = next.standardRate !== current.standardRate || next.effectiveDate !== current.effectiveDate;
      const log = moved
        ? [entry("Updated", next, now, { by: meta?.by, reason: meta?.reason ?? updates.notes }, {
            oldValue: current.standardRate, newValue: next.standardRate, effectiveDate: next.effectiveDate,
          })]
        : [];
      return {
        standardRates: prev.standardRates.map(r => (r.id === id ? next : r)),
        rateAudit: [...prev.rateAudit, ...log],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midFor]);

  const scheduleStandardRate = useCallback((id: string, upcoming: { standardRate: number; effectiveDate: string; notes: string }, meta?: RateChangeMeta) => {
    const now = new Date().toISOString();
    setState(prev => {
      const raw = prev.standardRates.find(r => r.id === id);
      if (!raw) return prev;
      const current = settleStandardRate(raw, todayIso());
      const by = meta?.by ?? DEFAULT_ACTOR;
      const next: StandardRate = { ...current, upcoming: { ...upcoming, setBy: by, setAt: now }, updatedAt: now, updatedBy: by };
      const log = entry("Scheduled", next, now, { by, reason: meta?.reason ?? upcoming.notes }, {
        oldValue: current.standardRate, newValue: upcoming.standardRate, effectiveDate: upcoming.effectiveDate,
      });
      return {
        standardRates: prev.standardRates.map(r => (r.id === id ? next : r)),
        rateAudit: [...prev.rateAudit, log],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midFor]);

  const archiveStandardRates = useCallback((ids: string[], meta?: RateChangeMeta) => {
    const now = new Date().toISOString();
    setState(prev => {
      const targets = prev.standardRates.filter(r => ids.includes(r.id) && r.status === "active");
      if (!targets.length) return prev;
      const targetIds = new Set(targets.map(t => t.id));
      return {
        // A rate still waiting for its day goes with the record.
        standardRates: prev.standardRates.map(r => (targetIds.has(r.id) ? { ...settleStandardRate(r, todayIso()), upcoming: undefined, status: "archived" as const, updatedAt: now, updatedBy: meta?.by ?? DEFAULT_ACTOR } : r)),
        rateAudit: [
          ...prev.rateAudit,
          ...targets.map(t => entry("Archived", t, now, meta, { oldValue: t.standardRate, newValue: null, effectiveDate: null })),
        ],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midFor]);

  const deleteStandardRate = useCallback((id: string, meta?: RateChangeMeta) => archiveStandardRates([id], meta), [archiveStandardRates]);

  const restoreStandardRate = useCallback((id: string, meta?: RateChangeMeta) => {
    const now = new Date().toISOString();
    setState(prev => {
      const current = prev.standardRates.find(r => r.id === id);
      if (!current || current.status !== "archived") return prev;
      // Only one active corporate rate per currency.
      if (activeStandardRateFor(current.sourceCurrency, prev.standardRates)) return prev;
      return {
        standardRates: prev.standardRates.map(r => (r.id === id ? { ...r, status: "active" as const, updatedAt: now, updatedBy: meta?.by ?? DEFAULT_ACTOR } : r)),
        rateAudit: [
          ...prev.rateAudit,
          entry("Restored", current, now, meta, { oldValue: null, newValue: current.standardRate, effectiveDate: null }),
        ],
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midFor]);

  // Read as they stand today: a scheduled rate whose day has come is the current one.
  const today = todayIso();
  const standardRates = useMemo(() => state.standardRates.map(r => settleStandardRate(r, today)), [state.standardRates, today]);

  const getActiveStandardRate = useCallback(
    (code: string) => activeStandardRateFor(code, standardRates),
    [standardRates],
  );

  return (
    <ExchangeRateContext.Provider
      value={{
        midMarketRates,
        standardRates,
        rateAudit: state.rateAudit,
        addStandardRate,
        updateStandardRate,
        scheduleStandardRate,
        deleteStandardRate,
        archiveStandardRates,
        restoreStandardRate,
        getActiveStandardRate,
      }}
    >
      {children}
    </ExchangeRateContext.Provider>
  );
}

export function useExchangeRates() {
  const ctx = useContext(ExchangeRateContext);
  if (!ctx) throw new Error("useExchangeRates must be used within ExchangeRateProvider");
  return ctx;
}
