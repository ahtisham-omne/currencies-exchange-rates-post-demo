import { BASE_CURRENCY, isBaseCurrency } from "./currencies";
import { formatMoney, moneyPrefix } from "./money";
import { toBaseNow } from "./partnerCurrency";

/* ── Partner amounts in base or partner currency ──────────────────────
 * Props for <CurrencyAmount> (components/currency) wherever a partner's
 * amount is shown: the listing's money columns and the profile's
 * dashboard, which can show it in the base currency (the default) or in
 * the partner's own. */

/** One currency a partner trades in: how many transactions, and their total in that currency. */
export interface CurrencyStream {
  code: string;
  txCount: number;
  amount: number;
}

export type CurrencyView = "base" | "partner";

export interface PartnerAmountProps {
  value: number;
  currency: string;
  mode: "single" | "listing-base" | "listing-partner" | "partner-rolled-up";
  partnerCurrency?: string;
  partnerValue?: number;
  rollupBreakdown?: CurrencyStream[];
}

/**
 * A partner's amount (kept in its currency) as shown in `view`:
 *  - base: converted to the base currency; the hover gives the partner-currency amount.
 *  - partner: as is; the hover gives the base equivalent, or, for a partner
 *    trading in several currencies (`streams`), what each one adds up to.
 * A partner in the base currency shows a plain amount either way.
 */
export function partnerAmount(
  value: number,
  partnerCurrency: string,
  view: CurrencyView,
  streams?: CurrencyStream[],
): PartnerAmountProps {
  if (isBaseCurrency(partnerCurrency)) return { value, currency: BASE_CURRENCY, mode: "single" };
  if (view === "base") {
    return {
      value: toBaseNow(value, partnerCurrency),
      currency: BASE_CURRENCY,
      mode: "listing-base",
      partnerCurrency,
      partnerValue: value,
    };
  }
  if ((streams?.length ?? 0) > 1) return { value, currency: partnerCurrency, mode: "partner-rolled-up", rollupBreakdown: streams };
  return { value, currency: partnerCurrency, mode: "listing-partner" };
}

/** An amount with its code after it, unless it already starts with the code:
 *  "$12,400.00 USD", "₨3,453,648.00 PKR", but "MXN 1,200.00". */
export function formatMoneyWithCode(value: number, code: string): string {
  const upper = code.toUpperCase();
  const text = formatMoney(value, upper);
  return moneyPrefix(upper).trim() === upper ? text : `${text} ${upper}`;
}

/** Short chart-axis labels in a currency: "$35K", "¥1.2M", "MXN 900". */
export function shortAxisFormatter(code: string): (value: number) => string {
  const prefix = moneyPrefix(code);
  return (value: number) => {
    const abs = Math.abs(value);
    const sign = value < 0 ? "−" : "";
    if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}${prefix}${Math.round(abs / 1e3)}K`;
    return `${sign}${prefix}${Math.round(abs)}`;
  };
}

/** How many partners use each currency, for the base-currency KPIs' hover. */
export function currencyBreakdown(codes: string[]): { code: string; partnerCount: number }[] {
  const counts = new Map<string, number>();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  return Array.from(counts, ([code, partnerCount]) => ({ code, partnerCount }));
}
