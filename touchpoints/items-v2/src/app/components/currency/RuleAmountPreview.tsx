import { BASE_CURRENCY } from '@/app/currency/currencies';
import { formatMoney } from '@/app/currency/money';
import { priceFromBase, priceInBase, vendorRate } from '@/app/currency/vendorFx';

/** Pricing rules are written in USD, as the rule templates are (as in Partners). */
export const RULE_CURRENCY = 'USD';

/**
 * Under a pricing-rule amount: what it is in the vendor's currency at
 * today's mid-market rate, or in base when the vendor trades in USD too.
 */
export function RuleAmountPreview({ raw, to }: { raw: string; to: string | null | undefined }) {
  const n = parseFloat(raw.replace(/,/g, ''));
  if (!Number.isFinite(n) || n === 0) return null;
  const vendor = (to || RULE_CURRENCY).toUpperCase();
  const target = vendor === RULE_CURRENCY ? BASE_CURRENCY : vendor;
  const value = priceFromBase(priceInBase(n, vendorRate(RULE_CURRENCY).rate), vendorRate(target).rate, target);
  const text = formatMoney(value, target);
  return (
    <p className="text-[10.5px] text-slate-400 mt-1 tabular-nums" style={{ fontWeight: 400 }}>
      ≈ {text.includes(target) ? text : `${text} ${target}`} <span className="text-slate-300">· at today's rate</span>
    </p>
  );
}
