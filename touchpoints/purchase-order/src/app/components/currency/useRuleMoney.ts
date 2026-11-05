import type { PricingRuleTier } from "../poPricingRulesData";
import { useDocCurrency } from "./docCurrencyContext";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, moneyPrefix } from "@/app/currency/money";
import { toBase } from "@/app/currency/rates";
import { RULE_AMOUNT_CURRENCY, localTodayIso, ruleAmountFactor, todayRate } from "@/app/currency/poFx";

/* ─── Rule tiers and impacts in money ────────────────────────────────
   A "%" tier reads "7%". A "$" tier is a flat amount per unit that the
   rule book writes in USD (RULE_AMOUNT_CURRENCY, as Partners does); on a
   PO in another currency its converted amount rides along:
   "$15.00 (≈ €13.71)". Impacts are already in the PO's currency, and the
   threshold a line met is also shown in base terms ("≈ ₨123,540.00").
   Shared by the rule cards, the create form and the price breakdown. */
type TierAmount = Pick<PricingRuleTier, "rate" | "unit">;

export function useRuleMoney() {
  const { currency, fx } = useDocCurrency();
  // Outside a PO (no rate yet) today's rate stands in.
  const rate = fx?.rate ?? todayRate(currency);
  const factor = ruleAmountFactor({ currency, rateDate: fx?.rateDate ?? localTodayIso() });
  const isRuleCurrency = currency === RULE_AMOUNT_CURRENCY;
  const isBase = isBaseCurrency(currency);

  const tierRate = (t: TierAmount) =>
    t.unit === "%" ? `${t.rate}%` : formatMoney(t.rate, RULE_AMOUNT_CURRENCY);
  const tierConverted = (t: TierAmount) =>
    t.unit === "%" || isRuleCurrency ? null : `≈ ${formatMoney(t.rate * factor, currency)}`;

  return {
    currency,
    /** USD flat amounts → the PO's currency (evaluateRuleForLine / computeLineBreakdowns). */
    factor,
    /** An amount already in the PO's currency. */
    money: (n: number) => formatMoney(n, currency),
    /** "7%" · "$15.00" */
    tierRate,
    /** "7%" · "$15" — hero chips and tier pills. */
    tierShort: (t: TierAmount) =>
      t.unit === "%" || !Number.isInteger(t.rate) ? tierRate(t) : `${moneyPrefix(RULE_AMOUNT_CURRENCY)}${t.rate}`,
    /** "≈ €13.71": a "$" tier in the PO's currency; null for "%" or a USD PO. */
    tierConverted,
    /** "7%" · "$15.00 (≈ €13.71)" */
    tierText: (t: TierAmount) => {
      const converted = tierConverted(t);
      return converted ? `${tierRate(t)} (${converted})` : tierRate(t);
    },
    /** "25–49 units" · "20+ units" */
    tierBand: (t: Pick<PricingRuleTier, "minQty" | "maxQty">) =>
      t.maxQty === null ? `${t.minQty}+ units` : `${t.minQty}–${t.maxQty} units`,
    /** "≈ ₨123,540.00": a PO amount in base; null on a base-currency PO. */
    baseText: (amount: number) => (isBase ? null : `≈ ${formatMoney(toBase(amount, rate), BASE_CURRENCY)}`),
  };
}
