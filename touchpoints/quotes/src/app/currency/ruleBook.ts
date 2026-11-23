import { BASE_CURRENCY } from './currencies';
import { formatMoney, moneyPrefix } from './money';

/* ── The pricing-rule book in the base currency ───────────────────────
 * Currency Touchpoints Map, Partners 5–6 (decision 9 for every module with
 * its own copy of the rules): a pricing rule has no currency of its own; it
 * is created in the company's base currency (PKR). Value thresholds and
 * fixed amounts are PKR. The design's seeded and template amounts are
 * written in USD; each is restated ×280 exactly, the spec's own factor
 * ($750 → ₨210,000, $2,500 → ₨700,000, $3,000 → ₨840,000, $10,000 →
 * ₨2,800,000), so every module restates the same way. Percentages and
 * quantity (volume) bands don't change. On a quote in another currency the
 * value threshold is checked in base (the quote's total × its rate) and a
 * fixed amount converts to the quote's currency at the quote's rate
 * (qFx.ts ruleAmountFactor). */

/** The spec's factor for restating the rule book's USD seeds in PKR. */
export const RULE_SEED_FACTOR = 280;

const PREFIX = moneyPrefix(BASE_CURRENCY);

const trimNumber = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

/**
 * The design's "$" amounts in a rule-book text, restated in the base
 * currency ×280: "10% off on orders over $1,000" → "… over ₨280,000";
 * "$1K to $25K" → "₨280K to ₨7M"; "$ 5,000" → "₨1,400,000". Other text is
 * left as it is.
 */
export function restateUsdText(text: string): string;
export function restateUsdText(text: string | undefined): string | undefined;
export function restateUsdText(text: string | undefined): string | undefined {
  if (!text || !text.includes('$')) return text;
  return text.replace(/\$\s?(\d+(?:,\d{3})*(?:\.\d+)?)\s?([KkMm])?(?![\w])/g, (_m, num: string, unit?: string) => {
    const n = Number(num.replace(/,/g, '')) * RULE_SEED_FACTOR;
    if (unit) {
      const v = n * (unit.toLowerCase() === 'm' ? 1e6 : 1e3);
      return v >= 1e6 ? `${PREFIX}${trimNumber(v / 1e6)}M` : `${PREFIX}${trimNumber(v / 1e3)}K`;
    }
    return `${PREFIX}${trimNumber(n)}`;
  });
}

/** A tier's upper limit restated. The design ends a tier one dollar below the
 *  next ("$4,999" before "$5,000"); ×280 would leave a gap (₨1,399,720 before
 *  ₨1,400,000), so such a limit ends one rupee below the next tier instead
 *  (₨1,399,999), as Partners and Sales Orders store theirs. */
function restateMax(text: string | undefined): string | undefined {
  const m = text?.trim().match(/^\$\s?(\d+(?:,\d{3})*)$/);
  if (!m) return restateUsdText(text);
  const n = Number(m[1].replace(/,/g, ''));
  return (n + 1) % 1000 === 0 ? `${PREFIX}${trimNumber((n + 1) * RULE_SEED_FACTOR - 1)}` : restateUsdText(text);
}

/** A tier's amounts and threshold restated (see restateUsdText). */
export function restateTier<T extends { minQty?: string; maxQty?: string; minValue?: string; maxValue?: string; discount: string }>(tier: T): T {
  return {
    ...tier,
    ...(tier.minQty !== undefined && { minQty: restateUsdText(tier.minQty) }),
    ...(tier.maxQty !== undefined && { maxQty: restateMax(tier.maxQty) }),
    ...(tier.minValue !== undefined && { minValue: restateUsdText(tier.minValue) }),
    ...(tier.maxValue !== undefined && { maxValue: restateMax(tier.maxValue) }),
    discount: restateUsdText(tier.discount),
  };
}

/** True for a fixed-amount tier text ("₨14,000", or the design's "$50"). */
export const isFixedAmountText = (text: string | null | undefined) =>
  !!text && (text.includes(PREFIX) || text.includes('$'));

/** The number in a rule-book text: "₨700,000" → 700000; "100 EA" → 100;
 *  "₨2.8M" → 2,800,000. Null when there is none. */
export function ruleNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s?([KkMm])?/);
  if (!m) return null;
  const unit = m[2]?.toLowerCase();
  return Number(m[1]) * (unit === 'm' ? 1e6 : unit === 'k' ? 1e3 : 1);
}

/** The highest value tier a base-currency total reaches, if any. */
export function pickValueTier<T extends { minQty: string; maxQty: string }>(tiers: T[], baseTotal: number): T | undefined {
  let best: { tier: T; min: number } | undefined;
  for (const tier of tiers) {
    const min = ruleNumber(tier.minQty) ?? 0;
    if (baseTotal < min) continue;
    if (!best || min >= best.min) best = { tier, min };
  }
  return best?.tier;
}

/** "₨700,000" for a threshold in the base currency, whole. */
export const formatThreshold = (n: number) => formatMoney(Math.round(n), BASE_CURRENCY).replace(/\.00$/, '');
