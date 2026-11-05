/* ═══════════════════════════════════════════════════════════════
   PLANNER PRICING-RULE BADGE

   The compact discount/premium label shown on each qualified-vendor
   card, plus the rich detail card revealed on hover. Both mirror the
   Partner Manager's pricing-rule design (PricingRulesTab):

     · Label  — green "Discount" / violet "Premium" pill carrying the
       rate and the CONDITION that unlocks it ("60+ EA", "$1,000+",
       or a relationship like "Net 30 terms").
     · Hover  — name + calculation basis + the full tier ladder
       (numbered min–max → rate rows) + an "about this rule" blurb.

   The condition shown here matches how `effectivePrice` actually
   applies the rule: a volume rule's discount is earned once the order
   reaches the tier's threshold.
   ═══════════════════════════════════════════════════════════════ */

import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import type { PlannerPricingRule } from "./plannerData";

/* Exact Partner-Manager palette (PricingRulesTab `theme`). */
const THEME = {
  discount: { text: "#047857", bg: "#ECFDF5", border: "#A7F3D0", pillBg: "#ECFDF5", pillBorder: "#D1FAE5" },
  premium: { text: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE", pillBg: "#F5F3FF", pillBorder: "#EDE9FE" },
} as const;

const asPct = (rate: number) => `${Math.round(rate * 1000) / 10}%`.replace(".0%", "%");
const fmtNum = (n: number) => n.toLocaleString("en-US");

/** A single tier's qty/value span, e.g. "60 – 149 EA" or "$1,000+". */
function tierRange(rule: PlannerPricingRule, tier: { minQty: number; maxQty: number | null }, uom: string): string {
  if (rule.conditionBasis === "value") {
    const lo = `$${fmtNum(tier.minQty)}`;
    return tier.maxQty == null ? `${lo}+` : `${lo} – $${fmtNum(tier.maxQty)}`;
  }
  const lo = fmtNum(tier.minQty);
  return tier.maxQty == null ? `${lo}+ ${uom}` : `${lo} – ${fmtNum(tier.maxQty)} ${uom}`;
}

/** The entry threshold shown inline on the label ("60+ EA" / "$1,000+"). */
function entryCondition(rule: PlannerPricingRule, uom: string): string | null {
  if (rule.tiers && rule.tiers.length > 0 && rule.conditionBasis) {
    const first = rule.tiers[0];
    return rule.conditionBasis === "value" ? `$${fmtNum(first.minQty)}+` : `${fmtNum(first.minQty)}+ ${uom}`;
  }
  // Always-on rule — fall back to its short description as the context.
  return rule.description ?? null;
}

/** Headline rate for the label — a single rate, or "up to N%" for a ladder. */
function headlineRate(rule: PlannerPricingRule): string {
  if (rule.tiers && rule.tiers.length > 0) {
    const max = Math.max(...rule.tiers.map((t) => t.rate));
    return rule.tiers.length > 1 ? `up to ${asPct(max)}` : asPct(rule.tiers[0].rate);
  }
  return asPct(rule.amount);
}

function PlannerPricingRuleBadge({ rule, uom }: { rule: PlannerPricingRule; uom: string }) {
  const isDis = rule.ruleType === "discount";
  const theme = isDis ? THEME.discount : THEME.premium;
  const typeLabel = isDis ? "Discount" : "Premium";
  const rate = headlineRate(rule);
  const condition = entryCondition(rule, uom);
  const tiered = !!(rule.tiers && rule.tiers.length > 0 && rule.conditionBasis);

  const basisLine = tiered
    ? `${rule.conditionBasis === "value" ? "Value-based" : "Volume-based"} · ${rule.tiers!.length} tier${rule.tiers!.length === 1 ? "" : "s"}`
    : "Applies to every order";

  return (
    <HoverCard openDelay={140} closeDelay={90}>
      <HoverCardTrigger asChild>
        <span
          className="inline-flex shrink-0 cursor-default items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none"
          style={{ backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }}
        >
          {typeLabel}
          <span className="opacity-50">·</span>
          {rate}
          {condition && (
            <>
              <span className="opacity-50">·</span>
              <span className="font-medium opacity-80">{condition}</span>
            </>
          )}
        </span>
      </HoverCardTrigger>

      <HoverCardContent align="start" sideOffset={6} className="w-72 overflow-hidden p-0">
        {/* Header — type pill + rule name + basis */}
        <div className="px-3.5 pb-3 pt-3.5">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none"
              style={{ backgroundColor: theme.pillBg, color: theme.text, borderColor: theme.pillBorder }}
            >
              {typeLabel}
            </span>
            <span className="truncate text-[13px] font-semibold text-slate-900">
              {rule.ruleName ?? `${typeLabel} rule`}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{basisLine}</p>
        </div>

        {/* Tier ladder (or the flat rate for an always-on rule) */}
        <div className="border-t border-slate-100 px-3.5 py-3">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-700">{tiered ? "Tiers" : "Rate"}</span>
            {tiered && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                {rule.tiers!.length}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {tiered ? (
              rule.tiers!.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-[#FAFBFC] px-2.5 py-1.5"
                >
                  <span className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span
                      className="grid h-4 w-4 place-items-center rounded text-[9px] font-bold"
                      style={{ backgroundColor: theme.bg, color: theme.text }}
                    >
                      {i + 1}
                    </span>
                    {tierRange(rule, t, uom)}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-slate-900">{asPct(t.rate)}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-[#FAFBFC] px-2.5 py-1.5">
                <span className="text-[11px] text-slate-600">{rule.description ?? "Every order"}</span>
                <span className="text-[11px] font-semibold tabular-nums text-slate-900">{asPct(rule.amount)}</span>
              </div>
            )}
          </div>
        </div>

        {/* About */}
        {rule.aboutText && (
          <p className="border-t border-slate-100 bg-slate-50/60 px-3.5 py-2.5 text-[11px] leading-[1.5] text-slate-500">
            {rule.aboutText}
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export default PlannerPricingRuleBadge;
