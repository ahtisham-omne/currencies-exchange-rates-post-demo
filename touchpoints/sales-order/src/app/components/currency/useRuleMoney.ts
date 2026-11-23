import type { PricingRuleTier } from "@/app/components/so/pricingRulesData";
import { useDocCurrency, useDocView } from "./docCurrencyContext";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, moneyPrefix } from "@/app/currency/money";
import { toBase } from "@/app/currency/rates";
import { RULE_AMOUNT_CURRENCY, ruleAmountFactor, todayRate } from "@/app/currency/soFx";

/* ─── Rule tiers and impacts in money ────────────────────────────────
   A "%" tier reads "7%". A fixed-amount tier ("$" in the data) is an amount
   per unit written in the base currency (RULE_AMOUNT_CURRENCY, PKR; Currency
   Touchpoints Map, 24 Nov 2026); on an SO in another currency its amount at
   the SO's rate rides along: "₨56,000.00 (≈ $201.06)". Impacts are already
   in the SO's currency, and the threshold a line met is also shown in base
   terms ("≈ ₨123,540.00"). Shared by the rule cards, the create form and
   the price breakdown. */
type TierAmount = Pick<PricingRuleTier, "rate" | "unit">;

export function useRuleMoney() {
  const { currency, fx } = useDocCurrency();
  const view = useDocView();
  const inBase = view.inBase;
  // Outside an SO (no rate yet) today's rate stands in.
  const rate = fx?.rate ?? todayRate(currency);
  const factor = ruleAmountFactor({ currency, rate });
  const isRuleCurrency = currency === RULE_AMOUNT_CURRENCY;
  const isBase = isBaseCurrency(currency);

  const tierRate = (t: TierAmount) =>
    t.unit === "%" ? `${t.rate}%` : formatMoney(t.rate, RULE_AMOUNT_CURRENCY);
  const tierConverted = (t: TierAmount) =>
    t.unit === "%" || isRuleCurrency ? null : `≈ ${formatMoney(t.rate * factor, currency)}`;

  return {
    currency,
    /** Base-currency fixed amounts → the SO's currency, at its rate (evaluateRuleForLine / computeLineBreakdowns). */
    factor,
    /** An amount in the SO's currency, shown in the page's currency. */
    money: (n: number) => formatMoney(view.toView(n), view.viewCurrency),
    /** "7%" · "₨56,000.00" */
    tierRate,
    /** "7%" · "₨56,000" — hero chips and tier pills. */
    tierShort: (t: TierAmount) =>
      t.unit === "%" || !Number.isInteger(t.rate) ? tierRate(t) : `${moneyPrefix(RULE_AMOUNT_CURRENCY)}${t.rate.toLocaleString("en-US")}`,
    /** "≈ $201.06": a fixed tier in the SO's currency; null for "%" or a base-currency SO. */
    tierConverted,
    /** "7%" · "₨56,000.00 (≈ $201.06)" */
    tierText: (t: TierAmount) => {
      const converted = tierConverted(t);
      return converted ? `${tierRate(t)} (${converted})` : tierRate(t);
    },
    /** "25–49 units" · "20+ units" */
    tierBand: (t: Pick<PricingRuleTier, "minQty" | "maxQty">) =>
      t.maxQty === null ? `${t.minQty}+ units` : `${t.minQty}–${t.maxQty} units`,
    /** "≈ €243.78" or "≈ ₨123,540.00": an SO amount in the currency the page
     *  isn't showing (the customer's in base view, base in the customer's);
     *  null on a base-currency SO. */
    baseText: (amount: number) =>
      isBase ? null : inBase ? `≈ ${formatMoney(amount, currency)}` : `≈ ${formatMoney(toBase(amount, rate), BASE_CURRENCY)}`,
  };
}
