import { BASE_CURRENCY, isBaseCurrency } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { RULE_CURRENCY } from '@/app/currency/ruleMoney';
import { priceFromBase, vendorRate } from '@/app/currency/vendorFx';

/** Pricing rules are in the base currency (Currency Touchpoints Map, Partners
 *  5–6). Re-exported for the rule form. */
export { RULE_CURRENCY };

/**
 * Under a pricing rule's fixed amount (in PKR): what it is in the vendor's
 * currency at today's rate, as a guide. On an order the amount converts at
 * that order's own rate. Nothing for a vendor in the base currency.
 */
export function RuleAmountPreview({ raw, to }: { raw: string; to: string | null | undefined }) {
  const n = parseFloat(raw.replace(/,/g, ''));
  if (!Number.isFinite(n) || n === 0) return null;
  const target = (to || BASE_CURRENCY).toUpperCase();
  if (isBaseCurrency(target)) return null;
  const value = priceFromBase(n, vendorRate(target).rate, target);
  const text = formatMoney(value, target);
  return (
    <p
      className="text-[10.5px] text-slate-400 mt-1 tabular-nums"
      style={{ fontWeight: 400 }}
      title={`Fixed amounts are in ${RULE_CURRENCY}. On an order in ${target}, they convert at the order's rate.`}
    >
      ≈ {text.includes(target) ? text : `${text} ${target}`} <span className="text-slate-300">· at today's rate</span>
    </p>
  );
}
