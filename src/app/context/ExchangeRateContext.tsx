import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  SEED_MID_MARKET_RATES,
  SEED_STANDARD_RATES,
  type MidMarketRate,
  type StandardRate,
} from "../data/exchangeRates";

interface ExchangeRateContextValue {
  midMarketRates: MidMarketRate[];
  standardRates: StandardRate[];
  addStandardRate: (rate: Omit<StandardRate, "id" | "createdAt" | "updatedAt" | "isStale">) => void;
  updateStandardRate: (id: string, updates: Partial<StandardRate>) => void;
  deleteStandardRate: (id: string) => void;
}

const ExchangeRateContext = createContext<ExchangeRateContextValue | null>(null);

export function ExchangeRateProvider({ children }: { children: ReactNode }) {
  const [midMarketRates] = useState<MidMarketRate[]>([...SEED_MID_MARKET_RATES]);
  const [standardRates, setStandardRates] = useState<StandardRate[]>([...SEED_STANDARD_RATES]);

  const addStandardRate = useCallback((rate: Omit<StandardRate, "id" | "createdAt" | "updatedAt" | "isStale">) => {
    const now = new Date().toISOString();
    const newRate: StandardRate = {
      ...rate,
      id: `std-${rate.sourceCurrency.toLowerCase()}-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      isStale: false,
    };
    setStandardRates(prev => [...prev, newRate]);
  }, []);

  const updateStandardRate = useCallback((id: string, updates: Partial<StandardRate>) => {
    setStandardRates(prev =>
      prev.map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)
    );
  }, []);

  const deleteStandardRate = useCallback((id: string) => {
    setStandardRates(prev => prev.filter(r => r.id !== id));
  }, []);

  return (
    <ExchangeRateContext.Provider value={{ midMarketRates, standardRates, addStandardRate, updateStandardRate, deleteStandardRate }}>
      {children}
    </ExchangeRateContext.Provider>
  );
}

export function useExchangeRates() {
  const ctx = useContext(ExchangeRateContext);
  if (!ctx) throw new Error("useExchangeRates must be used within ExchangeRateProvider");
  return ctx;
}
