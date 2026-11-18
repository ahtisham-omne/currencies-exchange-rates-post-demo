import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatCompactMoney, formatMoney } from '@/app/currency/money';
import { roundTo, toBaseToday, todayFx, vendorCurrency } from '@/app/currency/poFx';
import { convertListPrice } from '@/app/components/catalogData';
import { Money } from './Money';
import { CurrencyFlag } from './CurrencyChip';

/* ── Procurement Planning's prices (audit p. 10) ───────────────────────
 * The planner keeps every vendor price in USD, its working currency: the
 * solver ranks, splits and totals in it, and the cart and the PO convert from
 * it (`priceCurrency: "USD"`). What the buyer sees is each vendor's price in
 * the vendor's own currency, restated at the last synced mid-market rate the
 * way the cart and the PO restate it (`convertListPrice`), so a planned PO
 * reads the same figure it lands in the cart with. Beside it sits the base
 * equivalent at today's rate, so vendors in different currencies compare at a
 * glance. A plan that spans currencies totals in the base currency, as the
 * cart's Order Summary does; a plan in one currency keeps its total in it. */

export const PLANNER_PRICE_CURRENCY = 'USD';

/** A planner price (USD) in the vendor's currency. */
export function plannerUnit(usd: number, vendorName: string | null | undefined) {
  const currency = vendorCurrency(vendorName);
  return { currency, amount: convertListPrice(usd, PLANNER_PRICE_CURRENCY, currency) };
}

/** A planned line: its unit price and total in the vendor's currency, the
 *  total as the PO computes it (the converted unit price × quantity). */
export function plannerLine(usdUnit: number, qty: number, vendorName: string | null | undefined) {
  const { currency, amount } = plannerUnit(usdUnit, vendorName);
  return { currency, unit: amount, total: roundTo(currency, amount * qty) };
}

export interface PlannerLineInput {
  usdUnit: number;
  qty: number;
  vendorName: string | null | undefined;
}

export interface PlannerTotal {
  currency: string;
  value: number;
  /** How many vendor currencies went into it. */
  currencies: number;
}

/** A plan's total, as the cart totals one: in its one currency, or in base
 *  (each vendor's amount at today's rate) when it spans several. */
export function plannerTotal(lines: PlannerLineInput[]): PlannerTotal {
  const priced = lines.map((l) => plannerLine(l.usdUnit, l.qty, l.vendorName));
  const codes = new Set(priced.map((l) => l.currency));
  if (codes.size === 1) {
    const [currency] = codes;
    return { currency, value: roundTo(currency, priced.reduce((s, l) => s + l.total, 0)), currencies: 1 };
  }
  const value = priced.reduce((s, l) => s + toBaseToday(l.total, l.currency), 0);
  return { currency: BASE_CURRENCY, value: roundTo(BASE_CURRENCY, value), currencies: codes.size };
}

export const formatPlannerTotal = (t: PlannerTotal) => formatMoney(t.value, t.currency);

/** A plan total as a KPI: ₨1.2M · €48K. */
export const formatPlannerTotalCompact = (t: PlannerTotal) => formatCompactMoney(t.value, t.currency);

/** A planner price as text: "€110.43". */
export const formatPlannerUnit = (usd: number, vendorName: string | null | undefined) => {
  const { currency, amount } = plannerUnit(usd, vendorName);
  return formatMoney(amount, currency);
};

/** A vendor amount in its currency, with the rate hover (today's rate: it
 *  isn't on a PO yet). */
export function VendorMoney({ value, currency, className }: { value: number; currency: string; className?: string }) {
  return <Money value={value} currency={currency} fx={todayFx(currency)} role="vendor currency" className={className} />;
}

/** A planner price (USD) shown in the vendor's currency. */
export function PlannerPrice({ usd, vendorName, className }: { usd: number; vendorName: string | null | undefined; className?: string }) {
  const { currency, amount } = plannerUnit(usd, vendorName);
  return <VendorMoney value={amount} currency={currency} className={className} />;
}

/** A plan total where there's no room for the note under it: a one-currency
 *  total wears the rate hover; a total in base across currencies says so on
 *  hover. */
export function PlannerTotalAmount({ total, className = '' }: { total: PlannerTotal; className?: string }) {
  if (total.currencies > 1) {
    return (
      <span
        className={`tabular-nums cursor-help ${className}`}
        title={`In ${BASE_CURRENCY}, base currency · ${total.currencies} currencies converted at today's rate`}
      >
        {formatPlannerTotal(total)}
      </span>
    );
  }
  return <VendorMoney value={total.value} currency={total.currency} className={className} />;
}

/** "≈ ₨33,412.00": a foreign amount's base equivalent at today's rate.
 *  Nothing for an amount already in base. */
export function BaseApprox({ value, currency, className = '' }: { value: number; currency: string; className?: string }) {
  if (isBaseCurrency(currency)) return null;
  return (
    <span className={`whitespace-nowrap tabular-nums text-slate-400 ${className}`} title={`In ${BASE_CURRENCY} (base) at today's rate`}>
      ≈ {formatMoney(toBaseToday(value, currency), BASE_CURRENCY)}
    </span>
  );
}

/** Under a plan total, as under the cart's: its base equivalent, or that it
 *  is in base because the plan spans currencies. Nothing for a base total. */
export function PlannerTotalNote({ total, className = '' }: { total: PlannerTotal; className?: string }) {
  if (total.currencies <= 1 && isBaseCurrency(total.currency)) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] text-slate-500 ${className}`} style={{ lineHeight: 1.4 }}>
      <CurrencyFlag code={BASE_CURRENCY} size={11} />
      {total.currencies > 1 ? (
        <span>
          In {BASE_CURRENCY}, base currency · {total.currencies} currencies converted at today's rate
        </span>
      ) : (
        <span className="tabular-nums">
          ≈ {formatMoney(toBaseToday(total.value, total.currency), BASE_CURRENCY)} {BASE_CURRENCY} at today's rate
        </span>
      )}
    </span>
  );
}
