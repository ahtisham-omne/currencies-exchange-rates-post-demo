import type { PricingRuleTier, RuleBasis } from "../poPricingRulesData";
import { useDocCurrency, useDocView } from "./docCurrencyContext";
import { BASE_CURRENCY, isBaseCurrency } from "@/app/currency/currencies";
import { formatMoney, moneyPrefix } from "@/app/currency/money";
import { toBase } from "@/app/currency/rates";
import { RULE_AMOUNT_CURRENCY, localTodayIso, ruleAmountFactor, todayRate } from "@/app/currency/poFx";

/* ─── Rule tiers and impacts in money ────────────────────────────────
   A "%" tier reads "7%". A "$" tier is a flat amount per unit in the base
   currency (RULE_AMOUNT_CURRENCY; rules have no currency of their own); on
   a PO in another currency its converted amount, at the PO's rate, rides
   along: "₨4,200.00 (≈ $15.08)". Impacts are already in the PO's currency,
   and the threshold a line met is also shown in base terms ("≈ ₨123,540.00").
   A value-based rule's bands are order values in base ("₨700,000+ order
   value"). Shared by the rule cards, the create form and the price breakdown. */
type TierAmount = Pick<PricingRuleTier, "rate" | "unit">;

/** "₨210,000": a band edge of a value-based rule. */
const valueEdge = (n: number) => `${moneyPrefix(RULE_AMOUNT_CURRENCY)}${n.toLocaleString("en-US")}`;

/** A band edge as the rule cards write it: a quantity, or an order value. */
export const bandEdge = (n: number | null, basis?: RuleBasis) =>
  n === null ? "∞" : basis === "value" ? valueEdge(n) : String(n);

export function useRuleMoney() {
  const { currency, fx } = useDocCurrency();
  const view = useDocView();
  const inBase = view.inBase;
  // Outside a PO (no rate yet) today's rate stands in.
  const rate = fx?.rate ?? todayRate(currency);
  const factor = ruleAmountFactor({ currency, rate, rateDate: fx?.rateDate ?? localTodayIso() });
  const isRuleCurrency = currency === RULE_AMOUNT_CURRENCY;
  const isBase = isBaseCurrency(currency);

  const tierRate = (t: TierAmount) =>
    t.unit === "%" ? `${t.rate}%` : formatMoney(t.rate, RULE_AMOUNT_CURRENCY);
  const tierConverted = (t: TierAmount) =>
    t.unit === "%" || isRuleCurrency ? null : `≈ ${formatMoney(t.rate * factor, currency)}`;

  return {
    currency,
    /** Base flat amounts → the PO's currency (evaluateRuleForLine / computeLineBreakdowns). */
    factor,
    /** An amount in the PO's currency, shown in the page's currency. */
    money: (n: number) => formatMoney(view.toView(n), view.viewCurrency),
    /** "7%" · "₨4,200.00" */
    tierRate,
    /** "7%" · "₨4,200" — hero chips and tier pills. */
    tierShort: (t: TierAmount) =>
      t.unit === "%" || !Number.isInteger(t.rate) ? tierRate(t) : valueEdge(t.rate),
    /** "≈ $15.08": a "$" tier in the PO's currency; null for "%" or a base-currency PO. */
    tierConverted,
    /** "7%" · "₨4,200.00 (≈ $15.08)" */
    tierText: (t: TierAmount) => {
      const converted = tierConverted(t);
      return converted ? `${tierRate(t)} (${converted})` : tierRate(t);
    },
    /** "25–49 units" · "20+ units" · "₨700,000+ order value" */
    tierBand: (t: Pick<PricingRuleTier, "minQty" | "maxQty">, basis?: RuleBasis) =>
      basis === "value"
        ? t.maxQty === null
          ? `${valueEdge(t.minQty)}+ order value`
          : `${valueEdge(t.minQty)}–${valueEdge(t.maxQty)} order value`
        : t.maxQty === null
          ? `${t.minQty}+ units`
          : `${t.minQty}–${t.maxQty} units`,
    /** "≈ €243.78" or "≈ ₨123,540.00": a PO amount in the currency the page
     *  isn't showing (the vendor's in base view, base in the vendor's); null
     *  on a base-currency PO. */
    baseText: (amount: number) =>
      isBase ? null : inBase ? `≈ ${formatMoney(amount, currency)}` : `≈ ${formatMoney(toBase(amount, rate), BASE_CURRENCY)}`,
  };
}
