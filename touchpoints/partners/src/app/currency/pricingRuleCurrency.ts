import { BASE_CURRENCY, getCurrency, isBaseCurrency } from "./currencies";
import { formatRate, moneyPrefix } from "./money";
import { exampleDocumentCurrency, rateNow } from "./partnerCurrency";
import { toBase, type RateType } from "./rates";

/* ── Pricing rules are in the base currency ───────────────────────────
 * Currency Touchpoints Map, Partners §5–6 (24 Nov 2026; Eli, 24 Apr): a
 * rule is created in the company's base currency, whatever it is, with no
 * currency pick. Value thresholds and fixed amounts are base amounts;
 * percentages and volume (quantity) tiers have no currency. On a document
 * in another currency the threshold is checked in base (document total ×
 * the document's rate) and a fixed amount is converted to the document's
 * currency at that rate. */

export const RULE_CURRENCY = BASE_CURRENCY;

/** The design wrote its seeded and template amounts in US dollars. They are
 *  restated in base at ×280 exactly, the spec's own factor ($750 → ₨210,000,
 *  $2,500 → ₨700,000, $10,000 → ₨2,800,000), the same in every module. */
export const USD_RESTATE_FACTOR = 280;

const PREFIX = moneyPrefix(RULE_CURRENCY);
/** The base currency's symbol, for the % / ₨ switch on a tier. */
export const RULE_SYMBOL = PREFIX.trim();
/** The fixed side of a tier's % / ₨ switch. */
export const RULE_FIXED_TOOLTIP = (_kind: "Discount" | "Premium") =>
  `Fixed amount in ${getCurrency(RULE_CURRENCY)?.name ?? RULE_CURRENCY}s (${RULE_CURRENCY}), your base currency`;

/** One line for forms and tooltips. */
export const RULE_CURRENCY_NOTE = `All money amounts in this rule are in ${RULE_CURRENCY}.`;
/** The Currency field's info tooltip. */
export const RULE_CURRENCY_TOOLTIP = `Pricing rules always use ${RULE_CURRENCY}, your base currency. They still work on orders in other currencies. The amounts are converted to the order's currency.`;

/** A rule amount: "₨210,000", "₨14,000.50". */
export function formatRuleAmount(n: number): string {
  const abs = Math.abs(n);
  const whole = Math.abs(abs - Math.round(abs)) < 0.005;
  const text = abs.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  return `${n < 0 ? "−" : ""}${PREFIX}${text}`;
}

const LEGACY_USD = /^\$\s*([\d,]+(?:\.\d+)?)(.*)$/;

/** A tier value as shown: base amounts, "100 EA" and "5%" as written. An
 *  amount still written in dollars (from before rules moved to base) is
 *  restated in base, so no "$" reaches the screen. */
export function ruleTierText(v: string | undefined): string {
  if (!v) return "—";
  const m = v.trim().match(LEGACY_USD);
  if (!m) return v;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? `${formatRuleAmount(n * USD_RESTATE_FACTOR)}${m[2]}` : v;
}

/** The number in a stored rule amount, for a form field ("₨280,000" → "280,000"). */
export function ruleInputValue(v: string | undefined): string {
  if (!v) return "";
  return ruleTierText(v).replace(PREFIX, "").trim();
}

/** Whether a tier's adjustment is a fixed amount (₨14,000) rather than a percentage. */
export function isFixedRuleAmount(v: string | undefined): boolean {
  if (!v || v.trim().endsWith("%")) return false;
  return v.includes(PREFIX) || LEGACY_USD.test(v.trim());
}

