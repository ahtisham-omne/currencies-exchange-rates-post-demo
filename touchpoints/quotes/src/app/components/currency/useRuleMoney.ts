import type { PricingRuleTier } from "@/app/components/quote-details/pricingRulesData";
import { useDocCurrency, useDocView } from "./docCurrencyContext";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, moneyPrefix } from "@/app/currency/money";
import { toBase } from "@/app/currency/rates";
import { RULE_AMOUNT_CURRENCY, ruleAmountFactor, todayRate } from "@/app/currency/qFx";

/* ─── Rule tiers and impacts in money ────────────────────────────────
   A "%" tier reads "7%". A fixed-amount ("$") tier is an amount per unit
   that the rule book writes in the base currency (RULE_AMOUNT_CURRENCY,
   Currency Touchpoints Map, Partners 5–6); on a quote in another currency
   its amount at the quote's rate rides along: "₨56,000.00 (≈ $201.06)".
   Impacts are kept in the quote's currency and shown in the page's (base),
   with the quote's beside them ("≈ €243.78"). Shared by the rule cards, the
   create form and the price breakdown. */
type TierAmount = Pick<PricingRuleTier, "rate" | "unit">;

export function useRuleMoney() {
  const { currency, fx } = useDocCurrency();
  const view = useDocView();
  const inBase = view.inBase;
  // Outside a quote (no rate yet) today's rate stands in.
  const rate = fx?.rate ?? todayRate(currency);
  // A base amount in the quote's currency, at the quote's rate.
  const factor = ruleAmountFactor({ currency, rate });
  const isBase = isBaseCurrency(currency);

  const tierRate = (t: TierAmount) =>
    t.unit === "%" ? `${t.rate}%` : formatMoney(t.rate, RULE_AMOUNT_CURRENCY);
  const tierConverted = (t: TierAmount) =>
    t.unit === "%" || isBase ? null : `≈ ${formatMoney(t.rate * factor, currency)}`;

  return {
    currency,
    /** The quote's rate to base: a value threshold is checked at it. */
    rate,
    /** Base fixed amounts → the quote's currency (evaluateRuleForLine / computeLineBreakdowns). */
    factor,
    /** An amount in the quote's currency, shown in the page's currency. */
    money: (n: number) => formatMoney(view.toView(n), view.viewCurrency),
    /** "7%" · "₨56,000.00" */
    tierRate,
    /** "7%" · "₨56,000" — hero chips and tier pills. */
    tierShort: (t: TierAmount) =>
      t.unit === "%" || !Number.isInteger(t.rate) ? tierRate(t) : `${moneyPrefix(RULE_AMOUNT_CURRENCY)}${t.rate.toLocaleString("en-US")}`,
    /** "≈ $201.06": a fixed tier in the quote's currency; null for "%" or a base-currency quote. */
    tierConverted,
    /** "7%" · "₨56,000.00 (≈ $201.06)" */
    tierText: (t: TierAmount) => {
      const converted = tierConverted(t);
      return converted ? `${tierRate(t)} (${converted})` : tierRate(t);
    },
    /** "25–49 units" · "20+ units" */
    tierBand: (t: Pick<PricingRuleTier, "minQty" | "maxQty">) =>
      t.maxQty === null ? `${t.minQty}+ units` : `${t.minQty}–${t.maxQty} units`,
    /** "≈ €243.78" or "≈ ₨123,540.00": a quote amount in the currency the
     *  page isn't showing (the customer's in base view, base in the
     *  customer's); null on a base-currency quote. */
    baseText: (amount: number) =>
      isBase ? null : inBase ? `≈ ${formatMoney(amount, currency)}` : `≈ ${formatMoney(toBase(amount, rate), BASE_CURRENCY)}`,
    /** The code baseText is in. */
    otherCode: inBase ? currency : BASE_CURRENCY,
  };
}
