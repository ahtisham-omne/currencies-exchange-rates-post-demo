import { isBaseCurrency } from "@/app/currency/currencies";
import type { RateType } from "@/app/currency/rates";
import { crossRate, roundTo, type QuoteFx } from "@/app/currency/qFx";

/** A choice made in Quote Summary's Currency and Exchange rate fields. */
export interface QuoteCurrencyChoice {
  currency: string;
  rateType: RateType;
  exchangeRate: number;
  rateEdited?: boolean;
}

/** The currency fields a quote carries (types/quote.ts). */
export interface QuoteCurrencyFields {
  currency: string;
  exchangeRate: number;
  rateType: RateType;
  rateDate: string;
  rateEdited: boolean;
}

/**
 * The fields a quote moves to (spec 4.3), and the factor its amounts
 * convert by: another currency converts every price, freight charge and
 * fixed adjustment at the cross rate between the two rates. A rate change
 * alone converts nothing; it only changes what the quote is worth in base.
 */
export function withQuoteCurrency(before: QuoteFx, next: QuoteCurrencyChoice): { fields: QuoteCurrencyFields; factor: number } {
  const code = next.currency.toUpperCase();
  const rate = isBaseCurrency(code) ? 1 : next.exchangeRate;
  const fields: QuoteCurrencyFields = {
    currency: code,
    exchangeRate: rate,
    rateType: next.rateType,
    rateDate: before.rateDate,
    rateEdited: next.rateType === "corporate" && !!next.rateEdited,
  };
  return { fields, factor: code === before.currency ? 1 : crossRate(before.rate, rate) };
}

type ScalableLine = {
  quantity?: number;
  unitPrice: number;
  subtotal?: number;
  total?: number;
  shipmentConfig?: { shipmentCost?: number; [k: string]: unknown };
  oneTimeAdjustments?: { amountType: "$" | "%"; amount: number }[];
};

/** A line with its prices in another currency, `factor` per unit of the
 *  old one, rounded to the new currency's minor unit. The subtotal stays
 *  quantity × unit price, as the items table keeps it. */
export function scaleQuoteLine<T extends ScalableLine>(line: T, factor: number, code: string): T {
  if (factor === 1) return line;
  const conv = (n: number) => roundTo(code, n * factor);
  const unitPrice = conv(line.unitPrice);
  return {
    ...line,
    unitPrice,
    ...(typeof line.subtotal === "number" && {
      subtotal: typeof line.quantity === "number" ? line.quantity * unitPrice : conv(line.subtotal),
    }),
    ...(typeof line.total === "number" && { total: conv(line.total) }),
    ...(line.shipmentConfig && typeof line.shipmentConfig.shipmentCost === "number" && {
      shipmentConfig: { ...line.shipmentConfig, shipmentCost: conv(line.shipmentConfig.shipmentCost) },
    }),
    ...(line.oneTimeAdjustments && { oneTimeAdjustments: scaleAdjustments(line.oneTimeAdjustments, factor, code) }),
  };
}

/** Fixed ($) one-time adjustments in another currency; % ones stay as they are. */
export function scaleAdjustments<T extends { amountType: "$" | "%"; amount: number }>(list: T[], factor: number, code: string): T[] {
  if (factor === 1) return list;
  return list.map((a) => (a.amountType === "$" ? { ...a, amount: roundTo(code, a.amount * factor) } : a));
}
