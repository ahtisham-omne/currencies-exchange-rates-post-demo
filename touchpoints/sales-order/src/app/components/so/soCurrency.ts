import type { SalesOrder } from "./types";
import { isBaseCurrency } from "@/app/currency/currencies";
import type { RateType } from "@/app/currency/rates";
import { crossRate, roundTo, soFx } from "@/app/currency/soFx";

/** A choice made in Order Summary's Currency and Exchange rate fields. */
export interface SOCurrencyChoice {
  currency: string;
  rateType: RateType;
  exchangeRate: number;
  rateEdited?: boolean;
}

/**
 * The fields to update when an order moves to `next` (spec 4.3): another
 * currency converts every price and freight charge at the cross rate
 * between the two rates; documents already raised keep their currency. A
 * rate change alone converts nothing; it only changes what the order is
 * worth in base. Flat one-time adjustments live on the SO page and are
 * converted there with `factor`.
 */
export function withSOCurrency(so: SalesOrder, next: SOCurrencyChoice): { updates: Partial<SalesOrder>; factor: number } {
  const before = soFx(so);
  const code = next.currency.toUpperCase();
  const rate = isBaseCurrency(code) ? 1 : next.exchangeRate;
  const rateFields = {
    currency: code,
    exchangeRate: rate,
    rateType: next.rateType,
    rateDate: before.rateDate,
    rateEdited: next.rateType === "corporate" && !!next.rateEdited,
  };
  if (code === before.currency) return { updates: rateFields, factor: 1 };
  const factor = crossRate(before.rate, rate);
  const convert = (n: number) => roundTo(code, n * factor);
  return {
    factor,
    updates: {
      ...rateFields,
      ...(typeof so.freightCost === "number" && { freightCost: convert(so.freightCost) }),
      lines: so.lines.map((l) => ({
        ...l,
        unitPrice: convert(l.unitPrice),
        ...(typeof l.shipmentCost === "number" && { shipmentCost: convert(l.shipmentCost) }),
      })),
      linkedTransactions: so.linkedTransactions.map((t) => (t.currency ? t : { ...t, currency: before.currency })),
    },
  };
}
