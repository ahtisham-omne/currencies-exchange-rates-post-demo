import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney, formatRate, moneyPrefix } from '@/app/currency/money';
import { settledCurrencyOf } from '@/app/currency/paymentFx';
import { bankRateOf, needsBankRate, paymentAccountCurrencyOf } from '@/app/currency/paymentLedger';
import { convertsAtBank, costInBase } from '@/app/currency/paymentRules';
import type { Payment } from '@/app/data/mockPayments';

/* ── A payment's rate, on the lists (27 Nov 2026, Mahreen 7e and 7f) ──
 * The Rate column on Payment History and on an invoice's Payments tab:
 *  - scheduled, converting at the bank: an "Estimate" chip, the rate it was
 *    scheduled at ("1 USD = ₨278.5200", or the direct pair from a third
 *    currency, "1 USD = 1.3935 CAD") and "≈ ₨…" in base under it. The bank's
 *    rate is entered when it's paid (Mark as paid), so the status cell says
 *    "Rate settles when paid";
 *  - paid, converting: the bank's rate and what it cost in base, plain;
 *  - from an account in the invoice's currency: "Same currency";
 *  - a base-currency payment, or a cancelled one: blank (no dash in a table). */

/** "1 USD = ₨278.5200", "1 USD = 1.3935 CAD". */
function shortRate(currency: string, accountCurrency: string, rate: number): string {
  return isBaseCurrency(accountCurrency)
    ? `1 ${currency} = ${moneyPrefix(BASE_CURRENCY).trim()}${formatRate(rate)}`
    : `1 ${currency} = ${formatRate(rate)} ${accountCurrency}`;
}

/** The text the cell prints, for a table's search. */
export function paymentRateText(p: Payment): string {
  const cur = settledCurrencyOf(p);
  if (isBaseCurrency(cur) || p.status === 'Cancelled') return '';
  const acc = paymentAccountCurrencyOf(p);
  if (!convertsAtBank(acc, cur)) return 'Same currency';
  const scheduled = p.status === 'Scheduled';
  return `${scheduled ? 'Estimate ' : ''}${shortRate(cur, acc, bankRateOf(p))} ${scheduled ? '≈ ' : ''}${formatMoney(costInBase(p), BASE_CURRENCY)}`;
}

export function EstimateChip() {
  return (
    <span
      className="inline-flex items-center px-1.5 py-px rounded border text-[10px] shrink-0"
      style={{ fontWeight: 600, color: '#475569', backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}
    >
      Estimate
    </span>
  );
}

export function PaymentRateCell({ payment }: { payment: Payment }) {
  const cur = settledCurrencyOf(payment);
  if (isBaseCurrency(cur) || payment.status === 'Cancelled') return null;
  const acc = paymentAccountCurrencyOf(payment);
  if (!convertsAtBank(acc, cur)) {
    return <span className="text-[12px] text-slate-500 whitespace-nowrap">Same currency</span>;
  }
  const scheduled = payment.status === 'Scheduled';
  return (
    <span className="inline-flex flex-col leading-tight min-w-0">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {scheduled && <EstimateChip />}
        <span className="tabular-nums text-foreground text-[12px]">{shortRate(cur, acc, bankRateOf(payment))}</span>
      </span>
      <span className="text-[10.5px] text-slate-400 tabular-nums whitespace-nowrap mt-0.5">
        {scheduled ? '≈ ' : ''}
        {formatMoney(costInBase(payment), BASE_CURRENCY)}
      </span>
    </span>
  );
}

/** Under a Scheduled status (Mahreen 7f): the bank's rate is known when
 *  it's paid. Only where the bank converts. */
export function RateSettlesNote({ payment }: { payment: Payment }) {
  if (!needsBankRate(payment)) return null;
  return <span className="block text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">Rate settles when paid</span>;
}