/** A typed amount as a rule stores it: "280000" or "280,000" → "₨280,000". Blank stays blank. */
export function ruleAmountFromInput(typed: string | undefined): string {
  const n = parseFloat((typed ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? formatRuleAmount(n) : "";
}

/** The base amount in a stored rule value; null for quantities, percentages and blanks. */
export function ruleAmountValue(v: string | undefined): number | null {
  if (!v || !isFixedRuleAmount(v)) return null;
  const n = parseFloat(ruleTierText(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/* ── How a value rule meets a document in another currency ────────────
 * The spec's worked example ("On a USD PO for $3,000: in base currency
 * Rs 835,560; over Rs 700,000? Yes, 12% applies; discount $360.00 USD"),
 * computed for a partner's currency at today's rate of its default type. */

export interface RuleTierLike {
  minQty?: string;
  maxQty?: string;
  discount?: string;
}

export interface RuleDocumentExample {
  currency: string;
  rate: number;
  rateType: RateType;
  /** The document's total, in its currency. */
  documentTotal: number;
  /** documentTotal × rate. */
  baseTotal: number;
  /** The threshold checked, in base: the first tier's minimum (or its maximum when it has none). */
  threshold: number;
  thresholdKind: "over" | "under";
  /** The tier the base total falls in, or -1. */
  tierIndex: number;
  /** "12%" or "₨14,000". */
  adjustmentText?: string;
  /** The adjustment in the document's currency. */
  adjustment?: number;
}

/** A tier as the create-rule forms hold it: typed numbers, with the % / ₨
 *  switch (fixRate) and the Order Value Limits checkbox (qtyLimits). */
export interface RuleFormTier {
  discount: string;
  fixRate: boolean;
  qtyLimits?: boolean;
  minQty: string;
  maxQty: string;
}

/** A value-based rule's form tiers as stored tier values ("₨280,000", "12%"),
 *  for the worked example while the rule is being created. Limits count only
 *  while the tier's Order Value Limits box is ticked. */
export function ruleTiersFromForm(tiers: RuleFormTier[]): RuleTierLike[] {
  return tiers.map((t) => {
    const limits = t.qtyLimits !== false;
    const pct = (t.discount ?? "").replace(/%$/, "").trim();
    return {
      minQty: limits ? ruleAmountFromInput(t.minQty) : "",
      maxQty: limits ? ruleAmountFromInput(t.maxQty) : "",
      discount: !pct ? "" : t.fixRate ? ruleAmountFromInput(pct) : `${pct}%`,
    };
  });
}

/** The currency a rule's worked example is shown in (see exampleDocumentCurrency). */
export const ruleExampleCurrency = exampleDocumentCurrency;

/** The smallest one-significant-figure amount strictly above x ($2,513 → $3,000). */
function roundAbove(x: number): number {
  if (!(x > 0)) return 1;
  const step = 10 ** Math.floor(Math.log10(x));
  const n = Math.ceil(x / step) * step;
  return n > x ? n : n + step;
}

export function ruleDocumentExample(tiers: RuleTierLike[], currency: string, rateType: RateType): RuleDocumentExample | null {
  if (!tiers.length || isBaseCurrency(currency)) return null;
  const quote = rateNow(currency, rateType);
  const rate = quote.rate;
  if (!rate) return null;
  const bounds = tiers.map((t) => ({ min: ruleAmountValue(t.minQty), max: ruleAmountValue(t.maxQty) }));
  const first = bounds.find((b) => (b.min ?? 0) > 0 || b.max != null);
  if (!first) return null;
  const over = (first.min ?? 0) > 0;
  const threshold = over ? first.min! : first.max!;
  const documentTotal = roundAbove(over ? threshold / rate : threshold / rate / 2);
  const baseTotal = toBase(documentTotal, rate);
  let tierIndex = -1;
  bounds.forEach((b, i) => {
    if (baseTotal >= (b.min ?? 0) && (b.max == null || baseTotal <= b.max)) tierIndex = i;
  });
  const result: RuleDocumentExample = {
    currency, rate, rateType: quote.type, documentTotal, baseTotal, threshold, thresholdKind: over ? "over" : "under", tierIndex,
  };
  const adj = tierIndex >= 0 ? tiers[tierIndex].discount : undefined;
  if (adj) {
    const fixed = ruleAmountValue(adj);
    const pct = parseFloat(adj.replace(/[^\d.]/g, ""));
    if (fixed != null) {
      result.adjustmentText = formatRuleAmount(fixed);
      result.adjustment = fixed / rate;
    } else if (Number.isFinite(pct)) {
      result.adjustmentText = `${pct}%`;
      result.adjustment = (documentTotal * pct) / 100;
    }
  }
  return result;
}

/** "1 USD = ₨278.5200 PKR" */
export const baseRateSentence = (code: string, rate: number) =>
  `1 ${code.toUpperCase()} = ${moneyPrefix(BASE_CURRENCY)}${formatRate(rate)} ${BASE_CURRENCY}`;
